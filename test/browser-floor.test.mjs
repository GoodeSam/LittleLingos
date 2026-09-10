#!/usr/bin/env node
// 这个软件要在什么浏览器上跑得起来。
//
// 目标用户是中国家长，他们手机上不一定有 Safari、Chrome 或 Edge。真实的入口是
// 微信内置浏览器（X5/TBS 内核）和国产 OEM 浏览器（UC、QQ、小米、华为、
// vivo、OPPO）。这些内核普遍比桌面 Chrome 落后好几年。
//
// 所以定一条底线：**Chrome 86**。这是微信 X5 长期停留的那一代，也覆盖了
// 2021 年以后出厂的国产浏览器。
//
// 为什么要有这条测试而不是靠自觉：新写法用起来毫无阻力，而后果分两种——
//   · CSS 用超了：那一条声明被整条忽略，界面悄悄少一块底色、错一个位置
//   · JS 语法用超了：整个脚本解析失败，家长看到的是一片白
// 两种在开发机上都看不见，因为开发机的 Chrome 是最新的。
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   一个家长用微信点开链接，手机上没装过任何浏览器。页面照常出来，
//   该有底色的地方有底色，该在下面的东西在下面。
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const FLOOR = 86; // 微信 X5

// 逐个文件扫。sw.js 也算——service worker 挂了不该拖垮页面，但它自己得能解析。
const FILES = ["index.html", "icons.js", "scenarios.js", "dictionary-words.js", "sw.js"];
// 注释里提到某个特性不会让任何东西坏掉，所以扫之前先把注释剥掉——
// 否则一句「这里原来用的是 color-mix()」就能把这一层弄红。
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")   // /* ... */ 同时覆盖 CSS 和 JS
    .replace(/(^|[\s;{}()])\/\/[^\n]*/g, "$1"); // 行注释
}
const SRC = Object.fromEntries(FILES.map(f => [f, stripComments(readFileSync(join(ROOT, f), "utf8"))]));

// 每一条都标了最低 Chrome 版本和「用超了会怎样」。
const TOO_NEW = [
  { name: "color-mix()", re: /color-mix\s*\(/g, since: 111, kind: "css",
    hurt: "整条 background 被忽略，图标底色会没有" },
  { name: ":has()", re: /:has\s*\(/g, since: 105, kind: "css",
    hurt: "整条选择器失效，那组样式一条都不生效" },
  { name: "inset 简写", re: /(^|[;{\s])inset\s*:/g, since: 87, kind: "css",
    hurt: "浮层不会铺满，会缩成内容大小挂在角上" },
  { name: "AbortSignal.timeout", re: /AbortSignal\.timeout/g, since: 103, kind: "js",
    hurt: "抛 TypeError，那次请求直接失败" },
  { name: "structuredClone", re: /structuredClone\s*\(/g, since: 98, kind: "js",
    hurt: "抛 ReferenceError" },
  { name: ".findLast", re: /\.findLast(Index)?\s*\(/g, since: 97, kind: "js",
    hurt: "抛 TypeError" },
  { name: "Object.hasOwn", re: /Object\.hasOwn\s*\(/g, since: 93, kind: "js",
    hurt: "抛 TypeError" },
  { name: "Array.at()", re: /\.at\s*\(\s*-?\d/g, since: 92, kind: "js",
    hurt: "抛 TypeError" },
  { name: "顶层 await", re: /^await\s/gm, since: 89, kind: "js",
    hurt: "解析失败，整个脚本不执行，家长看到一片白" },
];

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test(`没有用到高于 Chrome ${FLOOR} 的写法`, () => {
  const hits = [];
  for (const [file, src] of Object.entries(SRC)) {
    for (const f of TOO_NEW) {
      if (f.since <= FLOOR) continue;
      const n = (src.match(f.re) || []).length;
      if (n) hits.push(`${file}: ${f.name} ×${n}（需要 Chrome ${f.since}）—— ${f.hurt}`);
    }
  }
  assert.deepEqual(hits, [], "\n  " + hits.join("\n  "));
});

test("视口高度留了老写法兜底", () => {
  // 100dvh 在安卓上更准（地址栏收起来时不会把最后一行顶出去），但它要
  // Chrome 108。写了 dvh 就必须在同一条规则里先写一遍 vh，否则老内核
  // 拿不到任何高度。
  const src = SRC["index.html"];
  const blocks = src.match(/\{[^{}]*\}/g) || [];
  const bad = blocks.filter(b => /\d(dvh|svh|lvh)/.test(b) && !/\d+vh/.test(b));
  assert.deepEqual(bad.map(b => b.slice(0, 60)), [], "有 dvh 却没有 vh 兜底");
});

test("没有可选链——它一旦用在别处，老内核会整页白屏", () => {
  // ?. 要 Chrome 80，本来在底线之内。钉住它是因为它是**解析期**特性：
  // 哪天底线要往下挪（比如为了更老的 X5），这一条会先红，而不是等家长
  // 打开看到一片白。
  const hits = [];
  for (const [file, src] of Object.entries(SRC)) {
    const n = (src.match(/\?\.[a-zA-Z_$([]/g) || []).length;
    if (n) hits.push(`${file} ×${n}`);
  }
  assert.deepEqual(hits, [], `用了可选链：${hits.join(", ")}`);
});

test("每一次读写本地存储都包了保护", () => {
  // 微信里可以关掉存储，隐私模式下 localStorage 会直接抛异常。启动路径上
  // 有一处没包，家长看到的就是一片白——不是「收藏丢了」，是整个页面没了。
  const src = readFileSync(join(ROOT, "index.html"), "utf8"); // 这条要报行号，用原文
  const naked = [];
  const lines = src.split("\n");
  lines.forEach((line, i) => {
    const at = line.search(/localStorage\s*\./);
    if (at === -1) return;
    if (/^\s*(\/\/|\*)/.test(line)) return;                 // 注释不算
    if (/\btry\s*\{/.test(line.slice(0, at))) return;       // 同一行就包着
    // 否则往前找 12 行，看它是不是活在一个还没闭合的 try 里
    const before = lines.slice(Math.max(0, i - 12), i).join("\n");
    const opens = (before.match(/\btry\s*\{/g) || []).length;
    const closes = (before.match(/\}\s*catch/g) || []).length;
    if (opens <= closes) naked.push(`${i + 1}: ${line.trim().slice(0, 70)}`);
  });
  assert.deepEqual(naked, [], "\n  这几处没有保护：\n  " + naked.join("\n  "));
});

console.log(`browser floor tests (Chrome ${FLOOR} / 微信 X5)`);
let passed = 0, failed = 0;
for (const t of tests) {
  try { t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
