#!/usr/bin/env node
// Behavioral tests for the alternative phrasings a translation comes with —
// 「还可以这样说」.
//
// Zero-dependency: the module is extracted from index.html between its markers
// and run in a vm context, per test/audio-store.test.mjs.
//
// WHY. Reported from real use: only the main sentence could be heard or kept.
// The alternatives arrived as text and stopped there — a parent who preferred
// one of them had to retype it into the box to get a voice or a place to save
// it. They are the same kind of thing as the main result and were the only
// kind without the same controls.
//
// GENERATED ON DEMAND, not on arrival. The main sentence is voiced the moment
// it appears, which already means paying for the ones glanced at and
// discarded. Doing that for every alternative too would multiply one
// translation into four or five generations, most of them never listened to.
// A tap is the signal that this one is wanted.
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   1. 家长看到「还可以这样说」里更顺口的一句，想听听怎么念——点一下就有。
//
//   2. 他觉得那句更好，收藏它。之后它和别的收藏一样：能复习、能连续播、
//      能标「记住了」。
//
//   3. 他不点的那几句一分钱不花。
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import assert from "node:assert/strict";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");

const START = "/* ll:translate-save:start */";
const END = "/* ll:translate-save:end */";

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

const RESULT = () => ({
  en: "Time for bed, sweetie.",
  zh: "该睡觉了",
  tip: "蹲下来看着他说",
  related: [
    { en: "Let's get ready for bed.", zh: "我们准备睡觉吧" },
    { en: "Bedtime!", zh: "睡觉时间到！" },
  ],
});

function loadModule({ saved = [] } = {}) {
  const s = html.indexOf(START), e = html.indexOf(END);
  assert.ok(s !== -1 && e !== -1, `index.html must contain ${START} … ${END} markers`);
  const calls = { safeSetItem: [], updateNavBadge: 0, requested: [] };
  const ctx = {
    console,
    savedPhrases: saved,
    translateAge: "1-2",
    safeSetItem: (k, v) => calls.safeSetItem.push([k, v]),
    updateNavBadge: () => { calls.updateNavBadge++; },
    requestAudio: item => { calls.requested.push(item); return Promise.resolve(true); },
  };
  vm.createContext(ctx);
  vm.runInContext(html.slice(s, e + END.length), ctx);
  for (const fn of ["assignTranslationIds", "saveTranslatedPhrase"]) {
    assert.equal(typeof ctx[fn], "function", `module must define ${fn}()`);
  }
  return { ctx, calls, saved: ctx.savedPhrases };
}

// ══ 1. 每一句都有自己的身份 ═══════════════════════════════════════════

test("主句和每条备选，各拿各的 id", async () => {
  // 音频以 id 为键。共用一个 id 的话，点第二条备选会放出第一条的声音。
  const { ctx } = loadModule();
  const r = RESULT();
  ctx.assignTranslationIds(r);
  const ids = [r.id, ...r.related.map(x => x.id)];
  assert.ok(ids.every(Boolean), "每一句都要有 id");
  assert.equal(new Set(ids).size, ids.length, `id 撞了：${ids.join(" ")}`);
});

test("再处理一次，已有的 id 不变", async () => {
  // 界面重绘会再走一遍。换 id 等于把刚生成的声音丢掉。
  const { ctx } = loadModule();
  const r = RESULT();
  ctx.assignTranslationIds(r);
  const before = [r.id, ...r.related.map(x => x.id)];
  ctx.assignTranslationIds(r);
  assert.deepEqual([r.id, ...r.related.map(x => x.id)], before);
});

test("没有备选的时候也不出错", async () => {
  const { ctx } = loadModule();
  for (const r of [{ en: "Hi." }, { en: "Hi.", related: null }, { en: "Hi.", related: [] }]) {
    assert.doesNotThrow(() => ctx.assignTranslationIds(r));
    assert.ok(r.id, "主句仍然要有 id");
  }
  assert.doesNotThrow(() => ctx.assignTranslationIds(null));
});

// ══ 2. 收藏一条备选 ═══════════════════════════════════════════════════

