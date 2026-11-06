#!/usr/bin/env node
// 连播时把已经掌握的句子从收藏里去掉（2026-11-06 Victor 要）：连播提示框右上角一个
// ×，点下去这一句就取消收藏，连播不中断、接着放下一句。这一组测的是连播模块那一半：
// 「这一句被收藏删掉了，这一轮该怎么办」。屏幕上的 ×、真的从收藏里删，见
// test/loop-repeat-e2e.mjs 的「连播时点提示框右上角的 ×」。
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   1. 正放着第 2 句，点 ×：第 2 句马上停，先念第 3 句的中文提示再放第 3 句英文，
//      屏幕上的中文换成第 3 句；第 2 句之后再也不会出现。
//   2. 放到最后一句时点 ×：转回第 1 句接着放，不停。
//   3. 放着第 3 句，从列表里别处把第 1 句删了：第 3 句不受打扰，放完接第 4 句
//      （不会因为前面少一句就跳过一句或重放一句）。
//   4. 放着第 2 句，把后面的第 4 句删了：第 2 句不受打扰，之后第 3 句、第 5 句，跳过第 4 句。
//   5. 这一轮只剩一句，点 ×：连播停下来，声音停，屏幕上提示框收起，不是卡在一句已经没了的话上。
//   6. 暂停着点 ×：不出声、仍是暂停；按继续，从下一句的中文提示开始。
//   7. 没在连播时删：什么也不发生（对照：连播不会被无关的删除惊动）。
//   8. 一句不在这一轮里的 id：什么也不做，不乱跳。
//   9. 每句放两遍、正在两遍之间的停顿里点 ×：下一句的中文提示照常先念，之后放下一句的英文，
//      不会再把被删那句的第二遍放出来。
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

async function setup({ repeat = 1 } = {}) {
  const keys = new Set([...ROWS.map(r => r.id), ...ROWS.map(r => "zh:" + r.id)]);
  const playback = playbackLib.create({
    getAudio: async k => { if (!keys.has(k)) return null; const b = new Blob([new Uint8Array(4)]); b._k = k; return b; },
    isAudioBacked: () => false,
    URL: { createObjectURL: b => "blob:" + b._k, revokeObjectURL: () => {} },
  });
  for (const k of keys) await playback.primeAudioUrl(k);
  const made = [], timers = [], cues = [], states = [];
  const loop = loopLib.create({
    Audio: fakeAudioClass(made),
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clearTimeout: () => {},
    audioUrlFor: id => playback.audioUrlFor(id),
    playableUrlFor: it => playback.playableUrlFor(it),
    getEnglishRepeat: () => repeat,
    onLoopState: s => states.push(s),
    silenceUrl: "blob:silence",
  });
  const onCue = it => cues.push(it ? it.id : null);
  const el = () => made[0];
  const finish = () => { el().fire("ended"); while (timers.length) timers.shift().fn(); };
  // 现在放着什么：最近一次 play 的地址
  const now = () => el().played.at(-1);
  // 推进到某个地址正在放（中文 → 无声停顿 → 英文，每段放完各要一次 ended）
  const until = addr => { let g = 0; while (now() !== addr && g++ < 12) finish(); return now(); };
  return { loop, made, cues, states, onCue, el, finish, now, until };
}

// 把连播推进到「第 n 句（0 起）的英文正在放」。silence 是无声停顿，不算句子的声音。
function advanceTo(ctx, n) {
  let guard = 0;
  while (ctx.now() !== "blob:" + ROWS[n].id && guard++ < 40) ctx.finish();
  assert.equal(ctx.now(), "blob:" + ROWS[n].id, `前提不成立：推不到第 ${n + 1} 句的英文`);
}

// ══ 删掉的是正放着的这一句 ═══════════════════════════════════════════════

