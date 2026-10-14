#!/usr/bin/env node
// 连播时，新收藏的句子有一部分「只念中文、不放英文」（2026-10-14 Victor 报）。
//
// 原因：每句自己存的英文，播放前要先变成一个临时地址（blob URL），这些地址有上限，
// 超了就回收最早备好的。上限按「收藏条数 + 20，至少 120」算——只数了英文。
// 可连播一开始，每句的中文提示也各备一个地址，挤进同一个池子：80 条收藏就是
// 160 个地址，回收 40 个。收藏页按「最新在前」备地址，最早备好的恰恰是最新收藏
// 的那几句英文。轮到它们时中文照念，英文没地址，连播悄悄跳过。
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   1. 家长收藏了 80 句自己的话，每句都有英文和中文提示的声音。他打开收藏页、
//      点「连续播放全部」，转满一圈——每一句的英文都真的放出来了，
//      包括最新收藏的那几句。
//
//   2. 连播途中，某一句的播放地址没了（被回收、被释放），但它的声音还存在手机里。
//      轮到它时，连播从手机里把声音取回来接着放英文，而不是念完中文就跳过。
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");
const playbackLib = require(join(ROOT, "audio-playback.js"));
const provisionLib = require(join(ROOT, "audio-provision.js"));
const loopLib = require(join(ROOT, "audio-loop.js"));

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// 让所有排着的 promise 都落地（取音频、备地址都是异步的）。
const settle = () => new Promise(r => setTimeout(r, 0));

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

// 手机里存着的声音：getAudio(键) 给一个 blob，地址读得懂是哪个键（blob:a、blob:zh:a）。
function deviceWith(keys) {
  const have = new Set(keys);
  return {
    getAudio: async k => { if (!have.has(k)) return null; const b = new Blob([new Uint8Array(4)]); b._k = k; return b; },
    hasAudio: async k => have.has(k),
  };
}
const fakeURL = (revoked = []) => ({ createObjectURL: b => "blob:" + b._k, revokeObjectURL: u => revoked.push(u) });

// index.html 里真正传给 audio-playback 的上限，原样拿出来用（不在测试里另抄一份公式）。
function urlCapFromIndex(saved) {
  const at = html.indexOf("llPlaybackLib.create({");
  const wiring = html.slice(at, html.indexOf("});", at));
  const m = wiring.match(/urlCap:\s*(function\s*\(\)\s*\{[\s\S]*?\})\s*,/);
  assert.ok(m, "index.html 里找不到 urlCap 的接线");
  return new Function("savedPhrases", "return (" + m[1] + ")();")(saved);
}

function buildLoop({ playback, provisionLoopCues, made, timers, extra = {} }) {
  return loopLib.create({
    Audio: fakeAudioClass(made),
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clearTimeout: () => {},
    audioUrlFor: id => playback.audioUrlFor(id),
    playableUrlFor: it => playback.playableUrlFor(it),
    provisionLoopCues,
    ...extra,
  });
}

// ══ 1 ════════════════════════════════════════════════════════════════════

test("收藏 80 句、每句都有中英文声音：连播转满一圈，每一句的英文都放了（含最新收藏的）", async () => {
  const N = 80;
  // 下标 0 是最新收藏的——收藏页就按这个顺序画、按这个顺序备地址。
  const rows = Array.from({ length: N }, (_, i) => ({ id: "t" + i, zh: "中文" + i, en: "English " + i, savedAt: N - i }));
  const dev = deviceWith(rows.flatMap(r => [r.id, "zh:" + r.id]));
  const playback = playbackLib.create({
    getAudio: dev.getAudio, isAudioBacked: () => false, URL: fakeURL(),
    urlCap: () => urlCapFromIndex(rows),
  });
  const provision = provisionLib.create({
    hasAudio: dev.hasAudio, primeAudioUrl: id => playback.primeAudioUrl(id),
    getAccessCode: () => "", isOnline: () => false,   // 声音都已在手机里，不需要生成
  });
  const made = [], timers = [];
  const loop = buildLoop({ playback, provisionLoopCues: q => provision.provisionLoopCues(q), made, timers,
    extra: { primeUrl: it => playback.primeAudioUrl(it && it.id) } });

  // 打开收藏页：每一行备地址
  for (const r of rows) playback.primeAudioUrl(r.id);
  await settle();
  // 点「连续播放全部」
  assert.equal(loop.startAudioLoop(rows, () => {}), true, "连播没起来");
  await settle();                                       // 中文提示的地址也备好了
  const el = made[0];
  // 转一圈：放完一段就 ended，停顿走计时器，取址走异步
  for (let step = 0; step < N * 4 && el.played.length < N * 2 + 5; step++) {
    el.fire("ended");
    await settle();
    while (timers.length) { timers.shift().fn(); await settle(); }
  }
  const heard = new Set(el.played);
  const silent = rows.filter(r => !heard.has("blob:" + r.id)).map(r => r.id);
  assert.deepEqual(silent.slice(0, 8), [],
    `${silent.length} 句的英文一次都没放（只念了中文就跳过）：${silent.slice(0, 8).join(", ")}…`);
});

