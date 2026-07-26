#!/usr/bin/env node
// Behavioral tests for the shared voice-input module in index.html.
// Zero-dependency: extracts the code between the ll:voice-input markers and
// runs it in a vm context with a stub DOM, stub SpeechRecognition, a fake
// window event bus, and a virtual clock. Written TDD-first for "voice input
// on the translate screen": the same controller factory must drive both the
// search mic (#micBtn → #searchInput) and the translate mic
// (#translateMicBtn → #zhInput).
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

// ── Virtual clock ──────────────────────────────────────
// Retains future timers instead of flushing everything queued: advance(ms)
// runs only timers whose deadline falls inside the advanced window, in
// scheduled order, so watchdog (1500ms) and cooldown (400ms) interleave the
// way a browser would.
function makeClock() {
  let now = 0, nextId = 1;
  const timers = new Map(); // id -> { fn, at }
  return {
    setTimeout: (fn, delay) => { const id = nextId++; timers.set(id, { fn, at: now + (Number(delay) || 0) }); return id; },
    clearTimeout: (id) => { timers.delete(id); },
    advance: (ms) => {
      const target = now + ms;
      for (;;) {
        let dueId = null, dueAt = Infinity;
        for (const [id, t] of timers) if (t.at <= target && t.at < dueAt) { dueId = id; dueAt = t.at; }
        if (dueId === null) break;
        const t = timers.get(dueId);
        timers.delete(dueId);
        now = t.at;
        t.fn();
      }
      now = target;
    },
    pending: () => timers.size,
  };
}

// ── Stub DOM / environment ─────────────────────────────
function fakeEl({ hidden = false } = {}) {
  const classes = new Set();
  const attrs = {};
  const listeners = {};
  return {
    hidden, disabled: false, value: "",
    classList: {
      add: c => classes.add(c),
      remove: c => classes.delete(c),
      toggle: (c, force) => { (force ? classes.add(c) : classes.delete(c)); },
      contains: c => classes.has(c),
    },
    setAttribute: (k, v) => { attrs[k] = v; },
    getAttribute: k => attrs[k],
    addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn); },
    click() { (listeners.click || []).forEach(fn => fn()); },
  };
}

function makeEnv({ withCtor = true, online = true } = {}) {
  const els = {
    micBtn: fakeEl({ hidden: true }),
    searchInput: fakeEl(),
    translateMicBtn: fakeEl({ hidden: true }),
    zhInput: fakeEl(),
  };
  const clock = makeClock();
  const toasts = [];
  const searchCalls = [];
  const instances = [];
  const behavior = { startThrows: false }; // makes FakeRecognition.start() throw on demand
  const winListeners = {};

  class FakeRecognition {
    constructor() {
      this.started = 0; this.stopped = 0; this.aborted = 0;
      instances.push(this);
    }
    start() { if (behavior.startThrows) throw new Error("InvalidStateError"); this.started++; }
    stop() { this.stopped++; }
    abort() { this.aborted++; }
  }

  const ctx = {
    window: {
      addEventListener: (type, fn) => { (winListeners[type] ||= []).push(fn); },
      ...(withCtor ? { SpeechRecognition: FakeRecognition } : {}),
    },
    navigator: { onLine: online },
    document: { getElementById: id => els[id] || null },
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    showOfflineToast: msg => toasts.push(msg),
    onSearchInput: () => searchCalls.push(1),
    console,
  };
  vm.createContext(ctx);

  const s = html.indexOf(START), e = html.indexOf(END);
  assert.ok(s !== -1 && e !== -1, `index.html must contain ${START} … ${END} markers`);
  vm.runInContext(html.slice(s, e + END.length), ctx);
  assert.equal(typeof ctx.setupVoiceInputs, "function",
    "voice-input module must define setupVoiceInputs()");
  const controllers = ctx.setupVoiceInputs();

  const fireWindow = (type) => (winListeners[type] || []).forEach(fn => fn());
  return { els, toasts, searchCalls, instances, controllers, ctx, clock, behavior, fireWindow, winListeners };
}

// ── Structural: the translate screen ships a mic button ──
test("index.html has #translateMicBtn inside the translate screen, hidden by default", () => {
  const screen = html.slice(html.indexOf('id="translateScreen"'), html.indexOf('id="translateResult"'));
  assert.match(screen, /id="translateMicBtn"/, "translate screen needs a mic button");
  const at = screen.indexOf('id="translateMicBtn"');
  const btnTag = screen.slice(Math.max(0, at - 200), at + 300);
  assert.match(btnTag, /hidden/, "translate mic button must start hidden (progressive enhancement)");
  assert.match(btnTag, /mic-btn/, "translate mic button reuses the .mic-btn styling");
});

