// 给收藏的句子配声音（ADR 0009 第十七块；原 ll:audio-provision 块）。
// 「家长收藏了一句」和「这句在他手机上有声音」之间的那一段。见 ADR 0003。
//
// 依赖从 create(deps) 传进来，之前都是直接抓全局：
//   api                    —— api-client.js 的实例（只用 raw()，要读二进制）
//   getAccessCode()        —— 没码就不花钱
//   getVoice() / cueVoiceId —— 英文用哪把嗓子、中文提示固定用哪把
//   hasAudio / putAudio / whichHaveAudio —— audio-store.js 的三个口
//   primeAudioUrl(id)      —— 存完之后把地址备好，不然播放路径找不到它
//   assignTranslationIds   —— translate-save.js 的（翻译一到就铸 id）
//   refreshAudioMarks()    —— 标记变了通知界面重画（可选）
//   isOnline()             —— 明知断网就不去撞超时
//
// 不碰 document / window，网络只经 api。普通脚本 + CommonJS 出口。
// 这里的三个 Set 只活在页面这一次生命周期里——重开之后靠 syncAudioMarks 从设备回填。
(function (root) {
  "use strict";

  function create(deps) {
    deps = deps || {};
    var api = deps.api;
    var getAccessCode = deps.getAccessCode || function () { return ""; };
    var getVoice = deps.getVoice || function () { return ""; };
    var cueVoiceId = deps.cueVoiceId || "";
    var hasAudio = deps.hasAudio || async function () { return false; };
    var putAudio = deps.putAudio || async function () { return false; };
    var whichHaveAudio = deps.whichHaveAudio || async function () { return new Set(); };
    var primeAudioUrl = deps.primeAudioUrl || function () {};
    var assignTranslationIds = deps.assignTranslationIds || function () {};
    var refreshAudioMarks = deps.refreshAudioMarks || function () {};
    var isOnline = deps.isOnline || function () { return true; };

    // Between "a parent saved a phrase" and "that phrase has a voice on their
    // phone". Depends on ll:audio-store below for the device half. See ADR 0003.
    //
    // The save lands FIRST and instantly; the voice catches up here, in the
    // background. The phrase text is the irreplaceable part — audio is an
    // enhancement, and making a parent wait three seconds on every save (or worse,
    // losing the save because the network was down) would be paying for audio with
    // the one thing the app is actually for. The job is 「别让我发起」 (jtbd.md);
    // friction at save time works directly against it.
    //
    // Nothing in here ever throws at its caller. saveTranslation() and
    // saveDictSense() call in and carry on.
    var audioPending = new Set();
    var audioFailed = new Set();
    var audioReady = new Set();

    // What the list should draw next to a row. Four states rather than two,
    // because "still working on it" and "this one has no sound" send a parent to
    // different places: one is worth waiting for, the other is worth tapping.
    //   none · pending ⏳ · ready 🔊 · failed ⚠
    function audioMarkFor(id) {
      if (audioPending.has(id)) return "pending";
      if (audioReady.has(id)) return "ready";
      if (audioFailed.has(id)) return "failed";
      return "none";
    }

    // Generate one clip and keep it. Returns whether the phrase now HAS audio —
    // including the case where it already did, which is a success that costs
    // nothing. Never rejects.
    //
    // Every early return below is money not spent. This is billed per character
    // and fires on every save, so a request that was always going to fail (no
    // code, no signal) is pure waste, and a clip that already exists is the entire
    // reason the design stores them at all.
    // Split in two on purpose. Everything up to the claim is SYNCHRONOUS: two
    // taps on 收藏 land in the same tick, and if the claim happened after an
    // await both would sail past it and pay twice. It is also why the list can
    // draw ⏳ the instant this is called rather than a frame later.
    function requestAudio(item) {
      if (!item || !item.id || !item.en) return Promise.resolve(false);
      const id = item.id;
      if (audioPending.has(id)) return Promise.resolve(false);
      if (audioReady.has(id)) return Promise.resolve(true);
      audioPending.add(id);
      audioFailed.delete(id);
      return provisionAudio(item, id);
    }

    // 要花钱的语音生成只有这一个出口：付费端点、凭据、音色，三件事写在一处。
    // 存句子和设置里的试听都走它——两个地方各自去拼凭据和音色，
    // 迟早有一处会漏掉其中一样。
    function ttsFetch(text, voice) {
      return api.raw("/api/tts", { text: text, voice: voice });   // 要读二进制回复，走不归类的那个口
    }

    // 连播里的中文提示，按需生成一次就存在设备上。键用 "zh:" 开头，clipKey 认得
    // 这个前缀，会用中文那把嗓子分键——所以家长换英文音色不会把中文提示作废。
    //
    // 不 await：连播一开始就把整队都排上，这一轮没备好的那几句先退回手机自带的
    // 合成，转一圈回来就有了。每句只花一次钱。
    var cuePending = new Set();
    async function provisionCue(item) {
      const zh = item && typeof item.zh === "string" ? item.zh.trim() : "";
      if (!zh || !item || !item.id) return false;
      const key = "zh:" + item.id;
      if (cuePending.has(key)) return false;
      cuePending.add(key);
      try {
        if (await hasAudio(key)) { await primeAudioUrl(key); return true; }
        if (!isOnline()) return false;
        if (!getAccessCode()) return false;
        const res = await ttsFetch(zh, cueVoiceId);
        if (!res.ok) return false;
        const stored = await putAudio(key, await res.blob());
        if (!stored) return false;
        await primeAudioUrl(key);
        return true;
      } catch {
        return false;
      } finally {
        cuePending.delete(key);
      }
    }
    function provisionLoopCues(items) {
      for (const it of items || []) { provisionCue(it); }
    }

    async function provisionAudio(item, id) {
      try {
        // A restored backup, a re-saved phrase, a fresh page load — all of these
        // ask about clips that are already on the device.
        if (await hasAudio(id)) { audioReady.add(id); return true; }

        // Known to fail: don't pay the timeout to find out.
        if (!isOnline()) return false;
        if (!getAccessCode()) return false;


        // Only the English goes out. The Chinese is what the parent typed; it is
        // useless for speech and every field sent needlessly is exposure earned
        // for nothing.
        const res = await ttsFetch(item.en, getVoice());
        if (!res.ok) return false;
        // Generated and paid for, but not stored, is worse than not generated —
        // it looks like it worked. putAudio() reporting false is the only way to
        // tell the difference.
        const stored = await putAudio(id, await res.blob());
        if (!stored) return false;
        audioReady.add(id);
        return true;
      } catch {
        // Offline mid-request, DNS failure, a body that never arrived.
        return false;
      } finally {
        audioPending.delete(id);
        if (!audioReady.has(id)) audioFailed.add(id);
        // The mark is stale the instant this settles — a spinner that never
        // becomes a speaker is indistinguishable from one that failed.
        //
        // Wrapped because this runs in a finally: a throw here would replace the
        // return value above, and requestAudio() is called WITHOUT await from both
        // save paths — so that rejection would have nobody to catch it. The
        // module's promise never to throw at its caller cannot depend on the
        // renderer behaving.
        try { refreshAudioMarks(); } catch {}
      }
    }



    // Voice a translation the moment it arrives, before it is saved.
    //
    // Reported from real use: the translate screen and the review screen sounded
    // like different people. Both clips come from the same Azure voice with
    // identical prosody — the translate screen simply had no clip at all and fell
    // back to browser speech, because generation used to happen at save time. So
    // the parent heard the machine voice FIRST, on the very screen where they
    // decide whether the phrase is any good, and the real one only afterwards.
    //
    // The id is minted HERE rather than in saveTranslation(). That is the whole
    // trick: the clip is stored under the id the saved item will carry, so saving
    // costs nothing more. Minting a second id at save time would orphan the clip
    // and pay for the same sentence twice.
    //
    // The cost of this choice, stated plainly: every translation is now a
    // generation, including the ones glanced at and discarded. Translate ten, keep
    // one, and nine clips were paid for and never wanted. The alternative was
    // making the parent wait three seconds the first time they tap play.
    function provisionTranslation(result) {
      if (!result || !result.en) return Promise.resolve(false);
      // Ids for the main sentence AND its alternatives. Existing ones are kept: a
      // re-render must not throw away the clip just made. Only the main sentence
      // is voiced here — the alternatives wait for a tap, or one translation
      // becomes four or five generations, most never listened to.
      assignTranslationIds(result);
      return requestAudio(result).then(ok => {
        // Storing the clip is not enough. Until its address is prepared, the play
        // path finds nothing and falls back to the browser voice — the clip sits
        // on the device, unheard, and the parent hears two different voices for
        // the same sentence with no way to tell why.
        if (ok) primeAudioUrl(result.id);
        return ok;
      });
    }

    // Read the device back into memory. audioMarkFor() answers from these three
    // Sets, and they live only as long as the page does — so on a fresh launch
    // every saved phrase claimed to have no sound while its clip sat in storage.
    // Playback still worked, because the list primes addresses from storage
    // directly, which made it worse rather than better: a row saying it was silent
    // that spoke when tapped.
    //
    // Asks about the whole list in one go. Dozens of single lookups is what makes
    // a list stutter on an older phone.
    //
    // Deliberately does NOT overwrite what this session already knows. A render
    // can land while one clip is mid-generation, and turning that ⏳ into 🔈 —
    // or erasing a ⚠ the parent was about to tap — would be the sync inventing a
    // state neither storage nor this session believes in.
    async function syncAudioMarks(ids) {
      const unknown = (ids || []).filter(
        id => id && !audioReady.has(id) && !audioPending.has(id) && !audioFailed.has(id));
      if (!unknown.length) return;
      const have = await whichHaveAudio(unknown);
      for (const id of have) audioReady.add(id);
    }

    // A tap on the ⚠ mark. Clears the memory of the last failure so the attempt
    // is genuinely made again rather than short-circuited.
    function retryAudio(item) {
      if (item && item.id) audioFailed.delete(item.id);
      return requestAudio(item);
    }

    return {
      audioMarkFor: audioMarkFor,
      requestAudio: requestAudio,
      ttsFetch: ttsFetch,
      provisionCue: provisionCue,
      provisionLoopCues: provisionLoopCues,
      provisionAudio: provisionAudio,
      provisionTranslation: provisionTranslation,
      syncAudioMarks: syncAudioMarks,
      retryAudio: retryAudio,
    };
  }

  var api = { create: create };
  if (typeof module !== "undefined" && module.exports) module.exports = api;   // Node（测试）
  else root.llProvisionLib = api;                                              // 浏览器
})(typeof globalThis !== "undefined" ? globalThis : this);
