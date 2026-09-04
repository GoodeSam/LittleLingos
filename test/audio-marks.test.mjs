#!/usr/bin/env node
// Behavioral tests for the audio mark on a saved row — the small piece that
// makes the rest of ADR 0003 visible.
//
// Zero-dependency: the module is extracted from index.html between its markers
// and run in a vm context, per test/audio-store.test.mjs.
//
// WHY THIS EXISTS. Everything else in this feature is invisible. A parent taps
// 收藏, something happens for three seconds, and then they hear either a real
// recorded voice or the browser's own speech — and cannot tell which. Airplane
// mode does not settle it either: browser speech works offline too. So the
// only honest answer is to say it on the row.
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   1. 家长收藏一句话之后，那一行上能看出来「这句已经有声音了」，
//      不用点开听、也不用猜。
//
//   2. 还在生成的时候看得出在生成；没生成出来的时候看得出没成，
//      并且知道可以点一下再试。这两者混在一起的话，他会盯着一个
//      永远不动的圈等下去。
//
//   3. 预设短语本来就有声音，不该被标成「没有」——那 1204 段
//      是随应用一起下发的，不走这套按条生成的机制。
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import assert from "node:assert/strict";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");

const START = "/* ll:audio-marks:start */";
const END = "/* ll:audio-marks:end */";

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

const TRANSLATED = { id: "t_1725300000000", en: "Time for bed.", scenario: "__translate__" };
const DICT = { id: "w_eat__v", en: "eat", scenario: "__dict__" };
const PRESET = { id: "bedtime_01", en: "Time for bed.", scenario: "bedtime" };

function loadModule({ marks = {}, presetIds = ["bedtime_01"] } = {}) {
  const s = html.indexOf(START), e = html.indexOf(END);
  assert.ok(s !== -1 && e !== -1, `index.html must contain ${START} … ${END} markers`);
  const retried = [], played = [];
  const ctx = {
    console,
    // From ll:audio-provision — its own 18 tests cover what it returns.
    audioMarkFor: id => marks[id] || "none",
    retryAudio: item => { retried.push(item); return Promise.resolve(true); },
    // From ll:dictionary-shared — preset phrases ship with their own mp3.
    isAudioBacked: item => presetIds.includes(item && item.id),
    // 🔊 now doubles as the play control, so tapping a ready row calls this.
    // A recording double, not the real thing: playReviewAudio() carries its own
    // session guard and speech-synthesis fallback, already covered by
    // test/audio-playback.test.mjs and test/dictionary-review.test.mjs, and
    // running it here would drag in Audio, stopAllAudio and speakText.
    playReviewAudio: item => { played.push(item); },
  };
  vm.createContext(ctx);
  vm.runInContext(html.slice(s, e + END.length), ctx);
  assert.equal(typeof ctx.audioMarkView, "function", "module must define audioMarkView()");
  return { ctx, retried, played };
}

// ══ 1. 看得出这句已经有声音了 ═════════════════════════════════════════

test("声音已经在手机上的条目，行上看得出来", async () => {
  const { ctx } = loadModule({ marks: { [TRANSLATED.id]: "ready" } });
  const v = ctx.audioMarkView(TRANSLATED);
  assert.ok(v, "有声音这件事必须显示出来，否则家长只能靠听猜");
  assert.equal(v.icon, "🔊");
  assert.match(v.label, /声音|已有|可听/, "读屏软件要念得出它是什么意思");
  assert.equal(v.canRetry, false, "已经好了的东西不该请人再点一次");
});

test("预设短语本来就有声音，不能被标成没有", async () => {
  // 那 1204 段随应用下发，不走按条生成，所以问「本机存了没有」永远是 none。
  // 照这个答案画的话，一整屏预设短语会全部显示成没有声音。
  const { ctx } = loadModule({ marks: {} });   // 存储里什么都没有
  const v = ctx.audioMarkView(PRESET);
  assert.equal(v.icon, "🔊", "预设短语必须显示为有声音");
  assert.equal(v.canRetry, false);
});

test("查词收藏的条目和翻译收藏的一视同仁", async () => {
  const { ctx } = loadModule({ marks: { [DICT.id]: "ready" } });
  assert.equal(ctx.audioMarkView(DICT).icon, "🔊");
});

// ══ 2. 生成中和生成失败是两回事 ═══════════════════════════════════════

test("正在生成的时候看得出在生成", async () => {
  const { ctx } = loadModule({ marks: { [TRANSLATED.id]: "pending" } });
  const v = ctx.audioMarkView(TRANSLATED);
  assert.equal(v.icon, "⏳");
  assert.equal(v.canRetry, false, "还在跑的时候请人重试，只会白花一次钱");
});

