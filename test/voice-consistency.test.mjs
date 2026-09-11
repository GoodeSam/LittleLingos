#!/usr/bin/env node
// 为什么同一个软件里会冒出好几种声音。
//
// 家长在设置里挑了一把嗓子，可听到的声音时而是它、时而是别的，甚至有时候
// 念的根本不是这一句。查下来是四件独立的事凑在一起：
//
//   1. 生成好的片段按句子 id 存，键里没有音色。换了音色之后，
//      provisionAudio 第一行的 hasAudio(id) 直接短路返回——旧片段永远不会
//      重做。于是同一个收藏列表里，早存的用旧音色、新存的用新音色。
//   2. 取不到片段时静默退回手机自带的语音合成。那是另一把完全不同的嗓子，
//      而界面上一个字都不说，家长只会觉得这软件时好时坏。
//   3. 场景里的预设句子放的是提前录好的 mp3，永远是最初那把嗓子。
//      （这条是设计如此，设置页写了；这里只守住「说清楚」。）
//   4. 翻译句子的 id 是 "t_" + Date.now()，毫秒分辨率。批量翻译时两句落在
//      同一毫秒就共用一个 id，后一句的音频盖掉前一句——播出来是另一句话。
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   家长在设置里换了一把嗓子。之后他听到的每一句自己存的话都是新那把，
//   不会一句新一句旧。偶尔某句还没生成好，软件会告诉他这次是手机自带的
//   声音在念，而不是让他猜。批量翻一堆句子，每一句播出来的都是它自己。
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import assert from "node:assert/strict";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const html = readFileSync(join(ROOT, "index.html"), "utf8");

function fragment(name) {
  const s = html.indexOf(`/* ll:${name}:start */`);
  const e = html.indexOf(`/* ll:${name}:end */`);
  assert.ok(s !== -1 && e !== -1 && e > s, `找不到 ll:${name} 这一段`);
  return html.slice(s, e);
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test("同一毫秒里铸出来的两个 id 不会撞", () => {
  // 批量翻译时每句都会铸一个 id。命中缓存的那几句返回极快，两句落在同一
  // 毫秒完全可能——撞了之后，后一句的音频存在前一句的键上，家长点前一句
  // 听到的是后一句。
  const ctx = {
    console,
    Date: { now: () => 1725300000000 },   // 时间钉死，模拟同一毫秒
    savedPhrases: [],
    isAlreadySaved: () => false,
    isCustomScenario: () => false,
    safeSetItem: () => true,
    scenarios: {},
  };
  vm.createContext(ctx);
  vm.runInContext(fragment("translate-save"), ctx);
  assert.equal(typeof ctx.assignTranslationIds, "function", "找不到铸 id 的地方");

  const a = { en: "Time for bed." };
  const b = { en: "Good night." };
  ctx.assignTranslationIds(a);
  ctx.assignTranslationIds(b);
  assert.ok(a.id && b.id, "没有铸出 id");
  assert.notEqual(a.id, b.id, `同一毫秒的两句共用了一个 id：${a.id}`);

  // 连铸 50 个也不能有重复
  const ids = new Set();
  for (let i = 0; i < 50; i++) {
    const r = { en: "x" + i };
    ctx.assignTranslationIds(r);
    ids.add(r.id);
  }
  assert.equal(ids.size, 50, `50 句里只铸出了 ${ids.size} 个不同的 id`);
});

test("片段的存储键里带着音色", () => {
  // 键里没有音色，换了音色就永远发旧声音——这是「时而这把、时而那把」的主因。
  const src = fragment("audio-store");
  assert.match(src, /function clipKey/, "音频仓库没有按音色分键");
  assert.match(src, /getVoice/, "分键时没有看家长选的是哪一把");
});

test("默认音色下键还是裸 id，已经装了的家长不作废", () => {
  // 换键是为了换音色时能重做，不是为了把所有人手机上已经付过钱的片段全废掉。
  // 默认那把仍用裸 id，所以旧片段照旧命中。
  const src = fragment("audio-store");
  const fn = src.match(/function clipKey[\s\S]*?\n\}/);
  assert.ok(fn, "找不到 clipKey 的实现");
  assert.match(fn[0], /DEFAULT|默认/, "没有为默认音色保留裸 id 这条路");
});

