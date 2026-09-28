#!/usr/bin/env node
// 样式住在自己的文件里（ADR 0009 最后一步之一：CSS 外置）。
//
// 由来：index.html 里 1752 行内联样式，改一条样式要在 6000 行文件里找。
// 外置的取舍：<link rel="stylesheet"> 放在 <head> 里是渲染阻塞的——浏览器等它到了
// 才画第一帧，**不会闪一下无样式**；代价是冷启动多一个请求，之后由 service worker 缓存。
// 所以这条测试守两件事：样式真的搬出去了；而且是同步加载，不是那些会闪的异步写法。
//
// 对应的用户情境（不含函数名）：
//   1. 家长打开 App，第一帧就是有样式的——不会先看到一堆没排版的黑字再跳成正常的。
//   2. 装到主屏幕后离线打开，样式也在（进了预缓存清单，且算进缓存戳）。
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test("样式搬进了 app.css：index.html 里不再有 <style> 块，app.css 是整份样式", () => {
  assert.equal(/<style[\s>]/.test(html), false, "index.html 里还有 <style> 块——样式两处各一份，改一处漏一处");
  assert.ok(existsSync(join(ROOT, "app.css")), "app.css 不存在");
  const css = readFileSync(join(ROOT, "app.css"), "utf8");
  assert.ok(css.split("\n").length >= 1500, `app.css 只有 ${css.split("\n").length} 行——样式没搬全`);
  assert.match(css, /--nav-h:\s*\d+px/, "app.css 里没有导航高度那个变量——搬的不是那份样式");
});

test("app.css 在 <head> 里同步加载：不是 media=print / preload / onload 那种会闪的写法", () => {
  const head = html.slice(0, html.indexOf("</head>"));
  const link = head.match(/<link[^>]*href="\.\/app\.css"[^>]*>/);
  assert.ok(link, '<head> 里没有 <link … href="./app.css">');
  assert.match(link[0], /rel="stylesheet"/, "不是 rel=stylesheet");
  assert.doesNotMatch(link[0], /media=|preload|onload=|defer|async/, "用了异步加载的写法——第一帧会没有样式，然后跳一下");
  const firstScript = head.indexOf("<script");
  assert.ok(firstScript === -1 || head.indexOf(link[0]) < firstScript, "样式要排在脚本前面，浏览器才会先去取它");
});

test("app.css 进了离线清单和缓存戳——否则装到主屏幕后离线打开没样式，改了样式也不换戳", () => {
  const sw = readFileSync(join(ROOT, "sw.js"), "utf8");
  const shell = sw.slice(sw.indexOf("const SHELL = ["), sw.indexOf("];", sw.indexOf("const SHELL = [")));
  assert.ok(shell.includes("app.css"), "sw.js 的 SHELL 里没有 app.css");
  const stamp = readFileSync(join(ROOT, "scripts/stamp-sw.mjs"), "utf8");
  const sources = stamp.slice(stamp.indexOf("const SOURCES = ["), stamp.indexOf("]", stamp.indexOf("const SOURCES = [")));
  assert.ok(sources.includes("app.css"), "stamp-sw.mjs 的 SOURCES 里没有 app.css");
});

console.log("app-css tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message.split("\n")[0]}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
