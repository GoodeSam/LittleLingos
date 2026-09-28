// 复习队列的数据操作（ADR 0009 第十九块；原 ll:review-engine 块里纯的那一半）：
// 今天到期的有哪些、按 id 给一条重新排期。排期算法本身在 review-engine.js。
// reviewAnswer()（带 reviewQueue 这个应用状态和四个重画回调）留在 index.html，归 app-state 那一步。
//
// 四个依赖从 create(deps) 传进来：
//   getSaved()          —— **函数**：savedPhrases 在导入备份和删条目时会被整个换掉
//   persistSaved()      —— 写回收藏
//   review              —— review-engine.js 的实例
//   sortedBySavedAtDesc —— 收藏页的排序（最近收的在前）
// 普通脚本 + CommonJS 出口。
(function (root) {
  "use strict";

  function create(deps) {
    deps = deps || {};
    var getSaved = deps.getSaved || function () { return []; };
    var persistSaved = deps.persistSaved || function () {};
    var review = deps.review;
    var sortedBySavedAtDesc = deps.sortedBySavedAtDesc || function (a) { return a; };

    function dueReviews() {
      const now = Date.now();
      // Newest-saved due items first (render/queue-build-time sort only — see
      // sortedBySavedAtDesc). reviewAnswer() still shift/push()es this queue in
      // place for its own "answer again this session" logic; that in-session
      // reordering is unaffected since it operates on the queue, not this sort.
      return sortedBySavedAtDesc(review.dueItems(getSaved(), now));
    }

    // Reschedule ONE phrase, named by id. This is the form the saved list needs:
    // reviewAnswer() below works on the head of the queue, and a list row wired
    // straight to it would reschedule the FIRST phrase when the parent tapped the
    // fifth — silently, with no error, discoverable only weeks later when the
    // wrong phrase stopped coming up.
    //
    // Returns whether anything was actually rescheduled. An id that is not in
    // savedPhrases changes nothing and writes nothing: the list can be a render
    // behind a deletion, and "not found, so adjust the first one" is the worst
    // possible reading of that.
    function answerById(id, remembered) {
      if (!id) return false;
      const item = getSaved().find(p => p.id === id);
      if (!item) return false;
      // Items saved by older versions, or restored by hand, may have no schedule
      // at all. Give them one rather than throwing.
      const now = Date.now();
      if (!item.rv) item.rv = review.freshSchedule(now);
      // 算法在 review-engine.js；这里原地写回（对象身份和格式 rv:{s,due} 都不变）。
      Object.assign(item.rv, review.nextSchedule(item.rv, remembered, now));
      persistSaved();
      return true;
    }

    return { dueReviews: dueReviews, answerById: answerById };
  }

  var api = { create: create };
  if (typeof module !== "undefined" && module.exports) module.exports = api;   // Node（测试）
  else root.llReviewQueueLib = api;                                            // 浏览器
})(typeof globalThis !== "undefined" ? globalThis : this);
