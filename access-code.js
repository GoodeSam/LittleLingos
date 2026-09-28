// 邀请码（ADR 0009 第十三块；原 ll:access-code 块）。
// 存哪儿、怎么取、填错了对家长说什么、动手之前先说明这里需要码。
//
// 一个依赖从 create(deps) 传进来：storage（storage.js 的实例，用它的
// readString / write / remove）。之前直接抓全局 llStorage。
// 纯的：不碰 document / window / 网络。普通脚本 + CommonJS 出口。
(function (root) {
  "use strict";

  function create(deps) {
    var storage = (deps && deps.storage) || { readString: function () { return ""; }, write: function () { return false; }, remove: function () { return false; } };

    // The client half of the access gate. Two endpoints cost money per call
    // (translate, and dictionary lookups of uncurated words), so the server
    // refuses anything without a code — see netlify/functions/_shared/access.mjs
    // and ADR 0003.
    //
    // The code is typed by the parent and lives only in their browser. It cannot
    // be baked in: this is a public static site and anything in the bundle is
    // readable by anyone, which would make it not a code at all.
    const ACCESS_KEY = "ll_access";

    // Held in memory as well as in storage, and the memory copy wins.
    //
    // Storage can refuse a write — private browsing, a full quota, a locked-down
    // webview — and on iOS the installed PWA and Safari keep separate stores, so
    // a code entered in one is simply absent in the other (tech-constraints C9).
    // None of that should stop a parent translating right now. Losing the code on
    // reload is a fair cost; being unable to use the feature at all is not, and
    // it would look like the app is broken rather than unconfigured.
    let accessCodeMemo = null;

    function getAccessCode() {
      if (accessCodeMemo !== null) return accessCodeMemo;
      return storage.readString(ACCESS_KEY, "");   // no storage at all, or reads throw → ""
    }

    // Returns whether the code will survive a reload, so the UI can tell a parent
    // they will have to type it again rather than letting them find out later.
    function setAccessCode(code) {
      // Trim: a pasted code very often carries a trailing space or newline, and
      // the server compares exactly.
      accessCodeMemo = String(code == null ? "" : code).trim();
      return accessCodeMemo ? storage.write(ACCESS_KEY, accessCodeMemo) : storage.remove(ACCESS_KEY);
    }

    // Callers hand this straight to fetch, so it carries the content type too —
    // returning only the access header would drop it and 400 every request.
    // 请求头（Content-Type + 邀请码）现由 api-client.js 统一拼，这里不再有第二份。

    // Returns null for anything that is not an access problem. A 500 is a server
    // configuration fault and a 502 is upstream; telling a parent to check their
    // code would send them off to fix the wrong thing.
    function accessErrorMessage(status) {
      if (status !== 403) return null;
      return getAccessCode()
        ? `邀请码不对 — 请到「${ACCESS_CODE_WHERE}」里重新填写`
        : `这个功能需要邀请码 — 请到「${ACCESS_CODE_WHERE}」里填写，${ACCESS_CODE_SOURCE}`;
    }

    // 邀请码填在哪儿、找谁要 —— 事前提示和事后提示的唯一来源。
    // 之前「设置」这个位置被写死在两句文案里：设置项一旦挪出
    // 收藏页，这两句话就开始骗人，而且没有任何测试会红。
    const ACCESS_CODE_WHERE = "设置";
    // ⚠️ Victor：这里要填真实的索取渠道（微信号 / 邮箱 / 一个页面）。
    // 我不替你编一个联系方式——这句话现在只说了「找作者」，没说怎么找到你。
    const ACCESS_CODE_SOURCE = "向 LittleLingos 的作者索取";

    // 在他动手之前就说明这里有一道门。
    //
    // 之前这道门是暗的：家长打开、写下一句中文、点「翻译」，然后才被告知需要
    // 邀请码。他在动手之前没有任何提示，而失败的归因很可能是「这软件坏了」。
    //
    // 查词和翻译的条件不一样，所以说的不是同一句话：已经收录的词不联网、
    // 不需要码，把查词整体说成「需要邀请码」会让他以为一个词也查不了。
    function accessGateNotice(feature) {
      if (getAccessCode()) return null;
      const tail = `到「${ACCESS_CODE_WHERE}」里填写，${ACCESS_CODE_SOURCE}。`;
      return feature === "dict"
        ? `🔑 查新词需要邀请码（已经收录的词不用）—— ${tail}`
        : `🔑 翻译需要邀请码 —— ${tail}`;
    }

    return { getAccessCode: getAccessCode, setAccessCode: setAccessCode, accessErrorMessage: accessErrorMessage, accessGateNotice: accessGateNotice, ACCESS_CODE_WHERE: ACCESS_CODE_WHERE, ACCESS_CODE_SOURCE: ACCESS_CODE_SOURCE };
  }

  var api = { create: create };
  if (typeof module !== "undefined" && module.exports) module.exports = api;   // Node（测试）
  else root.llAccessLib = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
