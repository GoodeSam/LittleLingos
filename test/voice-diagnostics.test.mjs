#!/usr/bin/env node
// Behavioral tests for the voice diagnostics readout — a temporary window
// into what the speech engine actually returned.
//
// Zero-dependency: the ll:voice-input module is extracted from index.html and
// run in a vm context, per test/voice-input.test.mjs (which covers the session
// and race handling and stays untouched).
//
// WHY. Reported from real use: "语音转文字识别经常不准确". Reading the code
// turns up four candidate causes and no way to tell which one is biting:
//
//   · continuous is never set, so the engine stops at the first pause — a
//     sentence with a comma in it comes back as a fragment
//   · confidence is never read; a transcript the engine is 30% sure of looks
//     exactly like one it is certain about, and the parent then taps 翻译,
//     which spends money
//   · maxAlternatives = 1, so the right answer sitting in slot 2 is discarded
//     and low confidence cannot even be detected
//   · the home search box accepts 中文找句子 · 英文查单词 but the mic is
//     hardcoded zh-CN, so an English word is guessed at in Chinese
//
// Their fixes conflict — turning on `continuous` means rebuilding the
// end-of-session logic that carries a lot of hard-won race handling — and
// none of it is testable in Node, which has no speech engine. So: measure
// first. This readout shows what came back, and the parent's report of what
// they SAID is the other half.
//
// It is DIAGNOSTIC, not product. It stays off unless switched on, and the
// last test here is what makes that checkable.
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   1. Victor 打开诊断，对着麦克风说一句话，屏幕上能看到引擎到底返回了
//      什么：完整文本、有多确定、以及它考虑过的其他候选。
//
//   2. 家长看不到这些。默认关着，而且不因为看到一堆数字而困惑。
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import assert from "node:assert/strict";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");

const START = "/* ll:voice-input:start */";
const END = "/* ll:voice-input:end */";

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// A result event shaped the way a real engine shapes one: an array-like of
// results, each an array-like of alternatives, each with transcript and
// confidence. The existing tests send only { transcript } — which is why
// nothing in the suite could see confidence or alternatives before now.
function resultEvent(alternatives) {
  const alts = alternatives.map(a =>
    typeof a === "string" ? { transcript: a, confidence: 0.9 } : a);
  const one = Object.assign([...alts], { length: alts.length, isFinal: true });
  return { results: Object.assign([one], { length: 1 }) };
}

function loadModule({ on = false } = {}) {
  const s = html.indexOf(START), e = html.indexOf(END);
  assert.ok(s !== -1 && e !== -1, `index.html must contain ${START} … ${END} markers`);
  const shown = [];
  const store = new Map(on ? [["ll_voice_debug", "1"]] : []);
  const ctx = {
    console, setTimeout, clearTimeout,
    localStorage: {
      getItem: k => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: k => store.delete(k),
    },
    showOfflineToast: msg => shown.push(msg),
    onSearchInput: () => {},
    navigator: { onLine: true },
    window: { addEventListener: () => {}, SpeechRecognition: undefined, webkitSpeechRecognition: undefined },
    document: { getElementById: () => null, querySelectorAll: () => [] },
  };
  vm.createContext(ctx);
  vm.runInContext(html.slice(s, e + END.length), ctx);
  assert.equal(typeof ctx.describeSpeechResult, "function",
    "module must define describeSpeechResult()");
  assert.equal(typeof ctx.voiceDebugOn, "function", "module must define voiceDebugOn()");
  return { ctx, shown, store };
}

// ══ 1. 摊出引擎真正返回了什么 ═════════════════════════════════════════

test("看得到完整文本 —— 判断「是不是被截短了」全靠它", async () => {
  const { ctx } = loadModule();
  const d = ctx.describeSpeechResult(resultEvent(["宝宝今天真棒"]));
  assert.equal(d.transcript, "宝宝今天真棒");
});

test("看得到引擎有多确定", async () => {
  // 三成把握的结果和十成把握的，现在界面上长得一模一样。而下一步点
  // 「翻译」是要花钱的。
  const { ctx } = loadModule();
  const d = ctx.describeSpeechResult(resultEvent([{ transcript: "宝宝", confidence: 0.31 }]));
  assert.equal(d.confidence, 0.31);
});

test("看得到它考虑过的其他候选", async () => {
  // 对的答案常常排在第二位。看不到的话，连「该不该提示确认」都判断不了。
  const { ctx } = loadModule();
  const d = ctx.describeSpeechResult(resultEvent([
    { transcript: "备的太", confidence: 0.4 },
    { transcript: "bedtime", confidence: 0.35 },
  ]));
  assert.deepEqual([...d.alternatives], ["备的太", "bedtime"]);
});

