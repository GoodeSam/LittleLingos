#!/usr/bin/env node
// Behavioral tests for judging a phrase from the saved list — any row, not
// just the one at the top of the review card.
//
// Zero-dependency: the ll:review-engine block is extracted from index.html and
// run in a vm context, per test/dictionary-review-engine.test.mjs (which
// covers the existing queue-based path and stays untouched).
//
// THE FAILURE THIS EXISTS TO PREVENT. reviewAnswer() operates on
// reviewQueue.shift() — the head of the queue. Wiring a list row straight to
// it means tapping 记住了 on the fifth row reschedules the FIRST one: silently,
// with no error, and discoverable only weeks later when the wrong phrase stops
// coming up. So the list gets a function addressed BY ID, and the review card
// keeps its own queue semantics.
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   1. 家长在收藏列表里翻到某一条，点「记住了」——被推迟的必须是**那一条**，
//      不是列表里的第一条，也不是复习卡上正显示的那条。
//
//   2. 点「还要练」，那一条今天要再出现一次。
//
//   3. 顶部复习卡的行为一点不变：答完一条换下一条，答错的这一轮还会回来。
//
//   4. 一条已经删掉的、或者根本不存在的条目，不会因为被点到而把别人的
//      复习时间改掉。
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import assert from "node:assert/strict";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");

const START = "/* ll:review-engine:start */";
const END = "/* ll:review-engine:end */";

const INTERVALS = [1, 3, 7, 14, 30];
const DAY = 86400000;

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

function item(id, { s = 0, dueIn = 0, savedAt = 1 } = {}) {
  return { id, en: id, zh: id, savedAt, rv: { s, due: Date.now() + dueIn } };
}

function loadModule(savedPhrases = []) {
  const s = html.indexOf(START), e = html.indexOf(END);
  assert.ok(s !== -1 && e !== -1, `index.html must contain ${START} … ${END} markers`);
  const calls = { safeSetItem: [], updateNavBadge: 0, renderReviewStrip: 0, renderReviewCard: 0, renderReviewArea: 0, renderSavedScreen: 0 };
  const ctx = {
    savedPhrases,
    REVIEW_INTERVALS: INTERVALS,
    sortedBySavedAtDesc: arr => [...arr].sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0)),
    safeSetItem: (k, v) => calls.safeSetItem.push([k, v]),
    updateNavBadge: () => { calls.updateNavBadge++; },
    renderReviewStrip: () => { calls.renderReviewStrip++; },
    renderReviewCard: () => { calls.renderReviewCard++; },
    renderReviewArea: () => { calls.renderReviewArea++; },
    renderSavedScreen: () => { calls.renderSavedScreen++; },
    console,
  };
  vm.createContext(ctx);
  vm.runInContext(html.slice(s, e + END.length), ctx);
  for (const fn of ["answerById", "reviewAnswer", "dueReviews"]) {
    assert.equal(typeof ctx[fn], "function", `module must define ${fn}()`);
  }
  return { ctx, calls, savedPhrases };
}

// ══ 1. 改的必须是被点的那一条 ═════════════════════════════════════════

test("点第几行就改第几行——不是列表里的第一条", async () => {
  // 这一条是整个改动存在的理由。接错的话没有任何报错，家长几周后才会
  // 发现某句话不再出现了，而且不知道为什么。
  const a = item("a", { s: 0 }), b = item("b", { s: 0 }), c = item("c", { s: 0 });
  const { ctx } = loadModule([a, b, c]);
  ctx.answerById("c", true);
  assert.equal(c.rv.s, 1, "被点的那一条必须前进一级");
  assert.equal(a.rv.s, 0, "第一条不该被动");
  assert.equal(b.rv.s, 0, "中间那条也不该被动");
});

