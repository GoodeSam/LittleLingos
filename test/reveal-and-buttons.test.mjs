#!/usr/bin/env node
// Behavioral tests for revealing the English, and for the two grading buttons
// being visibly buttons.
//
// THE REVEAL. It was done with `filter: blur(6px)` over the real English, with
// a hint laid on top. Three problems, all raised by review:
//
//   · blurred text still leaks word count and letter shapes — it obscures
//     without concealing, which is the worst of both
//   · with the hint over it, it reads as damaged text rather than a control
//   · the tap target is the text's own bounding box, so it changes size with
//     every phrase and is small and irregular on a phone held one-handed
//
// And after revealing, the element kept role=button and tabindex=0 while its
// handler returned immediately — a focusable control that does nothing, which
// a screen reader still announces as pressable.
//
// The review card at the top already solved this properly: a real button
// labelled 显示英文, replaced by the answer. The list now does the same thing,
// which is also the Repetition fix — one action, one appearance.
//
// THE BUTTONS. 还要练 sits on #FFF0E0 against a #FFFFFF card: 1.12:1. It does
// not read as a button at all, it reads as pale whitespace. 记住了 on #4CAF82
// is 2.71:1 — better, and still under the 3:1 that a control's boundary needs.
// My first draft treated 记住了 as the acceptable baseline and proposed
// fixing only 还要练; Codex pointed out that leaves a different imbalance.
// Both get a visible boundary.
//
// The text inside them was never the problem: 5.50:1 and 6.43:1, both fine.
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   1. 家长看到的是一个写着「显示英文」的按钮，不是一段糊掉的字。
//      点之前英文根本没渲染 —— 糊住的字仍然透出词数和轮廓。
//
//   2. 「还要练」和「记住了」都看得出是按钮，而且分量对等 ——
//      它们是一次自我评估的两个选项，视觉上偏向哪一个都会污染输入。
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// WCAG relative luminance / contrast, so these are measurements rather than
// opinions about whether something "looks" visible.
const lum = h => {
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(1 + i, 3 + i), 16) / 255);
  const f = c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const cssVar = name => {
  const m = html.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`));
  assert.ok(m, `--${name} not found`);
  return m[1];
};

const listBody = () => {
  const at = html.indexOf("function renderSavedScreen");
  return html.slice(at, html.indexOf("\nfunction ", at + 10));
};

// ══ 1. 揭示英文：真按钮，而不是糊住的字 ═══════════════════════════════

test("英文不再靠模糊藏起来", () => {
  // 糊住的字会漏出词数和字形轮廓 —— 遮而不蔽，两头不靠。
  // 先剥注释再查 —— 解释「为什么不用模糊」的那段注释本身提到了它。
  // 这是本轮第四次让守卫被自己的散文触发；一个会被散文触发的守卫，
  // 会教人去削弱它。
  const code = html.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
  assert.ok(!/blur\(6px\)/.test(code), "模糊遮蔽既不干净也不有效");
  assert.ok(!/saved-item-en-wrap/.test(code), "连同它那套包装一起去掉");
});

test("点之前，英文根本没被渲染出来", () => {
  // 只是视觉上藏起来的话，读屏软件照样念得出来，糊住也挡不住截图。
  const body = listBody();
  assert.match(body, /revealed|showEn|显示英文/, "得有个明确的揭示步骤");
});

test("那是一个真的 button，不是装成按钮的 div", () => {
  // 原来是 div + role=button + tabindex，揭示之后还能聚焦却什么都不做。
  const body = listBody();
  assert.ok(!/setAttribute\('role', 'button'\)/.test(body),
    "假按钮要自己补键盘、焦点、语义，而且这次三样都没补对");
});

test("和复习卡说同一种话 —— 同一个动作只该有一种长相", () => {
  const at = html.indexOf("function renderReviewCard");
  const card = html.slice(at, html.indexOf("\nfunction ", at + 10));
  assert.match(card, /显示英文/, "复习卡上那个是样板");
  assert.match(listBody(), /显示英文/, "列表该用同一个词，不是「点击显示英文」");
});

// ══ 2. 两个自评按钮都得看得出是按钮 ═══════════════════════════════════

test("「还要练」在白卡上看得出边界", () => {
  // 1.12:1 时它读起来是一块浅色留白，不是一个可以点的东西。
  const at = html.indexOf(".review-btn-again");
  assert.ok(at !== -1, ".review-btn-again not found");
  const rule = html.slice(at, html.indexOf("}", at));
  const hasBorder = /border(?!-radius)/.test(rule);
  const bg = (rule.match(/background:\s*var\(--([a-z-]+)\)/) || [])[1];
  const ratio = bg ? contrast(cssVar(bg), cssVar("card")) : 0;
  assert.ok(hasBorder || ratio >= 3,
    `底色对比 ${ratio.toFixed(2)}:1 且没有描边 —— 控件边界需要 3:1，或者给它一条边`);
});

test("「记住了」也一样 —— 我原先把它当成合格基准，它也不达标", () => {
  const at = html.indexOf(".review-btn-good");
  assert.ok(at !== -1, ".review-btn-good not found");
  const rule = html.slice(at, html.indexOf("}", at));
  const hasBorder = /border(?!-radius)/.test(rule);
  const bg = (rule.match(/background:\s*var\(--([a-z-]+)\)/) || [])[1];
  const ratio = bg ? contrast(cssVar(bg), cssVar("card")) : 0;
  assert.ok(hasBorder || ratio >= 3,
    `底色对比 ${ratio.toFixed(2)}:1 且没有描边 —— 只修一个，只是换一种不平衡`);
});

test("两个按钮的视觉分量对等", () => {
  // 它们是一次自我评估的两个选项。偏向哪一个，都会让没记住的句子
  // 被推到更远的复习日 —— 污染的是输入，不是外观。
  const a = html.slice(html.indexOf(".review-btn-again"), html.indexOf("}", html.indexOf(".review-btn-again")));
  const g = html.slice(html.indexOf(".review-btn-good"), html.indexOf("}", html.indexOf(".review-btn-good")));
  const shape = r => ({
    filled: /background:\s*var\(--(?!card\b)/.test(r),
    bordered: /border(?!-radius)/.test(r),
  });
  assert.deepEqual(shape(a), shape(g),
    "一个实心、一个描边，就是在告诉家长哪个是「正确答案」");
});

// ══ 3. 英文的字重与颜色 ═══════════════════════════════════════════════

test("揭示后的英文，不比中文弱", () => {
  // 这个 App 的意义是让家长记住那句英文。它现在 16px 常规 #5F5F5F，
  // 而中文 16px 粗体 #4A4A4A —— 字重和对比度上都更弱。
  const en = html.match(/\.saved-item-en\s*\{([^}]*)\}/);
  assert.ok(en, ".saved-item-en not found");
  assert.match(en[1], /font-weight:\s*(700|bold)/, "要学的那句不该比已经会的那句轻");
});

test("英文的颜色仍然可读 —— 换配色不能换掉可读性", () => {
  const en = html.match(/\.saved-item-en\s*\{([^}]*)\}/)[1];
  const v = (en.match(/color:\s*var\(--([a-z-]+)\)/) || [])[1];
  assert.ok(v, "英文得有明确的颜色");
  const ratio = contrast(cssVar(v), cssVar("card"));
  assert.ok(ratio >= 4.5, `${ratio.toFixed(2)}:1 —— 16px 粗体仍按普通文本算，需要 4.5:1`);
});

test("中文没有被降级 —— 它是回想时先读的那一句", () => {
  const zh = html.match(/\.saved-item-zh\s*\{([^}]*)\}/);
  assert.ok(zh, ".saved-item-zh not found");
  assert.match(zh[1], /font-weight:\s*700/, "削弱提示语等于动了这个练习的前半段");
});

console.log("reveal and buttons tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
