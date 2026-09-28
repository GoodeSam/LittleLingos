// 存音频的唯一主人（ADR 0009 第十块；原 index.html 的 ll:audio-store 块）。
// 生成好的 mp3 存在手机的 IndexedDB 里，断网也能听（tech-constraints C10）。
//
// 两个依赖从 create(deps) 传进来，不抓全局：
//   indexedDB     → 浏览器的本机数据库（没有它就整块降级：读返回空，写返回 false，不炸）
//   getVoice()    → 当前音色。同一句话在不同嗓子下是不同的副本，键里带音色后缀，
//                   所以家长换了嗓子不会读到上一把嗓子那一份，也不会互相覆盖
//   defaultVoiceId→ 默认音色（默认那把不加后缀，保持老数据的键不变）
// 纯的：不碰 document / window / 存储以外的东西。普通脚本 + CommonJS 出口。
(function (root) {
  "use strict";

  function create(deps) {
    deps = deps || {};
    var indexedDB = deps.indexedDB;
    var voiceOf = deps.getVoice;
    var defaultVoiceId = deps.defaultVoiceId;
    var voiceIds = deps.voiceIds;   // 全部可选音色的 id：删一句话时要把它所有嗓子的副本一起删
    var cueVoiceId = deps.cueVoiceId;   // 连播里中文提示的嗓子（中文那把，不跟着英文音色走）

    // Where a generated clip lives once it has been paid for.
    //
    // Every clip in here cost money to make (ADR 0003). The point of keeping them
    // on the device is that reviewing a phrase fifty times costs nothing and works
    // with no signal. So the one thing this module must never do is quietly lose
    // one: putAudio() reports whether the write actually landed, and the caller is
    // expected to tell the parent when it did not. A silent failure means the
    // money was spent and the sound is gone, and nobody finds out until a review
    // days later.
    //
    // IndexedDB rather than localStorage because these are Blobs, not strings —
    // verified on device before this was written (tech-constraints C11: 38GB
    // available on an iPhone PWA, Blob stored directly, played back in airplane
    // mode). Storing base64 instead would be 33% larger and would need decoding
    // on every single playback.
    //
    // Every path degrades to "there is no audio" rather than throwing. Private
    // browsing, a locked-down webview, a parent who cleared site data — on those
    // phones the whole app still has to work, just without the real voice. A
    // storage failure must never be the reason a button stops responding.
    const AUDIO_DB = "ll_audio";
    const AUDIO_STORE = "clips";
    const AUDIO_FAIL = { failed: true };
    let audioDbPromise = null;

    // Opened once and shared. Not merely a speed concern: marking up a list of
    // saved phrases asks about dozens of ids at once, and a fresh open per call
    // would be dozens of opens. The promise is assigned synchronously so calls
    // made in the same tick — a save landing while the list renders — join this
    // one rather than starting their own.
    function openAudioDb() {
      if (audioDbPromise) return audioDbPromise;
      audioDbPromise = new Promise(resolve => {
        if (!indexedDB) return resolve(null);   // 没传进来 = 这个浏览器没有本机数据库，整块降级
        let req;
        try { req = indexedDB.open(AUDIO_DB, 1); }
        catch { return resolve(null); }
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(AUDIO_STORE)) db.createObjectStore(AUDIO_STORE);
        };
        req.onsuccess = () => resolve(req.result);
        // Resolve, never reject: "no database" is a state this module handles, not
        // an error the rest of the app should have to catch.
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      });
      return audioDbPromise;
    }

    // One shape for every operation, so no caller has to know how IndexedDB
    // reports trouble. Returns {value} or AUDIO_FAIL — kept distinct because a
    // stored-but-absent clip and an unreachable database are different answers,
    // and only the second one is worth telling a parent about.
    function audioOp(mode, run) {
      return openAudioDb().then(db => {
        if (!db) return AUDIO_FAIL;
        return new Promise(resolve => {
          let req;
          try { req = run(db.transaction(AUDIO_STORE, mode).objectStore(AUDIO_STORE)); }
          catch { return resolve(AUDIO_FAIL); }
          req.onsuccess = () => resolve({ value: req.result });
          req.onerror = () => resolve(AUDIO_FAIL);
        });
      }).catch(() => AUDIO_FAIL);
    }

    // true only if the bytes are actually on the device now. The caller decides
    // what to say when this is false; what it must not do is assume success.
    // 片段的存储键里带上音色。原来只按句子 id 存，于是 provisionAudio 第一行的
    // hasAudio(id) 会直接短路——家长换了嗓子，旧片段永远不会重做，同一个收藏
    // 列表里早存的是旧音色、新存的是新音色。这就是「时而这把、时而那把」的主因。
    //
    // 默认那把仍然用裸 id：已经装了的家长手机上那批付过钱的片段照旧命中，不作废。
    // 换成别的音色就是另一个键——新音色会重新生成，换回去时旧片段还在，不用再花一次钱。
    function clipKey(id) {
      const s = String(id);
      // 连播里的中文提示是另一把嗓子（中文的），不跟着家长挑的英文音色走。
      // 跟着走的话，他每换一次英文嗓子，所有中文提示就全部作废重生成——白花钱，
      // 而中文听起来一点没变。
      if (s.indexOf("zh:") === 0) {
        return typeof cueVoiceId === "string" ? s + "@" + cueVoiceId : s;
      }
      const fallback = typeof defaultVoiceId === "string" ? defaultVoiceId : null;
      const v = typeof voiceOf === "function" ? voiceOf() : fallback;
      return (!v || v === fallback) ? s : s + "@" + v;
    }

    // 一句话在设备上可能有好几把嗓子的副本。删的时候要一起删，不然家长删掉一句，
    // 别的音色那几份还赖在手机里占空间，而且谁也找不到它们。
    function allClipKeys(id) {
      const keys = [String(id)];
      const opts = (voiceIds || []).map(function (id) { return { id: id }; });   // 全部音色，由 create(deps) 传进来
      for (const o of opts) {
        if (o && o.id) keys.push(String(id) + "@" + o.id);
      }
      // 这句话的中文提示是另一条路存的，删的时候不能落下。
      keys.push("zh:" + id);
      if (typeof cueVoiceId === "string") keys.push("zh:" + id + "@" + cueVoiceId);
      return keys;
    }

    async function putAudio(id, blob) {
      const r = await audioOp("readwrite", s => s.put(blob, clipKey(id)));
      return !r.failed;
    }

    async function getAudio(id) {
      const r = await audioOp("readonly", s => s.get(clipKey(id)));
      return r.failed ? null : (r.value ?? null);
    }

    // Asks whether a clip exists WITHOUT reading it. A review list marks dozens of
    // rows, and pulling ~52KB per row to draw an icon is what makes a list stutter
    // on an older phone.
    async function hasAudio(id) {
      const r = await audioOp("readonly", s => s.count(clipKey(id)));
      return !r.failed && r.value > 0;
    }

    async function deleteAudio(id) {
      for (const k of allClipKeys(id)) {
        await audioOp("readwrite", s => s.delete(k));
      }
    }

    // The batch form of hasAudio(), for rendering a list in one pass instead of
    // one transaction per row. Returns the subset of `ids` that have audio.
    async function whichHaveAudio(ids) {
      const wanted = new Set(ids || []);
      // Nothing asked, nothing to open — a list that renders before anything is
      // saved should not be touching the database at all.
      if (!wanted.size) return new Set();
      const r = await audioOp("readonly", s => s.getAllKeys());
      if (r.failed) return new Set();
      // 存的键现在可能带音色后缀。只认当前这把嗓子的那一份——把旧音色的副本
      // 当成「有声音」的话，列表上标着有，点下去却是另一把嗓子在念。
      const have = new Set(r.value || []);
      const out = new Set();
      for (const id of wanted) { if (have.has(clipKey(id))) out.add(id); }
      return out;
    }

    return { openAudioDb: openAudioDb, audioOp: audioOp, clipKey: clipKey, allClipKeys: allClipKeys, putAudio: putAudio, getAudio: getAudio, hasAudio: hasAudio, deleteAudio: deleteAudio, whichHaveAudio: whichHaveAudio };
  }

  var api = { create: create };
  if (typeof module !== "undefined" && module.exports) module.exports = api;   // Node（测试）
  else root.llAudioStoreLib = api;                                             // 浏览器
})(typeof globalThis !== "undefined" ? globalThis : this);
