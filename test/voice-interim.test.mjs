#!/usr/bin/env node
// Behavioral tests for observing whether ANY audio reaches the recogniser.
//
// Zero-dependency: the ll:voice-input module is extracted from index.html and
// run in a vm context, per test/voice-input.test.mjs.
//
// WHAT THE FIRST REAL READING SHOWED. Five attempts on the phone:
//
//   1. tap → end 1648ms                                  · 没有结果
//   2. tap → start 32ms → audiostart 34ms → result 7430ms → end 7442ms
//   3. tap → start 7ms  → audiostart 7ms  → end 12021ms  · 没有结果
//   4. tap → start 8ms  → audiostart 9ms  → end 8956ms   · 没有结果
//   5. tap → start 9ms  → audiostart 10ms → end 7031ms   · 没有结果
//
// Two things follow, and both correct an earlier belief of mine.
//
// The engine starts in 7–34ms, so the handshake delay I fixed last round was
// a real defect but not this one. And run 2 produced a RESULT while the
// readout still said 没检测到人声 — proving this engine never fires
// speechstart at all, so inferring "no voice" from its absence was my
// diagnostic lying about the thing it was built to observe.
//
// What remains unexplained is 7–12 seconds of listening that yields nothing
// and reports no error. Interim results are the probe for it: if partial
// transcripts arrive during those seconds, audio is reaching the recogniser
// and the final result is being lost; if none arrive, nothing is getting in.
//
// The live path is unchanged — only final results are ever used. An interim
// is observed and discarded.
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   1. 那 7 到 12 秒里，引擎到底有没有听到东西 —— 记录要答得出来。
//
//   2. 半路的猜测不能写进输入框，也不能触发「没听清」。家长看到的东西
//      不因为诊断而改变。
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

function fakeButton() {
  const classes = new Set();
  return {
    classes, disabled: false, className: "", hidden: true, value: "",
    classList: {
      toggle: (c, on) => { if (on) classes.add(c); else classes.delete(c); },
      add: c => classes.add(c), remove: c => classes.delete(c),
      contains: c => classes.has(c),
    },
    setAttribute() {},
    addEventListener(type, fn) { (this._h ||= {})[type] = fn; },
    click() { this._h && this._h.click && this._h.click(); },
  };
}

function loadModule({ debug = true } = {}) {
  const s = html.indexOf(START), e = html.indexOf(END);
  const made = [], shown = [], timers = [];
  const store = new Map(debug ? [["ll_voice_debug", "1"]] : []);
  class FakeRec { constructor() { made.push(this); } start() {} stop() {} abort() {} }
  const els = {};
  const ctx = {
    console, Date,
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clearTimeout: () => {},
    localStorage: {
      getItem: k => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: k => store.delete(k),
    },
    showOfflineToast: m => shown.push(m),
    onSearchInput: () => {},
    navigator: { onLine: true },
    window: { addEventListener: () => {}, SpeechRecognition: FakeRec },
    document: { getElementById: id => (els[id] ||= fakeButton()), querySelectorAll: () => [] },
  };
  vm.createContext(ctx);
  vm.runInContext(html.slice(s, e + END.length), ctx);
  ctx.setupVoiceInputs();
  return { ctx, els, made, shown, store, tap: () => els["translateMicBtn"].click() };
}

// A result event with an explicit isFinal, the way a real engine sends one.
const evt = (transcript, isFinal) => ({
  results: Object.assign([Object.assign([{ transcript, confidence: 0.8 }], { isFinal })],
                         { length: 1 }),
});

// ══ 1. 半路的猜测被观察到，但不被采用 ═════════════════════════════════

test("引擎要被要求给出半路的猜测 —— 否则那 7 到 12 秒是个黑箱", async () => {
  const src = html.slice(html.indexOf(START), html.indexOf(END));
  assert.match(src, /interimResults\s*=\s*true/,
    "关着的话，无从知道那些秒里到底有没有音频进去");
});

test("半路的猜测记进时间线", async () => {
  const m = loadModule();
  m.tap();
  m.made[0].onstart();
  m.made[0].onresult(evt("宝", false));
  m.made[0].onresult(evt("宝宝今天", false));
  m.made[0].onend();
  const log = JSON.parse(m.store.get("ll_voice_log") || "[]");
  assert.match(log[0], /interim/, "有没有中间结果，是「音频进没进去」的答案");
});

test("半路的猜测不写进输入框 —— 家长看到的东西不因为诊断而变", async () => {
  const m = loadModule();
  m.tap();
  m.made[0].onstart();
  const field = m.ctx.document.getElementById("zhInput");   // 懒建的假 DOM，先问一次
  field.value = "";
  m.made[0].onresult(evt("宝", false));
  assert.equal(field.value, "", "半截的猜测写进去，家长会看到字自己在跳");
});

test("最终结果照常写进输入框", async () => {
  const m = loadModule();
  m.tap();
  m.made[0].onstart();
  m.made[0].onresult(evt("宝", false));
  m.made[0].onresult(evt("宝宝今天真棒", true));
  assert.equal(m.els["zhInput"].value, "宝宝今天真棒");
});

test("只有半路的猜测、始终没有最终结果时，仍然算「没有结果」", async () => {
  // 这正是要测量的那种失败：听到了东西，但最终什么都没交出来。
  const m = loadModule();
  m.tap();
  m.made[0].onstart();
  m.made[0].onresult(evt("宝宝", false));
  m.made[0].onend();
  const log = JSON.parse(m.store.get("ll_voice_log") || "[]");
  assert.match(log[0], /没有结果/, "有中间结果不等于成功");
  assert.match(log[0], /interim/, "但要看得出确实有音频进去了");
});

test("半路的空猜测不会误触「没听清」", async () => {
  // 之前只要 transcript 为空就弹「没听清」。中间结果常常是空的，
  // 那会在家长还在说话的时候就弹出来。
  const m = loadModule({ debug: false });
  m.tap();
  m.made[0].onstart();
  m.made[0].onresult(evt("", false));
  assert.equal(m.shown.length, 0, "还没说完就说没听清，是在打断他");
});

test("最终结果为空时，照旧告诉他没听清", async () => {
  const m = loadModule({ debug: false });
  m.tap();
  m.made[0].onstart();
  m.made[0].onresult(evt("  ", true));
  assert.ok(m.shown.some(t => /没听清/.test(t)));
});

// ══ 2. 不再声称一件这个引擎不会说的事 ═════════════════════════════════

test("不再因为没有 speechstart 就断言「没检测到人声」", async () => {
  // 真机第 2 行：出了结果，却仍写着没检测到人声 —— 这个引擎根本不发那个
  // 事件。凭它缺席去推断，是诊断在编造。
  const m = loadModule();
  m.tap();
  m.made[0].onstart();
  m.made[0].onresult(evt("宝宝", true));
  m.made[0].onend();
  const log = JSON.parse(m.store.get("ll_voice_log") || "[]");
  assert.ok(!/没检测到人声/.test(log[0]),
    "有结果还说没听到人声 —— 那是诊断在说谎，比没有诊断更坏");
});

test("speechstart 真的来了的时候，照样记下来", async () => {
  // 换个浏览器可能就有了。记事实，不做推断。
  const m = loadModule();
  m.tap();
  m.made[0].onstart();
  m.made[0].onspeechstart();
  m.made[0].onend();
  const log = JSON.parse(m.store.get("ll_voice_log") || "[]");
  assert.match(log[0], /speechstart/);
});

console.log("voice interim tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
