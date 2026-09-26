// 本机存储的唯一主人（ADR 0009 第二块）。
//
// 由来：index.html 里原来有 13 处直接碰 localStorage，四种不同的出错处理；
// 「收藏」这一份数据有 10 处一模一样的写入。改数据格式的时候必然漏掉一处。
// 现在：键名只写一次，读的容错规则只有一套，写失败只在一处处理。
//
// 硬约束（Victor 2026-09-26 批准这一块时的条件）：不改任何键名、不改任何格式、
// 不做迁移。改完之后家长手机上的数据一个字节都不变。
//
// 这是普通脚本，不是 ES module：收藏列表在页面一解析就要读，那时 defer 的
// module 还没到。同时留一个 Node 能 require 的出口，所以能直接测。
// 纯度和播放模块一样：不碰 document / window；localStorage 从 createStorage(deps)
// 传进来——在某些隐私模式里连碰一下 localStorage 都会抛，所以后端是三个
// 适配函数，每次调用都包在 try 里。
(function (root) {
  "use strict";

  // 键名表。加键可以，改名不行——改名等于把家长的数据弄丢。
  var KEYS = Object.freeze({
    saved: "ll_saved",                 // 收藏（含复习进度）
    scenarios: "ll_scenarios",         // 自建场景
    access: "ll_access",               // 邀请码
    age: "ll_age",                     // 当前年龄档
    voice: "ll_voice",                 // 朗读音色
    reminder: "ll_reminder",           // 到点提醒设置
    usedMeta: "ll_used_meta",          // 今天用了（带日期）
    audio: "ll_audio",                 // 音频相关标记
    installDismissed: "ll_install_dismissed",             // 安装横幅「别再提醒」
    iosInstallDismissed: "ll_ios_install_dismissed",      // iOS 安装指引「别再提醒」
    wechatInstallDismissed: "ll_wechat_install_dismissed" // 微信里的安装提示「别再提醒」
  });

  // backend: { getItem, setItem, removeItem }，任何一个都可能抛。
  // onWriteFailed(key)：第一次写失败时叫一次，之后不再叫——界面据此提示一次
  // 「无法保存到本机」，不反复弹。
  function createStorage(deps) {
    deps = deps || {};
    var backend = deps.backend;
    var onWriteFailed = deps.onWriteFailed;
    var warned = false;

    function rawGet(key) {
      try { return backend ? backend.getItem(key) : null; }
      catch (e) { return null; }
    }

    return {
      KEYS: KEYS,

      // 字符串：没存过、读不到、存的是 null，都给默认值；存的是空串就是空串。
      readString: function (key, fallback) {
        var v = rawGet(key);
        return v == null ? (fallback === undefined ? "" : fallback) : String(v);
      },

      // 对象：没存过、半截 JSON、读不到，都给默认值。
      readJSON: function (key, fallback) {
        var v = rawGet(key);
        if (v == null || v === "") return fallback === undefined ? null : fallback;
        try { return JSON.parse(v); }
        catch (e) { return fallback === undefined ? null : fallback; }
      },

      // 列表：不是数组就当空；里面不是对象的条目丢掉（手工改坏的 `[null]` 之类），
      // 好的留着——渲染和迁移路径就能放心取字段，不会因为一条坏记录整页打不开。
      readArray: function (key) {
        var v = this.readJSON(key, null);
        if (!Array.isArray(v)) return [];
        return v.filter(function (x) { return x && typeof x === "object"; });
      },

      // 存了非空值才算有。
      has: function (key) {
        var v = rawGet(key);
        return v != null && v !== "";
      },

      // 对象走 JSON.stringify，字符串原样——和上线版本一模一样的存法。
      // 存不进去（存储满、被禁、隐私模式）：返回 false，第一次通知界面一次。
      // 内存里的状态仍然是准的，当前这一次操作照常完成。
      write: function (key, value) {
        var s = typeof value === "string" ? value : JSON.stringify(value);
        try { backend.setItem(key, s); return true; }
        catch (e) {
          if (!warned) {
            warned = true;
            if (typeof onWriteFailed === "function") onWriteFailed(key);
          }
          return false;
        }
      },

      remove: function (key) {
        try { backend.removeItem(key); return true; }
        catch (e) { return false; }
      }
    };
  }

  var api = { KEYS: KEYS, createStorage: createStorage };
  if (typeof module !== "undefined" && module.exports) module.exports = api;   // Node（测试）
  else root.llStorageLib = api;                                               // 浏览器
})(typeof globalThis !== "undefined" ? globalThis : this);
