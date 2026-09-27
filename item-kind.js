// 「这条收藏是哪一种」的唯一主人（ADR 0009 第七块；原 index.html 的 ll:dictionary-shared 块）。
//
// 三种：scenario（预设句子，有随应用下发的 mp3）/ translate（AI 翻译或自建场景的句子，
// 没有预录 mp3）/ dict（查词存的单词）。判定是正向白名单：只有 scenarios 表里真有这个
// 场景才算 scenario，别的一律 translate——将来再加一种没有预录音频的类型也不会误发
// 一个从没生成过的 mp3 请求。
//
// 两个依赖从 create(deps) 传进来，不抓全局：
//   scenarios()        → 预设场景表（浏览器里是 scenarios.js 定义的全局；它是 defer 加载的，
//                        所以传的是取值函数，用的时候再取）
//   isCustomScenario(tag) → 这个标签是不是家长自建的场景（那些句子是逐条生成、存在本机的，
//                        按 scenario 处理会去找一个从没发过的文件，tech-constraints C13）
// 纯的；普通脚本 + CommonJS 出口（同 storage.js）。
(function (root) {
  "use strict";

  function create(deps) {
    deps = deps || {};
    var getScenarios = typeof deps.scenarios === "function" ? deps.scenarios : function () { return {}; };
    var isCustom = typeof deps.isCustomScenario === "function" ? deps.isCustomScenario : function () { return false; };

    // 收藏 / 复习条目的标题文字只在这里拼：renderSavedScreen / renderReviewCard /
    // renderSavedChips 三处共用，分隔符不会再各写各的。多义词的收藏带 senseLabel
    // （一个简短的中文义项），拼成 "en · senseLabel"；没有就是光秃秃的 en——
    // 绝大多数条目（预设句、翻译、单义词）和原来完全一样，不会冒出 "· undefined"。
    function savedHeadline(item) {
      var en = (item && item.en) ? item.en : "";
      var label = item && item.senseLabel;
      return label ? en + " · " + label : en;
    }

    function classifyItem(item) {
      if (!item) return "translate";
      var id = item.id != null ? String(item.id) : "";
      // 旧版本（a1f7181 之前）存的 t_ 前缀翻译，scenario 字段可能是脏的（比如 "bath"），
      // 必须仍归 translate，否则已存的用户数据会退化成一个 404 的 mp3 请求。
      if (id.indexOf("t_") === 0) return "translate";
      if (item.scenario === "__dict__") return "dict";
      // 自建场景要排在预设检查之前（见文件头 C13）
      if (isCustom(item.scenario)) return "translate";
      var table = getScenarios() || {};
      if (item.scenario && table[item.scenario]) return "scenario";
      return "translate";
    }

    // 只有真正的预设句子才有预录的 <id>_normal.mp3。别的一律直接念，
    // 绝不为一个从没生成过的文件造 Audio() 地址。
    function isAudioBacked(item) {
      return classifyItem(item) === "scenario";
    }

    // 收藏页和复习卡共用的标签/图标，两处不会再对不上（曾经一个写「翻译」一个写「AI 翻译」）。
    function resolveItemLabel(item) {
      var kind = classifyItem(item);
      if (kind === "scenario") {
        var s = getScenarios()[item.scenario];
        // id 让渲染端能取 icons.js 的线性图标；icon 仍是自建场景的兜底。
        return { id: item.scenario, icon: s.icon, name: s.name };
      }
      if (kind === "dict") return { icon: "📖", name: "单词" };
      return { icon: "🔤", name: "AI 翻译" };
    }

    return { savedHeadline: savedHeadline, classifyItem: classifyItem, isAudioBacked: isAudioBacked, resolveItemLabel: resolveItemLabel };
  }

  var api = { create: create };
  if (typeof module !== "undefined" && module.exports) module.exports = api;   // Node（测试）
  else root.llItemKindLib = api;                                               // 浏览器
})(typeof globalThis !== "undefined" ? globalThis : this);
