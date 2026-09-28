// 连播（ADR 0009 第十六块；原 ll:audio-loop 块）。
// 一次点击，收藏过的句子一句接一句放下去，中间留出让家长自己先说的停顿。
//
// 九个依赖从 create(deps) 传进来，之前都是直接抓全局：
//   Audio / speech / Utterance   —— 浏览器零件（Audio 构造器、speechSynthesis、
//                                  SpeechSynthesisUtterance）
//   setTimeout / clearTimeout    —— 时钟。测试要能驱动它：句子之间那段停顿
//                                  是「练习」和「背景噪音」的分界，必须可验
//   audioUrlFor(id)              —— 中文提示的地址
//   playableUrlFor(item)         —— 这一句现在能不能放、放哪个地址
//   stopAllAudio()               —— 起播前把别处正在放的停掉
//   provisionLoopCues(queue)     —— 按需生成中文提示
//
// 不碰 document / window / 网络，也不自己 new Audio。普通脚本 + CommonJS 出口。
(function (root) {
  "use strict";

  function create(deps) {
    deps = deps || {};
    var AudioCtor = deps.Audio;
    var speech = deps.speech || null;
    var Utterance = deps.Utterance || null;
    var setTimeout = deps.setTimeout;
    var clearTimeout = deps.clearTimeout;
    var audioUrlFor = deps.audioUrlFor || function () { return null; };
    var playableUrlFor = deps.playableUrlFor || function () { return null; };
    var stopAllAudio = deps.stopAllAudio || function () {};
    var provisionLoopCues = deps.provisionLoopCues || function () {};

    // One tap, and every saved phrase plays in turn, over and over.
    //
    // This is what the rest of ADR 0003 was for. jtbd.md names the real job as
    // 「别让我发起」 — a parent who knows they should review and will not begin.
    // Every other control still asks them to start something: open the app, find a
    // row, tap it, judge it. This one asks once and then keeps going.
    //
    // ONE Audio element for the whole session, src swapped between phrases. On iOS
    // only the element unlocked by the tap itself may keep playing; a fresh
    // `new Audio()` for the second clip is started by an `ended` handler rather
    // than a gesture, and Safari can refuse it silently — the loop would stop
    // after one phrase with nothing on screen to explain it. Same unverified iOS
    // rule that shapes ll:audio-playback.
    //
    // Only phrases that actually have a recorded clip take part. Dropping the
    // browser voice in for the ENGLISH would break a listening session into two
    // textures, and C1 already ruled that voice out for the thing being learned.
    //
    // THE SEQUENCE (2026-09-07). Before, this was English, gap, English: the
    // parent repeated each sentence after hearing it, and never once had to
    // produce it. That is listening, not remembering. Pimsleur's shape is cue in
    // the mother tongue, a pause, then the answer — the pause is where retrieval
    // happens. So between phrases the loop now speaks the NEXT phrase's Chinese
    // (system voice, zh-CN — a cue, not content; C1's verdict was about the
    // English), shows it on screen, waits long enough to think, then plays the
    // English clip. The first phrase of a session is the exception: the tap
    // itself must start a clip (the iOS rule above), so it is heard once
    // unprompted; from then on, and on every wrap-around, every phrase is cued.
    // 2026-09-11 重做这段的时序。原来是：念出中文，然后起一个 4 秒的固定计时器。
    // 它量的是「从开口那一刻算起 4 秒」，不是「念完了再等」——句子一长，或者设备
    // 语音慢，4 秒到了人还在念，英文就压上去，两个声音叠在一起听不清。
    //
    // 现在中文也走 Azure 生成的音频，和英文共用同一个 audio 元素（iOS 只认那一个
    // 被点击解锁的元素），靠它的 ended 接续：中文念完 → 停 2 秒 → 英文。那 2 秒
    // 是家长的反应时间，他要在这个缝里自己先说一遍。
    //
    // 拿不到中文音频时仍退回手机自带的合成，但接续也改成等 onend；有的内核不发
    // onend，所以留一个兜底计时，而那个兜底把停顿也算进去了——绝不会卡在人还在
    // 念的时候开口。
    var LOOP_PAUSE_MS = 2000;          // 中文念完之后给家长的反应时间
    var LOOP_CUE_MIN_MS = 3200;        // 退回手机合成时，兜底计时的下限
    var LOOP_CUE_MAX_MS = 9000;

    var loopEl = null;
    var loopQueue = [];
    var loopIndex = 0;
    var loopTimer = null;
    var loopOn = false;
    var loopOnCue = null;
    var loopPhase = "en";                // "zh" 正在念中文 | "en" 正在放英文
    var loopCueGuard = null;

    function audioLoopPlaying() { return loopOn; }

    // Tell the screen which phrase is up, then say its Chinese if the device can.
    // The screen comes first: a phone with no zh voice must still show the cue,
    // or the pause is just silence with nothing to retrieve.
    function cueLoopItem(item) {
      if (typeof loopOnCue === "function") { try { loopOnCue(item); } catch (e) {} }
    }
    function speakLoopCue(item, onDone) {
      const zh = item && typeof item.zh === "string" ? item.zh.trim() : "";
      if (!zh) return false;
      if (!speech || !Utterance) return false;
      try {
        speech.cancel();
        var u = new Utterance(zh);
        u.lang = "zh-CN";
        if (typeof onDone === "function") {
          u.onend = () => onDone();
          u.onerror = () => onDone();
        }
        speech.speak(u);
        return true;
      } catch (e) { return false; }
    }

    // 生成好的中文提示存在哪。和英文分开一个命名空间：换英文音色不该把中文
    // 提示一起作废，它们是两把不同的嗓子。
    function loopCueId(id) { return "zh:" + id; }
    function loopCueUrl(item) {
      if (!item || !item.id) return null;
      return audioUrlFor(loopCueId(item.id));
    }
    // 中文念多久。退回手机合成时没有可靠的「念完了」信号，只能估——而且把停顿
    // 也算进去，宁可多等一下，也不要压在人家嘴上。
    function loopCueGuardMs(item) {
      const zh = item && typeof item.zh === "string" ? item.zh.trim() : "";
      // 按每秒 3 个字算（比实际慢，宁可多等），再加一段开口前的启动延迟，
      // 最后加上那 2 秒停顿。估短了就是压在人嘴上，估长了只是多等一会儿。
      const spoken = Math.round((zh.length / 3) * 1000) + 700 + LOOP_PAUSE_MS;
      return Math.max(LOOP_CUE_MIN_MS, Math.min(LOOP_CUE_MAX_MS, spoken));
    }
    function clearLoopCueGuard() {
      if (loopCueGuard) { clearTimeout(loopCueGuard); loopCueGuard = null; }
    }
    function silenceLoopCue() {
      if (!speech) return;
      try { speech.cancel(); } catch (e) {}
    }

    // Must be called from a tap — see the iOS note above. Returns false when there
    // is nothing to play, so the caller can say why rather than leaving the parent
    // tapping a button that appears dead. `onCue(item)` is called whenever the
    // phrase on deck changes, so the screen can show its Chinese.
    function startAudioLoop(items, onCue) {
      stopAudioLoop();
      stopAllAudio();   // 播放键正在放的那段要停，否则两个声音一起响
      loopQueue = (items || []).filter(it => playableUrlFor(it));
      if (!loopQueue.length) return false;
      loopOnCue = typeof onCue === "function" ? onCue : null;

      if (!loopEl) {
        loopEl = new AudioCtor();
        // Bound once, on the element that lives for the session. Rebinding per
        // phrase would leave old handlers firing into a finished session.
        // 同一个元素先放中文再放英文，所以 ended 要看现在是哪一段。
        loopEl.addEventListener("ended", () => {
          if (!loopOn) return;
          if (loopPhase === "zh") afterLoopCue(); else advanceAndCue();
        });
        // A clip whose address was evicted from the cache must not end the
        // session — that reads as the loop stopping for no reason.
        loopEl.addEventListener("error", () => {
          if (!loopOn) return;
          if (loopPhase === "zh") afterLoopCue(); else advanceAndCue();
        });
      }
      loopIndex = 0;
      loopOn = true;
      loopPhase = "en";
      // 中文提示按需生成：这一轮没备好的就退回手机合成，转回来时就有了。
      try { provisionLoopCues(loopQueue); } catch (e) {}
      cueLoopItem(loopQueue[0]);   // shown, not spoken: the English starts now
      playCurrentLoopClip();
      return true;
    }

    function playCurrentLoopClip() {
      const item = loopQueue[loopIndex];
      const url = playableUrlFor(item);
      // 这一句没地址了（浏览器把它清掉了）：往下走，不是停在这里。
      // 2026-09-28 修：原来叫 scheduleNextLoopClip()，那个函数 09-11 重做时序时
      // 就删掉了，两处调用留在原地——踩上去抛 ReferenceError，连播就此哑掉，
      // 而按钮仍然显示正在放。往下走的那个函数现在叫 advanceAndCue()。
      if (!url) { advanceAndCue(); return; }
      loopEl.src = url;
      const p = loopEl.play();
      // A rejected play (autoplay refused, element torn down) must not strand the
      // session on a phrase that never sounds.
      if (p && typeof p.catch === "function") p.catch(() => { if (loopOn) advanceAndCue(); });
    }

    // Cue the next phrase now, play its English after the pause. The pause is the
    // whole point: it is where the parent tries to say it before hearing it.
    // Without it this is background noise.
    // 一句的英文放完了：推到下一句，先念它的中文。
    function advanceAndCue() {
      if (loopTimer) clearTimeout(loopTimer);
      clearLoopCueGuard();
      loopIndex = (loopIndex + 1) % loopQueue.length;
      const item = loopQueue[loopIndex];
      cueLoopItem(item);
      startLoopCue(item);
    }

    // 念中文。有生成好的音频就用它——同一个元素，靠 ended 接续，时序是准的。
    function startLoopCue(item) {
      clearLoopCueGuard();
      const url = loopCueUrl(item);
      if (url) {
        loopPhase = "zh";
        loopEl.src = url;
        const p = loopEl.play();
        if (p && typeof p.catch === "function") p.catch(() => { if (loopOn) afterLoopCue(); });
        return;
      }
      // 没有中文音频：退回手机合成。onend 来了就按它走，不来就靠兜底——
      // 兜底里含着那 2 秒停顿，所以无论走哪条都不会压在人还在念的时候。
      loopPhase = "en";
      const spoke = speakLoopCue(item, () => { if (loopOn) afterLoopCue(); });
      loopCueGuard = setTimeout(() => {
        loopCueGuard = null;
        if (loopOn) playCurrentLoopClip();
      }, spoke ? loopCueGuardMs(item) : LOOP_PAUSE_MS);
    }

    // 中文念完了。停 2 秒——这是家长自己先说一遍的时间——再放英文。
    function afterLoopCue() {
      clearLoopCueGuard();
      loopPhase = "en";
      if (loopTimer) clearTimeout(loopTimer);
      loopTimer = setTimeout(() => {
        loopTimer = null;
        if (loopOn) playCurrentLoopClip();
      }, LOOP_PAUSE_MS);
    }

    function stopAudioLoop() {
      loopOn = false;
      loopPhase = "en";
      clearLoopCueGuard();
      if (loopTimer) { clearTimeout(loopTimer); loopTimer = null; }
      // Cancelling only the schedule would leave the current phrase sounding after
      // the parent pressed stop — and a Chinese cue mid-sentence, likewise.
      if (loopEl) { try { loopEl.pause(); } catch (e) {} }
      silenceLoopCue();
    }

    function toggleAudioLoop(items, onCue) {
      if (loopOn) { stopAudioLoop(); return false; }
      return startAudioLoop(items, onCue);
    }

    return {
      LOOP_PAUSE_MS: LOOP_PAUSE_MS,
      LOOP_CUE_MIN_MS: LOOP_CUE_MIN_MS,
      LOOP_CUE_MAX_MS: LOOP_CUE_MAX_MS,
      audioLoopPlaying: audioLoopPlaying,
      cueLoopItem: cueLoopItem,
      speakLoopCue: speakLoopCue,
      loopCueId: loopCueId,
      loopCueUrl: loopCueUrl,
      loopCueGuardMs: loopCueGuardMs,
      clearLoopCueGuard: clearLoopCueGuard,
      silenceLoopCue: silenceLoopCue,
      startAudioLoop: startAudioLoop,
      playCurrentLoopClip: playCurrentLoopClip,
      advanceAndCue: advanceAndCue,
      startLoopCue: startLoopCue,
      afterLoopCue: afterLoopCue,
      stopAudioLoop: stopAudioLoop,
      toggleAudioLoop: toggleAudioLoop,
    };
  }

  var api = { create: create };
  if (typeof module !== "undefined" && module.exports) module.exports = api;   // Node（测试）
  else root.llAudioLoopLib = api;                                              // 浏览器
})(typeof globalThis !== "undefined" ? globalThis : this);