test("没生成出来的时候看得出没成，而且能点一下再试", async () => {
  // 和「正在生成」混在一起的话，家长会盯着一个永远不动的圈等下去。
  const { ctx } = loadModule({ marks: { [TRANSLATED.id]: "failed" } });
  const v = ctx.audioMarkView(TRANSLATED);
  assert.equal(v.icon, "⚠");
  assert.equal(v.canRetry, true, "失败是唯一一个「你可以做点什么」的状态");
  assert.match(v.label, /重试|再试|没有声音/, "读屏软件要念得出下一步能做什么");
});

test("四种状态的图标两两不同——不然标了等于没标", async () => {
  const seen = new Set();
  for (const state of ["ready", "pending", "failed", "none"]) {
    const { ctx } = loadModule({ marks: { [TRANSLATED.id]: state } });
    seen.add(ctx.audioMarkView(TRANSLATED).icon);
  }
  assert.equal(seen.size, 4, `只有 ${seen.size} 种图标：${[...seen].join(" ")}`);
});

test("还没轮到生成的条目，也说清它现在没有声音", async () => {
  // 从备份恢复来的就是这一类：句子在，声音没有（备份不带音频，ADR 0003）。
  const { ctx } = loadModule({ marks: {} });
  const v = ctx.audioMarkView(TRANSLATED);
  assert.match(v.label, /没有声音|暂无/, "家长要知道这条现在点了会是机器音");
  assert.equal(v.canRetry, true, "恢复回来的条目应该能补生成");
});

// ══ 3. 点那个标记会发生什么 ═══════════════════════════════════════════

test("点一下失败的标记，真的会再试一次", async () => {
  const { ctx, retried } = loadModule({ marks: { [TRANSLATED.id]: "failed" } });
  const v = ctx.audioMarkView(TRANSLATED);
  await v.onTap();
  assert.equal(retried.length, 1, "点了不重试的话，那个 ⚠ 就只是个装饰");
  assert.equal(retried[0], TRANSLATED, "重试的必须是这一条，不是别的");
});

test("已经好了、或者正在生成的，点了都不会白花一次钱", async () => {
  // 对照组和主张写在一起：没有对照的话，一个根本不提供点击行为的
  // 实现也能让这两个 0 成立。
  const fail = loadModule({ marks: { [TRANSLATED.id]: "failed" } });
  await fail.ctx.audioMarkView(TRANSLATED).onTap();
  assert.equal(fail.retried.length, 1, "对照：失败的那个点了必须真的重试");

  for (const state of ["ready", "pending"]) {
    const { ctx, retried, played } = loadModule({ marks: { [TRANSLATED.id]: state } });
    const v = ctx.audioMarkView(TRANSLATED);
    if (v.onTap) await v.onTap();
    assert.equal(retried.length, 0, `${state} 的时候再生成一次是纯粹的浪费`);
    // 已经有声音的，点了该做的是放出来 —— 只验「没重试」的话，
    // 一个点了什么都不做的实现同样成立。
    assert.equal(played.length, state === "ready" ? 1 : 0,
      state === "ready" ? "有声音的点了必须真的播" : "还在生成的点了不该播一段还不存在的声音");
  }
});

test("传进来一个空条目，不崩", async () => {
  const { ctx } = loadModule({ marks: { [TRANSLATED.id]: "ready" } });
  for (const bad of [null, undefined, {}]) {
    assert.doesNotThrow(() => ctx.audioMarkView(bad));
  }
  // 对照：正常条目给出的必须是「有声音」那一个，而不是随便一个对象——
  // 一个永远返回同一坨东西的实现同样不会崩。
  assert.equal(ctx.audioMarkView(TRANSLATED).icon, "🔊", "对照：正常条目必须给出对应的标记");
});

// ══ 4. 列表真的把它画出来了 ═══════════════════════════════════════════

test("收藏列表每一行都带上这个标记", async () => {
  // 断言源码，因为渲染要 DOM 才能跑。要紧的是它确实被画出来了——
  // 只算不画，这一整轮等于没做。
  const at = html.indexOf("function renderSavedScreen");
  assert.ok(at !== -1, "renderSavedScreen not found");
  const body = html.slice(at, html.indexOf("\nfunction ", at + 10));
  assert.match(body, /audioMarkView\(/, "列表不画的话，家长仍然只能靠听猜");
});

// ── Runner ───────────────────────────────────────────────
console.log("audio-marks tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
