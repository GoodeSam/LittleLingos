// 播放这件事的唯一主人。
//
// 由来（[ADR 0009]）：2026-09-22 真机报上来「点 ⏸ 变成从头重放」，病根是三个
// 播放函数各自 stopAllAudio() 再新造一段——同一个副作用有三个主人。补一个共用
// 函数只是把三处接上；这个模块是把「谁在放、要不要停」收口成一处，让那类 bug
// 从结构上不可能再犯。
//
// 三条规矩：
// 1. 这个文件是纯的：不碰 document / window / localStorage，也不自己 new Audio。
//    浏览器零件从 createAudioController(deps) 传进来。所以它在 Node 里能直接
//    import 来测，不用从 index.html 里切文本塞沙箱。
// 2. 「谁在放」用 owner 认，owner 是调用方给的任意标识（句子 id、按钮对象都行）。
//    播放逻辑不认得界面元素——界面怎么画是界面的事。
// 3. 状态一变就通知订阅者。界面照着通知重画，不必自己去翻全局变量。
//
// 有录音（Audio 元素）的能真暂停、之后从停的地方接着放。
// 退回手机自带朗读的那种没有可靠的 pause/resume（iOS 上 resume 常常不响），
// 所以第二下当「停」，第三下从头念。

export function createAudioController({ Audio: AudioCtor, speech, Utterance } = {}) {
  let listeners = [];
  // 当前这一段。owner = 谁点的；mode = "clip"（有录音）或 "speech"（手机自带朗读）。
  let cur = null;   // { owner, mode, paused, audio? }

  const snapshot = () => ({
    owner: cur ? cur.owner : null,
    mode: cur ? cur.mode : null,
    paused: cur ? cur.paused : false,
    // 按下去到声音真响起来之间是「加载中」：界面要能显示 ⏳，而不是装作已经在放。
    loading: cur ? !!cur.loading : false,
  });

  function notify() {
    const s = snapshot();
    for (const fn of listeners.slice()) fn(s);
  }

  // 把当前这一段停掉。不通知——调用方紧接着会开始新的一段，一次变化只通知一次。
  function halt() {
    if (!cur) return;
    if (cur.loadTimer) { clearTimeout(cur.loadTimer); cur.loadTimer = null; }
    if (cur.mode === "clip" && cur.audio && !cur.audio.ended) cur.audio.pause();
    if (cur.mode === "speech" && speech) speech.cancel();
    cur = null;
  }

  function startClip(owner, url, text, opts = {}) {
    const audio = new AudioCtor(url);
    // 声音真的响起来了（浏览器的 playing 事件）：退出「加载中」。
    audio.addEventListener("playing", () => {
      if (!cur || cur.audio !== audio || !cur.loading) return;
      cur.loading = false;
      if (cur.loadTimer) { clearTimeout(cur.loadTimer); cur.loadTimer = null; }
      notify();
    });
    // 进度：场景卡的进度条靠它走。这里只报比例，怎么画是界面的事。
    if (typeof opts.onProgress === "function") {
      audio.addEventListener("timeupdate", () => {
        if (!cur || cur.audio !== audio) return;
        const d = audio.duration;
        if (d > 0) opts.onProgress(Math.min(1, audio.currentTime / d));
      });
    }
    audio.addEventListener("ended", () => {
      if (!cur || cur.audio !== audio) return;   // 早就换成别的了，这条消息过期
      cur = null;
      notify();
    });
    // 起播成功之后才坏掉（文件损坏、解码失败、网络中断）。只听 play() 的承诺
    // 是不够的——那时候它已经成功了，状态会永远停在「正在放」，按钮卡在 ⏸。
    audio.addEventListener("error", () => {
      if (!cur || cur.audio !== audio || cur.paused) return;   // 暂停着出错，不替用户做决定
      const t = cur.text;
      cur = null;
      if (t) startSpeech(owner, t);
      notify();
    });
    cur = { owner, mode: "clip", paused: false, audio, text, loading: true, loadTimer: null };
    // 网络卡住时，这一段可能既不响也不报错。到点就退回手机自带的声音念，
    // 不许让家长对着一个「加载中」的按钮干等（旧代码里的 8 秒 loadTimer 同理）。
    const wait = opts.loadTimeoutMs ?? 8000;
    if (wait > 0) {
      cur.loadTimer = setTimeout(() => {
        if (!cur || cur.audio !== audio || !cur.loading) return;
        audio.pause();
        cur = null;
        if (text) startSpeech(owner, text);
        notify();
      }, wait);
    }
    audio.play().catch(() => {
      // 这一段放不出来（文件没了、格式不认、iOS 拦了）：退回手机自带朗读，
      // 别让家长按了没反应。但有两种「失败」不算放不出来，不许插队：
      //   · 中途已经换成别的一段了；
      //   · 用户自己按了暂停——声音还没真正响起来就 pause()，浏览器会让这个
      //     承诺以 AbortError 失败。当成播放失败的话，家长一按暂停手机反而
      //     开始念（2026-09-25 真机报上来的就是这个）。
      if (!cur || cur.audio !== audio || cur.paused) return;
      cur = null;
      if (text) startSpeech(owner, text);
      notify();
    });
    notify();
    return "playing";
  }

  function startSpeech(owner, text) {
    const utter = Utterance ? new Utterance(text) : { text };
    // 念完（或念出错）就把状态清掉，按钮才会回到 ▶。
    // 身份校验不能省：取消掉的旧朗读，回调可能迟到，那时早就换成别的在放了——
    // 不校验的话它会把后来开始的那一段停掉（Codex 2026-09-25 指出）。
    utter.onend = utter.onerror = () => {
      if (!cur || cur.utter !== utter) return;
      cur = null;
      notify();
    };
    cur = { owner, mode: "speech", paused: false, utter };
    if (speech) {
      speech.cancel();
      speech.speak(utter);
    }
    return "speaking";
  }

  return {
    // 点一下播放键。返回这一下做了什么：
    // playing（开始放）/ paused（停住了）/ resumed（接着放）/
    // speaking（用手机自带声音念）/ stopped（把正在念的停掉）
    toggle({ owner, url, text, onProgress, loadTimeoutMs } = {}) {
      // ① 点的是正在放的这一段
      if (cur && cur.owner === owner) {
        if (cur.mode === "clip" && cur.audio && !cur.audio.ended) {
          if (!cur.paused) {
            cur.audio.pause();
            cur.paused = true;
            notify();
            return "paused";
          }
          const resuming = cur.audio;
          cur.paused = false;
          resuming.play().catch(() => {
            if (!cur || cur.audio !== resuming || cur.paused) return;   // 同上：自己按的暂停不算失败
            cur = null;
            if (text) startSpeech(owner, text);
            notify();
          });
          notify();
          return "resumed";
        }
        // 手机自带朗读：没有可靠的接着念，第二下当「停」
        if (cur.mode === "speech") {
          halt();
          notify();
          return "stopped";
        }
      }
      // ② 点的是别的一段（或者什么都没在放）：先把旧的停掉，再开新的
      halt();
      if (url) return startClip(owner, url, text, { onProgress, loadTimeoutMs });
      const r = startSpeech(owner, text);
      notify();
      return r;
    },

    // 全停。界面切换、开始录音、连播结束之类的场合用。
    stopAll() {
      if (!cur) return;
      halt();
      notify();
    },

    // 现在谁在放、是不是暂停着。
    state: snapshot,

    // 状态一变就叫我。返回退订函数。
    subscribe(fn) {
      listeners.push(fn);
      return () => { listeners = listeners.filter(f => f !== fn); };
    },
  };
}
