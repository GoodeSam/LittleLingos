#!/usr/bin/env node
// Behavioral tests for one tap that plays every saved phrase, over and over.
//
// Zero-dependency: the module is extracted from index.html between its markers
// and run in a vm context, per test/audio-store.test.mjs.
//
// WHY THIS IS THE POINT OF THE WHOLE FEATURE. jtbd.md names the real job as
// 「别让我发起」 — a parent who knows they should review and will not start.
// Every other control built so far still asks them to begin: open the app,
// find a row, tap it, decide. This one asks for a single tap and then keeps
// going. Everything before it — the endpoint, the store, generation, playback,
// the marks — exists so that this can play real recorded speech instead of the
// browser's.
//
// THE iOS CONSTRAINT IT IS BUILT AROUND: only the audio element unlocked by
// the tap itself may keep playing. A fresh `new Audio()` for the second clip
// is started by an `ended` event, not by a gesture, and Safari can refuse it
// silently — the loop would stop after one phrase with nothing on screen to
// say why. So there is exactly ONE element for the whole session and its src
// is swapped. This is the same unverified iOS rule that shapes
// ll:audio-playback; it is a design premise, not something Node can test.
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   1. 家长点一下，收藏过的句子一句接一句放下去，放完从头再来。
//      他不用做任何别的事——这正是「别让我发起」要的东西。
//
//   2. 每句之间留一段停顿，够他跟着念一遍。连着放成一堵声音墙的话，
//      这个功能就只是背景噪音，不是练习。
//
//   3. 再点一下就停。
//
//   4. 没有声音的那些条目被跳过，而不是中间插进一段机器音——
//      那会把一段听力练习打断成两种质感。
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import assert from "node:assert/strict";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");

const START = "/* ll:audio-loop:start */";
const END = "/* ll:audio-loop:end */";

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

const ITEMS = [
  { id: "a", en: "Time for bed." },
  { id: "b", en: "Wash your hands." },
  { id: "c", en: "Good job!" },
];

// A fake Audio that records every element ever constructed and every src it
// was given, so the tests can prove ONE element carries the whole session.
function fakeAudioClass(made) {
  return class FakeAudio {
    constructor(src) {
      this._src = src || "";
      this._handlers = {};
      this.played = [];
      made.push(this);
    }
    get src() { return this._src; }
    set src(v) { this._src = v; }
    addEventListener(name, fn) { (this._handlers[name] ||= []).push(fn); }
    removeEventListener(name, fn) {
      this._handlers[name] = (this._handlers[name] || []).filter(h => h !== fn);
    }
    play() { this.played.push(this._src); return Promise.resolve(); }
    pause() { this.paused = true; }
    fire(name) { for (const h of [...(this._handlers[name] || [])]) h({ target: this }); }
  };
}

function loadModule({ withAudio = ["a", "b", "c"] } = {}) {
  const s = html.indexOf(START), e = html.indexOf(END);
  assert.ok(s !== -1 && e !== -1, `index.html must contain ${START} … ${END} markers`);
  const made = [];
  const timers = [];
  const ctx = {
    console,
    Audio: fakeAudioClass(made),
    // From ll:audio-playback — its own tests cover how addresses are made.
    audioUrlFor: id => (withAudio.includes(id) ? `blob:${id}` : null),
    primeAudioUrl: () => Promise.resolve(null),
    stopAllAudio: () => {},
    // Controllable clock: the pause between phrases is the difference between
    // a practice session and a wall of sound, so tests drive it explicitly.
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clearTimeout: () => {},
    _timers: timers,
  };
  vm.createContext(ctx);
  vm.runInContext(html.slice(s, e + END.length), ctx);
  for (const fn of ["startAudioLoop", "stopAudioLoop", "audioLoopPlaying"]) {
    assert.equal(typeof ctx[fn], "function", `module must define ${fn}()`);
  }
  const tick = () => { const t = timers.shift(); if (t) t.fn(); return !!t; };
  return { ctx, made, timers, tick };
}

// ══ 1. 一点就开始，一句接一句 ═════════════════════════════════════════

test("点一下，第一句就开始放", async () => {
  const { ctx, made } = loadModule();
  ctx.startAudioLoop(ITEMS);
  assert.equal(made.length, 1, "整场只该有一个音频元素");
  assert.deepEqual(made[0].played, ["blob:a"]);
  assert.equal(ctx.audioLoopPlaying(), true);
});

test("一句放完，隔一段停顿再放下一句", async () => {
  // 停顿是这个功能和「一堵声音墙」的区别：家长要在缝里跟着念一遍。
  const { ctx, made, timers, tick } = loadModule();
  ctx.startAudioLoop(ITEMS);
  made[0].fire("ended");
  assert.equal(made[0].played.length, 1, "还没到时候就不该抢着放下一句");
  assert.ok(timers.length === 1 && timers[0].ms >= 800,
    `句间停顿要够跟读一遍，现在是 ${timers[0] && timers[0].ms}ms`);
  tick();
  assert.deepEqual(made[0].played, ["blob:a", "blob:b"]);
});

