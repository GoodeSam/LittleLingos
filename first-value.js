// 家长第一次打开到第一条收藏之间那条路上的四个纯函数（ADR 0009 第十三块；原 ll:first-value 块）。
// 现在几点算哪一档、今天推荐哪个场景、第一次收藏后说什么、首页那张引导卡怎么写。
// 画界面的两个（scenarioIconInto / paintIconSlots）留在 index.html——它们碰 DOM。
// 纯的：不碰 document / window / 存储 / 网络。普通脚本 + CommonJS 出口。
(function (root) {
  "use strict";

  // 时段 → 这个钟点最可能正在发生的事。from 含、to 不含；from > to 表示跨零点。
  // 场景 id 必须存在于 scenarios.js —— 有一条测试拿真实数据逐个核对，
  // 因为手写的 id 列表在场景改名时会静默指向 undefined。
  const TIME_BANDS = [
    { from: 5,  to: 9,  ids: ["morning", "dress", "teeth", "handwash", "meal"] },
    { from: 9,  to: 12, ids: ["reading", "music", "art", "blocks", "discover", "praise"] },
    { from: 12, to: 14, ids: ["meal", "handwash", "nap", "manners"] },
    { from: 14, to: 17, ids: ["outdoor", "friends", "share", "exercise", "pretend", "shopping"] },
    { from: 17, to: 20, ids: ["meal", "kitchen", "cleanup", "potty", "emotion"] },
    { from: 20, to: 23, ids: ["bath", "bedtime", "teeth", "reading"] },
    // 半夜喂奶、哄睡、孩子发烧的家长是真实存在的。少了这一档，
    // 凌晨三点打开的人会看到一片空白。
    { from: 23, to: 5,  ids: ["bedtime", "emotion", "sick", "nap"] },
  ];
  function bandForHour(hour) {
    for (const b of TIME_BANDS) {
      const inside = b.from <= b.to
        ? (hour >= b.from && hour < b.to)
        : (hour >= b.from || hour < b.to);   // 跨零点
      if (inside) return b;
    }
    return TIME_BANDS[0];
  }
  // 今天推哪个场景。优先此刻用得上的，其次他还没学过的。
  function pickTodayScenario({ hour, dayIndex, savedScenarioIds }) {
    const band = bandForHour(hour);
    const learned = new Set(savedScenarioIds || []);
    const fresh = band.ids.filter(id => !learned.has(id));
    // 这一档全学过了，就在整档里轮转——总要给出一个，不能给空。
    // （不跳到别的时段：晚上八点推「超市购物」比推一个学过的睡前场景更差。）
    const pool = fresh.length ? fresh : band.ids;
    return pool[Math.abs(dayIndex | 0) % pool.length];
  }
  // 收下第一句之后说的那句话。他刚点了一颗星，不知道那颗星意味着什么。
  // 只在第一次说 —— 每次都说就成了噪音。
  function firstSaveNotice(savedCount) {
    if (savedCount !== 1) return null;
    // 不带 ⭐：这个项目里实心彩星只表示「已收藏」这一个意思，
    // 出现在别处会稀释它（test/save-star.test.mjs 守着这条）。
    return "收好了 —— 明天它会回到「今日复习」等你，你不用记着来找它。";
  }
  // 一条收藏都没有时，首页那张卡的内容。
  // 旧文案是「还没有收藏 — 去场景里探索吧！」：「探索」不是一个动作，
  // 他不知道探索完该干什么，也不知道干完能得到什么。
  function firstValueCard() {
    return {
      // 「最近收藏」是给已经用了一阵的人看的标题。压在「学第一句」上面，
      // 这张卡对刚装上的家长在说两件互相矛盾的事。
      heading: "从这一句开始",
      text: "挑一句现在就用得上的，收下来 —— 明天它会自己回来找你。",
      buttonLabel: "学第一句 →",
      // 「今日推荐」卡在空状态下被隐藏（它和上面这个按钮去的是同一个地方，
      // 一张卡两个主按钮），但它承载的「去哪、为什么」得搬回这里。
      nextLine: (name, n) => `接下来：${name} · ${n} 句（按现在的时间推荐）`,
    };
  }

  var api = { TIME_BANDS: TIME_BANDS, bandForHour: bandForHour, pickTodayScenario: pickTodayScenario, firstSaveNotice: firstSaveNotice, firstValueCard: firstValueCard };
  if (typeof module !== "undefined" && module.exports) module.exports = api;   // Node（测试）
  else root.llFirstValue = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
