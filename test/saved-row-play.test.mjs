#!/usr/bin/env node
// Behavioral tests for playing a phrase from the saved list — not just the one
// card at the top.
//
// Zero-dependency: the module is extracted from index.html between its markers
// and run in a vm context, per test/audio-marks.test.mjs.
//
// WHY. Reported from real use: "只能最上面的一句才能点播放，其他下面的无法点
// 播放". The top card is the review card, a different component; the rows below
// it never had a play control at all. Now that a saved phrase can have a real
// recorded voice on the device, a list of phrases you cannot play is a list of
// clips that were paid for and never heard.
//
// The 🔊 mark doubles as the play control rather than adding a second button.
// A speaker icon already invites a tap, and a row with both a speaker and a
// play button asks the parent to work out the difference.
//
// ⚠️ THE SAME iOS RULE APPLIES HERE and is still unverified: an audio element
// that starts playing after an await may not count as started by that tap. So
// the addresses for every visible row are prepared when the LIST renders, and
// the tap stays synchronous. See ll:audio-playback.
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   1. 家长在收藏列表里看到一条有声音的，点一下就能听——不只是最上面那条。
//
//   2. 点第二条的时候，第一条正在放的声音会停下来。两句英文同时响
//      对着孩子念是没法用的。
//
//   3. 那条没有声音的，点了是去补生成，不是播出一段机器音假装有声音。
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

const A = { id: "t_1", en: "Time for bed.", scenario: "__translate__" };
const B = { id: "t_2", en: "Wash your hands.", scenario: "__translate__" };
const PRESET = { id: "bedtime_01", en: "Time for bed.", scenario: "bedtime" };

function loadModule({ marks = {}, presetIds = ["bedtime_01"] } = {}) {
  const s = html.indexOf(START), e = html.indexOf(END);
  assert.ok(s !== -1 && e !== -1, `index.html must contain ${START} … ${END} markers`);
  const retried = [], played = [];
  const ctx = {
    console,
    audioMarkFor: id => marks[id] || "none",
    retryAudio: item => { retried.push(item); return Promise.resolve(true); },
    isAudioBacked: item => presetIds.includes(item && item.id),
    // From the existing playback path — its own session guard and fallback are
    // covered by test/audio-playback.test.mjs and dictionary-review.test.mjs.
    playReviewAudio: (item, btn) => played.push({ item, btn }),
  };
  vm.createContext(ctx);
  vm.runInContext(html.slice(s, e + END.length), ctx);
  return { ctx, retried, played };
}

// ══ 1. 不只是最上面那一条 ═════════════════════════════════════════════

test("有声音的行，点一下就能听", async () => {
  const { ctx, played } = loadModule({ marks: { [A.id]: "ready" } });
  const v = ctx.audioMarkView(A);
  assert.ok(v.onTap, "有声音却点不动，等于那次生成白花了钱");
  await v.onTap();
  assert.equal(played.length, 1);
  assert.equal(played[0].item, A, "放的必须是这一行，不是别的哪一行");
});

test("列表里第几行都一样能点，不只是第一行", async () => {
  // 这条测试对应的正是那句反馈：「只能最上面的一句才能点播放」。
  const { ctx, played } = loadModule({ marks: { [A.id]: "ready", [B.id]: "ready" } });
  await ctx.audioMarkView(A).onTap();
  await ctx.audioMarkView(B).onTap();
  assert.deepEqual(played.map(p => p.item), [A, B], "两行都要能各放各的");
});

test("预设短语也能从列表里点播", async () => {
  const { ctx, played } = loadModule();
  await ctx.audioMarkView(PRESET).onTap();
  assert.equal(played.length, 1);
  assert.equal(played[0].item, PRESET);
});

// ══ 2. 有声音的点了是播，没声音的点了是补 ═════════════════════════════

test("没有声音的那一行，点了是去补生成，不是放一段机器音", async () => {
  // 放机器音会让家长以为这条已经好了，于是永远不去补。
  const { ctx, retried, played } = loadModule({ marks: { [A.id]: "failed" } });
  await ctx.audioMarkView(A).onTap();
  assert.equal(retried.length, 1, "失败的那一行点了必须是重新生成");
  assert.equal(played.length, 0, "不能拿机器音冒充已经有声音了");

  const ok = loadModule({ marks: { [A.id]: "ready" } });
  await ok.ctx.audioMarkView(A).onTap();
  assert.equal(ok.played.length, 1, "对照：有声音的那一行点了必须是播放");
  assert.equal(ok.retried.length, 0, "对照：有声音了就不该再生成");
});

test("还没生成过的那一行，点了也是去生成", async () => {
  const { ctx, retried, played } = loadModule({ marks: {} });
  await ctx.audioMarkView(A).onTap();
  assert.equal(retried.length, 1);
  assert.equal(played.length, 0);
});

test("正在生成的那一行，点了什么都不做", async () => {
  // 既不该再花一次钱，也不该放一段还不存在的声音。
  const { ctx, retried, played } = loadModule({ marks: { [A.id]: "pending" } });
  const v = ctx.audioMarkView(A);
  if (v.onTap) await v.onTap();
  assert.equal(retried.length, 0);
  assert.equal(played.length, 0);

  const ok = loadModule({ marks: { [A.id]: "ready" } });
  await ok.ctx.audioMarkView(A).onTap();
  assert.equal(ok.played.length, 1, "对照：换成有声音的就必须真的播");
});

// ══ 3. 列表把它接上了，而且提前备好了地址 ═════════════════════════════

test("收藏列表渲染时，把每一行的声音都提前备好", async () => {
  // 断言源码，因为渲染要 DOM。要紧的是：不提前备好的话，每一行的
  // 第一次点击都会落空——而那正是这个模块存在的全部理由（iOS 手势）。
  const at = html.indexOf("function renderSavedScreen");
  assert.ok(at !== -1, "renderSavedScreen not found");
  const body = html.slice(at, html.indexOf("\nfunction ", at + 10));
  assert.match(body, /primeAudioUrl\(/,
    "列表不提前备好地址的话，每一行第一次点都只会退回浏览器朗读");
});

test("列表里那个标记本身就是播放控件，没有第二个按钮", async () => {
  // 一行上既有喇叭又有播放键，是在请家长自己琢磨两者的区别。
  const at = html.indexOf("function renderSavedScreen");
  const body = html.slice(at, html.indexOf("\nfunction ", at + 10));
  assert.match(body, /audioMarkView\(/);
  assert.ok(!/review-btn-play/.test(body),
    "复习卡那个播放按钮不该被复制到列表行上");
});

// ── Runner ───────────────────────────────────────────────
console.log("saved-row play tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
