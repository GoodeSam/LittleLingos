// 翻译结果的身份与保存（ADR 0009 第十五块；原 ll:translate-save 块）。
//
// 七个依赖从 create(deps) 传进来，之前都是直接抓全局：
//   api                 —— api-client.js 的实例（llApi）
//   accessErrorMessage  —— access-code.js 的（403 该对家长说什么）
//   getSaved()          —— 取当前收藏列表。**函数**：savedPhrases 会被整个换掉
//   getAge()            —— 取当前年龄档。**函数**：translateAge 在两处被重新赋值
//                          （切年龄档、翻译页上自己选），存一次值的话存下来的条目
//                          年龄永远停在打开应用那一刻
//   persistSaved()      —— 写回收藏
//   onSaved()           —— 存完之后界面要做的事（角标）
//   requestAudio(item)  —— 认领/生成这条的声音
//
// 纯的：不碰 document / window，网络只经 api。普通脚本 + CommonJS 出口。
(function (root) {
  "use strict";

  var TRANSLATE_TIMEOUT_MS = 12000;
  // 和服务端 translate.mjs 的 MAX_INPUT_LEN 同一个数（测试钉着）。在这里就拦下，不发请求：
  // 服务器必拒，发出去只是白等一趟；而且界面要能说「太长了」，不能说成「服务器不可用」。
  var TRANSLATE_MAX_LEN = 200;

  function create(deps) {
    deps = deps || {};
    var api = deps.api;
    var accessErrorMessage = deps.accessErrorMessage || function () { return null; };
    var getSaved = deps.getSaved || function () { return []; };
    var getAge = deps.getAge || function () { return undefined; };
    var persistSaved = deps.persistSaved || function () {};
    var onSaved = deps.onSaved || function () {};
    var requestAudio = deps.requestAudio || function () {};

    // Identity and saving for a translation and the alternatives it comes with.
    //
    // Audio is keyed by id, so every sentence on the translate screen needs its
    // own — sharing one would make the second alternative play the first one's
    // voice. The main sentence's id is minted here rather than at save time so
    // the clip generated on arrival is stored under the id the saved item will
    // carry; a second id at save time would orphan it and pay twice.
    //
    // Date.now() 只到毫秒。批量翻译时命中缓存的几句返回极快，两句落在同一
    // 毫秒完全可能——撞了之后后一句的音频存在前一句的键上，家长点前一句听到
    // 的是后一句。加一个只增不减的序号，同一毫秒里也各是各的。
    var localIdSeq = 0;
    function newLocalId() {
      return "t_" + Date.now() + "_" + (++localIdSeq).toString(36);
    }

    function assignTranslationIds(result) {
      if (!result || !result.en) return;
      if (!result.id) result.id = newLocalId();
      var related = Array.isArray(result.related) ? result.related : [];
      related.forEach(function (r, i) {
        // Suffixed rather than re-stamped: several ids minted in the same
        // millisecond would collide, and Date.now() has exactly that resolution.
        if (r && r.en && !r.id) r.id = result.id + "_r" + i;
      });
    }

    // The translate call with no screen attached, so the translate tab and
    // "add a sentence to my scenario" share one implementation. A second copy is
    // where the timeout, the completeness check and the invite-code handling
    // would quietly drift apart.
    //
    // Returns {ok:true, result} or {ok:false, error, message}. The error kinds are
    // distinct because they send a parent to different places: a missing code is
    // something they can fix, an outage is something to wait out, and telling them
    // the wrong one sends them to restart a router that was never the problem.
    async function translateChinese(zh, age) {
      var clean = String(zh == null ? "" : zh).trim();
      if (!clean) return { ok: false, error: "empty" };
      if (clean.length > TRANSLATE_MAX_LEN) return { ok: false, error: "too-long", max: TRANSLATE_MAX_LEN };
      var r = await api.post("/api/translate", { zh: clean, age: age }, { timeoutMs: TRANSLATE_TIMEOUT_MS });
      if (r.kind === "access") return { ok: false, error: "access", message: accessErrorMessage(r.status) };
      // 失败原因原样带出（network / timeout / server / upstream / malformed / invalid）：
      // 2026-09-27 之前断网、超时、回复异常全被压成 offline，家长看到的都是「离线建议」，
      // 会去检查一个其实正常的网络（PRD 6.8）。对家长说什么，见 translateFailureNotice()。
      if (r.kind !== "ok") return { ok: false, error: r.kind };
      var result = r.body;
      // A result missing its English or its tip is not a usable suggestion —
      // treated as an outage so the caller falls back rather than showing a
      // half-empty card.
      if (!result || !result.en || !result.tip) return { ok: false, error: "incomplete" };
      return { ok: true, result: result };
    }

    // A scenario a parent cannot put anything into is a folder. They supply the
    // one thing they already have — the Chinese they would have said anyway.
    //
    // Nothing is written unless the translation came back. Half a phrase in their
    // own scenario is worse than none: it looks like something they added.
    async function addPhraseToScenario(zh, scenarioTag) {
      var clean = String(zh == null ? "" : zh).trim();
      var t = await translateChinese(clean, getAge());
      if (!t.ok) return t;
      var entry = {
        en: t.result.en,
        // Their own words, kept. The model's rewrite of the Chinese would leave
        // them unable to recognise their own sentence at review time.
        zh: clean,
        tip: t.result.tip || "",
        source: t.result.source || "local",
        scenario: scenarioTag,
      };
      assignTranslationIds(entry);
      if (!saveTranslatedPhrase(entry)) return { ok: false, error: "duplicate" };
      return { ok: true, entry: entry };
    }

    // ☆ hollow means not saved, ★ filled means saved. One convention everywhere:
    // four places offer to save a phrase and they used three between them, two of
    // them backwards — the dictionary drew ⭐, a filled coloured star, for NOT
    // saved and ★ for saved, so the unsaved state looked the fuller of the two.
    function saveStar(isSaved) { return isSaved ? "★" : "☆"; }

    // The one place that decides whether a phrase is already kept. The duplicate
    // guard below and every star drawn on screen ask the same question, so a star
    // can never say one thing while the tap says another.
    function isAlreadySaved(en) {
      if (typeof en !== "string" || !en) return false;
      return getSaved().some(function (p) { return p && p.en === en; });
    }

    // Returns false when nothing was saved — already there, or nothing to save —
    // so the caller can say which rather than leaving the tap unexplained.
    function saveTranslatedPhrase(entry) {
      if (!entry || !entry.en) return false;
      if (isAlreadySaved(entry.en)) return false;
      if (!entry.id) entry.id = newLocalId();
      var saved = getSaved();
      saved.push({
        id: entry.id,
        en: entry.en,
        zh: entry.zh || "",
        tip: entry.tip || "",
        // A phrase added inside a self-made scenario belongs to it; everything
        // else lands in the general translated bucket exactly as before.
        scenario: entry.scenario || "__translate__",
        age: getAge(),
        source: entry.source || "local",
        savedAt: Date.now(),
        rv: { s: 0, due: Date.now() },
      });
      persistSaved();
      onSaved();
      // Claims the clip if one already exists — requestAudio() checks the device
      // before spending anything, so an alternative the parent played before
      // saving costs nothing to keep.
      requestAudio(saved[saved.length - 1]);
      return true;
    }

    return {
      TRANSLATE_TIMEOUT_MS: TRANSLATE_TIMEOUT_MS,
      TRANSLATE_MAX_LEN: TRANSLATE_MAX_LEN,
      newLocalId: newLocalId,
      assignTranslationIds: assignTranslationIds,
      translateChinese: translateChinese,
      addPhraseToScenario: addPhraseToScenario,
      saveStar: saveStar,
      isAlreadySaved: isAlreadySaved,
      saveTranslatedPhrase: saveTranslatedPhrase,
    };
  }

  var api = { create: create, TRANSLATE_TIMEOUT_MS: TRANSLATE_TIMEOUT_MS, TRANSLATE_MAX_LEN: TRANSLATE_MAX_LEN };
  if (typeof module !== "undefined" && module.exports) module.exports = api;   // Node（测试）
  else root.llTranslateSaveLib = api;                                          // 浏览器
})(typeof globalThis !== "undefined" ? globalThis : this);
