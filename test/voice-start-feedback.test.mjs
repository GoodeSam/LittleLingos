#!/usr/bin/env node
// Behavioral tests for the gap between tapping the mic and the engine
// actually listening.
//
// Zero-dependency: the ll:voice-input module is extracted from index.html and
// run in a vm context, per test/voice-input.test.mjs.
//
// THE REPORT: "每次点那话筒进录音的时候，他经常给我反馈是说没有听清楚，
// 请再说一次". Not misrecognition — nothing recognised at all.
//
// THE DEFECT. setListening(true) runs only from onstart/onaudiostart, which
// arrive after the engine has finished its handshake — on a phone that is
// commonly half a second to well over one. Between the tap and that moment the
// button looks exactly as it did before: nothing pulses, nothing changes.
//
// So a parent taps, sees no response, and starts talking into an engine that
// is not listening yet. By the time it starts, the sentence is over. It hears
// silence and reports no-speech, or ends silently — and both land on
// 「没听清，请再说一次」, which tells them their pronunciation was the problem.
//
// It is the failure a parent would hit MOST often, because the faster they
// are, the more reliably they lose. Someone who taps and waits a beat gets a
// working mic; someone holding a squirming child does not.
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   1. 家长点下话筒，立刻看得出有反应 —— 不用猜「它到底开始了没有」。
//
//   2. 「准备中」和「正在听」看起来不一样，因为该开口的时刻只有一个。
//
//   3. 引擎没起来就回到空闲，按钮不会卡在一个假的「正在听」上。
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

// A button that records which classes it has been given, so a test can ask
// what the parent would see rather than what the code intended.
function fakeButton() {
  const classes = new Set();
  return {
    classes,
    disabled: false,
    className: "",
    classList: {
      toggle: (c, on) => { if (on) classes.add(c); else classes.delete(c); },
      add: c => classes.add(c),
      remove: c => classes.delete(c),
      contains: c => classes.has(c),
    },
    setAttribute() {},
    // 真实代码用的是 addEventListener('click', toggle) —— 假按钮照着收，
    // 否则测的是一个不存在的绑定方式。
    addEventListener(type, fn) { (this._h ||= {})[type] = fn; },
    click() { this._h && this._h.click && this._h.click(); },
  };
}

function loadModule() {
  const s = html.indexOf(START), e = html.indexOf(END);
  assert.ok(s !== -1 && e !== -1, `index.html must contain ${START} … ${END} markers`);

  const made = [];
  class FakeRec {
    constructor() { made.push(this); this.aborted = false; }
    start() { this.started = true; }
    stop() { this.stopped = true; }
    abort() { this.aborted = true; }
  }

  const buttons = {};
  const timers = [];
  const shown = [];
  const ctx = {
    console,
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clearTimeout: () => {},
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    showOfflineToast: m => shown.push(m),
    onSearchInput: () => {},
    navigator: { onLine: true },
    window: { addEventListener: () => {}, SpeechRecognition: FakeRec },
    document: {
      getElementById: id => (buttons[id] ||= fakeButton()),
      querySelectorAll: () => [],
    },
    _timers: timers,
  };
  vm.createContext(ctx);
  vm.runInContext(html.slice(s, e + END.length), ctx);
  const api = ctx.setupVoiceInputs();
  const btn = buttons["translateMicBtn"];
  const tap = () => btn.click();
  const tick = () => { const t = timers.shift(); if (t) t.fn(); return !!t; };
  return { ctx, api, btn, made, shown, tap, tick, timers };
}

// ══ 1. 点下去就有反应 ═════════════════════════════════════════════════

test("点下话筒的瞬间，按钮就变了样 —— 不用等引擎握手完成", async () => {
  // 这一条是整组测试存在的理由。等 onstart 才给反馈的话，家长在那半秒到
  // 一秒多里看不到任何变化，于是对着一个还没开始听的引擎说完了整句话。
  const { btn, tap } = loadModule();
  const before = [...btn.classes];
  tap();
  assert.notDeepEqual([...btn.classes], before,
    "点了没反应的话，家长唯一能做的就是马上开口 —— 而那时引擎还没起来");
});