test("index.html actually calls setupVoiceInputs() at startup (outside the tested fragment)", () => {
  const afterModule = html.slice(html.indexOf(END) + END.length);
  assert.match(afterModule, /setupVoiceInputs\(\);/,
    "production wiring must invoke the module, not just define it");
});

// ── Support gating ─────────────────────────────────────
test("with SpeechRecognition support, both mic buttons are revealed", () => {
  const { els } = makeEnv();
  assert.equal(els.micBtn.hidden, false);
  assert.equal(els.translateMicBtn.hidden, false);
});

test("without SpeechRecognition support, both mic buttons stay hidden and nothing crashes", () => {
  const { els, instances } = makeEnv({ withCtor: false });
  assert.equal(els.micBtn.hidden, true);
  assert.equal(els.translateMicBtn.hidden, true);
  els.micBtn.click(); els.translateMicBtn.click();
  assert.equal(instances.length, 0);
});

// ── Search mic still works through the shared module ───
test("search mic: tap → zh-CN session; result writes #searchInput and calls onSearchInput()", () => {
  const { els, instances, searchCalls } = makeEnv();
  els.micBtn.click();
  assert.equal(instances.length, 1);
  const rec = instances[0];
  assert.equal(rec.lang, "zh-CN");
  assert.equal(rec.started, 1);
  rec.onstart();
  assert.ok(els.micBtn.classList.contains("listening"));
  rec.onresult({ results: [[{ transcript: " 睡觉 " }]] });
  assert.equal(els.searchInput.value, "睡觉");
  assert.equal(searchCalls.length, 1);
  rec.onend();
  assert.equal(els.micBtn.classList.contains("listening"), false);
});

// ── Translate mic (the new feature) ────────────────────
test("translate mic: tap → result writes #zhInput and does NOT trigger search", () => {
  const { els, instances, searchCalls } = makeEnv();
  els.translateMicBtn.click();
  assert.equal(instances.length, 1);
  const rec = instances[0];
  assert.equal(rec.lang, "zh-CN");
  rec.onstart();
  assert.ok(els.translateMicBtn.classList.contains("listening"));
  rec.onresult({ results: [[{ transcript: "宝宝今天真棒" }]] });
  assert.equal(els.zhInput.value, "宝宝今天真棒");
  assert.equal(searchCalls.length, 0);
  assert.equal(els.searchInput.value, "");
});

test("translate mic: listening aria-label reflects state and resets on end", () => {
  const { els, instances } = makeEnv();
  els.translateMicBtn.click();
  const rec = instances[0];
  rec.onstart();
  assert.match(els.translateMicBtn.getAttribute("aria-label"), /聆听/);
  rec.onend();
  assert.match(els.translateMicBtn.getAttribute("aria-label"), /语音输入/);
});

test("multi-result event: the LAST final transcript wins, not a stale first result", () => {
  const { els, instances } = makeEnv();
  els.translateMicBtn.click();
  const rec = instances[0];
  rec.onstart();
  rec.onresult({ results: [[{ transcript: "旧的" }], [{ transcript: "新的" }]] });
  assert.equal(els.zhInput.value, "新的");
});

// ── One microphone: controllers are mutually exclusive ─
test("starting the translate mic while the search mic listens preempts (aborts) the search session", () => {
  const { els, instances } = makeEnv();
  els.micBtn.click();
  const searchRec = instances[0];
  searchRec.onstart();
  els.translateMicBtn.click();
  assert.equal(searchRec.aborted, 1, "search session must be torn down when translate mic starts");
  assert.equal(els.micBtn.classList.contains("listening"), false);
});

test("late events from a preempted search session are ignored — they cannot write the search field or disturb the translate session", () => {
  const { els, instances, searchCalls } = makeEnv();
  els.micBtn.click();
  const searchRec = instances[0];
  searchRec.onstart();
  els.translateMicBtn.click();
  const translateRec = instances[1];
  translateRec.onstart();
  // The aborted engine may still flush a result and its onend afterwards.
  searchRec.onresult({ results: [[{ transcript: "迟到的结果" }]] });
  searchRec.onend();
  assert.equal(els.searchInput.value, "", "late result must not fill the search input");
  assert.equal(searchCalls.length, 0, "late result must not trigger a search");
  assert.ok(els.translateMicBtn.classList.contains("listening"),
    "late onend of the old session must not clear the new session's listening state");
  translateRec.onresult({ results: [[{ transcript: "现在的话" }]] });
  assert.equal(els.zhInput.value, "现在的话");
});