test("删一句话时，它所有音色的片段一起删", () => {
  // 不然家长删掉一句，另外几把嗓子的副本还赖在手机里占空间，谁也找不到。
  const src = fragment("audio-store");
  const fn = src.match(/async function deleteAudio[\s\S]*?\n\}/);
  assert.ok(fn, "找不到 deleteAudio");
  assert.match(fn[0], /VOICE_OPTIONS|allClipKeys|forEach|for \(/,
    "只删了当前音色那一份，别的音色的副本留在了手机里");
});

test("退回手机自带的声音时，界面上说得出来", () => {
  // 这是第二个原因：取不到片段就静默换一把嗓子。声音突然变了而界面一个字
  // 不说，家长只会觉得这软件时好时坏。
  assert.match(html, /function noteBrowserVoice/,
    "没有地方告诉家长这次用的是手机自带的声音");
  const fn = html.match(/function noteBrowserVoice[\s\S]*?\n\}/);
  assert.match(fn[0], /手机|自带|系统/, "那句话没说清这是手机自带的声音");

  // 两条退路都要说：句子卡的朗读，和结果卡/复习卡的朗读
  const speakText = html.match(/function speakText[\s\S]*?\n\}/);
  assert.ok(speakText, "找不到 speakText");
  assert.match(speakText[0], /noteBrowserVoice\(\)/, "speakText 退回时没说");
  const fallback = html.match(/function fallbackTTS[\s\S]*?\n  \}/);
  if (fallback) {
    assert.match(fallback[0], /noteBrowserVoice\(\)/, "句子卡退回时没说");
  }
});

test("场景里的预设句子不跟着换音色——这件事在设置里写明了", () => {
  // 第三个原因，设计如此：1204 条预设片段是提前生成的文件，换音色不会重做。
  // 不能悄悄让家长以为换了，所以设置页必须写出来。
  const at = html.indexOf("朗读声音");
  assert.ok(at !== -1, "设置里没有朗读声音这一块");
  const near = html.slice(at, at + 400);
  assert.match(near, /预设/, "没说预设句子不跟着换");
  assert.match(near, /已经生成|保持原样|不跟着换/, "没说已经生成过的句子会保持原样");
});

test("列表上的「有声音」标记也只认当前这把嗓子", () => {
  // 差点引入的新 bug：批量查询拿存储键去比对句子 id，带音色后缀的片段会被
  // 当成「没有声音」。反过来如果放宽成前缀匹配，旧音色的副本又会被当成有，
  // 标着有、点下去是另一把嗓子在念。两边都不对，只能按当前音色精确比对。
  const src = fragment("audio-store");
  const fn = src.match(/async function whichHaveAudio[\s\S]*?\n\}/);
  assert.ok(fn, "找不到批量查询");
  assert.match(fn[0], /clipKey\(/, "批量查询没有按当前音色比对");
  assert.doesNotMatch(fn[0], /wanted\.has\(k\)/, "还在拿原始存储键跟句子 id 直接比");
});

test("中文提示自成一路：不跟着英文音色走，也不共用一个键", () => {
  // 连播里的中文提示是另一把嗓子（中文的）。它要是跟着家长挑的英文音色
  // 分键，家长每换一次英文嗓子，所有中文提示就全部作废重生成——白花钱，
  // 而且中文听起来一点没变。
  const src = fragment("audio-store");
  const fn = src.match(/function clipKey[\s\S]*?\n\}/);
  assert.ok(fn, "找不到 clipKey");
  assert.match(fn[0], /zh:/, "clipKey 没有把中文提示单独认出来");
  assert.match(fn[0], /CUE_VOICE_ID/, "中文提示没有用它自己那把嗓子分键");
});

test("删一句话时，它的中文提示也一起删", () => {
  const src = fragment("audio-store");
  const fn = src.match(/function allClipKeys[\s\S]*?\n\}/);
  assert.ok(fn, "找不到 allClipKeys");
  assert.match(fn[0], /zh:/, "删的时候把中文提示那份落下了");
});

test("界面和服务端说的是同一把中文嘴", async () => {
  // 两边对不上，中文提示会一直生成失败，而且没有任何东西会红。
  const { CUE_VOICE } = await import("../netlify/functions/tts.mjs");
  const m = html.match(/const CUE_VOICE_ID = "([^"]+)"/);
  assert.ok(m, "客户端没有指定中文提示用哪把嗓子");
  assert.equal(m[1], CUE_VOICE, "界面和服务端说的不是同一把中文嘴");
});

console.log("voice consistency tests");
let passed = 0, failed = 0;
for (const t of tests) {
  // 必须 await：异步测试不 await 的话，它抛的错落在一个没人接的 promise 里，
  // 这一条会永远显示为绿的。
  try { await t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
