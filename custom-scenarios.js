// 家长自己建的场景（ADR 0009 第十四块；原 ll:custom-scenarios 块）。
//
// 三个依赖从 create(deps) 传进来，之前都是直接抓全局：
//   storage       —— storage.js 的实例（之前是全局 llStorage + safeSetItem 薄壳）
//   getSaved()    —— 取当前收藏列表。**必须是函数**：savedPhrases 在导入备份和
//                    删除条目时会被整个换掉（index.html 两处 `savedPhrases =`），
//                    存一份引用进来的话，换过之后这里看到的还是旧数组，
//                    「删场景把句子退回翻译箱」会改到一个没人在看的数组上。
//   persistSaved() —— 写回收藏
//
// 纯的：不碰 document / window / 网络。普通脚本 + CommonJS 出口。
(function (root) {
  "use strict";

  var SCENARIOS_KEY = "ll_scenarios";
  var CUSTOM_PREFIX = "custom_";
  var DEFAULT_SCENARIO_ICON = "📌";

  function create(deps) {
    deps = deps || {};
    var storage = deps.storage;
    var getSaved = deps.getSaved || function () { return []; };
    var persistSaved = deps.persistSaved || function () {};

    // Scenarios a parent makes themselves.
    //
    // The prepared ones cover bedtime, meals, going out. They do not cover this
    // parent's Tuesday — the paediatrician, the grandparents' place, swimming.
    // Those are the moments they actually need words for.
    //
    // THE PHRASES ARE ORDINARY SAVED ITEMS tagged with `custom_<id>`. That is the
    // whole design: they inherit review scheduling, audio generation, the marks,
    // row playback, loop playback and backup, none of which is built again here.
    //
    // The tag is deliberately NOT a key in the preset `scenarios` object. An item
    // found there is classified as audio-backed and sent to
    // ./audio/<id>_normal.mp3 — a file that does not exist for these — where it
    // would fail over to the browser voice with nothing to show for it
    // (tech-constraints C13).
    function customScenarioTag(id) { return CUSTOM_PREFIX + id; }
    function isCustomScenario(tag) {
      return typeof tag === "string" && tag.startsWith(CUSTOM_PREFIX);
    }

    // Anything unreadable is treated as "no scenarios yet" rather than an error.
    // A parent whose storage got mangled should find an app that works and an
    // empty list, not one that will not open.
    function loadCustomScenarios() {
      var list = storage.readJSON(SCENARIOS_KEY, null);
      if (!Array.isArray(list)) return [];
      // A half-written entry would render as a scenario with no name — a tile a
      // parent cannot identify and cannot fix.
      return list.filter(function (x) {
        return x && typeof x.id === "string" && x.id
                 && typeof x.name === "string" && x.name.trim();
      });
    }

    function saveCustomScenarios(list) {
      storage.write(SCENARIOS_KEY, JSON.stringify(list));   // 存的字节和以前一模一样
    }

    function normName(n) { return String(n == null ? "" : n).trim(); }

    function createCustomScenario(name, icon) {
      var clean = normName(name);
      if (!clean) return null;
      var list = loadCustomScenarios();
      // Two scenarios with one name leaves the parent unable to tell which of
      // them a phrase should go into.
      if (list.some(function (x) { return normName(x.name) === clean; })) return null;
      var sc = {
        id: "s_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
        name: clean,
        icon: normName(icon) || DEFAULT_SCENARIO_ICON,
        createdAt: Date.now(),
      };
      list.push(sc);
      saveCustomScenarios(list);
      return sc;
    }

    function renameCustomScenario(id, name) {
      var clean = normName(name);
      if (!clean) return false;
      var list = loadCustomScenarios();
      var sc = list.find(function (x) { return x.id === id; });
      if (!sc) return false;
      if (list.some(function (x) { return x.id !== id && normName(x.name) === clean; })) return false;
      // The id never changes: every phrase in this scenario points at it, and a
      // new id would orphan all of them.
      sc.name = clean;
      saveCustomScenarios(list);
      return true;
    }

    // The saved phrases belonging to one scenario, or all of them when no
    // scenario is given. A self-made scenario is not a new screen — it is the 收藏
    // list with one filter on it, so everything a parent can already do to a saved
    // phrase keeps working inside a scenario without being built twice.
    function phrasesInScenario(tag) {
      var saved = getSaved();
      if (!tag) return saved;
      return saved.filter(function (p) { return p && p.scenario === tag; });
    }

    // Deleting a scenario is tidying, not destruction. Each phrase inside cost a
    // generation to voice and carries months of review progress, so they move to
    // the general translated bucket and stay reachable in 收藏.
    function deleteCustomScenario(id) {
      var list = loadCustomScenarios();
      var at = list.findIndex(function (x) { return x.id === id; });
      if (at === -1) return false;
      var tag = customScenarioTag(id);
      var saved = getSaved();
      for (var i = 0; i < saved.length; i++) {
        var p = saved[i];
        if (p && p.scenario === tag) p.scenario = "__translate__";
      }
      persistSaved();
      list.splice(at, 1);
      saveCustomScenarios(list);
      return true;
    }

    return {
      SCENARIOS_KEY: SCENARIOS_KEY,
      CUSTOM_PREFIX: CUSTOM_PREFIX,
      DEFAULT_SCENARIO_ICON: DEFAULT_SCENARIO_ICON,
      customScenarioTag: customScenarioTag,
      isCustomScenario: isCustomScenario,
      loadCustomScenarios: loadCustomScenarios,
      saveCustomScenarios: saveCustomScenarios,
      createCustomScenario: createCustomScenario,
      renameCustomScenario: renameCustomScenario,
      phrasesInScenario: phrasesInScenario,
      deleteCustomScenario: deleteCustomScenario,
    };
  }

  var api = { create: create, SCENARIOS_KEY: SCENARIOS_KEY, CUSTOM_PREFIX: CUSTOM_PREFIX };
  if (typeof module !== "undefined" && module.exports) module.exports = api;   // Node（测试）
  else root.llCustomScenariosLib = api;                                        // 浏览器
})(typeof globalThis !== "undefined" ? globalThis : this);