// ── Failure feedback (same contract as voice search) ───
test("empty transcript → '没听清' toast and #zhInput untouched", () => {
  const { els, instances, toasts } = makeEnv();
  els.translateMicBtn.click();
  const rec = instances[0];
  rec.onstart();
  rec.onresult({ results: [[{ transcript: "  " }]] });
  assert.equal(els.zhInput.value, "");
  assert.ok(toasts.some(t => t.includes("没听清")));
});

test("silent end (no result, no error) → '没听清' toast", () => {
  const { els, instances, toasts } = makeEnv();
  els.translateMicBtn.click();
  const rec = instances[0];
  rec.onstart();
  rec.onend();
  assert.ok(toasts.some(t => t.includes("没听清")));
});

test("not-allowed error → permission toast and listening state cleared", () => {
  const { els, instances, toasts } = makeEnv();
  els.translateMicBtn.click();
  const rec = instances[0];
  rec.onstart();
  rec.onerror({ error: "not-allowed" });
  assert.equal(els.translateMicBtn.classList.contains("listening"), false);
  assert.ok(toasts.some(t => t.includes("麦克风")));
});

test("recognition.start() throwing (teardown race) → retry toast, idle state, cooldown", () => {
  const { els, toasts, behavior, clock } = makeEnv();
  behavior.startThrows = true;
  els.translateMicBtn.click();
  assert.equal(els.translateMicBtn.classList.contains("listening"), false);
  assert.ok(toasts.some(t => t.includes("请稍等")));
  assert.equal(els.translateMicBtn.disabled, true, "failed start must enter cooldown");
  behavior.startThrows = false;
  clock.advance(400);
  assert.equal(els.translateMicBtn.disabled, false);
});

test("watchdog: start() with no onstart within 1.5s → abort, idle, retry toast — but not before 1.5s", () => {
  const { els, instances, toasts, clock } = makeEnv();
  els.translateMicBtn.click();
  const rec = instances[0];
  clock.advance(1400);
  assert.equal(rec.aborted, 0, "watchdog must not fire early");
  clock.advance(100);
  assert.equal(rec.aborted, 1);
  assert.equal(els.translateMicBtn.classList.contains("listening"), false);
  assert.ok(toasts.some(t => t.includes("再试一次") || t.includes("没有响应")));
});

// ── Online/offline + cooldown gating ───────────────────
test("offline disables both mic buttons; tap does nothing", () => {
  const { els, instances, controllers } = makeEnv({ online: false });
  controllers.updateOnlineState();
  assert.equal(els.micBtn.disabled, true);
  assert.equal(els.translateMicBtn.disabled, true);
  els.translateMicBtn.click();
  assert.equal(instances.length, 0);
});

test("window offline event disables the mics and stops a live session; online event re-enables", () => {
  const { els, instances, ctx, fireWindow } = makeEnv();
  els.translateMicBtn.click();
  const rec = instances[0];
  rec.onstart();
  ctx.navigator.onLine = false;
  fireWindow("offline");
  assert.equal(els.micBtn.disabled, true);
  assert.equal(els.translateMicBtn.disabled, true);
  assert.equal(rec.stopped, 1, "going offline mid-session must stop the engine");
  rec.onend(); // engine acknowledges the stop
  ctx.navigator.onLine = true;
  fireWindow("online");
  // still inside the 400ms post-session cooldown right after onend
  assert.equal(els.translateMicBtn.disabled, true);
});

test("after a session ends, a 400ms cooldown disables the button, then online state re-enables it", () => {
  const { els, instances, clock } = makeEnv();
  els.translateMicBtn.click();
  const rec = instances[0];
  rec.onstart();
  rec.onend();
  assert.equal(els.translateMicBtn.disabled, true, "cooldown must disable the button");
  clock.advance(400);
  assert.equal(els.translateMicBtn.disabled, false, "cooldown expiry re-enables while online");
});

test("cooldown expiring while offline keeps the button disabled", () => {
  const { els, instances, ctx, clock } = makeEnv();
  els.translateMicBtn.click();
  const rec = instances[0];
  rec.onstart();
  rec.onend();
  ctx.navigator.onLine = false;
  clock.advance(400);
  assert.equal(els.translateMicBtn.disabled, true);
});

// ── Runner: async-aware so future await-based tests can't false-pass ──
console.log("voice-input module tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