test("推迟的天数按它自己的进度算，不是按别人的", async () => {
  const a = item("a", { s: 4 }), b = item("b", { s: 0 });
  const { ctx } = loadModule([a, b]);
  const before = Date.now();
  ctx.answerById("b", true);
  const days = (b.rv.due - before) / DAY;
  assert.ok(days >= INTERVALS[0] - 0.01 && days <= INTERVALS[0] + 0.01,
    `第一次答对应该是 ${INTERVALS[0]} 天后，实际 ${days.toFixed(2)} 天`);
  assert.equal(a.rv.s, 4, "另一条的进度一点不变");
});

test("连着答对，一级一级往后推", async () => {
  const x = item("x", { s: 0 });
  const { ctx } = loadModule([x]);
  for (let i = 0; i < INTERVALS.length; i++) {
    const before = Date.now();
    ctx.answerById("x", true);
    assert.equal(x.rv.s, i + 1);
    const days = (x.rv.due - before) / DAY;
    assert.ok(Math.abs(days - INTERVALS[i]) < 0.01,
      `第 ${i + 1} 次应该推 ${INTERVALS[i]} 天，实际 ${days.toFixed(2)}`);
  }
});

test("推到头之后不会再往上爬", async () => {
  // 上限之外还继续加的话，rv.s 会长成一个没有对应间隔的数字。
  const x = item("x", { s: INTERVALS.length });
  const { ctx } = loadModule([x]);
  ctx.answerById("x", true);
  assert.equal(x.rv.s, INTERVALS.length);
  const days = (x.rv.due - Date.now()) / DAY;
  assert.ok(Math.abs(days - INTERVALS[INTERVALS.length - 1]) < 0.01);
});

// ══ 2. 「还要练」让它今天再来一次 ═════════════════════════════════════

test("点「还要练」，那一条今天就重新到期", async () => {
  const a = item("a", { s: 3, dueIn: 30 * DAY }), b = item("b", { s: 2, dueIn: 30 * DAY });
  const { ctx } = loadModule([a, b]);
  ctx.answerById("b", false);
  assert.equal(b.rv.s, 0, "回到起点");
  assert.ok(b.rv.due <= Date.now(), "今天就该再出现");
  assert.ok(ctx.dueReviews().some(p => p.id === "b"), "必须真的进了今天的队列");
  assert.equal(a.rv.s, 3, "另一条不受影响");
  assert.ok(!ctx.dueReviews().some(p => p.id === "a"), "另一条不该被拉进今天");
});

test("点「记住了」，那一条从今天的队列里消失", async () => {
  const x = item("x", { s: 0, dueIn: -1000 });   // 已到期
  const { ctx } = loadModule([x]);
  assert.ok(ctx.dueReviews().some(p => p.id === "x"), "对照：答之前它确实在队列里");
  ctx.answerById("x", true);
  assert.ok(!ctx.dueReviews().some(p => p.id === "x"), "答对之后不该还挂在今天");
});

// ══ 3. 存下来了，而且只存一次 ═════════════════════════════════════════

test("答完之后真的写进了本机存储", async () => {
  // 不写的话，家长关掉 App 再打开，刚才那次判断就没了。
  const { ctx, calls } = loadModule([item("x")]);
  ctx.answerById("x", true);
  assert.equal(calls.safeSetItem.length, 1);
  assert.equal(calls.safeSetItem[0][0], "ll_saved");
});

// ══ 4. 点到一条不存在的，不许伤到别人 ═════════════════════════════════

test("点一条已经删掉的，不会改到队首那一条", async () => {
  // 列表渲染和删除之间存在时间差：家长删掉一条之后、界面还没重绘时
  // 点到了旧的那一行。这时候「找不到就默默改第一条」是最坏的行为。
  const a = item("a", { s: 2 }), b = item("b", { s: 1 });
  const { ctx, calls } = loadModule([a, b]);
  assert.doesNotThrow(() => ctx.answerById("已经删掉了", true));
  assert.equal(a.rv.s, 2, "队首那条不许被动");
  assert.equal(b.rv.s, 1);
  assert.equal(calls.safeSetItem.length, 0, "什么都没改，就不该写存储");

  const ok = loadModule([item("a")]);
  ok.ctx.answerById("a", true);
  assert.equal(ok.calls.safeSetItem.length, 1, "对照：点存在的那条必须写");
});

