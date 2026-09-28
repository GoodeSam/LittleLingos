// 收藏列表每一行右边那个声音标记该显示成什么（ADR 0009 第十二块；原 ll:audio-marks 块）。
// 🔊已就绪 / ⏳生成中 / ⚠失败 / 🔈还没有——界面靠它一处定，不各写各的。
//
// 四个依赖从 create(deps) 传进来，不抓全局：
//   audioMarkFor(id)   → 这条现在是什么状态（audio-provision 那边记的）
//   isAudioBacked(item)→ 预设句子本来就有声音，不该被标成「没有」
//   retryAudio(item)   → ⚠ 点一下重试
//   playReviewAudio(item) → 🔊 点一下就听（这个标记同时是播放键）
// 纯的：不碰 document / window / 存储 / 网络。普通脚本 + CommonJS 出口。
(function (root) {
  "use strict";

  function create(deps) {
    deps = deps || {};
    var audioMarkFor = deps.audioMarkFor, isAudioBacked = deps.isAudioBacked;
    var retryAudio = deps.retryAudio, playReviewAudio = deps.playReviewAudio;
    // What a saved row says about its voice.
    //
    // Everything else in ADR 0003 is invisible. A parent taps 收藏, something
    // happens for three seconds, and then they hear either a real recorded voice
    // or the browser's own — and cannot tell which. Airplane mode does not settle
    // it either, because browser speech works offline too. So the row says it.
    //
    // Four states, four icons, deliberately distinguishable at a glance:
    //   🔊 ready   — the clip is on this phone; plays with no signal, costs nothing
    //   ⏳ pending — being generated right now; tapping would only pay twice
    //   ⚠  failed  — no clip; TAPPABLE, and the only state where the parent can act
    //   🔈 none    — not attempted yet, or restored from a backup (backups carry no
    //                audio, ADR 0003); also tappable, to fill it in
    //
    // Keeping ⏳ and ⚠ apart is the whole point of having four rather than two: a
    // parent staring at a spinner that will never resolve has no way to know they
    // were supposed to do something.
    function audioMarkView(item) {
      if (!item || !item.id) return { icon: "🔈", label: "暂无声音", canRetry: false };

      // Preset phrases ship with the app as ./audio/<id>_normal.mp3 and never go
      // through per-item generation — asking the device store about them always
      // answers "none", which would paint a whole screen of them as silent.
      // 🔊 doubles as the play control. Reported from real use: only the review
      // card at the top could be played, so every row below it held a clip that
      // had been paid for and could never be heard. A speaker icon already invites
      // a tap; adding a separate play button next to it would ask the parent to
      // work out the difference between the two.
      const playable = item => ({
        // Says both what it is and what tapping does — a screen reader user gets
        // no icon, so the label carries the whole message.
        icon: "🔊", label: "已有声音 — 点一下听这一句", canRetry: false,
        onTap: () => playReviewAudio(item),
      });

      if (typeof isAudioBacked === "function" && isAudioBacked(item)) {
        return playable(item);
      }

      const state = typeof audioMarkFor === "function" ? audioMarkFor(item.id) : "none";
      if (state === "ready")   return playable(item);
      if (state === "pending") return { icon: "⏳", label: "正在生成声音", canRetry: false };
      if (state === "failed") {
        return {
          icon: "⚠", label: "没有声音 — 点一下重试", canRetry: true,
          onTap: () => retryAudio(item),
        };
      }
      return {
        icon: "🔈", label: "暂无声音 — 点一下生成", canRetry: true,
        onTap: () => retryAudio(item),
      };
    }

    return { audioMarkView: audioMarkView };
  }

  var api = { create: create };
  if (typeof module !== "undefined" && module.exports) module.exports = api;   // Node（测试）
  else root.llAudioMarksLib = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
