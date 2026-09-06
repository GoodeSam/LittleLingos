#!/usr/bin/env node
// 四个标签在每一屏上都要在。
//
// 之前 .bottom-nav 长在 #homeScreen 里面，而每个二级屏都是
// `position: fixed; top:0; bottom:0; z-index:50` 的整屏浮层——它把导航
// 整个盖住了。结果是：家长在「洗澡时间」里看完句子想去「收藏」复习，
// 必须先点左上角那个 ←，回到首页，再点底部的标签。
//
// 这条路每天都要走好几遍，而 docs/jtbd.md 记下的 job 是「别让我发起」：
// 凡是多一道需要下决心穿过的门，就会有人在那里停下。多一次返回不是
// 「多一次点击」那么轻——F3 那条摩擦时刻的原话是「不想要拿出手机来使用，
// 觉得操作比较麻烦」。
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   家长正在「洗澡时间」这一页上看句子，想直接去收藏里复习。底部那四个
//   标签就在他眼前，点一下就到——不必先找左上角的返回箭头。翻译页、
//   查词页、收藏页上同样。而且每一页最下面那条内容都不会被这排标签压住。
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

const SCREENS = [
  ["scenarioScreen", "洗澡时间这一页"],
  ["savedScreen", "收藏 · 复习这一页"],
  ["translateScreen", "翻译这一页"],
  ["dictScreen", "查词这一页"],
];

const navAt = () => {
  const at = html.indexOf('<div class="bottom-nav">');
  assert.ok(at !== -1, "找不到底部导航");
  return at;
};

// ── 导航不再长在首页里面 ────────────────────────────────────────────────

test("四个标签不再是首页的一部分", () => {
  const home = html.indexOf('id="homeScreen"');
  assert.ok(home !== -1, "找不到首页");
  const homeEnd = html.indexOf('<div class="screen"', home);
  assert.ok(homeEnd !== -1, "找不到首页的结尾");
  assert.ok(navAt() > homeEnd,
    "导航还长在首页里 —— 二级页面会把它整个盖住");
});

test("每一屏都排在导航前面，导航是它们共同的邻居", () => {
  // 控制组式的写法：逐屏比位置，而不是只看导航"在不在文件里"。
  const nav = navAt();
  for (const [id, human] of SCREENS) {
    const at = html.indexOf(`id="${id}"`);
    assert.ok(at !== -1, `找不到${human}`);
    assert.ok(at < nav, `${human}排在导航后面了`);
  }
});

// ── 盖不住 ──────────────────────────────────────────────────────────────

test("二级页面盖不住这排标签", () => {
  // .screen 是 z-index 50 的整屏浮层。导航必须比它高，否则搬出去也没用。
  const nav = html.slice(html.lastIndexOf(".bottom-nav {", html.indexOf(".nav-item")),
                         html.indexOf(".nav-item"));
  const zm = nav.match(/z-index:\s*(\d+)/);
  assert.ok(zm, "导航没有设 z-index —— 会被二级页面盖住");
  const screenCss = html.slice(html.indexOf("    .screen {"), html.indexOf(".screen.open"));
  const sz = screenCss.match(/z-index:\s*(\d+)/);
  assert.ok(sz, "找不到二级页面的 z-index");
  assert.ok(Number(zm[1]) > Number(sz[1]),
    `导航 z-index ${zm[1]} 不高于页面的 ${sz[1]}`);
});

test("导航钉在屏幕底部，不跟着内容滚走", () => {
  const nav = html.slice(html.lastIndexOf(".bottom-nav {", html.indexOf(".nav-item")),
                         html.indexOf(".nav-item"));
  assert.match(nav, /position:\s*fixed/,
    "导航不是钉住的 —— 在长页面上会被滚出屏幕外");
});

// ── 压不住内容 ──────────────────────────────────────────────────────────

test("每一页最下面的内容都不会被这排标签压住", () => {
  // 导航一旦浮起来，就不再占位置了。每一屏都要自己让出这块高度，
  // 否则最后一句话、最后一个按钮会永远藏在标签底下点不到。
  const css = html.slice(0, html.indexOf("</style>"));
  assert.match(css, /--nav-h:\s*\d+px/,
    "导航高度没有一个单独的来源 —— 留白和导航各写一份，改一处就会错位");
  const uses = (css.match(/var\(--nav-h\)/g) || []).length;
  assert.ok(uses >= 2,
    `--nav-h 只被用了 ${uses} 次：导航自己用一次，留白至少还要用一次`);
});

test("首页也让出了这块高度", () => {
  // 首页原来靠 margin-top:auto 把导航推到底，导航浮起来之后那招失效了。
  const css = html.slice(0, html.indexOf("</style>"));
  const home = css.match(/#homeScreen\s*\{[^}]*\}/);
  assert.ok(home, "首页没有自己的样式规则 —— 没地方让出导航的高度");
  assert.match(home[0], /padding-bottom[^;]*var\(--nav-h\)/,
    "首页没让出导航那块高度，最下面的场景会被压住");
  // 真浏览器里量出来的：光有 padding-bottom 不够。body 是 min-height:100vh
  // 的 flex column，首页作为 flex item 会被压缩到一屏高，内容溢出到盒子
  // 外面画——盒子 746 高而内容排到 2149。那种状态下这条 padding 一点效果
  // 都没有，加在 body 上、加在最后一个子元素上也一样。
  assert.match(home[0], /flex-shrink:\s*0/,
    "首页会被压缩成一屏高，上面那条留白就成了摆设");
});

test("导航那块高度是量出来的，不是拍脑袋写死的", () => {
  // 真浏览器里量到的：--nav-h 写的是 64px，导航实际高 84px。内容没被压住
  // 纯属巧合——只剩 10px 余量。字号一放大、徽章一换行，那 20px 的差就
  // 变成遮挡，而这种遮挡在字符串测试里永远看不见。
  //
  // 所以「单一来源」不能只是名义上的：让代码去量导航实际多高，再写回
  // --nav-h，两个数字就不可能对不上。
  const product = html
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
  assert.match(product, /setProperty\(\s*["']--nav-h["']/,
    "没有任何代码去量导航的实际高度——留白和导航是两个各写各的数字");
  assert.match(product, /addEventListener\(\s*["']resize["']/,
    "只在启动时量一次：转屏或改系统字号之后，两个数字又会对不上");
});

// ── 原有约定不能被破坏 ──────────────────────────────────────────────────

test("还是那四个标签，名字没变", () => {
  // 搬家不该顺手改内容。nav-labels.test.mjs 守着同一件事，
  // 这里再确认一次是因为搬动 DOM 最容易连带碰坏它。
  const nav = html.slice(navAt(), html.indexOf("</div>", html.lastIndexOf("</div>", html.indexOf("</body>"))));
  for (const label of ["场景", "查词", "收藏", "翻译"]) {
    assert.ok(nav.includes(label), `标签「${label}」不见了`);
  }
});

let failed = 0;
for (const t of tests) {
  try { t.fn(); console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed}/${tests.length} 条失败` : `\n✓ all ${tests.length} tests passed`);
process.exit(failed ? 1 : 0);