test("引擎不给置信度时，如实说「不知道」，不编一个数", async () => {
  // Safari 经常不填这个字段。填 0 会被读成「完全没把握」，那是另一回事。
  const { ctx } = loadModule();
  const d = ctx.describeSpeechResult({ results: [[{ transcript: "宝宝" }]] });
  assert.equal(d.transcript, "宝宝");
  assert.equal(d.confidence, null, "缺失和 0 是两个意思");
});

test("多个 result 时，看的是最后一个 —— 和实际取用的那条保持一致", async () => {
  const { ctx } = loadModule();
  const evt = { results: [[{ transcript: "旧的" }], [{ transcript: "新的" }]] };
  assert.equal(ctx.describeSpeechResult(evt).transcript, "新的");
});

test("空的、畸形的事件，不崩", async () => {
  const { ctx } = loadModule();
  for (const bad of [null, undefined, {}, { results: [] }, { results: [[]] }]) {
    assert.doesNotThrow(() => ctx.describeSpeechResult(bad));
    assert.equal(ctx.describeSpeechResult(bad).transcript, "");
  }
  assert.equal(ctx.describeSpeechResult(resultEvent(["在"])).transcript, "在",
    "对照：正常事件必须读得出来");
});

// ══ 2. 默认关着 ═══════════════════════════════════════════════════════

test("默认不显示 —— 家长不该看到一堆置信度数字", async () => {
  const { ctx, shown } = loadModule({ on: false });
  assert.equal(ctx.voiceDebugOn(), false);
  ctx.reportSpeechResult(resultEvent([{ transcript: "宝宝", confidence: 0.3 }]));
  assert.equal(shown.length, 0, "关着的时候一个字都不该冒出来");
});

test("开了才显示，而且把三样都摆出来", async () => {
  const { ctx, shown } = loadModule({ on: true });
  assert.equal(ctx.voiceDebugOn(), true);
  ctx.reportSpeechResult(resultEvent([
    { transcript: "宝宝", confidence: 0.31 },
    { transcript: "包包", confidence: 0.28 },
  ]));
  assert.equal(shown.length, 1);
  const msg = shown[0];
  assert.match(msg, /宝宝/, "要有听到的文本");
  assert.match(msg, /31|0\.31/, "要有置信度");
  assert.match(msg, /包包/, "要有第二候选 —— 对的答案常常排在这儿");
});

test("开关是存下来的 —— 不用每次重开都设一遍", async () => {
  const { ctx, store } = loadModule({ on: false });
  ctx.setVoiceDebug(true);
  assert.equal(store.get("ll_voice_debug"), "1");
  assert.equal(loadModule({ on: true }).ctx.voiceDebugOn(), true);
});

test("存储用不了时，当作关着，而不是崩掉", async () => {
  const s = html.indexOf(START), e = html.indexOf(END);
  const ctx = {
    console, setTimeout, clearTimeout,
    showOfflineToast: () => {}, onSearchInput: () => {},
    navigator: { onLine: true },
    window: { addEventListener: () => {} },
    document: { getElementById: () => null, querySelectorAll: () => [] },
  };                                   // 没有 localStorage
  vm.createContext(ctx);
  vm.runInContext(html.slice(s, e + END.length), ctx);
  assert.equal(ctx.voiceDebugOn(), false);
  assert.doesNotThrow(() => ctx.setVoiceDebug(true));
});

// ══ 3. 它是诊断，不是产品 ═════════════════════════════════════════════

test("识别照常走，诊断只是旁观 —— 它不能改变听到的内容", async () => {
  // 一个会影响结果的「诊断」，测的就不是原来那个系统了。
  const { ctx } = loadModule({ on: true });
  const evt = resultEvent([{ transcript: "宝宝今天真棒", confidence: 0.9 }]);
  const before = ctx.describeSpeechResult(evt).transcript;
  ctx.reportSpeechResult(evt);
  assert.equal(ctx.describeSpeechResult(evt).transcript, before);
});

test("拿得到更多候选 —— 只要一个的话，诊断也没什么可看的", async () => {
  // maxAlternatives = 1 时引擎只返回一条，这个诊断就永远看不到「对的答案
  // 排在第二位」这种情况 —— 而那正是要测量的东西之一。
  const src = html.slice(html.indexOf(START), html.indexOf(END));
  const m = src.match(/maxAlternatives\s*=\s*(\d+)/);
  assert.ok(m, "maxAlternatives 没设");
  assert.ok(Number(m[1]) >= 3, `maxAlternatives = ${m[1]}，看不到候选就没法判断该不该提示确认`);
});

console.log("voice diagnostics tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
