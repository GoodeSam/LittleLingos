#!/usr/bin/env node
// 复习卡上的播放键：正在放的时候再点一下，是「暂停」，不是「从头再来」。
//
// 报上来的情形（2026-09-22，Victor 真机）：点 ▶ 开始放，按钮变 ⏸，再点 ⏸——
// 声音没停，而是从头重放。按钮上画的是暂停，做的却是重播，等于骗人。
//
// 对应的用户情境（不含函数名）：
//   1. 点 ▶，放了一半点 ⏸：声音停在那里，按钮变回 ▶。
//   2. 再点 ▶：从刚才停的地方接着放，不是从头；还是同一段声音。
//   3. 放完了（自然结束）再点 ▶：从头放，这时候造一段新的是对的。
//   4. 退回手机自带朗读（没有录音）的那种：它没有可靠的暂停，第二下当「停」，
//      按钮变回 ▶，第三下从头念。
//   5. 正放着 A 卡，去点 B 卡的 ▶：A 停、B 放——这是原来就有的行为，不许被改坏。
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

function fnSource(name) {
  const at = html.indexOf(`function ${name}(`);
  assert.ok(at !== -1, `找不到 ${name}`);
  return html.slice(at, html.indexOf("\n}", at) + 2);
}

function fakeBtn(name) {
  const b = { name, textContent: "▶", dataset: { playingLabel: "⏸" }, attrs: {},
    classList: { _s: new Set(["review-btn-play"]),
      add: (...c) => c.forEach(x => b.classList._s.add(x)), remove: (...c) => c.forEach(x => b.classList._s.delete(x)),
      contains: c => b.classList._s.has(c) },
    setAttribute: (k, v) => { b.attrs[k] = v; }, removeAttribute: (k) => { delete b.attrs[k]; } };
  return b;
}

function makeFakeAudio(log) {
  const instances = [];
  function FakeAudio(url) {
    const listeners = {};
    const inst = { url, paused: true, ended: false, src: url, currentTime: 0,
      addEventListener(evt, fn) { listeners[evt] = fn; },
      play() { inst.paused = false; log.push(`play#${instances.indexOf(inst) + 1}`); return Promise.resolve(); },
      pause() { inst.paused = true; log.push(`pause#${instances.indexOf(inst) + 1}`); },
      fire(evt) { if (evt === "ended") { inst.ended = true; inst.paused = true; } if (listeners[evt]) listeners[evt](); } };
    instances.push(inst); log.push(`new#${instances.length}`);
    return inst;
  }
  FakeAudio.instances = instances;
  return FakeAudio;
}

function load({ url = "./audio/x_normal.mp3" } = {}) {
  const log = [];
  const buttons = [];
  const FakeAudio = makeFakeAudio(log);
  const ctx = {
    console, currentAudio: null, playbackSession: 0, Audio: FakeAudio,
    window: { speechSynthesis: { cancel: () => log.push("synth.cancel"), speak: () => log.push("synth.speak") } },
    document: {
      getElementById: () => null,
      querySelectorAll: (sel) => {
        // 只认 .a.b, .c 这种按 class 的选择器：哪个复合选择器的每个 class 都在，就算命中。
        // 第一版粗暴地「带 playing 就返回」，把 stopAllAudio 里给场景卡按钮改标签的那句也
        // 套到了复习卡按钮上，测试因此假红。
        const groups = sel.split(",").map(g => g.trim().split(".").filter(Boolean));
        return buttons.filter(b => groups.some(g => g.every(c => b.classList.contains(c))));
      },
    },
    playableUrlFor: () => url,
    speakText: (text, rate, btn) => { log.push("speakText"); if (btn) ctx.setPlayBtnPlaying(btn); },
    clearTimeout, setTimeout,
  };
  vm.createContext(ctx);
  for (const fn of ["setPlayBtnPlaying", "resetPlayBtnState", "flashAudioUnavailable", "stopAllAudio", "playReviewAudio", "pauseOrResumeClip"]) {
    vm.runInContext(fnSource(fn), ctx);
  }
  const btn = (name) => { const b = fakeBtn(name); buttons.push(b); return b; };
  return { ctx, log, FakeAudio, btn, item: { id: "s1", en: "Bath time!" } };
}
const flush = () => new Promise(r => setTimeout(r, 0));

test("点 ▶ 开始放，按钮变 ⏸", async () => {
  const { ctx, log, btn, item } = load();
  const b = btn("A");
  ctx.playReviewAudio(item, b); await flush();
  assert.deepEqual(log, ["synth.cancel", "new#1", "play#1"]);
  assert.equal(b.textContent, "⏸");
  assert.ok(b.classList.contains("playing"));
});

