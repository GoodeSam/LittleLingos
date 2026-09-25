#!/usr/bin/env node
// 播放这件事，从今往后只有一个主人：audio-controller.mjs。
//
// 为什么要有它（[ADR 0009](docs/adr/0009-modularize-before-framework.md)）：
// 2026-09-22 真机报上来「点 ⏸ 变成从头重放」，病根是三个播放函数各自
// stopAllAudio() 再新造一段——同一个副作用有三个主人。那次是补了一个共用
// 函数把三处接上；这次是把它连同 currentAudio / playbackSession 一起搬出
// index.html，让「谁在放、要不要停」只有一处能回答。
//
// 这个模块必须是「纯」的：import 的时候不碰 document、不碰 window、不自己
// 造 Audio。浏览器用的 Audio 和手机朗读都从外面传进来。这样它在 Node 里能
// 直接 import 来测——不用再像现在 48 个测试那样，从 index.html 里切一段
// 文本塞进沙箱、手搭一堆假对象。
//
// 这一组测试对应的用户情境（不含函数名）：
//   1. 点一句话的播放键：开始放。
//   2. 正在放，再点同一个键：停在那里，不是从头重放。
//   3. 接着再点：从刚才停的地方继续，还是同一段声音。
//   4. 放完了再点：从头放一遍（这时候造一段新的才是对的）。
//   5. 正在放 A，去点 B：A 停下来，B 开始放。
//   6. 这句话没有现成录音，用手机自带的声音念：第二下是「停」，不是接着念；
//      第三下从头念。
//   7. 界面能知道「现在谁在放、是不是暂停着」，不用自己去翻全局变量。
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MODULE_PATH = join(ROOT, "audio-controller.mjs");

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// ── 假的浏览器零件 ───────────────────────────────────────────
// 只 mock 不受本项目控制的东西：Audio 元素和手机自带朗读。控制器本身用真的。
function makeFakeAudio(log) {
  const made = [];
  function FakeAudio(url) {
    const listeners = {};
    const a = {
      url, paused: true, ended: false, currentTime: 0,
      addEventListener: (evt, fn) => { (listeners[evt] ||= []).push(fn); },
      // 真浏览器里 play() 返回一个承诺；声音还没真正响起来就被 pause() 打断的话，
      // 这个承诺会以 AbortError 失败。这一点必须照实模拟——2026-09-25 就是它咬人的。
      play() {
        a.paused = false; log.push(`play#${made.indexOf(a) + 1}`);
        if (a.settleNow) return Promise.resolve();
        return new Promise((res, rej) => { a._pending = { res, rej }; });
      },
      started() { if (a._pending) { a._pending.res(); a._pending = null; } },   // 声音真响起来了
      pause() {
        a.paused = true; log.push(`pause#${made.indexOf(a) + 1}`);
        if (a._pending) { const e = new Error("interrupted by pause"); e.name = "AbortError"; a._pending.rej(e); a._pending = null; }
      },
      fire(evt) { if (evt === "ended") { a.ended = true; a.paused = true; } (listeners[evt] || []).forEach(f => f()); },
    };
    made.push(a); log.push(`new#${made.length}(${url})`);
    return a;
  }
  FakeAudio.made = made;
  return FakeAudio;
}

function makeFakeSpeech(log) {
  return {
    spoken: [],
    cancel() { log.push("speech:cancel"); },
    speak(u) { log.push(`speech:speak(${u && u.text})`); this.spoken.push(u); },
  };
}

async function load() {
  assert.ok(existsSync(MODULE_PATH),
    "audio-controller.mjs 还不存在——这条测试就是用来逼它出生的（ADR 0009 第 2 条迁移规矩）");
  const log = [];
  const Audio = makeFakeAudio(log);
  const speech = makeFakeSpeech(log);
  const mod = await import(MODULE_PATH);
  assert.equal(typeof mod.createAudioController, "function",
    "模块要导出 createAudioController(deps)，把浏览器零件从外面传进去");
  const ac = mod.createAudioController({
    Audio, speech,
    Utterance: function (text) { return { text }; },
  });
  return { ac, log, Audio, speech };
}

