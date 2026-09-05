#!/usr/bin/env node
// Behavioral tests for keeping a readable record of failed listen attempts.
//
// Zero-dependency: the ll:voice-input module is extracted from index.html and
// run in a vm context, per test/voice-input.test.mjs.
//
// TWO DEFECTS THIS FILE EXISTS FOR, both in the diagnostic itself rather than
// in the feature it was built to diagnose:
//
//   1. The timeline was printed with showOfflineToast() and then immediately
//      followed by 「没听清，请再说一次」 — a second call to the same toast,
//      which overwrites the first. So on the exact failure it was built for,
//      the reading was invisible.
//
//   2. A toast disappears in 3.5 seconds. Nobody can read
//      "tap 0ms → start 620ms → end 900ms · 没检测到人声" in 3.5 seconds,
//      let alone five of them in a row while also holding a child.
//
// A record that cannot be read is not a record. Attempts are kept, and the
// settings screen shows them when asked — so the reading happens after the
// experiment rather than during it.
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   1. Victor 连点五次话筒，五次都说没听清。事后打开设置，五次分别发生了
//      什么写在那儿 —— 而不是每次闪 3.5 秒然后消失。
//
//   2. 诊断关着的时候，家长看到的还是原来那句话，不多一个字。
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
    classes, disabled: false, className: "", hidden: true,
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

function loadModule({ debug = false, stored = null } = {}) {
  const s = html.indexOf(START), e = html.indexOf(END);
  const made = [], shown = [], timers = [];
  const store = new Map();
  if (debug) store.set("ll_voice_debug", "1");
  if (stored) store.set("ll_voice_log", JSON.stringify(stored));

  class FakeRec {
    constructor() { made.push(this); }
    start() {} stop() {} abort() {}
  }
  const buttons = {};
  const ctx = {
    console,
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clearTimeout: () => {},
    Date,
    localStorage: {
      getItem: k => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: k => store.delete(k),
    },
    showOfflineToast: m => shown.push(m),
    onSearchInput: () => {},
    navigator: { onLine: true },
    window: { addEventListener: () => {}, SpeechRecognition: FakeRec },
    document: { getElementById: id => (buttons[id] ||= fakeButton()), querySelectorAll: () => [] },
  };
  vm.createContext(ctx);
  vm.runInContext(html.slice(s, e + END.length), ctx);
  ctx.setupVoiceInputs();
  const btn = buttons["translateMicBtn"];
  return { ctx, btn, made, shown, store, tap: () => btn.click() };
}

// One listen attempt that hears nothing — the failure being reported.
function silentAttempt(m) { m.tap(); m.made[0].onstart(); m.made[0].onend(); }

// ══ 1. 诊断开着时，看得到的是时间线，不是那句笼统的话 ═════════════════

test("诊断开着，那次失败留下的是时间线", async () => {
  // 之前两条提示接连发出，后一条把前一条盖掉 —— 在它专门要看的那个故障上，
  // 读数从来没露过面。
  const m = loadModule({ debug: true });
  silentAttempt(m);
  assert.equal(m.shown.length, 1, `弹了 ${m.shown.length} 条 —— 后面那条会盖掉前面的`);
  assert.match(m.shown[0], /tap|start|end/, "留下的必须是时间线，不是那句笼统的话");
});

test("诊断关着，家长看到的还是原来那句话，一个字不多", async () => {
  const m = loadModule({ debug: false });
  silentAttempt(m);
  assert.equal(m.shown.length, 1);
  assert.match(m.shown[0], /没听清/);
  assert.ok(!/ms/.test(m.shown[0]), "家长不该看到毫秒数");
});

// ══ 2. 存下来，事后能翻 ═══════════════════════════════════════════════

test("失败的尝试被记下来了 —— 提示条 3.5 秒读不完一条时间线", async () => {
  const m = loadModule({ debug: true });
  silentAttempt(m);
  const log = JSON.parse(m.store.get("ll_voice_log") || "[]");
  assert.equal(log.length, 1);
  assert.match(log[0], /tap/);
});

