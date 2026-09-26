// 往自家服务器打电话的唯一出口（ADR 0009 第三块）。
//
// 由来：index.html 里原来四处 fetch("/api/…")，拼请求的写法一模一样，但状态码
// 怎么归类各写一遍——09-23 那句「500 reminder not configured」甩给家长，就是
// 没有统一出口的结果。现在：拼请求（含超时）和归类在这一处；**说什么中文**仍归
// 各界面（查词面板、翻译卡、提醒设置各有各的话）。
//
// 纯的：fetch、AbortController、邀请码都从 createApiClient(deps) 传进来。
// 普通脚本 + CommonJS 出口（同 storage.js）：沙箱测试要同步 require 它。
(function (root) {
  "use strict";

  // 状态码 → 几类。和原来四处各自的判断合起来一致：
  //   403 邀请码问题；400 请求不合法；500 服务器自己没配好；其余非 2xx 一律当上游挂了。
  function classify(status) {
    if (status === 403) return "access";
    if (status === 400) return "invalid";
    if (status === 500) return "server";
    if (status >= 200 && status < 300) return "ok";
    return "upstream";
  }

  function createApiClient(deps) {
    deps = deps || {};
    var fetchImpl = deps.fetch;
    var getAccessCode = deps.getAccessCode;
    var AC = deps.AbortController;
    var setT = deps.setTimeout, clearT = deps.clearTimeout;

    // 没填码就不带那个头：带一个空的和没带，服务器回的话不一样。
    function headers() {
      var h = { "Content-Type": "application/json" };
      var code = typeof getAccessCode === "function" ? getAccessCode() : "";
      if (code) h["X-LL-Access"] = code;
      return h;
    }

    // 只拼请求、不归类。要读二进制回复的（生成声音）用它。
    function raw(path, body, opts) {
      opts = opts || {};
      var init = { method: "POST", headers: headers(), body: JSON.stringify(body == null ? {} : body) };
      if (opts.signal) init.signal = opts.signal;
      return fetchImpl(path, init);
    }

    // 拼请求 + 超时 + 归类。返回 { kind, status, body }：
    //   kind ∈ ok / access / invalid / server / upstream / malformed / timeout / network
    //   body：能解析成 JSON 就带回来（不管什么状态码——提醒那条路要读 500 里的正文），
    //         解析不了给 null；2xx 却解析不了才算 malformed。
    //   超时 / 断网：status 0。
    function post(path, body, opts) {
      opts = opts || {};
      var controller = (opts.timeoutMs > 0 && typeof AC === "function") ? new AC() : null;
      var timer = controller ? setT(function () { controller.abort(); }, opts.timeoutMs) : null;
      var pending;
      try { pending = raw(path, body, controller ? { signal: controller.signal } : {}); }
      catch (e) { pending = Promise.reject(e); }
      return pending.then(function (res) {
        if (timer) clearT(timer);
        var kind = classify(res.status);
        return res.json().then(
          function (b) { return { kind: kind, status: res.status, body: b }; },
          function () { return { kind: kind === "ok" ? "malformed" : kind, status: res.status, body: null }; }
        );
      }, function (err) {
        if (timer) clearT(timer);
        return { kind: (err && err.name === "AbortError") ? "timeout" : "network", status: 0, body: null };
      });
    }

    return { post: post, raw: raw, classify: classify };
  }

  var api = { createApiClient: createApiClient, classify: classify };
  if (typeof module !== "undefined" && module.exports) module.exports = api;   // Node（测试）
  else root.llApiLib = api;                                                   // 浏览器
})(typeof globalThis !== "undefined" ? globalThis : this);