// ══ 2 ════════════════════════════════════════════════════════════════════

test("连播途中某句的播放地址被回收了、声音还在手机里：轮到它时取回来接着放英文", async () => {
  const items = [{ id: "a", zh: "甲", en: "A" }, { id: "b", zh: "乙", en: "B" }, { id: "c", zh: "丙", en: "C" }];
  const dev = deviceWith(["a", "b", "c", "x"]);
  // 池子只容 3 个地址：先备 b、a、c，连播开始后再备一个 x，最早的 b 就被挤掉
  const playback = playbackLib.create({ getAudio: dev.getAudio, isAudioBacked: () => false, URL: fakeURL(), urlCap: () => 3 });
  for (const id of ["b", "a", "c"]) await playback.primeAudioUrl(id);
  const made = [], timers = [];
  const loop = buildLoop({ playback, made, timers,
    extra: { primeUrl: it => playback.primeAudioUrl(it && it.id) } });

  assert.equal(loop.startAudioLoop(items, () => {}), true);
  await playback.primeAudioUrl("x");
  assert.equal(playback.audioUrlFor("b"), null, "前提没摆好：b 的地址应该已经被挤掉了");

  const el = made[0];
  el.fire("ended");                                     // a 放完 → 轮到 b：先念中文（无中文音频，走计时）
  while (timers.length) { timers.shift().fn(); await settle(); }
  await settle();
  assert.ok(el.played.includes("blob:b"), `b 的英文没放，连播直接跳过了它（放过的：${el.played.join(", ")}）`);
  assert.equal(loop.audioLoopPlaying(), true, "连播停了");
});

test("连播途中某句的声音手机里真没有了：照旧跳到下一句，不卡住", async () => {
  // 对照组：上一条的修法不能把「真没声音」变成卡死在那一句。
  const items = [{ id: "a", zh: "甲", en: "A" }, { id: "b", zh: "乙", en: "B" }, { id: "c", zh: "丙", en: "C" }];
  const dev = deviceWith(["a", "b", "c"]);
  const playback = playbackLib.create({ getAudio: dev.getAudio, isAudioBacked: () => false, URL: fakeURL() });
  for (const id of ["a", "b", "c"]) await playback.primeAudioUrl(id);
  const made = [], timers = [];
  const loop = buildLoop({ playback, made, timers, extra: { primeUrl: async () => null } });
  assert.equal(loop.startAudioLoop(items, () => {}), true);
  playback.releaseAudioUrls();                          // 地址全没了，取也取不回来
  for (const id of ["a", "c"]) await playback.primeAudioUrl(id);   // 只有 a、c 回来了
  const el = made[0];
  el.fire("ended");
  for (let i = 0; i < 6; i++) { while (timers.length) { timers.shift().fn(); await settle(); } await settle(); }
  assert.ok(el.played.includes("blob:c"), `b 没声音之后没往下走到 c（放过的：${el.played.join(", ")}）`);
  assert.equal(loop.audioLoopPlaying(), true, "连播停了");
});

test("正在从手机取回那句英文时家长按了暂停：取回来也不出声；再按继续，放的正是这句英文", async () => {
  const items = [{ id: "a", zh: "甲", en: "A" }, { id: "b", zh: "乙", en: "B" }];
  const dev = deviceWith(["a", "b"]);
  const playback = playbackLib.create({ getAudio: dev.getAudio, isAudioBacked: () => false, URL: fakeURL() });
  for (const id of ["a", "b"]) await playback.primeAudioUrl(id);
  let release;
  const slow = new Promise(r => { release = r; });   // 取回要一会儿，由测试决定什么时候到
  const made = [], timers = [];
  const loop = buildLoop({ playback, made, timers, extra: { primeUrl: () => slow } });
  assert.equal(loop.toggleAudioLoop(items, () => {}), true);
  playback.releaseAudioUrls();
  await playback.primeAudioUrl("a");                   // a 回来了，b 的地址没了
  const el = made[0];
  el.fire("ended");                                     // → 轮到 b
  while (timers.length) { timers.shift().fn(); await settle(); }   // 中文提示过去 → 开始取 b
  loop.toggleAudioLoop(items, () => {});                // 家长按暂停
  assert.equal(loop.audioLoopPaused(), true, "前提没摆好：没进暂停");
  release("blob:b");
  await settle(); await settle();
  assert.ok(!el.played.includes("blob:b"), "已经暂停了，取回来的英文还是放出来了");
  loop.toggleAudioLoop(items, () => {});                // 再按：继续
  await settle(); await settle();
  assert.equal(el.played.at(-1), "blob:b", `继续之后放的不是 b 的英文（放过的：${el.played.join(", ")}）`);
});

test("index.html 把「从手机取回声音」接给了连播", () => {
  const at = html.indexOf("llAudioLoopLib.create({");
  const wiring = html.slice(at, html.indexOf("\n});", at));
  assert.match(wiring, /primeUrl\s*:[\s\S]{0,120}primeAudioUrl/, "连播拿不到取回声音的办法，地址一没就只能跳过");
});

console.log("loop-new-saved-audio tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
