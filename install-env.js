// 这个手机能不能装到主屏幕、离线准备好了没（ADR 0009 第十二块；原 ll:install-env 块）。
// 两个纯函数：从 UA 认环境（iOS / 安卓 / 微信内置），从 service worker 的真实注册结果
// 推「能不能说自己离线可用」——不是「调用过 register() 就算数」。
// 纯的：不碰 document / window / 存储 / 网络。普通脚本 + CommonJS 出口。
(function (root) {
  "use strict";

  function detectInstallEnvironment(ua) {
    // Total: any non-string (undefined, null, a number, an object, garbage)
    // collapses to "", which matches nothing below and resolves to the safe
    // 'unknown' path instead of throwing inside .test().
    const safeUa = typeof ua === "string" ? ua : "";
    const isIOS = /iphone|ipad|ipod/i.test(safeUa);
    const isAndroid = /android/i.test(safeUa);
    // Case-insensitive: some X5 builds vary MicroMessenger's casing.
    const isWeChat = /micromessenger/i.test(safeUa);
    let installPath;
    if (isWeChat) installPath = "wechat"; // iOS or Android — same honest-fallback path
    else if (isIOS) installPath = "ios-safari";
    else if (isAndroid) installPath = "android-prompt";
    else installPath = "unknown"; // default for garbage/desktop/unrecognized UAs
    return { isIOS, isAndroid, isWeChat, installPath };
  }

  // Derives whether the app can honestly claim "offline ready" from the
  // ACTUAL registration outcome, replacing the assumption that register()
  // succeeding just because it was called (the bug this fixes:
  // `.register('./sw.js').catch(() => {})` swallowed every failure silently).
  // `registrationState` is one of 'pending' | 'success' | 'failed'; anything
  // else defaults to 'pending' (the conservative "don't claim readiness,
  // don't alarm the parent yet" state — a real answer is still in flight).
  // Controller presence is the ground truth for "can this device actually
  // serve cached assets right now" — independent of whether THIS particular
  // register() call resolved or rejected, so a transient failure on an
  // already-controlled page never false-alarms a parent who is already
  // offline-capable.
  function deriveOfflineReadiness(state) {
    const s = state && typeof state === "object" ? state : {};
    const supported = s.supported === true;
    const registrationState = ["pending", "success", "failed"].includes(s.registrationState)
      ? s.registrationState : "pending";
    const hasController = s.hasController === true;

    if (!supported) {
      return { offlineReady: false, status: "unsupported", showFailureToast: false };
    }
    const offlineReady = hasController;
    const showFailureToast = registrationState === "failed" && !hasController;
    return { offlineReady, status: registrationState, showFailureToast };
  }

  var api = { detectInstallEnvironment: detectInstallEnvironment, deriveOfflineReadiness: deriveOfflineReadiness };
  if (typeof module !== "undefined" && module.exports) module.exports = api;   // Node（测试）
  else root.llInstallEnv = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
