#!/usr/bin/env node
// 翻译结果的 ▶ 和场景卡的「▶ 朗读」，第二下也得是暂停，不是从头重放。
// 复习卡那条 2026-09-22 修了（test/review-play-pause.test.mjs），这两处是同一个毛病。
//
// 对应的用户情境（不含函数名）：
//   1. 翻译结果：点 ▶ 放，放到一半点 ⏸ 停住，再点接着放；放完再点从头。
//   2. 场景卡：点「▶ 朗读」，进度条走到一半点「⏸ 播放中」——停住、进度条留在那里、
//      按钮变回「▶ 朗读」；再点接着放，进度条接着走，不是归零重来。
//   3. 场景卡正放着「▶ 朗读」去点「慢速」：换成慢速从头放（那是另一段录音，本来就该重来）。
//   4. 没有录音、退回手机朗读的那种：第二下当「停」。
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

function fnSource(name, { optional = false } = {}) {
  const at = html.indexOf(`function ${name}(`);
  if (at === -1) { if (optional) return ""; assert.fail(`找不到 ${name}`); }
  return html.slice(at, html.indexOf("\n}", at) + 2);
}
function fakeBtn(name, cls) {
  const b = { name, textContent: "▶", dataset: { playingLabel: "⏸" }, attrs: {},
    classList: { _s: new Set([cls]),
      add: (...c) => c.forEach(x => b.classList._s.add(x)), remove: (...c) => c.forEach(x => b.classList._s.delete(x)),
      contains: c => b.classList._s.has(c) },
    setAttribute: (k, v) => { b.attrs[k] = v; }, removeAttribute: (k) => { delete b.attrs[k]; } };
  return b;
}
function makeFakeAudio(log) {
  const instances = [];
  function FakeAudio(url) {
    const listeners = {};
    const inst = { url, paused: true, ended: false, src: url, currentTime: 0, duration: 3,
      addEventListener(evt, fn) { listeners[evt] = fn; },
      load() { log.push(`load#${instances.indexOf(inst) + 1}`); },
      play() { inst.paused = false; log.push(`play#${instances.indexOf(inst) + 1}`); return Promise.resolve(); },
      pause() { inst.paused = true; log.push(`pause#${instances.indexOf(inst) + 1}`); },
      fire(evt) { if (evt === "ended") { inst.ended = true; inst.paused = true; } if (listeners[evt]) listeners[evt](); } };
    instances.push(inst); log.push(`new#${instances.length}`);
    return inst;
  }
  FakeAudio.instances = instances;
  return FakeAudio;
}
function load({ clipUrl = "blob:clip" } = {}) {
  const log = [], buttons = [], els = {};
  const FakeAudio = makeFakeAudio(log);
  const el = (id) => els[id] || (els[id] = { id, style: {} });
  const ctx = {
    console, currentAudio: null, playbackSession: 0, cachedVoice: null, Audio: FakeAudio,
    window: { speechSynthesis: { cancel: () => log.push("synth.cancel"), speak: () => log.push("synth.speak"), getVoices: () => [{}] } },
    document: { getElementById: (id) => (/^(bar|fill)-/.test(id) ? el(id) : null),
      querySelectorAll: (sel) => { const groups = sel.split(",").map(g => g.trim().split(".").filter(Boolean)); return buttons.filter(b => groups.some(g => g.every(c => b.classList.contains(c)))); } },
    audioUrlFor: () => clipUrl,
    findPhrase: (id) => ({ id, en: "Bath time!" }),
    speakText: (text, rate, btn) => { log.push("speakText"); if (btn) ctx.setPlayBtnPlaying(btn); },
    getEnglishVoice: () => null, noteBrowserVoice: () => {},
    requestAnimationFrame: () => 0, setTimeout, clearTimeout,
    SpeechSynthesisUtterance: function (t) { this.text = t; },
  };
  ctx.speechSynthesis = ctx.window.speechSynthesis;
  vm.createContext(ctx);
  for (const fn of ["setPlayBtnPlaying", "resetPlayBtnState", "flashAudioUnavailable", "stopAllAudio", "stopLegacyAudio", "playClipOrSpeak", "speakPhrase"]) vm.runInContext(fnSource(fn), ctx);
  const shared = fnSource("pauseOrResumeClip", { optional: true }); if (shared) vm.runInContext(shared, ctx);
  const btn = (name, cls) => { const b = fakeBtn(name, cls); buttons.push(b); return b; };
  return { ctx, log, FakeAudio, btn, els };
}
const flush = () => new Promise(r => setTimeout(r, 0));