test("放着第 2 句点 ×：马上先念第 3 句的中文提示，再放第 3 句英文；第 2 句不再出现", async () => {
  const ctx = await setup();
  ctx.loop.startAudioLoop(ROWS, ctx.onCue);
  advanceTo(ctx, 1);
  assert.equal(ctx.loop.removeFromLoop("b"), true, "删不掉");
  assert.equal(ctx.now(), "blob:zh:c", "没有马上先念下一句（第 3 句）的中文提示");
  assert.equal(ctx.cues.at(-1), "c", "屏幕上的中文没换成第 3 句");
  assert.equal(ctx.el().paused, false, "删掉之后连播哑了");
  assert.equal(ctx.until("blob:c"), "blob:c", "中文之后放的不是第 3 句的英文");
  const tail = [];
  for (let i = 0; i < 20; i++) { ctx.finish(); tail.push(ctx.now()); }
  assert.ok(!tail.includes("blob:b") && !tail.includes("blob:zh:b"), `被删的第 2 句又出现了：${tail.join(", ")}`);
  assert.ok(tail.includes("blob:d") && tail.includes("blob:a"), "后面的句子没有接着放，或转不回第 1 句");
});

test("放到最后一句点 ×：转回第 1 句接着放，不停", async () => {
  const ctx = await setup();
  ctx.loop.startAudioLoop(ROWS, ctx.onCue);
  advanceTo(ctx, 4);
  assert.equal(ctx.loop.removeFromLoop("e"), true);
  assert.equal(ctx.now(), "blob:zh:a", "最后一句删掉后，没有转回第 1 句的中文提示");
  assert.equal(ctx.cues.at(-1), "a");
  assert.equal(ctx.loop.audioLoopPlaying(), true);
  assert.equal(ctx.until("blob:a"), "blob:a", "中文之后放的不是第 1 句的英文");
});

test("这一轮只剩一句，点 ×：连播停下来、声音停、状态变成已停止", async () => {
  const ctx = await setup();
  const one = [ROWS[0]];
  ctx.loop.startAudioLoop(one, ctx.onCue);
  assert.equal(ctx.loop.audioLoopPlaying(), true, "前提不成立：连播没起来");
  assert.equal(ctx.loop.removeFromLoop("a"), true);
  assert.equal(ctx.loop.audioLoopPlaying(), false, "队列空了连播还开着");
  assert.equal(ctx.loop.audioLoopPaused(), false, "队列空了停在暂停上，会续一句没了的话");
  assert.equal(ctx.el().paused, true, "队列空了声音还在响");
  assert.equal(ctx.states.at(-1), "stopped", "屏幕没被告知已经停了");
  // 对照：停下之后再 finish（迟到的 ended）不会又放出什么
  const before = ctx.el().played.length;
  ctx.el().fire("ended");
  assert.equal(ctx.el().played.length, before, "停下之后迟到的 ended 又放出了声音");
});

// ══ 删掉的是别的句子 ═════════════════════════════════════════════════════

test("放着第 3 句，别处把第 1 句删了：第 3 句不受打扰，放完接第 4 句", async () => {
  const ctx = await setup();
  ctx.loop.startAudioLoop(ROWS, ctx.onCue);
  advanceTo(ctx, 2);
  const before = ctx.el().played.length;
  assert.equal(ctx.loop.removeFromLoop("a"), true);
  assert.equal(ctx.el().played.length, before, "删别的句子，正在放的这一句被打断了");
  ctx.finish();                                       // 第 3 句英文放完 → 下一句的中文
  assert.equal(ctx.now(), "blob:zh:d", "第 3 句之后接的不是第 4 句（前面少一句，下标没跟着挪）");
});

test("放着第 2 句，把后面的第 4 句删了：之后第 3 句、第 5 句，跳过第 4 句", async () => {
  const ctx = await setup();
  ctx.loop.startAudioLoop(ROWS, ctx.onCue);
  advanceTo(ctx, 1);
  assert.equal(ctx.loop.removeFromLoop("d"), true);
  const seq = [];
  for (let i = 0; i < 14; i++) { ctx.finish(); if (/^blob:[a-e]$/.test(ctx.now())) seq.push(ctx.now()); }
  assert.deepEqual(seq.slice(0, 3), ["blob:c", "blob:e", "blob:a"], `顺序不对：${seq.join(", ")}`);
});

