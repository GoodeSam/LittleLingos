#!/usr/bin/env node
// Behavioral tests for what a saved row is allowed to be.
//
// WHY IT SHRANK. Codex, reviewing the design findings, saw what neither design
// advisor nor I had: the saved list had quietly become a SECOND review flow.
// Each row offered 显示英文 → 还要练/记住了, and those ratings rewrote the
// spaced-repetition schedule. So a parent browsed a library, picked a sentence,
// tested themselves, graded themselves, and changed when things would come
// back — every step of it self-initiated.
//
// The job this project measured is 「别让我发起」 (jtbd.md). A list of
// self-serve practice entry points is that job's opposite, and every extra row
// is another one.
//
// Those buttons were added on 2026-09-04 because Victor asked for them:
// "其他下面的无法选择还要练或者记住了". The request was real — you scroll to a
// phrase and want to mark it. Removing them again is his call, made on
// 2026-09-06 after seeing the argument. Recorded here because a test that
// enforces the reverse of a user's stated request should say who reversed it.
//
// Grading now happens in one place: the review card at the top, on the phrase
// the system chose. The list is for finding, hearing, and unsaving.
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   1. 家长翻收藏列表，是为了找一句、听一句、或者删掉一句 —— 不是为了
//      在那儿再做一遍复习。该复习哪句由系统定。
//
//   2. 顶部那张卡仍然能评分，一点没变。
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

const listBody = () => {
  const at = html.indexOf("function renderSavedScreen");
  assert.ok(at !== -1, "renderSavedScreen not found");
  return html.slice(at, html.indexOf("\nfunction ", at + 10));
};

// ══ 1. 列表不再是第二个复习流程 ═══════════════════════════════════════

test("收藏列表里不再逐条评分", () => {
  const body = listBody();
  assert.ok(!/answerById\(/.test(body),
    "逐条评分会改排程 —— 那是一个自发的复习入口，正是「别让我发起」的反面");
  assert.ok(!/还要练/.test(body), "评分按钮不该还在列表里");
});

test("也没有换个方式偷偷保留 —— 队列版更不行", () => {
  // reviewAnswer 操作的是队列头，从列表调它会让点第 5 行改到第 1 行。
  const body = listBody();
  assert.ok(!/reviewAnswer\(/.test(body));
});

test("列表仍然能找、能听、能删 —— 这三样是它存在的理由", () => {
  const body = listBody();
  assert.match(body, /audioMarkView\(|playableUrlFor\(/, "得能听");
  assert.match(body, /removeSaved\(/, "得能删");
  assert.match(body, /savedHeadline\(|saved-item-zh/, "得看得见是哪一句");
});

// ══ 2. 评分仍然有地方做 ═══════════════════════════════════════════════

test("顶部复习卡仍然能评分，一点没变", () => {
  // 拿掉列表那套是为了让评分只发生在一处，不是为了让它消失。
  const at = html.indexOf("function renderReviewCard");
  assert.ok(at !== -1, "renderReviewCard not found");
  const body = html.slice(at, html.indexOf("\nfunction ", at + 10));
  assert.match(body, /reviewAnswer\(/, "唯一的评分入口不能也没了");
  assert.match(body, /还要练/);
  assert.match(body, /记住了/);
});

test("按 id 评分那个函数还在，只是只有队列版调它", () => {
  // 它是排程逻辑的唯一实现，reviewAnswer 是它的队列包装。
  assert.match(html, /function answerById/, "排程实现不该跟着按钮一起删掉");
  const at = html.indexOf("function reviewAnswer");
  const body = html.slice(at, html.indexOf("\n}", at));
  assert.match(body, /answerById\(/, "两处各写一份排程逻辑，迟早会分叉");
});

console.log("saved row shape tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
