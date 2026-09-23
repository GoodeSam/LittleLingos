#!/usr/bin/env node
// 场景卡上那个 ✓「今天用了」：点错了要能取消。
//
// Victor 2026-09-23 问起这个按钮做什么用，才发现它只进不出——点下去就没法
// 撤回，误点一下要等到第二天自动清零。打卡记的是「我今天真对孩子说过这句」，
// 记错了却改不了，家长下次就不敢点了。
//
// 对应的用户情境（不含函数名）：
//   1. 第一次点：这句算今天用过了，首页的今日进度跟着加一。
//   2. 再点一次：取消，这句不再算今天用过，首页的今日进度跟着减一。
//   3. 一来一回之后再点：又算用过——可以反复切，不会卡死在某一边。
//   4. 取消之后按钮回到没打勾的样子（不是绿的），读屏念的也跟着变回去。
//   5. 取消的是这一句，别的句子今天用过的记录不受影响。
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

function fnSource(name) {
  const at = html.indexOf(`function ${name}(`);
  assert.ok(at !== -1, `找不到 ${name}`);
  return html.slice(at, html.indexOf("\n}", at) + 2);
}

// 基础类名就叫 used-btn，"包含 used" 会永远为真——按空格切开逐个比。
const hasClass = (el, c) => el.className.split(/\s+/).includes(c);

function load(initial = []) {
  const repaints = { grid: 0, today: 0 };
  const saved = [];
  const btn = { className: "used-btn", innerHTML: "", attrs: {},
    setAttribute: (k, v) => { btn.attrs[k] = v; } };
  const ctx = {
    usedToday: initial.slice(),
    saveUsedToday() { saved.push(ctx.usedToday.slice()); },
    renderScenarioGrid() { repaints.grid++; },
    renderTodayProgress() { repaints.today++; },
    document: { getElementById: id => (id === "used-p1" ? btn : null) },
    llIcon: () => "",
  };
  vm.createContext(ctx);
  vm.runInContext(fnSource("markUsed"), ctx);
  return { ctx, btn, repaints, saved };
}

test("第一次点：这句算今天用过了，首页要重画", () => {
  const { ctx, btn, repaints, saved } = load();
  ctx.markUsed("p1");
  assert.deepEqual(Array.from(ctx.usedToday), ["p1"]);
  assert.ok(hasClass(btn, "used"), `按钮没变成打勾的样子：${btn.className}`);
  assert.equal(btn.attrs["aria-label"], "已使用");
  assert.equal(repaints.today, 1, "首页的今日进度没跟着重画");
  assert.equal(saved.length, 1, "没有存下来");
});

test("再点一次：取消，这句不再算今天用过", () => {
  const { ctx, btn, repaints, saved } = load();
  ctx.markUsed("p1");
  ctx.markUsed("p1");
  assert.deepEqual(Array.from(ctx.usedToday), [], "再点一次没有取消");
  assert.equal(saved.length, 2, "取消之后没存");
  assert.equal(repaints.today, 2, "取消之后首页的今日进度没重画");
  assert.ok(!hasClass(btn, "used"), `按钮没回到没打勾的样子：${btn.className}`);
  assert.equal(btn.attrs["aria-label"], "今天用了", "读屏念的没变回去");
});

test("一来一回之后再点：又算用过，可以反复切", () => {
  const { ctx } = load();
  ctx.markUsed("p1"); ctx.markUsed("p1"); ctx.markUsed("p1");
  assert.deepEqual(Array.from(ctx.usedToday), ["p1"]);
  ctx.markUsed("p1");
  assert.deepEqual(Array.from(ctx.usedToday), []);
});

test("取消这一句，别的句子今天用过的记录不受影响", () => {
  const { ctx } = load(["p0", "p1", "p2"]);
  ctx.markUsed("p1");
  assert.deepEqual(Array.from(ctx.usedToday), ["p0", "p2"]);
});

test("按钮不在屏幕上（那张卡已经重画掉了）也不会出错", () => {
  const { ctx } = load();
  ctx.markUsed("p9");
  assert.deepEqual(Array.from(ctx.usedToday), ["p9"]);
});

let pass = 0, fail = 0;
for (const t of tests) {
  try { t.fn(); console.log(`  ✓ ${t.name}`); pass++; }
  catch (e) { console.log(`  ✗ ${t.name}\n    ${e.message}`); fail++; }
}
console.log(fail ? `✗ ${fail} failed, ${pass} passed` : `✓ all ${pass} tests passed`);
process.exit(fail ? 1 : 0);
