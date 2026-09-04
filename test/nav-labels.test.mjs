#!/usr/bin/env node
// Guards the bottom tab labels — what a parent reads to decide where to go.
//
// 「首页」told them nothing. Every screen in an app is somewhere; the word
// names the position, not the contents. That tab holds the prepared everyday
// situations — bedtime, meals, going out — and 「场景」says so, which is what
// a parent scanning four labels needs.
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   家长想找「睡前该说什么」。四个标签里有一个直接告诉他答案在哪儿，
//   而不是要他先猜「首页」上有什么。
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

const navBlock = () => {
  const at = html.indexOf('<div class="bottom-nav">');
  assert.ok(at !== -1, "bottom-nav not found");
  return html.slice(at, html.indexOf("</div>\n</div>", at));
};

test("第一个标签写的是「场景」，不是「首页」", () => {
  const nav = navBlock();
  assert.match(nav, /data-tab="home"[\s\S]{0,200}场景/,
    "「首页」说的是位置不是内容——家长要的是知道那里有什么");
  assert.ok(!/>首页/.test(nav), "旧标签不该还留着");
});

test("四个标签各说各的，没有重名", () => {
  const nav = navBlock();
  const labels = [...nav.matchAll(/<\/span>([^<]+)</g)].map(m => m[1].trim()).filter(Boolean);
  assert.equal(labels.length, 4, `找到 ${labels.length} 个标签：${labels.join(" ")}`);
  assert.equal(new Set(labels).size, 4, `标签重名：${labels.join(" ")}`);
});

test("内部的 tab 名仍然是 home——只改了给人看的字", () => {
  // 改内部名要动 showTab / data-tab / 若干分支，对家长没有任何好处，
  // 只是把一次文案改动变成一次重构。
  assert.match(html, /showTab\('home'\)/, "内部标识不该跟着文案改");
  assert.match(html, /data-tab="home"/);
});

console.log("nav label tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