// ── 1～5：有录音的那条路 ────────────────────────────────────
test("点一句话的播放键：开始放", async () => {
  const { ac, log } = await load();
  const r = ac.toggle({ owner: "p1", url: "./audio/a.mp3", text: "Bath time!" });
  assert.equal(r, "playing", `第一次点应当开始放，实际是「${r}」`);
  assert.deepEqual(log, ["new#1(./audio/a.mp3)", "play#1"]);
  assert.deepEqual(ac.state(), { owner: "p1", mode: "clip", paused: false });
});

test("正在放，再点同一个键：停在那里，不是从头重放", async () => {
  const { ac, log } = await load();
  ac.toggle({ owner: "p1", url: "./audio/a.mp3", text: "Bath time!" });
  log.length = 0;
  const r = ac.toggle({ owner: "p1", url: "./audio/a.mp3", text: "Bath time!" });
  assert.equal(r, "paused", `再点一下应当是暂停，实际是「${r}」`);
  assert.deepEqual(log, ["pause#1"], `暂停时不许新造一段声音：${JSON.stringify(log)}`);
  assert.deepEqual(ac.state(), { owner: "p1", mode: "clip", paused: true });
});

test("接着再点：从停的地方继续，还是同一段声音", async () => {
  const { ac, log, Audio } = await load();
  const clip = { owner: "p1", url: "./audio/a.mp3", text: "Bath time!" };
  ac.toggle(clip); ac.toggle(clip);
  log.length = 0;
  const r = ac.toggle(clip);
  assert.equal(r, "resumed", `暂停之后再点应当是接着放，实际是「${r}」`);
  assert.deepEqual(log, ["play#1"], `接着放不许新造一段：${JSON.stringify(log)}`);
  assert.equal(Audio.made.length, 1, "从头到尾只该有一段声音");
  assert.equal(ac.state().paused, false);
});

test("放完了再点：从头放一遍，这时候造一段新的才对", async () => {
  const { ac, log, Audio } = await load();
  const clip = { owner: "p1", url: "./audio/a.mp3", text: "Bath time!" };
  ac.toggle(clip);
  Audio.made[0].fire("ended");
  assert.equal(ac.state().owner, null, "放完之后不该还占着「正在放」");
  log.length = 0;
  const r = ac.toggle(clip);
  assert.equal(r, "playing");
  assert.equal(Audio.made.length, 2, "放完再点应当是新的一段");
});

test("正在放 A，去点 B：A 停下来，B 开始放", async () => {
  const { ac, log, Audio } = await load();
  ac.toggle({ owner: "A", url: "./audio/a.mp3", text: "A" });
  log.length = 0;
  const r = ac.toggle({ owner: "B", url: "./audio/b.mp3", text: "B" });
  assert.equal(r, "playing");
  assert.ok(log.includes("pause#1"), `A 没有被停下来：${JSON.stringify(log)}`);
  assert.equal(Audio.made.length, 2);
  assert.deepEqual(ac.state(), { owner: "B", mode: "clip", paused: false });
});

test("刚点开始、声音还没响就点暂停：仍然是暂停，不许偷偷改用手机自带的声音念", async () => {
  const { ac, log, speech, Audio } = await load();
  const clip = { owner: "p1", url: "./audio/a.mp3", text: "Bath time!" };
  ac.toggle(clip);              // 开始放（这一段还在加载，声音没响）
  const r = ac.toggle(clip);    // 马上暂停 —— 浏览器会让上面那个承诺以 AbortError 失败
  assert.equal(r, "paused");
  await new Promise(res => setTimeout(res, 0));   // 让失败的回调有机会跑
  assert.equal(ac.state().paused, true, "暂停之后状态被兜底逻辑改掉了");
  assert.equal(ac.state().mode, "clip", `暂停之后变成了 ${ac.state().mode}——用户按的是暂停，结果手机开始念`);
  assert.deepEqual(speech.spoken, [], `不该念任何东西：${JSON.stringify(log)}`);
  assert.equal(Audio.made.length, 1, "不该另造一段");
});

