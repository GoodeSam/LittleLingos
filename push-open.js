// 推送的公共部分（ADR 0009 第十九块；原 ll:push-open 块的纯的那一半）。见 ADR 0008。
// 公钥解码、能力检测、从通知点开时去哪——三件不碰界面的事。
// 点开之后怎么切页面、怎么启动连播（openFromPush）留在 index.html。
// 零依赖，普通脚本 + CommonJS 出口。
(function (root) {
  "use strict";

  // 公钥是公开的，可以写在这里；私钥只在 Netlify 的环境变量里。
  var PUSH_PUBLIC_KEY = "BBPXvT-rnKQYK-iXm6x_ocKfIyx5vfpbIFQWxYmPW44NBC4g7fykk_Fhu2f0FCzjag41AtfGNKm0xosX21HHMpw";

  // base64url → 字节。补位（padding）按长度余数算：这里错一位，subscribe() 会静默失败。
  function pushKeyBytes(b64u) {
    var s = atob(b64u.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64u.length + 3) % 4));
    return Uint8Array.from(s, function (c) { return c.charCodeAt(0); });
  }

  // 这个环境能不能收推送。四样零件缺一样都不能：传全局对象进来，Node 里就能测。
  function pushSupported(g) {
    g = g || {};
    return !!(g.navigator && g.navigator.serviceWorker) && typeof g.PushManager !== "undefined" &&
           typeof g.Notification !== "undefined" && typeof g.caches !== "undefined";
  }

  // App 被通知新打开时，目标在地址里（?to=）。不在名单里的不算。
  function deepLinkTarget(search, targets) {
    var to = new URLSearchParams(search || "").get("to");
    return (targets || []).indexOf(to) !== -1 ? to : null;
  }

  var api = { PUSH_PUBLIC_KEY: PUSH_PUBLIC_KEY, pushKeyBytes: pushKeyBytes, pushSupported: pushSupported, deepLinkTarget: deepLinkTarget };
  if (typeof module !== "undefined" && module.exports) module.exports = api;   // Node（测试）
  else root.llPushLib = api;                                                   // 浏览器
})(typeof globalThis !== "undefined" ? globalThis : this);
