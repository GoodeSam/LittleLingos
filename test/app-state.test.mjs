#!/usr/bin/env node
// 应用状态只有一个主人：app-state.js（ADR 0009 最后一步）。
//
// 由来：index.html 主脚本里 17 个顶层 let（收藏列表、年龄档、复习队列……）散在
// 4000 行里各处，谁都能改、改了没人知道——ADR 0009 说的「改了状态忘了重画」就是
// 这么来的。这一步不改任何一处读写（`savedPhrases = merged` 一行不动），只是把这
// 17 个名字装成 window 上的访问器：每次写都经过一处，可订阅、测试里看得见。
//
// 对应的用户情境（不含函数名）：
//   1. 家长恢复备份，收藏列表被整个换掉——谁订阅了「收藏变了」就一定收到通知，
//      角标、列表不会再「改了忘了画」。
//   2. 写错一个状态名（打字错），立刻抛错，而不是悄悄造出一个没人读的新全局。
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
const lib = () => require(join(ROOT, "app-state.js"));

test("状态有清单：只认清单里的名字，写错名字立刻抛，不悄悄造新全局", () => {
  const st = lib().create(["savedPhrases", "currentAge"]);
  assert.equal(st.get("savedPhrases"), undefined);
  st.set("currentAge", "3-6");
  assert.equal(st.get("currentAge"), "3-6");
  assert.throws(() => st.set("curentAge", "1-2"), /curentAge/, "写错的名字没有被拦下");
  assert.throws(() => st.get("nope"), /nope/);
  assert.deepEqual(st.fields(), ["savedPhrases", "currentAge"]);
});

test("装到一个对象上之后，裸名读写照常，但每次写都有人知道", () => {
  const st = lib().create(["savedPhrases", "reviewQueue"]);
  const target = {};
  st.install(target);
  const seen = [];
  st.subscribe((name, value, prev) => seen.push([name, value, prev]));
  target.savedPhrases = [{ id: "a" }];                  // 和 index.html 里 `savedPhrases = merged` 一样的写法
  assert.deepEqual(st.get("savedPhrases"), [{ id: "a" }], "裸名赋值没有进到状态里");
  assert.equal(target.savedPhrases, st.get("savedPhrases"), "裸名读到的不是状态里那一份");
  assert.deepEqual(seen, [["savedPhrases", [{ id: "a" }], undefined]], "写了没人知道——「改了忘了画」就是从这里来的");
  target.reviewQueue = [1];
  assert.equal(seen.length, 2);
  const off = st.subscribe(() => { throw new Error("不该再收到"); });
  off();
  target.reviewQueue = [2];
  assert.equal(seen.length, 3, "退订之后别的订阅者照常收到");
});

test("index.html 主脚本里不再有顶层 let：可变状态只住在 app-state 的清单里，且清单和代码对得上", () => {
  const at = html.indexOf("\n<script>\n");
  const main = html.slice(at, html.indexOf("</script>", at));
  const code = main.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const lets = [...code.matchAll(/^let ([A-Za-z_$][\w$]*)/gm)].map(m => m[1]);
  assert.deepEqual(lets, [], "主脚本里还有顶层 let：" + lets.join(", "));
  const m = code.match(/llAppStateLib\.create\(\[([^\]]+)\]\)/);
  assert.ok(m, "主脚本没有从清单建状态（llAppStateLib.create([...])）");
  const fields = [...m[1].matchAll(/"([A-Za-z_$][\w$]*)"/g)].map(x => x[1]);
  assert.ok(fields.length >= 15, `清单只有 ${fields.length} 个名字，读法可能坏了`);
  assert.ok(code.indexOf("llState.install(window)") !== -1, "状态没装到 window 上，裸名读写会各自造新全局");
  for (const f of fields) {
    assert.ok(new RegExp(`^${f} = `, "m").test(code), `清单里的「${f}」在主脚本里没有顶层赋值——清单和代码对不上`);
    assert.ok(code.indexOf("llState.install(window)") < code.search(new RegExp(`^${f} = `, "m")), `「${f}」在装访问器之前就被赋值了——那次写没进状态`);
  }
  assert.ok(html.includes('<script src="./app-state.js"></script>'), "index.html 没加载 app-state.js");
  const sw = readFileSync(join(ROOT, "sw.js"), "utf8");
  assert.ok(sw.slice(sw.indexOf("const SHELL = ["), sw.indexOf("];", sw.indexOf("const SHELL = ["))).includes("app-state.js"), "sw.js 的 SHELL 里没有它");
  const stamp = readFileSync(join(ROOT, "scripts/stamp-sw.mjs"), "utf8");
  assert.ok(stamp.slice(stamp.indexOf("const SOURCES = ["), stamp.indexOf("]", stamp.indexOf("const SOURCES = ["))).includes("app-state.js"), "stamp-sw.mjs 的 SOURCES 里没有它");
});

console.log("app-state tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message.split("\n")[0]}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