test("「准备中」和「正在听」看起来不是一回事", async () => {
  // 该开口的时刻只有一个。两个状态长得一样，等于没有告诉他那一刻是什么时候。
  const { btn, tap, made } = loadModule();
  tap();
  const starting = [...btn.classes].sort();
  made[0].onstart();
  const listening = [...btn.classes].sort();
  assert.notDeepEqual(starting, listening, `两个状态都是 ${starting.join(",")}`);
});

test("引擎起来之后，才是那个会跳动的「正在听」", async () => {
  const { btn, tap, made } = loadModule();
  tap();
  assert.equal(btn.classes.has("listening"), false, "还没起来就不该说在听");
  made[0].onstart();
  assert.equal(btn.classes.has("listening"), true);
});

test("引擎直接跳到 onaudiostart 时，也算起来了", async () => {
  // 有的引擎不发 onstart，直接发 onaudiostart。
  const { btn, tap, made } = loadModule();
  tap();
  made[0].onaudiostart();
  assert.equal(btn.classes.has("listening"), true);
});

// ══ 2. 起不来的时候，别卡在假状态上 ═══════════════════════════════════

test("引擎一直没起来，按钮回到空闲，不卡在「准备中」", async () => {
  // 卡住的话，家长下次点它不会有任何反应，而屏幕上还写着在准备。
  const { btn, tap, tick, timers } = loadModule();
  tap();
  while (timers.length) tick();          // 看门狗到点
  assert.equal(btn.classes.has("listening"), false);
  assert.equal([...btn.classes].some(c => /start/i.test(c)), false,
    "「准备中」这个状态也要收掉");
});

test("start() 当场抛异常时，也不会留下「准备中」", async () => {
  // Chrome 的拆卸竞态：上一次会话还没释放干净时 start() 会抛。
  const { btn, tap, made } = loadModule();
  tap();
  made[0].onstart();
  made[0].onend();                       // 一次正常会话，留下待释放的实例
  const stuck = [...btn.classes].some(c => /start|listening/i.test(c));
  assert.equal(stuck, false, "正常结束之后就该是空闲");
});

test("一次会话正常结束之后，两个状态都收掉", async () => {
  const { btn, tap, made } = loadModule();
  tap();
  made[0].onstart();
  made[0].onend();
  assert.equal([...btn.classes].some(c => /start|listening/i.test(c)), false);
});

// ══ 3. 诊断要能看见「什么都没听到」这种失败 ═══════════════════════════

test("诊断记录从点击到各个事件之间过了多久", async () => {
  // 之前那个诊断只在有结果时才显示 —— 而家长报的恰恰是「没有结果」。
  // 它对这个故障完全是盲的。
  const { ctx } = loadModule();
  assert.equal(typeof ctx.voiceTimeline, "function", "module must define voiceTimeline()");
  const t = ctx.voiceTimeline();
  assert.ok(t && typeof t.mark === "function", "要能记事件");
  assert.ok(typeof t.summary === "function", "要能读出来");
});

test("时间线读得出：引擎起来了没有、有没有听到人声", async () => {
  // 这三种失败的修法完全不同：引擎没起来 / 起来了但没人声 / 有人声但转写为空。
  // 现在它们都归到同一句「没听清」。
  const { ctx } = loadModule();
  const t = ctx.voiceTimeline();
  t.mark("tap");
  t.mark("start");
  t.mark("speechstart");
  const s = t.summary();
  assert.match(s, /tap/);
  assert.match(s, /start/);
  assert.match(s, /speechstart/, "有没有检测到人声，是这三种失败的分界线");
  assert.match(s, /\d+ms|\d+\s*ms/, "要带毫秒 —— 慢多少和有没有是两个问题");
});

test("什么都没发生的时候，时间线也说得出「什么都没发生」", async () => {
  const { ctx } = loadModule();
  const t = ctx.voiceTimeline();
  t.mark("tap");
  const s = t.summary();
  assert.match(s, /tap/);
  assert.ok(!/speechstart/.test(s), "没发生的事不该出现在里面");
});

console.log("voice start-feedback tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
