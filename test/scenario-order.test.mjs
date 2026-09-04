#!/usr/bin/env node
// Guards the order of the scenario grid: a parent's own scenarios first.
//
// Zero-dependency source assertions — renderScenarioGrid() needs a DOM. What
// is checked here is the ORDER things are appended in, which is the whole
// point of the change and the one thing a later edit could silently reverse.
//
// WHY. 「去医院」 is a scenario this parent made because they needed it. The
// prepared ones are a starting kit. Putting the kit first means scrolling past
// twelve tiles somebody else chose to reach the one they made themselves.
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   1. 家长打开「场景」，先看到的是自己建的那几个。
//
//   2. 一个都还没建的时候，不该冒出一个「我的场景」标题下面空着 ——
//      那看起来像是东西丢了。
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

const gridBody = () => {
  const at = html.indexOf("function renderScenarioGrid");
  assert.ok(at !== -1, "renderScenarioGrid not found");
  const body = html.slice(at, html.indexOf("\n}\n", at));
  // 只看代码。注释里提到顺序是在解释，不是在排序 —— 一个会被散文触发的
  // 守卫，会教人去削弱它。
  return body.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
};

test("自己建的场景排在预设场景前面", () => {
  const body = gridBody();
  const custom = body.indexOf("loadCustomScenarios()");
  const preset = body.indexOf("scenarioOrder.forEach");
  assert.ok(custom !== -1, "自建场景没被渲染");
  assert.ok(preset !== -1, "预设场景没被渲染");
  assert.ok(custom < preset,
    "预设的排前面，家长要划过十几个别人选的格子才够得着自己那个");
});

test("新建入口跟在自己的场景后面，而不是被挤到最下面", () => {
  const body = gridBody();
  const add = body.indexOf("scenario-card-add");
  const preset = body.indexOf("scenarioOrder.forEach");
  assert.ok(add !== -1, "新建入口没了");
  assert.ok(add < preset, "新建是「我的场景」这一组的一部分，不该落在预设后面");
});

test("一个自建场景都没有时，不显示空的分组标题", () => {
  // 标题底下什么都没有，看起来像东西丢了。
  const body = gridBody();
  assert.match(body, /length\s*(?:>|>=)|\.length\s*\?|if\s*\(\s*mine\.length/,
    "分组标题要按有没有内容来决定显不显示");
});

test("两组之间分得开", () => {
  const body = gridBody();
  assert.match(body, /我的场景|自己的场景/, "看不出哪些是自己建的");
  assert.match(body, /现成|预设|准备好/, "也要说清另一组是现成的");
});

console.log("scenario order tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
