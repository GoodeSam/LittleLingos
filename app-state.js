// 应用状态的唯一主人（ADR 0009 最后一步：app-state）。
//
// index.html 主脚本原来有 17 个顶层 let——收藏列表、年龄档、复习队列、当前场景……
// 散在 4000 行里各处，谁都能改、改了没人知道。ADR 0009 说的「改了状态忘了重画」
// 就是这么来的。
//
// 这一步**不改任何一处读写**：`savedPhrases = merged` 这种裸名赋值一行不动。做法是
// 把这些名字装成 window 上的访问器属性（install），读写都进到这里这一张表：
//   · 只认清单里的名字，打错字立刻抛，不会悄悄造出一个没人读的新全局；
//   · 每次写都通知订阅者（谁改了什么、从什么改成什么），界面可以据此重画，
//     测试也能看见「改了没画」。
// 这一步先把主人立起来，不自动重画——自动重画会撞上「列表重画会扔掉正在出声的元素」
// 那类事，得一处一处接。
// 纯的：不碰 document / 存储 / 网络。普通脚本 + CommonJS 出口。
(function (root) {
  "use strict";

  function create(fields) {
    var names = (fields || []).slice();
    var values = Object.create(null);
    var listeners = [];
    function known(name) {
      if (names.indexOf(name) === -1) throw new Error("app-state: 没有叫「" + name + "」的状态——是不是打错了？清单里有：" + names.join(", "));
    }
    function get(name) { known(name); return values[name]; }
    function set(name, value) {
      known(name);
      var prev = values[name];
      values[name] = value;
      for (var i = 0; i < listeners.length; i++) listeners[i](name, value, prev);
      return value;
    }
    function subscribe(fn) {
      listeners.push(fn);
      return function () { listeners = listeners.filter(function (f) { return f !== fn; }); };
    }
    // 把清单里的每个名字装成 target 上的访问器：裸名读写照常，写都经过 set()。
    function install(target) {
      names.forEach(function (name) {
        Object.defineProperty(target, name, {
          configurable: true, enumerable: true,
          get: function () { return values[name]; },
          set: function (v) { set(name, v); },
        });
      });
      return target;
    }
    return { get: get, set: set, subscribe: subscribe, install: install,
             fields: function () { return names.slice(); },
             snapshot: function () { var o = {}; names.forEach(function (n) { o[n] = values[n]; }); return o; } };
  }

  var api = { create: create };
  if (typeof module !== "undefined" && module.exports) module.exports = api;   // Node（测试）
  else root.llAppStateLib = api;                                               // 浏览器
})(typeof globalThis !== "undefined" ? globalThis : this);