test("收藏一条备选，它就是一条正常的收藏", async () => {
  const { ctx, saved } = loadModule();
  const r = RESULT();
  ctx.assignTranslationIds(r);
  assert.equal(ctx.saveTranslatedPhrase(r.related[0]), true);
  assert.equal(saved.length, 1);
  const it = saved[0];
  assert.equal(it.en, "Let's get ready for bed.");
  assert.equal(it.zh, "我们准备睡觉吧");
  assert.equal(it.id, r.related[0].id, "沿用它自己的 id —— 声音就存在那个键下");
  assert.ok(it.rv && typeof it.rv.due === "number", "要能进复习队列，否则收了也不会再出现");
  assert.equal(it.scenario, "__translate__");
});

test("收藏之后写进了本机存储，并刷新了待复习计数", async () => {
  const { ctx, calls } = loadModule();
  const r = RESULT();
  ctx.assignTranslationIds(r);
  ctx.saveTranslatedPhrase(r.related[0]);
  assert.equal(calls.safeSetItem.length, 1);
  assert.equal(calls.safeSetItem[0][0], "ll_saved");
  assert.ok(calls.updateNavBadge >= 1);
});

test("同一句话收藏两次，第二次不重复进列表", async () => {
  const { ctx, saved } = loadModule();
  const r = RESULT();
  ctx.assignTranslationIds(r);
  assert.equal(ctx.saveTranslatedPhrase(r.related[0]), true);
  assert.equal(ctx.saveTranslatedPhrase(r.related[0]), false, "调用方据此提示「已经收藏过了」");
  assert.equal(saved.length, 1);
});

test("收藏时会去认领这句话的声音，而不是重新生成", async () => {
  // requestAudio 自己会先问本机有没有；这里要的是「确实去问了」。
  const { ctx, calls } = loadModule();
  const r = RESULT();
  ctx.assignTranslationIds(r);
  ctx.saveTranslatedPhrase(r.related[1]);
  assert.equal(calls.requested.length, 1);
  assert.equal(calls.requested[0].id, r.related[1].id, "问的必须是这一条");
});

test("主句和备选走同一个收藏实现", async () => {
  // 抄第二份正是本次交付已经踩过两次的坑（见 tech-constraints C13）。
  const { ctx, saved } = loadModule();
  const r = RESULT();
  ctx.assignTranslationIds(r);
  ctx.saveTranslatedPhrase(r);
  ctx.saveTranslatedPhrase(r.related[0]);
  assert.equal(saved.length, 2);
  for (const it of saved) {
    assert.ok(it.id && it.en && it.rv, "两条都该是完整的收藏条目");
  }
});

test("空的、或者没有英文的，收藏不了也不报错", async () => {
  const { ctx, saved } = loadModule();
  for (const bad of [null, undefined, {}, { zh: "只有中文" }]) {
    assert.equal(ctx.saveTranslatedPhrase(bad), false);
  }
  assert.equal(saved.length, 0);
  const r = RESULT();
  ctx.assignTranslationIds(r);
  assert.equal(ctx.saveTranslatedPhrase(r), true, "对照：正常的必须能收藏");
});

// ══ 3. 不点的那几句一分钱不花 ═════════════════════════════════════════

test("光是显示出来，不会去生成任何一条备选的声音", async () => {
  // 主句是一出来就生成的，已经在为看一眼就丢的句子付钱。备选再自动生成，
  // 一次翻译就是四五次生成，绝大多数没人听。
  const { ctx, calls } = loadModule();
  const r = RESULT();
  ctx.assignTranslationIds(r);
  assert.equal(calls.requested.length, 0, "分配 id 不该触发任何生成");
});

// ══ 4. 界面接上了 ═════════════════════════════════════════════════════

test("每条备选都带播放和收藏两个按钮", async () => {
  const at = html.indexOf("function renderRelatedExpressions");
  assert.ok(at !== -1, "renderRelatedExpressions not found");
  const body = html.slice(at, html.indexOf("\nfunction ", at + 10));
  assert.match(body, /saveTranslatedPhrase\(/, "没有收藏键，家长只能把那句话重打一遍");
  assert.match(body, /playableUrlFor\(|requestAudio\(/, "没有播放键，那几句就只是文字");
});

test("主句的收藏也改用了共用实现", async () => {
  const at = html.indexOf("function saveTranslation");
  const body = html.slice(at, html.indexOf("\n}", at));
  assert.match(body, /saveTranslatedPhrase\(/, "两处各写一份，迟早会分叉");
});

// ── Runner ───────────────────────────────────────────────
console.log("related-expressions tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
