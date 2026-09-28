// 复习怎么排的唯一主人（ADR 0009 第四块）。
//
// 由来：间隔表和「答对 / 答错之后下一次什么时候」散在 index.html 三处（顶层常量、
// ll:review-engine 块、查词重查那一段各写了一份 s=0/due=now）。P01「复习间隔按一周
// 重算」一旦定了规格，改这一个文件就够——前提是只有这一个文件管这件事。
//
// 硬约束：数据格式 rv:{ s, due } 不动。间隔表只经明确决定才动（P01，2026-09-28 动过一次）。
// 纯的：时间从外面传进来（now），不碰 Date.now / window / 存储。返回新对象，不改传入的。
// 普通脚本 + CommonJS 出口（同 storage.js）：首页一开就要数「今天到期几句」。
(function (root) {
  "use strict";

  var DAY = 86400000;
  // 答对第 1 次 → 1 天后；第 2 次 → 2 天；第 3 次 → 4 天；第 4 次起停在 7 天。
  // P01（2026-09-28，Victor 定）：ADR 0007 把目标定为「一周内还记得」，14、30 天服务的是射程外
  // 的目标，退掉；任何一句都不会超过一周不回来。原表 [1,3,7,14,30]。
  // 不迁移：家长手机上已存的 due 一个不动，答对那次起才用新表；旧表下 s=5 的答对后收到 s=4。
  var INTERVALS = Object.freeze([1, 2, 4, 7]);

  // 刚开始 / 回到起点：档位 0，现在就到期。
  function freshSchedule(now) {
    return { s: 0, due: now };
  }

  // 答完之后的下一次。remembered = true 往后排一档，false 回到起点。
  // 没有排期（老版本存的、手工恢复的）的当作档位 0。
  function nextSchedule(rv, remembered, now) {
    var cur = rv && typeof rv === "object" ? rv : freshSchedule(now);
    if (!remembered) return freshSchedule(now);
    var s = Math.min((cur.s || 0) + 1, INTERVALS.length);
    var days = INTERVALS[Math.min(s - 1, INTERVALS.length - 1)];
    return { s: s, due: now + days * DAY };
  }

  function isDue(item, now) {
    return !!(item && item.rv && typeof item.rv === "object" && item.rv.due <= now);
  }

  // 到期的那些，保持传入顺序（怎么排先后归界面）。
  function dueItems(list, now) {
    if (!Array.isArray(list)) return [];
    return list.filter(function (p) { return isDue(p, now); });
  }

  var api = { INTERVALS: INTERVALS, freshSchedule: freshSchedule, nextSchedule: nextSchedule, isDue: isDue, dueItems: dueItems };
  if (typeof module !== "undefined" && module.exports) module.exports = api;   // Node（测试）
  else root.llReview = api;                                                    // 浏览器
})(typeof globalThis !== "undefined" ? globalThis : this);
