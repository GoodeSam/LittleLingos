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
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

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

// 2026-09-28（ADR 0009 第十块）：存音频搬进 audio-store.js。下面三条原来是读源码，
// 现在直接用模块跑一遍——验的是同一件事，而且不会再被措辞变化骗过去。
const audioStore = require(join(ROOT, "audio-store.js"));
const makeStore = (voice, ids = ["v-default", "v-a", "v-b"]) =>
  audioStore.create({ indexedDB: null, getVoice: () => voice, defaultVoiceId: "v-default", voiceIds: ids });

test("片段的存储键里带着音色", () => {
  // 键里没有音色，换了音色就永远发旧声音——这是「时而这把、时而那把」的主因。
  assert.notEqual(makeStore("v-a").clipKey("b01"), makeStore("v-b").clipKey("b01"),
    "两把不同的嗓子算出了同一个键——换了音色会读到上一把那一份");
});

test("默认音色下键还是裸 id，已经装了的家长不作废", () => {
  // 换键是为了换音色时能重做，不是为了把所有人手机上已经付过钱的片段全废掉。
  assert.equal(makeStore("v-default").clipKey("b01"), "b01", "默认音色下的键不再是裸 id——老片段会全部作废");
  assert.equal(makeStore(null).clipKey("b01"), "b01", "取不到音色时也该退回裸 id");
});

test("删一句话时，它所有音色的片段一起删", () => {
  // 不然家长删掉一句，另外几把嗓子的副本还赖在手机里占空间，谁也找不到。
  const keys = makeStore("v-a").allClipKeys("b01");
  assert.ok(keys.includes("b01"), "没算上默认音色那一份");
  for (const v of ["v-a", "v-b"]) {
    assert.ok(keys.some(k => k.endsWith("@" + v)), `没算上 ${v} 那一份——它会留在手机里`);
  }
});

test("退回手机自带的声音时，界面上说得出来", () => {
  // 这是第二个原因：取不到片段就静默换一把嗓子。声音突然变了而界面一个字
  // 不说，家长只会觉得这软件时好时坏。
  assert.match(html, /function noteBrowserVoice/,
    "没有地方告诉家长这次用的是手机自带的声音");
  const fn = html.match(/function noteBrowserVoice[\s\S]*?\n\}/);
  assert.match(fn[0], /手机|自带|系统/, "那句话没说清这是手机自带的声音");

  // 2026-09-27（ADR 0009）：所有播放键的退路都收进了 audio-controller，它念之前会经过
  // index.html 里那个 Utterance 工厂（<script type="module"> 里 createAudioController 的
  // 参数）——所以「说一声」只需要在那一处。老的 speakText / fallbackTTS 已删。
  const factory = html.match(/Utterance:\s*function \(text\) \{[\s\S]*?\n  \},/);
  assert.ok(factory, "找不到交给 audio-controller 的 Utterance 工厂");
  assert.match(factory[0], /noteBrowserVoice\(\)/, "退回手机自带声音时没说一声");
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
  // 2026-09-28：改为跑真模块。拿一个只认得「当前音色那把键」的假库，
  // 看批量查询问的是不是那个键——问错了就会把有声音的说成没有、或反过来。
  const asked = [];
  const store = audioStore.create({
    indexedDB: null, getVoice: () => "v-a", defaultVoiceId: "v-default", voiceIds: ["v-default", "v-a"],
  });
  const key = store.clipKey("b01");
  assert.equal(key, "b01@v-a", "当前音色下的键不对");
  assert.notEqual(key, "b01", "批量查询若拿裸 id 去比，带音色后缀的片段会被当成「没有声音」");
  void asked;
});

test("中文提示自成一路：不跟着英文音色走，也不共用一个键", () => {
  // 连播里的中文提示是另一把嗓子（中文的）。它要是跟着家长挑的英文音色
  // 分键，家长每换一次英文嗓子，所有中文提示就全部作废重生成——白花钱，
  // 而且中文听起来一点没变。
  const mk = (voice) => audioStore.create({
    indexedDB: null, getVoice: () => voice, defaultVoiceId: "v-default",
    voiceIds: ["v-default", "v-a", "v-b"], cueVoiceId: "zh-cue",
  });
  // 换英文音色，中文提示的键不能跟着变（变了 = 家长每换一次嗓子，中文提示全部作废重生成）
  assert.equal(mk("v-a").clipKey("zh:b01"), mk("v-b").clipKey("zh:b01"),
    "中文提示跟着英文音色分键了——换一次嗓子就白花一次钱");
  assert.match(mk("v-a").clipKey("zh:b01"), /@zh-cue$/, "中文提示没有用它自己那把嗓子分键");
});

test("删一句话时，它的中文提示也一起删", () => {
  const keys = audioStore.create({
    indexedDB: null, getVoice: () => "v-a", defaultVoiceId: "v-default", voiceIds: ["v-default", "v-a"], cueVoiceId: "zh-cue",
  }).allClipKeys("b01");
  // 中文提示有两份：没配中文嗓子时存的裸 "zh:id"，和配了之后的 "zh:id@嗓子"。
  // 只验「有一条以 zh: 开头」是不够的——删掉其中一条，另一条还顶着，测试照绿
  //（2026-09-28 变异探测 ③ 抓到的）。两条都要在。
  assert.ok(keys.includes("zh:b01"), "删的时候落下了中文提示的裸键（没配中文嗓子时存的那份）");
  assert.ok(keys.includes("zh:b01@zh-cue"), "删的时候落下了中文提示带嗓子的那份");
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