test("传空 id 进来，也不许伤到别人", async () => {
  const a = item("a", { s: 2 });
  const { ctx, calls } = loadModule([a]);
  for (const bad of [null, undefined, ""]) {
    assert.doesNotThrow(() => ctx.answerById(bad, true));
  }
  assert.equal(a.rv.s, 2);
  assert.equal(calls.safeSetItem.length, 0, "什么都没改，就不该写存储");
  // 对照：换成真的 id 必须真的改动 —— 否则上面这几个「没变」
  // 只说明这个函数从不改任何东西。
  ctx.answerById("a", true);
  assert.equal(a.rv.s, 3, "对照：正常 id 必须真的推进");
});

test("一条从来没复习过、连进度都没有的，也能被判断", async () => {
  // 从旧版本升上来的、或者手工恢复进来的条目可能没有 rv 字段。
  const x = { id: "x", en: "x", savedAt: 1 };     // 没有 rv
  const { ctx } = loadModule([x]);
  assert.doesNotThrow(() => ctx.answerById("x", true));
  assert.ok(x.rv, "必须给它补上一个进度，而不是崩掉");
  assert.equal(x.rv.s, 1);
});

// ══ 5. 顶部复习卡的行为一点不变 ═══════════════════════════════════════

test("复习卡答对之后换下一条，答错的这一轮还会回来", async () => {
  // 这是既有行为，不许因为这次重构被改掉。dictionary-review-engine.test.mjs
  // 也在验它，这里再验一遍是因为两个函数现在共用同一段排程逻辑。
  const a = item("a", { s: 0, dueIn: -2000, savedAt: 2 });
  const b = item("b", { s: 0, dueIn: -1000, savedAt: 1 });
  const { ctx } = loadModule([a, b]);
  ctx.__primeReviewQueueForTest([a, b]);
  ctx.reviewAnswer(true);
  assert.equal(a.rv.s, 1, "答对的是队首那条");
  assert.equal(b.rv.s, 0);

  ctx.__primeReviewQueueForTest([b]);
  ctx.reviewAnswer(false);
  assert.equal(b.rv.s, 0, "答错回到起点");
  assert.ok(b.rv.due <= Date.now(), "而且今天还会再来一次");
});

test("从列表答一条，顶部那张卡不会因此指到别人身上", async () => {
  // 列表操作之后必须重建队列。只改对象不重建的话，队列里还留着那条
  // 已经答完的，复习卡会把它再显示一遍。
  const a = item("a", { s: 0, dueIn: -2000, savedAt: 2 });
  const b = item("b", { s: 0, dueIn: -1000, savedAt: 1 });
  const { ctx } = loadModule([a, b]);
  ctx.__primeReviewQueueForTest(ctx.dueReviews());
  ctx.answerById("a", true);
  assert.ok(!ctx.dueReviews().some(p => p.id === "a"), "答完的不该还在今天的队列里");
});

// ══ 6. 列表真的把按钮接上了 ═══════════════════════════════════════════

test("收藏列表的每一行都能判断，不只是最上面那条", async () => {
  // 断言源码，因为渲染要 DOM。对应的正是那句反馈：
  // 「可以选择还要练还是记住了两个选项，但是其他下面的无法选择」。
  const at = html.indexOf("function renderSavedScreen");
  assert.ok(at !== -1, "renderSavedScreen not found");
  const body = html.slice(at, html.indexOf("\nfunction ", at + 10));
  assert.match(body, /answerById\(/, "列表不接上的话，家长仍然只能对最上面那条做判断");
  assert.ok(!/reviewAnswer\(/.test(body),
    "列表绝不能调队列版——那会让点第 5 行改到第 1 行");
});

// ── Runner ───────────────────────────────────────────────
console.log("answer-by-id tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
