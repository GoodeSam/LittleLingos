#!/usr/bin/env node
// 复习怎么排，从今往后只有一个主人：review-engine.js。
//
// 为什么（ADR 0009 第四块）：间隔表和「答对 / 答错之后下一次什么时候」的算法散在
// index.html 三处（顶层常量、ll:review-engine 块、查词重查那一段各写了一份 s=0/due=now）。
// P01「复习间隔按一周重算」一旦定了规格，改一个文件就够——前提是只有一个文件管这件事。
//
// 硬约束：间隔表 [1,3,7,14,30] 和数据格式 rv:{s,due} 一个都不动——改了会让家长的
// 复习节奏悄悄变。这个文件是纯的：时间从外面传进来，不碰 Date.now / window / 存储。
// 普通脚本 + CommonJS 出口（同 storage.js）：首页一开就要数「今天到期几句」。
//
// 对应的用户情境（不含函数名）：
//   1. 升级之后，复习节奏一点没变：还是 1、3、7、14、30 天。
//   2. 点【记住了】：这句往后排，一次比一次久；到了最后一档就停在 30 天，不会越界。
//   3. 点【还要练】：回到起点，今天这一轮里还会再出现。
//   4. 老版本存的、没有排期的句子：当作刚开始，不炸。
//   5. 「今天到期几句」数得对：到期的算，没到的不算，坏数据不炸。
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MODULE_PATH = join(ROOT, "review-engine.js");
const require = createRequire(import.meta.url);
const DAY = 86400000;
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

function load() {
  assert.ok(existsSync(MODULE_PATH), "review-engine.js 还不存在——这条测试就是用来逼它出生的");
  const lib = require(MODULE_PATH);
  for (const k of ["INTERVALS", "nextSchedule", "freshSchedule", "isDue", "dueItems"]) {
    assert.ok(k in lib, `要导出 ${k}`);
  }
  return lib;
}

test("间隔表一个数没变：1、3、7、14、30 天——改了家长的复习节奏会悄悄变", () => {
  const { INTERVALS } = load();
  assert.deepEqual([...INTERVALS], [1, 3, 7, 14, 30]);
  assert.ok(Object.isFrozen(INTERVALS), "间隔表要冻结");
});

test("点【记住了】：往后排，一次比一次久；到最后一档停在 30 天，不越界", () => {
  const { nextSchedule } = load();
  const now = 1_000_000_000_000;
  let rv = { s: 0, due: now };
  const seen = [];
  for (let i = 0; i < 7; i++) { rv = nextSchedule(rv, true, now); seen.push({ s: rv.s, days: (rv.due - now) / DAY }); }
  assert.deepEqual(seen.map(x => x.days), [1, 3, 7, 14, 30, 30, 30], "第 6、7 次该停在 30 天");
  assert.deepEqual(seen.map(x => x.s), [1, 2, 3, 4, 5, 5, 5], "档位到 5 就不再涨");
});

test("点【还要练】：回到起点，今天就再来", () => {
  const { nextSchedule } = load();
  const now = 1_000_000_000_000;
  const rv = nextSchedule({ s: 4, due: now + 99 * DAY }, false, now);
  assert.deepEqual(rv, { s: 0, due: now });
});

test("老版本存的、没有排期的句子：当作刚开始，不炸", () => {
  const { nextSchedule, freshSchedule } = load();
  const now = 1_000_000_000_000;
  assert.deepEqual(freshSchedule(now), { s: 0, due: now });
  for (const bad of [undefined, null, {}, "x", 3]) {
    const rv = nextSchedule(bad, true, now);
    assert.deepEqual(rv, { s: 1, due: now + 1 * DAY }, `没排期的当作 s=0：${JSON.stringify(bad)}`);
  }
});

test("不改传进来的对象：算出来的是新对象（旧的留给调用方决定怎么用）", () => {
  const { nextSchedule } = load();
  const now = 1_000_000_000_000;
  const before = { s: 2, due: now };
  const after = nextSchedule(before, true, now);
  assert.deepEqual(before, { s: 2, due: now }, "传进来的对象被改了");
  assert.notEqual(after, before);
});

test("「今天到期几句」：到期的算，没到的不算，坏数据不炸", () => {
  const { isDue, dueItems } = load();
  const now = 1_000_000_000_000;
  const list = [
    { id: "a", rv: { s: 1, due: now - 1 } },
    { id: "b", rv: { s: 1, due: now } },
    { id: "c", rv: { s: 1, due: now + 1 } },
    { id: "d" },
    null,
    { id: "e", rv: "bad" },
  ];
  assert.deepEqual(dueItems(list, now).map(x => x.id), ["a", "b"]);
  assert.equal(isDue(list[2], now), false);
  assert.equal(isDue(null, now), false);
  assert.deepEqual(dueItems(null, now), [], "输入不是数组也该给空");
});

// ── 模块本身的规矩 ─────────────────────────────────────────
test("这个文件是纯的：时间从外面传，不碰 Date.now、window、document、存储", () => {
  const src = readFileSync(MODULE_PATH, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
  for (const bad of ["Date.now", "window.", "document.", "localStorage", "llStorage"]) {
    assert.ok(!src.includes(bad), `review-engine.js 里出现了「${bad}」`);
  }
});

test("index.html：间隔表和排期算法只剩模块这一份；主脚本之前加载它；进了离线缓存清单", () => {
  const html = readFileSync(join(ROOT, "index.html"), "utf8");
  const code = html.replace(/<!--[\s\S]*?-->/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
  assert.ok(!/const REVIEW_INTERVALS\s*=/.test(code), "index.html 里还有第二份间隔表——P01 改的时候必漏一处");
  // 只禁「乘 86400000」（把天数换算成到期时间 = 排期算法）；「今日场景」按天计数用的是除法，不归这里管
  assert.equal((code.match(/\*\s*86400000/g) || []).length, 0, "index.html 里还在自己算「天 × 86400000」——排期算法只该在模块里");
  assert.equal((code.match(/\.rv\.s\s*=\s*0/g) || []).length, 0, "index.html 里还有手写的「回到起点」——该用模块的 freshSchedule / nextSchedule");
  const tagAt = html.indexOf('<script src="./review-engine.js"></script>');
  assert.ok(tagAt !== -1 && tagAt < html.indexOf("\n<script>\n"), "review-engine.js 要在主脚本之前加载（首页一开就要数今天到期几句）");
  const sw = readFileSync(join(ROOT, "sw.js"), "utf8");
  assert.ok(sw.slice(sw.indexOf("const SHELL = ["), sw.indexOf("];", sw.indexOf("const SHELL = ["))).includes("review-engine.js"), "sw.js 的 SHELL 里没有它");
  const stamp = readFileSync(join(ROOT, "scripts/stamp-sw.mjs"), "utf8");
  assert.ok(stamp.slice(stamp.indexOf("const SOURCES = ["), stamp.indexOf("]", stamp.indexOf("const SOURCES = ["))).includes("review-engine.js"), "stamp-sw.mjs 的 SOURCES 里没有它");
});

let pass = 0, fail = 0;
for (const t of tests) {
  try { await t.fn(); console.log(`  ✓ ${t.name}`); pass++; }
  catch (e) { console.log(`  ✗ ${t.name}\n    ${e.message.split("\n")[0]}`); fail++; }
}
console.log(fail ? `✗ ${fail} failed, ${pass} passed` : `✓ all ${pass} tests passed`);
process.exit(fail ? 1 : 0);
