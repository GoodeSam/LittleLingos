#!/usr/bin/env node
// 连播不必每次从第一句开始（2026-10-14 Victor 要）：收藏页连播那里一个滑块，
// 拖到哪句就从哪句放；正在放的时候拖，就跳过去。
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   1. 家长把滑块拖到第 3 句再点「连续播放全部」：第一段放的是第 3 句的英文，
//      屏幕上的中文也是第 3 句。
//   2. 拖到的那句没有声音：从它往后第一句有声音的开始，而不是退回第一句。
//   3. 从第 3 句开始，放到最后一句之后转回第 1 句接着放，不会停。
//   4. 正在放第 1 句时拖到第 4 句：第 1 句马上停，先念第 4 句的中文提示，再放
//      第 4 句的英文；之后接第 5 句。
//   5. 暂停着拖到第 4 句：不出声；按「继续」从第 4 句的中文提示开始。
//   6. 没动过滑块：照旧从第 1 句开始（对照）。
//   7. 拖到一句已经不在列表里的（刚删掉）：什么也不做，不乱跳。
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const playbackLib = require(join(ROOT, "audio-playback.js"));
const loopLib = require(join(ROOT, "audio-loop.js"));

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

function fakeAudioClass(made) {
  return class FakeAudio {
    constructor() { this._src = ""; this._h = {}; this.played = []; this.paused = true; made.push(this); }
    get src() { return this._src; }
    set src(v) { this._src = v; }
    addEventListener(n, fn) { (this._h[n] ||= []).push(fn); }
    play() { this.played.push(this._src); this.paused = false; return Promise.resolve(); }
    pause() { this.paused = true; }
    fire(n) { for (const h of [...(this._h[n] || [])]) h({ target: this }); }
  };
}

const ROWS = ["a", "b", "c", "d", "e"].map((id, i) => ({ id, zh: "中" + (i + 1), en: "E" + (i + 1) }));

// withAudio：哪几句有英文录音；withCue：哪几句有中文提示录音（键 zh:<id>）
async function setup({ withAudio = ["a", "b", "c", "d", "e"], withCue = ["a", "b", "c", "d", "e"] } = {}) {
  const keys = new Set([...withAudio, ...withCue.map(id => "zh:" + id)]);
  const playback = playbackLib.create({
    getAudio: async k => { if (!keys.has(k)) return null; const b = new Blob([new Uint8Array(4)]); b._k = k; return b; },
    isAudioBacked: () => false,
    URL: { createObjectURL: b => "blob:" + b._k, revokeObjectURL: () => {} },
  });
  for (const k of keys) await playback.primeAudioUrl(k);
  const made = [], timers = [], cues = [];
  const loop = loopLib.create({
    Audio: fakeAudioClass(made),
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clearTimeout: () => {},
    audioUrlFor: id => playback.audioUrlFor(id),
    playableUrlFor: it => playback.playableUrlFor(it),
  });
  const onCue = it => cues.push(it ? it.id : null);
  const el = () => made[0];
  // 一段放完：ended；停顿走计时器
  const finish = () => { el().fire("ended"); while (timers.length) timers.shift().fn(); };
  return { loop, made, timers, cues, onCue, el, finish };
}

// ══ 选起点 ═══════════════════════════════════════════════════════════════

test("拖到第 3 句再点开始：第一段放的就是第 3 句的英文，屏幕上是第 3 句的中文", async () => {
  const { loop, cues, onCue, el } = await setup();
  assert.equal(loop.toggleAudioLoop(ROWS, onCue, "c"), true);
  assert.deepEqual(el().played, ["blob:c"], "第一段不是第 3 句");
  assert.equal(cues[0], "c", "屏幕上的中文不是第 3 句");
});

test("拖到的那句没有声音：从它往后第一句有声音的开始，不退回第一句", async () => {
  const { loop, onCue, el } = await setup({ withAudio: ["a", "b", "d", "e"] });
  assert.equal(loop.startAudioLoop(ROWS, onCue, "c"), true);
  assert.deepEqual(el().played, ["blob:d"]);
});

test("从第 3 句开始，放完最后一句转回第 1 句接着放", async () => {
  const { loop, onCue, el, finish } = await setup();
  loop.startAudioLoop(ROWS, onCue, "c");
  for (let i = 0; i < 4; i++) { finish(); finish(); }   // 每句：英文 ended → 中文 ended → 停顿
  const english = el().played.filter(s => /^blob:[a-e]$/.test(s));
  assert.deepEqual(english.slice(0, 5), ["blob:c", "blob:d", "blob:e", "blob:a", "blob:b"],
    `顺序不对：${english.join(", ")}`);
  assert.equal(loop.audioLoopPlaying(), true);
});

test("没动过滑块：照旧从第 1 句开始", async () => {
  const { loop, onCue, el } = await setup();
  loop.toggleAudioLoop(ROWS, onCue);
  assert.deepEqual(el().played, ["blob:a"]);
});

// ══ 放的时候拖 ═══════════════════════════════════════════════════════════

test("正在放第 1 句时拖到第 4 句：先念第 4 句的中文提示，再放第 4 句英文，之后接第 5 句", async () => {
  const { loop, cues, onCue, el, finish } = await setup();
  loop.startAudioLoop(ROWS, onCue);
  assert.equal(loop.jumpAudioLoop("d"), true, "跳不过去");
  assert.equal(el().played.at(-1), "blob:zh:d", "跳过去之后没先念第 4 句的中文提示");
  assert.equal(cues.at(-1), "d", "屏幕上的中文没换成第 4 句");
  finish();                                           // 中文念完 → 停顿 → 英文
  assert.equal(el().played.at(-1), "blob:d", "中文之后放的不是第 4 句的英文");
  finish();                                           // 英文放完 → 下一句的中文
  finish();
  assert.equal(el().played.at(-1), "blob:e", "第 4 句之后接的不是第 5 句");
});

test("暂停着拖到第 4 句：不出声；按继续从第 4 句的中文提示开始", async () => {
  const { loop, onCue, el, finish } = await setup();
  loop.toggleAudioLoop(ROWS, onCue);                  // 开始
  loop.toggleAudioLoop(ROWS, onCue);                  // 暂停
  const before = el().played.length;
  assert.equal(loop.jumpAudioLoop("d"), true);
  assert.equal(el().played.length, before, "暂停着，拖一下就出声了");
  assert.equal(loop.audioLoopPaused(), true, "拖一下把暂停弄没了");
  assert.equal(loop.toggleAudioLoop(ROWS, onCue), true, "继续不起来");
  assert.equal(el().played.at(-1), "blob:zh:d", "继续之后不是从第 4 句的中文提示开始");
  finish();
  assert.equal(el().played.at(-1), "blob:d");
});

test("没在放的时候拖、或者拖到一句已经不在这一轮里的：什么也不做，不乱跳", async () => {
  const { loop, onCue, el } = await setup();
  assert.equal(loop.jumpAudioLoop("c"), false, "没在放也跳了");
  assert.equal(el(), undefined, "没在放，拖一下却出声了");
  loop.startAudioLoop(ROWS, onCue);
  assert.equal(loop.jumpAudioLoop("zzz"), false);
  assert.deepEqual(el().played, ["blob:a"], "拖到不存在的那句，连播乱跳了");
});

console.log("loop-start-position tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