test("连着好几次都记下来，而且新的在前面", async () => {
  // 连点五次全说没听清，事后要能一次看完五次分别发生了什么。
  const m = loadModule({ debug: true });
  silentAttempt(m);
  silentAttempt(m);
  silentAttempt(m);
  const log = JSON.parse(m.store.get("ll_voice_log") || "[]");
  assert.equal(log.length, 3);
});

test("只留最近若干条，不会一直涨下去", async () => {
  const m = loadModule({ debug: true });
  for (let i = 0; i < 30; i++) silentAttempt(m);
  const log = JSON.parse(m.store.get("ll_voice_log") || "[]");
  assert.ok(log.length <= 20, `留了 ${log.length} 条 —— 存储不是日志服务器`);
  assert.ok(log.length >= 5, "留太少的话，连点几次就冲掉了前面的");
});

test("诊断关着的时候，什么都不记 —— 家长的设备上不留东西", async () => {
  const m = loadModule({ debug: false });
  silentAttempt(m);
  assert.equal(m.store.has("ll_voice_log"), false);
});

test("成功的那些次也记 —— 「什么时候好使」和「什么时候不好使」一样有用", async () => {
  const m = loadModule({ debug: true });
  m.tap();
  m.made[0].onstart();
  m.made[0].onspeechstart();
  m.made[0].onresult({ results: [[{ transcript: "宝宝", confidence: 0.9 }]] });
  m.made[0].onend();
  const log = JSON.parse(m.store.get("ll_voice_log") || "[]");
  assert.equal(log.length, 1);
  assert.match(log[0], /speechstart/, "成功那次有没有 speechstart，是对照组");
});

// ══ 3. 读得出来、清得掉 ═══════════════════════════════════════════════

test("能把记下来的都读出来", async () => {
  const m = loadModule({ debug: true, stored: ["第一次", "第二次"] });
  assert.equal(typeof m.ctx.readVoiceLog, "function", "module must define readVoiceLog()");
  assert.deepEqual([...m.ctx.readVoiceLog()], ["第一次", "第二次"]);
});

test("存储里是乱码时，当作空的，不崩", async () => {
  const m = loadModule({ debug: true });
  m.store.set("ll_voice_log", "{不是合法 JSON");
  assert.deepEqual([...m.ctx.readVoiceLog()], []);
  assert.doesNotThrow(() => silentAttempt(m));
});

test("能清空 —— 排查完了不该一直留着", async () => {
  const m = loadModule({ debug: true, stored: ["旧的"] });
  m.ctx.clearVoiceLog();
  assert.deepEqual([...m.ctx.readVoiceLog()], []);
});

test("存储用不了时，一切照常，只是记不下来", async () => {
  const s = html.indexOf(START), e = html.indexOf(END);
  const ctx = {
    console, setTimeout, clearTimeout, Date,
    showOfflineToast: () => {}, onSearchInput: () => {},
    navigator: { onLine: true },
    window: { addEventListener: () => {} },
    document: { getElementById: () => null, querySelectorAll: () => [] },
  };                                    // 没有 localStorage
  vm.createContext(ctx);
  vm.runInContext(html.slice(s, e + END.length), ctx);
  assert.deepEqual([...ctx.readVoiceLog()], []);
  assert.doesNotThrow(() => ctx.clearVoiceLog());
});

// ══ 4. 界面上真的看得到 ═══════════════════════════════════════════════

test("设置页上有地方把它显示出来", async () => {
  // 存下来却没有入口，等于没存 —— 这个错误本轮已经犯过一次。
  assert.match(html, /id="voiceLogBox"/, "没有显示的地方，记下来也读不到");
  assert.match(html, /readVoiceLog\(/, "得有人去读它");
  assert.match(html, /clearVoiceLog\(/, "也得能清掉");
});

console.log("voice log tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