test("放到一半点 ⏸：声音停住，不造新的，按钮变回 ▶", async () => {
  const { ctx, log, btn, item, FakeAudio } = load();
  const b = btn("A");
  ctx.playReviewAudio(item, b); await flush();
  log.length = 0;
  ctx.playReviewAudio(item, b); await flush();
  assert.deepEqual(log, ["pause#1"], `第二下应该只是暂停第一段，实际发生了：${log.join(" ")}`);
  assert.equal(FakeAudio.instances.length, 1, "第二下造了新的声音——这就是「重新播放」");
  assert.equal(b.textContent, "▶");
  assert.ok(!b.classList.contains("playing"));
  assert.ok(ctx.currentAudio === FakeAudio.instances[0], "暂停后那段声音被扔了——接不上了");
});

test("暂停后再点 ▶：同一段接着放，不从头", async () => {
  const { ctx, log, btn, item, FakeAudio } = load();
  const b = btn("A");
  ctx.playReviewAudio(item, b); await flush();
  ctx.playReviewAudio(item, b); await flush();
  FakeAudio.instances[0].currentTime = 1.3;
  log.length = 0;
  ctx.playReviewAudio(item, b); await flush();
  assert.deepEqual(log, ["play#1"], `第三下该接着放第一段，实际：${log.join(" ")}`);
  assert.equal(FakeAudio.instances[0].currentTime, 1.3, "从头放了——进度被归零");
  assert.equal(b.textContent, "⏸");
});

test("放完了再点 ▶：从头放，造一段新的是对的", async () => {
  const { ctx, log, btn, item, FakeAudio } = load();
  const b = btn("A");
  ctx.playReviewAudio(item, b); await flush();
  FakeAudio.instances[0].fire("ended");
  assert.equal(b.textContent, "▶", "放完了按钮没变回 ▶");
  log.length = 0;
  ctx.playReviewAudio(item, b); await flush();
  assert.ok(log.includes("new#2") && log.includes("play#2"), `放完再点该从头来一段新的，实际：${log.join(" ")}`);
});

test("没有录音、退回手机自带朗读：第二下当「停」，第三下从头念", async () => {
  const { ctx, log, btn, item } = load({ url: null });
  const b = btn("A");
  ctx.playReviewAudio(item, b); await flush();
  assert.ok(log.includes("speakText"), "没走朗读兜底");
  assert.equal(b.textContent, "⏸");
  log.length = 0;
  ctx.playReviewAudio(item, b); await flush();
  assert.ok(log.includes("synth.cancel"), "第二下没把朗读停掉");
  assert.ok(!log.includes("speakText"), "第二下又从头念了一遍");
  assert.equal(b.textContent, "▶");
  log.length = 0;
  ctx.playReviewAudio(item, b); await flush();
  assert.ok(log.includes("speakText"), "第三下没重新念");
});

test("正放着 A 卡，去点 B 卡：A 停、B 放——原有行为不许改坏", async () => {
  const { ctx, log, btn, FakeAudio } = load();
  const a = btn("A"), b = btn("B");
  ctx.playReviewAudio({ id: "s1", en: "one" }, a); await flush();
  log.length = 0;
  ctx.playReviewAudio({ id: "s2", en: "two" }, b); await flush();
  assert.ok(log.includes("pause#1") && log.includes("new#2") && log.includes("play#2"), `实际：${log.join(" ")}`);
  assert.equal(a.textContent, "▶", "A 的按钮没复位");
  assert.equal(b.textContent, "⏸");
  assert.equal(ctx.currentAudio, FakeAudio.instances[1]);
});

test("A 暂停着，去点 B：B 从头放，A 那段被清掉、按钮保持 ▶", async () => {
  const { ctx, log, btn, FakeAudio } = load();
  const a = btn("A"), b = btn("B");
  ctx.playReviewAudio({ id: "s1", en: "one" }, a); await flush();
  ctx.playReviewAudio({ id: "s1", en: "one" }, a); await flush();   // 暂停 A
  log.length = 0;
  ctx.playReviewAudio({ id: "s2", en: "two" }, b); await flush();
  assert.ok(log.includes("new#2") && log.includes("play#2"), `实际：${log.join(" ")}`);
  assert.equal(ctx.currentAudio, FakeAudio.instances[1]);
  assert.equal(a.textContent, "▶");
  // 再回头点 A：不能接着放那段被清掉的，得从头
  log.length = 0;
  ctx.playReviewAudio({ id: "s1", en: "one" }, a); await flush();
  assert.ok(log.includes("new#3"), `回头点 A 该从头来一段新的，实际：${log.join(" ")}`);
});

console.log("review play/pause tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message.split("\n")[0]}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