test("放到最后一句之后，从头再来", async () => {
  const { ctx, made, tick } = loadModule();
  ctx.startAudioLoop(ITEMS);
  for (let i = 0; i < 3; i++) { made[0].fire("ended"); tick(); }
  assert.deepEqual(made[0].played, ["blob:a", "blob:b", "blob:c", "blob:a"],
    "循环的意思是它自己会转回来，不用家长再点一次");
});

test("整场只用一个音频元素", async () => {
  // iOS 上只有被那次点击解锁的元素能继续播。每句新建一个的话，
  // 第二句开始会被静默拒绝，循环停在第一句而屏幕上什么都不说。
  const { ctx, made, tick } = loadModule();
  ctx.startAudioLoop(ITEMS);
  for (let i = 0; i < 5; i++) { made[0].fire("ended"); tick(); }
  assert.equal(made.length, 1, `建了 ${made.length} 个元素`);
});

// ══ 2. 没有声音的跳过 ═════════════════════════════════════════════════

test("没有声音的条目被跳过，不插进一段机器音", async () => {
  // 中间掺进浏览器朗读，会把一段听力练习打断成两种质感 —— 而 C1 已经
  // 判定那个声音不可接受。
  const { ctx, made, tick } = loadModule({ withAudio: ["a", "c"] });
  ctx.startAudioLoop(ITEMS);
  made[0].fire("ended"); tick();
  assert.deepEqual(made[0].played, ["blob:a", "blob:c"], "b 没有声音，直接跳过");
});

test("一条声音都没有时，明确地不开始，而不是静默装死", async () => {
  const { ctx, made } = loadModule({ withAudio: [] });
  assert.equal(ctx.startAudioLoop(ITEMS), false, "调用方要靠这个告诉家长为什么没动静");
  assert.equal(made.length, 0);
  assert.equal(ctx.audioLoopPlaying(), false);

  const ok = loadModule();
  assert.equal(ok.ctx.startAudioLoop(ITEMS), true, "对照：有声音时必须真的开始");
});

test("空列表也不开始", async () => {
  const { ctx } = loadModule();
  assert.equal(ctx.startAudioLoop([]), false);
  assert.equal(ctx.startAudioLoop(null), false);
  assert.equal(ctx.startAudioLoop(ITEMS), true, "对照：正常列表必须开始");
});

// ══ 3. 停 ═════════════════════════════════════════════════════════════

test("停下来之后，正在响的那一句也停", async () => {
  const { ctx, made } = loadModule();
  ctx.startAudioLoop(ITEMS);
  ctx.stopAudioLoop();
  assert.equal(ctx.audioLoopPlaying(), false);
  assert.equal(made[0].paused, true, "只停调度不停声音，等于按了停止还在响");
});

test("停下来之后，已经排好的下一句不会再冒出来", async () => {
  // 停止时可能正卡在句间停顿里。那个定时器到点还照放的话，
  // 家长会在按下停止几秒后又听到一句。
  const { ctx, made, tick } = loadModule();
  ctx.startAudioLoop(ITEMS);
  made[0].fire("ended");        // 排好了下一句
  ctx.stopAudioLoop();
  tick();                        // 定时器到点
  assert.deepEqual(made[0].played, ["blob:a"], "停了就是停了");
});

test("停完还能再开", async () => {
  const { ctx, made } = loadModule();
  ctx.startAudioLoop(ITEMS);
  ctx.stopAudioLoop();
  assert.equal(ctx.startAudioLoop(ITEMS), true);
  assert.equal(ctx.audioLoopPlaying(), true);
  assert.equal(made[0].played.length, 2, "复用同一个元素，从头再放");
});

test("已经在放的时候再点开始，不会变成两条线同时放", async () => {
  const { ctx, made, tick } = loadModule();
  ctx.startAudioLoop(ITEMS);
  ctx.startAudioLoop(ITEMS);
  made[0].fire("ended"); tick();
  assert.equal(made.length, 1);
  assert.equal(made[0].played.filter(s => s === "blob:b").length, 1,
    "两条调度线会让同一句叠着放出来");
});

// ══ 4. 中途出问题不卡住 ═══════════════════════════════════════════════

test("某一句放不出来时，跳过它继续往下", async () => {
  // 地址可能已经被淘汰（缓存有上限）。卡在那儿的话，
  // 家长听到的是循环无缘无故停了。
  const { ctx, made, tick } = loadModule();
  ctx.startAudioLoop(ITEMS);
  made[0].fire("error");
  tick();
  assert.deepEqual(made[0].played, ["blob:a", "blob:b"], "一句坏掉不该让整场停下");
});

// ══ 5. 界面接上了 ═════════════════════════════════════════════════════

test("收藏页有一个一键连续播放的入口", async () => {
  assert.match(html, /toggleAudioLoop\(|startAudioLoop\(/,
    "算得出来但没人点，等于没做");
  const at = html.indexOf("function renderSavedScreen");
  const body = html.slice(at, html.indexOf("\nfunction ", at + 10));
  assert.match(body, /AudioLoop/, "入口要在收藏页上，那是家长复习时待的地方");
});

// ── Runner ───────────────────────────────────────────────
console.log("audio-loop tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
