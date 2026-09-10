#!/usr/bin/env node
// 成年人版外观：颜色、字号、间距全部来自一份 token 表，emoji 让位给单色线性图标。
//
// 为什么有这组测试。2026-09-10 的可用性评审与视觉规格（newLittleLingoes 仓库
// docs/research/ui-visual-spec-2026-09-10.md）指出三件事：橙色在页面上无处不在
// 所以标记不了"最重要的那个"；复习卡"还要练/记住了"一个浅一个深，把家长的
// 自评往"记住了"上推；多彩 emoji 与药丸圆角合起来像儿童 App，而使用者是成年人。
// 这里守住的是改完之后不许悄悄退回去的几条。
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   一个下班后的家长打开首页，看到的是一套安静的成年人界面：一个主按钮、
//   单色图标、够深的灰字。翻到复习卡，"还要练"和"记住了"一样重，他
//   按哪个都不觉得在选"错的那个"。
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");
const css = html.slice(0, html.indexOf("</style>"));
const rule = (sel) => {
  const m = css.match(new RegExp(sel.replace(/[.\[\]]/g, "\\$&") + "\\s*\\{[^}]*\\}"));
  return m ? m[0] : "";
};

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test("颜色、字号、间距、圆角、阴影都定义在一份 token 表里", () => {
  const root = css.match(/:root\s*\{[\s\S]*?\n\s*\}/);
  assert.ok(root, "没有 :root");
  for (const t of ["--clay-100", "--clay-700", "--clay-900", "--gray-50", "--gray-600", "--gray-900",
                   "--success-800", "--warning-800", "--text-base", "--text-md", "--space-4",
                   "--radius-md", "--shadow-1", "--shadow-2", "--touch-min", "--icon-stroke"]) {
    assert.ok(root[0].includes(t + ":"), `token 表里没有 ${t}`);
  }
});

test("旧的颜色名不再各自硬编码，全部指向新 token", () => {
  // 别名住在第二个 :root 里（第一个是 token 表本身），所以在整段 CSS 里找。
  const root = css;
  assert.match(root, /--accent:\s*var\(--clay-/, "--accent 还是一个裸色值");
  assert.match(root, /--muted:\s*var\(--gray-600\)/, "--muted 没有指向 gray-600");
  assert.match(root, /--text:\s*var\(--gray-900\)/, "--text 没有指向 gray-900");
  assert.match(root, /--border:\s*var\(--gray-200\)/, "--border 没有指向 gray-200");
  assert.match(root, /--r:\s*var\(--radius-md\)/, "卡片圆角没有指向 radius-md");
});

test("首页头部不再是橙色渐变", () => {
  const h = rule(".header");
  assert.ok(h, "没有 .header 规则");
  assert.doesNotMatch(h, /linear-gradient/, "头部还是渐变");
});

test("复习卡的「还要练」和「记住了」一样深、一样白字，只差色相", () => {
  const again = rule(".review-btn-again");
  const good = rule(".review-btn-good");
  assert.match(again, /background:\s*var\(--warning-800\)/, "还要练不是 warning-800 底");
  assert.match(good, /background:\s*var\(--success-800\)/, "记住了不是 success-800 底");
  assert.match(again, /color:\s*var\(--white\)/, "还要练不是白字");
  assert.match(good, /color:\s*var\(--white\)/, "记住了不是白字");
});

test("朗读按钮：空闲是主色，播放中更深，都是白字", () => {
  const idle = rule(".play-btn");
  const playing = rule(".play-btn.playing");
  assert.match(idle, /background:\s*var\(--clay-700\)/, "朗读按钮不是 clay-700");
  assert.match(idle, /color:\s*var\(--white\)/, "朗读按钮不是白字");
  assert.match(playing, /background:\s*var\(--clay-900\)/, "播放中不是 clay-900");
});

test("30 个预设场景各有一个单色线性图标，文件进了离线缓存", () => {
  const iconsPath = join(ROOT, "icons.js");
  assert.ok(existsSync(iconsPath), "icons.js 不存在");
  globalThis.window = {};
  new Function(readFileSync(iconsPath, "utf8"))();
  const icons = globalThis.window.LL_ICONS;
  assert.ok(icons && icons.scenario, "icons.js 没有导出 LL_ICONS.scenario");
  const ids = [...readFileSync(join(ROOT, "scenarios.js"), "utf8").matchAll(/^  ([a-zA-Z_]+): \{$/gm)].map(m => m[1]);
  assert.ok(ids.length >= 30, `只找到 ${ids.length} 个预设场景`);
  for (const id of ids) {
    const svg = icons.scenario[id];
    assert.ok(typeof svg === "string" && svg.startsWith("<svg"), `场景「${id}」没有图标`);
    assert.doesNotMatch(svg, /[\u{1F300}-\u{1FAFF}]/u, `场景「${id}」的图标里还有 emoji`);
  }
  assert.match(html, /<script src="\.\/icons\.js"/, "index.html 没有引入 icons.js");
  assert.ok(html.indexOf('src="./icons.js"') < html.indexOf('src="./scenarios.js"'), "icons.js 得在 scenarios.js 之前加载");
  const sw = readFileSync(join(ROOT, "sw.js"), "utf8");
  assert.match(sw, /'\.\/icons\.js'/, "sw.js 的缓存清单里没有 icons.js");
});

test("首页上标题、搜索框、年龄档位不再带 emoji", () => {
  const s = html.indexOf('<div class="header">'), e = html.indexOf('id="scenarioGrid"');
  const home = html.slice(s, e);
  assert.doesNotMatch(home, /⭐ 最近收藏/, "hero 标题还带着实心星");
  assert.doesNotMatch(home, /placeholder="🔍/, "搜索框占位文字还带着放大镜 emoji");
  assert.doesNotMatch(home, /💡/, "提示还带着灯泡 emoji");
  const tabs = html.slice(html.indexOf('id="tierTabs"'), html.indexOf('id="ownWordsInvite"'));
  assert.doesNotMatch(tabs, /🌱|🌿|🌳/, "难度筛选还带着植物 emoji");
});

test("场景网格的图标来自 icons.js，自建场景才退回 emoji", () => {
  assert.match(html, /llIcon\("scenario",/, "场景卡没有调用 llIcon 取图标");
});

console.log("design tokens tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