// ── 6：没有录音、退回手机朗读的那条路 ──────────────────────
test("没有现成录音：用手机自带的声音念；第二下是停，第三下从头念", async () => {
  const { ac, log, speech } = await load();
  const line = { owner: "p9", url: null, text: "Let's wash hands" };
  assert.equal(ac.toggle(line), "speaking");
  assert.deepEqual(ac.state(), { owner: "p9", mode: "speech", paused: false });
  log.length = 0;
  // 手机自带朗读没有可靠的暂停/继续（iOS 上 resume 常常不响），所以第二下当「停」
  assert.equal(ac.toggle(line), "stopped");
  assert.ok(log.includes("speech:cancel"), `第二下应当把朗读停掉：${JSON.stringify(log)}`);
  assert.deepEqual(ac.state(), { owner: null, mode: null, paused: false });
  assert.equal(ac.toggle(line), "speaking", "第三下应当从头念");
  assert.equal(speech.spoken.length, 2, "两次念，不是接着上次");
});

// ── 7：界面靠它知道现在谁在放 ──────────────────────────────
test("状态变了会通知界面，界面不用自己去翻全局变量", async () => {
  const { ac, Audio } = await load();
  const seen = [];
  const off = ac.subscribe(s => seen.push(`${s.owner}:${s.mode}:${s.paused ? "paused" : "playing"}`));
  const clip = { owner: "p1", url: "./audio/a.mp3", text: "x" };
  ac.toggle(clip);            // 开始放
  ac.toggle(clip);            // 暂停
  ac.toggle(clip);            // 接着放
  Audio.made[0].fire("ended"); // 自己放完
  assert.deepEqual(seen, [
    "p1:clip:playing",
    "p1:clip:paused",
    "p1:clip:playing",
    "null:null:playing",
  ], "开始/暂停/继续/放完，四次都要通知");
  off();
  ac.toggle(clip);
  assert.equal(seen.length, 4, "退订之后不该再收到通知");
});

// ── 模块本身的规矩 ─────────────────────────────────────────
test("这个模块是纯的：import 的时候不碰 document、不碰 window", async () => {
  assert.ok(existsSync(MODULE_PATH), "audio-controller.mjs 还不存在");
  assert.equal(typeof globalThis.document, "undefined", "测试环境本来就没有 document，下面这句 import 才有意义");
  await import(MODULE_PATH);   // 顶层碰 DOM 的话，这里直接抛
  // 只看代码，不看注释——注释里点名这些东西（比如写「不碰 localStorage」）不算犯规。
  const src = readFileSync(MODULE_PATH, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
  for (const bad of ["document.", "window.", "localStorage", "new Audio("]) {
    assert.ok(!src.includes(bad),
      `模块里出现了「${bad}」——浏览器零件要从 createAudioController(deps) 传进来，不许自己去抓`);
  }
});

test("新文件要进 sw.js 的预缓存清单和缓存戳来源，否则离线会坏、改了也不换戳", async () => {
  const sw = readFileSync(join(ROOT, "sw.js"), "utf8");
  const shell = sw.slice(sw.indexOf("const SHELL = ["), sw.indexOf("];", sw.indexOf("const SHELL = [")));
  assert.ok(shell.includes("audio-controller.mjs"),
    "sw.js 的 SHELL 里没有 audio-controller.mjs——装了主屏幕版的家长离线打开会白屏");
  const stamp = readFileSync(join(ROOT, "scripts/stamp-sw.mjs"), "utf8");
  const sources = stamp.slice(stamp.indexOf("const SOURCES = ["), stamp.indexOf("]", stamp.indexOf("const SOURCES = [")));
  assert.ok(sources.includes("audio-controller.mjs"),
    "stamp-sw.mjs 的 SOURCES 里没有它——改了这个文件缓存戳不变，老版本会一直被当成最新的");
});

let pass = 0, fail = 0;
for (const t of tests) {
  try { await t.fn(); console.log(`  ✓ ${t.name}`); pass++; }
  catch (e) { console.log(`  ✗ ${t.name}\n    ${e.message.split("\n")[0]}`); fail++; }
}
console.log(fail ? `✗ ${fail} failed, ${pass} passed` : `✓ all ${pass} tests passed`);
process.exit(fail ? 1 : 0);
