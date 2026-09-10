#!/usr/bin/env node
// 候选一信息架构：场景 · 帮我说 · 复习 · 收藏，外加一个不占主位的设置屏。
//
// 为什么改。2026-09-10 的导航评估（newLittleLingoes 仓库
// docs/research/ui-visual-spec-nav-candidate1-2026-09-10.md）指出两件事：
// 「收藏」一个标签底下住着复习队列、收藏列表、邀请码、备份四件性质不同的事，
// 家长要找的「复习」在标签上一个字都没提；而「查词」和「翻译」是同一个求助
// 活动的两个门，家长得先自己判断「这是一个词还是一句话」才能选对。
//
// 还有一条来自 Victor 的硬规则：提示文字默认隐藏，只在条件成立时出现，
// 否则屏幕上全是字。
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   家长临场想问一句话怎么说，只要点「帮我说」，不用先想清楚自己要查词
//   还是要翻译。晚上想复习，底部就写着「复习」两个字。邀请码和备份收在
//   设置里，不再挡在收藏前面。屏幕上平时很干净，该提醒的时候才出现一句话。
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");
const navBlock = () => {
  const at = html.indexOf('<div class="bottom-nav">');
  return html.slice(at, html.indexOf("\n</div>", at));
};
// 一屏的范围：从它自己的 <div class="screen" id="..."> 起，到下一个 screen 或底部导航为止
const screenOf = (id) => {
  const at = html.indexOf(`<div class="screen" id="${id}">`);
  assert.ok(at !== -1, `找不到 #${id}`);
  const nexts = [html.indexOf('<div class="screen" id=', at + 10), html.indexOf('<div class="bottom-nav">', at)]
    .filter(n => n !== -1);
  return html.slice(at, Math.min(...nexts));
};

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test("底部四个标签是 场景 · 帮我说 · 复习 · 收藏", () => {
  const nav = navBlock();
  const tabs = [...nav.matchAll(/data-tab="([a-z]+)"/g)].map(m => m[1]);
  assert.deepEqual(tabs, ["home", "help", "review", "saved"],
    `顺序或标识不对：${tabs.join(" ")}`);
  const labels = [...nav.matchAll(/<\/span>([^<]+)</g)].map(m => m[1].trim()).filter(Boolean);
  assert.deepEqual(labels, ["场景", "帮我说", "复习", "收藏"],
    `标签文字不对：${labels.join(" ")}`);
});

test("「帮我说」一个输入框就够，家长不用先判断自己要查词还是翻译", () => {
  assert.match(html, /id="helpScreen"/, "没有帮我说这一屏");
  assert.match(html, /id="helpInput"/, "帮我说没有输入框");
  assert.match(html, /function helpSubmit/, "没有一个地方决定这次是查词还是翻译");
  // 旧的两屏不该还立着——半删的屏会被后来的人当成还在用的
  assert.ok(!/id="dictScreen"/.test(html), "旧的查词屏还在");
  assert.ok(!/id="translateScreen"/.test(html), "旧的翻译屏还在");
  assert.ok(!/showTab\('dict'\)|showTab\("dict"\)/.test(html), "还有地方往查词屏跳");
  assert.ok(!/showTab\('translate'\)|showTab\("translate"\)/.test(html), "还有地方往翻译屏跳");
});

test("查词和翻译各自的机器还在，只是搬进了同一间屋子", () => {
  const help = html.slice(html.indexOf('id="helpScreen"'), html.indexOf('<div class="bottom-nav">'));
  for (const id of ["dictInput", "zhInput", "dictScreenPanel", "translateResult", "aiDisclaimer"]) {
    assert.ok(help.includes(`id="${id}"`), `${id} 没跟着搬进帮我说`);
  }
});

test("复习有自己的一屏，标签上写着「复习」", () => {
  assert.match(html, /id="reviewScreen"/, "没有复习这一屏");
  const review = screenOf("reviewScreen");
  assert.ok(review.includes('id="reviewArea"'), "复习队列没搬进复习屏");
  assert.ok(!screenOf("savedScreen").includes('id="reviewArea"'), "复习队列还留在收藏屏里");
});

test("邀请码和备份收进设置，收藏屏只剩收藏", () => {
  assert.match(html, /id="settingsScreen"/, "没有设置这一屏");
  const settings = html.slice(html.indexOf('id="settingsScreen"'), html.indexOf('<div class="bottom-nav">'));
  assert.ok(settings.includes('id="accessCodeInput"'), "邀请码没搬进设置");
  assert.ok(settings.includes('id="importFile"'), "备份没搬进设置");
  const saved = html.slice(html.indexOf('id="savedScreen"'), html.indexOf('id="settingsScreen"'));
  assert.ok(!saved.includes("backup-section"), "收藏屏里还留着邀请码或备份");
  assert.match(html, /onclick="showTab\('settings'\)"/, "首页没有去设置的入口");
});

test("没有邀请码时，提示指向的是「设置」，不再是「收藏」页底部", () => {
  const at = html.indexOf("需要邀请码");
  assert.ok(at !== -1, "找不到邀请码提示");
  const near = html.slice(at - 200, at + 400);
  assert.match(near, /设置/, "提示没说去设置");
  assert.ok(!/「收藏 · 复习」页底部/.test(html), "还在把人往收藏页底部指");
});

test("提示文字平时不占地方，条件成立才出现", () => {
  // 麦克风说明：点进输入框才出现
  assert.match(html, /id="micHint"[^>]*hidden/, "麦克风说明默认没有藏起来");
  assert.match(html, /onfocus="[^"]*micHint|showMicHint/, "没有让它在点进输入框时出现");
  // 词典联网说明：查的词不在离线词表、真要联网时才出现
  assert.match(html, /id="dictPrivacyNote"[^>]*hidden/, "首页的词典联网说明默认没有藏起来");
  // 翻译隐私与 AI 声明：准备发送时才出现
  assert.match(html, /id="translatePrivacyNote"[^>]*hidden/, "翻译隐私说明默认没有藏起来");
});

test("首页搜到几条都给两个选择：现成的句子，和让 AI 翻这句", () => {
  const at = html.indexOf("function onSearchInput");
  const body = html.slice(at, html.indexOf("\nfunction ", at + 10));
  assert.ok(!/results\.length < 3/.test(body),
    "命中够多就不给 AI 选项了——家长会以为这句没法翻");
});

console.log("candidate-one navigation tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