// ══ 暂停着 ═══════════════════════════════════════════════════════════════

test("暂停着点 ×：不出声、仍是暂停；按继续从下一句的中文提示开始", async () => {
  const ctx = await setup();
  ctx.loop.toggleAudioLoop(ROWS, ctx.onCue);          // 开始
  advanceTo(ctx, 1);
  ctx.loop.toggleAudioLoop(ROWS, ctx.onCue);          // 暂停
  const before = ctx.el().played.length;
  assert.equal(ctx.loop.removeFromLoop("b"), true);
  assert.equal(ctx.el().played.length, before, "暂停着，删一句就出声了");
  assert.equal(ctx.loop.audioLoopPaused(), true, "删一句把暂停弄没了");
  assert.equal(ctx.cues.at(-1), "c", "屏幕上的中文没换成下一句");
  const rest = ROWS.filter(r => r.id !== "b");        // 收藏页重画后传进来的列表
  assert.equal(ctx.loop.toggleAudioLoop(rest, ctx.onCue), true, "继续不起来（被当成列表变了，从头重来）");
  assert.equal(ctx.now(), "blob:zh:c", "继续之后不是从下一句的中文提示开始");
  assert.equal(ctx.until("blob:c"), "blob:c");
});

// ══ 不该有反应的时候 ═════════════════════════════════════════════════════

test("没在连播时删：什么也不发生；不在这一轮里的 id：不乱跳（对照：同一轮里的 id 删得掉）", async () => {
  const ctx = await setup();
  assert.equal(ctx.loop.removeFromLoop("a"), false, "没在连播也说删了");
  assert.equal(ctx.el(), undefined, "没在连播，删一句却出声了");
  ctx.loop.startAudioLoop(ROWS, ctx.onCue);
  const played = [...ctx.el().played];
  assert.equal(ctx.loop.removeFromLoop("zzz"), false, "不在这一轮里的 id 却说删了");
  assert.deepEqual(ctx.el().played, played, "删一个不存在的句子，连播乱跳了");
  assert.equal(ctx.loop.removeFromLoop("e"), true, "对照失败：同一轮里的句子都删不掉，上面两条是假绿");
});

test("连播已经停掉之后再删（内部还记着上一轮的名单）：什么也不发生", async () => {
  const ctx = await setup();
  ctx.loop.startAudioLoop(ROWS, ctx.onCue);
  ctx.loop.stopAudioLoop();
  const played = [...ctx.el().played];
  assert.equal(ctx.loop.removeFromLoop("c"), false, "停掉之后删，却说动了这一轮");
  assert.deepEqual(ctx.el().played, played, "停掉之后删一句，连播自己又响了");
  assert.equal(ctx.loop.audioLoopPlaying(), false);
});

// ══ 两遍英文之间 ═════════════════════════════════════════════════════════

test("每句放两遍、在两遍之间的停顿里点 ×：先念下一句中文，再放下一句英文，不再放被删那句的第二遍", async () => {
  const ctx = await setup({ repeat: 2 });
  ctx.loop.startAudioLoop(ROWS, ctx.onCue);
  advanceTo(ctx, 1);
  ctx.el().fire("ended");                             // 第 2 句第一遍放完 → 两遍之间的无声停顿
  assert.equal(ctx.now(), "blob:silence", "前提不成立：没进到两遍之间的停顿");
  assert.equal(ctx.loop.removeFromLoop("b"), true);
  assert.equal(ctx.now(), "blob:zh:c", "停顿里点 ×，没有马上念下一句的中文提示");
  assert.equal(ctx.until("blob:c"), "blob:c", "中文之后放的不是下一句的英文");
  const tail = [];
  for (let i = 0; i < 6; i++) { ctx.finish(); tail.push(ctx.now()); }
  assert.ok(!tail.includes("blob:b"), `被删那句的第二遍又放出来了：${tail.join(", ")}`);
});

console.log("loop-remove-current tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