// ── 翻译结果的 ▶ ──────────────────────────────────────────────
test("翻译结果：放到一半点 ⏸ 停住、不造新的；再点接着放；放完再点从头", async () => {
  const { ctx, log, btn, FakeAudio } = load();
  const b = btn("T", "result-play-btn");
  ctx.playClipOrSpeak({ id: "t_1", text: "Good night.", btn: b }); await flush();
  assert.deepEqual(log, ["synth.cancel", "new#1", "play#1"]); assert.equal(b.textContent, "⏸");
  log.length = 0;
  ctx.playClipOrSpeak({ id: "t_1", text: "Good night.", btn: b }); await flush();
  assert.deepEqual(log, ["pause#1"], `第二下应只是暂停，实际：${log.join(" ")}`);
  assert.equal(b.textContent, "▶");
  FakeAudio.instances[0].currentTime = 1.1; log.length = 0;
  ctx.playClipOrSpeak({ id: "t_1", text: "Good night.", btn: b }); await flush();
  assert.deepEqual(log, ["play#1"], `第三下该接着放，实际：${log.join(" ")}`);
  assert.equal(FakeAudio.instances[0].currentTime, 1.1, "从头放了");
  FakeAudio.instances[0].fire("ended"); log.length = 0;
  ctx.playClipOrSpeak({ id: "t_1", text: "Good night.", btn: b }); await flush();
  assert.ok(log.includes("new#2"), `放完再点该造新的，实际：${log.join(" ")}`);
});

test("翻译结果：没有生成好的声音、走手机朗读——第二下当「停」", async () => {
  const { ctx, log, btn } = load({ clipUrl: null });
  const b = btn("T", "result-play-btn");
  ctx.playClipOrSpeak({ id: "t_1", text: "Good night.", btn: b }); await flush();
  assert.ok(log.includes("speakText")); assert.equal(b.textContent, "⏸");
  log.length = 0;
  ctx.playClipOrSpeak({ id: "t_1", text: "Good night.", btn: b }); await flush();
  assert.ok(log.includes("synth.cancel") && !log.includes("speakText"), `第二下该停、不该重念，实际：${log.join(" ")}`);
  assert.equal(b.textContent, "▶");
});

// ── 场景卡的「▶ 朗读」 ──────────────────────────────────────
async function startScenario(ctx, FakeAudio, b, rate) {
  ctx.speakPhrase("p1", b, rate); await flush();
  FakeAudio.instances[FakeAudio.instances.length - 1].fire("canplaythrough"); await flush();
}

test("场景卡：放到一半点「⏸ 播放中」——停住、进度条留着、按钮变回「▶ 朗读」", async () => {
  const { ctx, log, btn, FakeAudio, els } = load();
  const b = btn("S", "play-btn");
  await startScenario(ctx, FakeAudio, b);
  assert.equal(b.textContent, "⏸ 播放中"); assert.ok(log.includes("play#1"));
  els["fill-p1"].style.width = "40%"; log.length = 0;
  ctx.speakPhrase("p1", b); await flush();
  assert.deepEqual(log, ["pause#1"], `第二下应只是暂停，实际：${log.join(" ")}`);
  assert.equal(b.textContent, "▶ 朗读");
  assert.ok(!b.classList.contains("playing"));
  assert.equal(els["fill-p1"].style.width, "40%", "暂停时进度条被归零了");
  assert.notEqual(els["bar-p1"].style.display, "none", "暂停时进度条被藏起来了——家长看不出停在哪");
});

test("场景卡：暂停后再点「▶ 朗读」——同一段接着放，按钮回到「⏸ 播放中」", async () => {
  const { ctx, log, btn, FakeAudio } = load();
  const b = btn("S", "play-btn");
  await startScenario(ctx, FakeAudio, b);
  ctx.speakPhrase("p1", b); await flush();
  FakeAudio.instances[0].currentTime = 1.5; log.length = 0;
  ctx.speakPhrase("p1", b); await flush();
  assert.deepEqual(log, ["play#1"], `第三下该接着放，实际：${log.join(" ")}`);
  assert.equal(FakeAudio.instances[0].currentTime, 1.5, "从头放了");
  assert.equal(b.textContent, "⏸ 播放中");
  assert.equal(FakeAudio.instances.length, 1, "造了新的");
});

test("场景卡：正放着「▶ 朗读」去点「慢速」——换慢速从头放，是另一段录音", async () => {
  const { ctx, log, btn, FakeAudio } = load();
  const normal = btn("N", "play-btn"), slow = btn("L", "play-btn-slow");
  await startScenario(ctx, FakeAudio, normal);
  log.length = 0;
  await startScenario(ctx, FakeAudio, slow, 0.6);
  assert.ok(log.includes("pause#1") && log.includes("new#2") && log.includes("play#2"), `实际：${log.join(" ")}`);
  assert.match(FakeAudio.instances[1].url, /slow_wbw/);
  assert.equal(normal.textContent, "▶ 朗读", "正常速的按钮没复位");
  assert.equal(slow.textContent, "⏸", "慢速按钮没进播放态");
});

test("场景卡：录音加载失败退回手机朗读——第二下当「停」，按钮回「▶ 朗读」", async () => {
  const { ctx, log, btn, FakeAudio } = load();
  const b = btn("S", "play-btn");
  ctx.speakPhrase("p1", b); await flush();
  FakeAudio.instances[0].fire("error"); await flush();
  assert.ok(log.includes("synth.speak"), "没退回朗读");
  assert.equal(b.textContent, "⏸ 播放中");
  log.length = 0;
  ctx.speakPhrase("p1", b); await flush();
  assert.ok(log.includes("synth.cancel"), "第二下没停掉朗读");
  assert.ok(!log.includes("synth.speak") && !log.includes("new#2"), `第二下重念/重放了：${log.join(" ")}`);
  assert.equal(b.textContent, "▶ 朗读");
});

console.log("play/pause everywhere tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message.split("\n")[0]}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
