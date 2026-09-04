#!/usr/bin/env node
// Behavioral tests for the star that says whether a phrase is already saved.
//
// Zero-dependency: the ll:translate-save block is extracted from index.html
// and run in a vm context, per test/related-expressions.test.mjs.
//
// WHY. Four places offer to save a phrase and they used three different icon
// conventions between them — two of them backwards. The dictionary drew ⭐, a
// filled coloured star, for NOT saved and ★, a plain one, for saved: the
// unsaved state looked more filled than the saved one. The translate screen
// drew ♡ and never changed it at all, so a parent could tap 收藏 on the same
// sentence twice and only find out from an alert.
//
// ☆ hollow means not saved. ★ filled means saved. Everywhere.
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   家长扫一眼就知道这句话收没收过——不用点下去、也不用去收藏页对一遍。
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

function loadModule({ saved = [] } = {}) {
  const s = html.indexOf(START), e = html.indexOf(END);
  const ctx = {
    console, savedPhrases: saved, translateAge: "1-2",
    safeSetItem: () => {}, updateNavBadge: () => {}, requestAudio: () => Promise.resolve(true),
  };
  vm.createContext(ctx);
  vm.runInContext(html.slice(s, e + END.length), ctx);
  for (const fn of ["isAlreadySaved", "saveStar"]) {
    assert.equal(typeof ctx[fn], "function", `module must define ${fn}()`);
  }
  return { ctx };
}

const P = en => ({ id: "t_" + en, en, zh: "x", scenario: "__translate__", rv: { s: 0, due: 1 } });

// ══ 1. 实心表示已收藏 ═════════════════════════════════════════════════

test("已收藏的是实心，没收藏的是空心", async () => {
  const { ctx } = loadModule();
  assert.equal(ctx.saveStar(true), "★");
  assert.equal(ctx.saveStar(false), "☆");
  assert.notEqual(ctx.saveStar(true), ctx.saveStar(false), "两种状态看起来必须不一样");
});

test("表示「没收藏」的那个，不能是实心的彩色星", async () => {
  // 词典页原来用 ⭐ 表示未收藏、★ 表示已收藏 —— 未收藏那个反而更实心。
  const { ctx } = loadModule();
  assert.ok(!ctx.saveStar(false).includes("⭐"),
    "⭐ 是实心彩星，拿它表示「还没收藏」会把意思读反");
});

// ══ 2. 判断收没收过，只有一处实现 ═════════════════════════════════════

test("这句话收没收过，问得出来", async () => {
  const { ctx } = loadModule({ saved: [P("Time for bed.")] });
  assert.equal(ctx.isAlreadySaved("Time for bed."), true);
  assert.equal(ctx.isAlreadySaved("Wash your hands."), false);
});

test("空的、没有英文的，一律算没收过", async () => {
  const { ctx } = loadModule({ saved: [P("Time for bed.")] });
  for (const bad of [null, undefined, "", {}]) {
    assert.equal(ctx.isAlreadySaved(bad), false);
  }
});

test("收藏之后，同一句话就算收过了", async () => {
  const { ctx } = loadModule();
  const r = { en: "Time for bed.", zh: "睡觉" };
  assert.equal(ctx.isAlreadySaved(r.en), false, "对照：收之前是没收过");
  ctx.assignTranslationIds(r);
  ctx.saveTranslatedPhrase(r);
  assert.equal(ctx.isAlreadySaved(r.en), true);
});

test("拦重复收藏用的，和界面画星星用的，是同一个判断", async () => {
  // 两处各写一份的话，会出现「星星是实心但点下去说没收过」这种自相矛盾。
  const at = html.indexOf("function saveTranslatedPhrase");
  const body = html.slice(at, html.indexOf("\n}", at));
  assert.match(body, /isAlreadySaved\(/,
    "去重必须走同一个判断，否则界面和行为会各说各的");
});

// ══ 3. 四个入口都改过来了 ═════════════════════════════════════════════

test("翻译主句的收藏按钮反映状态", async () => {
  // 原来是写死的 ♡，收过了也不变 —— 家长只能靠点一下、看弹窗才知道。
  // 只看那个按钮本身。♡ 合法地出现在收藏页标题和底部标签上 —— 那是
  // 「收藏夹」这个区域的图标，不是「这一条收没收过」的状态。
  const at = html.indexOf('id="resultSaveBtn"');
  assert.ok(at !== -1, "翻译结果上的收藏按钮找不到了");
  const btn = html.slice(html.lastIndexOf("<button", at), html.indexOf("</button>", at));
  assert.ok(!/♡/.test(btn), "这个按钮不该是写死的心形 —— 它要反映收没收过");
  assert.match(html, /function paintSaveBtn/, "要有个地方按当前状态重画它");
});

test("备选句的收藏按钮，一显示出来就反映状态", async () => {
  // 重新翻译同一句时，已经收过的那条不该还提示「收藏」。
  const at = html.indexOf("function renderRelatedExpressions");
  const body = html.slice(at, html.indexOf("\nfunction ", at + 10));
  assert.match(body, /isAlreadySaved\(/, "渲染时就要知道收没收过");
  assert.match(body, /saveStar\(/, "图标要走共用那个");
  assert.ok(!/"⭐/.test(body), "不该再用实心彩星表示未收藏");
});

test("词典的加入复习按钮，未收藏时是空心", async () => {
  const at = html.indexOf('saveBtn.className = "dict-save-btn"');
  assert.ok(at !== -1, "dict save button not found");
  const near = html.slice(at, at + 300);
  assert.ok(!/⭐/.test(near), "未收藏用实心彩星，比已收藏那个还满");
  assert.match(near, /saveStar\(|☆/, "未收藏要用空心");
});

test("整个文件里，未收藏状态不再出现实心彩星", async () => {
  // ⭐ 只允许留在标题这类装饰位置上，不许再当状态用。
  // 先剥注释再数 —— 注释里提到它是在解释为什么不用它。一个会被散文
  // 触发的守卫，会教人去削弱它。
  const code = html.replace(/\/\*[\\s\\S]*?\*\//g, "")
                   .replace(/^[ \t]*\/\/.*$/gm, "");
  const uses = [...code.matchAll(/⭐/g)];
  assert.ok(uses.length <= 1,
    `⭐ 在代码里还出现 ${uses.length} 次；它只该留在「最近收藏」那个标题上`);
});

console.log("save-star tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
