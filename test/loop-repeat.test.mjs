#!/usr/bin/env node
// 连播「英语放一次还是两次」（2026-11-03 Victor 提）+ 放英文时只看英文、字大一些。
//
// 约定的接口（测试先行，实现照这个接）：
//   audio-loop.js 的 create(deps) 多收一个依赖 getEnglishRepeat()：返回 1 或 2。
//     每一句的英文开始放之前现读一次（家长在设置里改了，下一句起生效）。
//     读不到、不是 1 或 2（0、3、"2"、undefined、NaN）一律按 1 处理。
//   选 2 时：一句的英文放完 → 停 2 秒（LOOP_PAUSE_MS）→ 同一句的英文再放一遍 →
//     才轮到下一句。这 2 秒和句首中文念完后的那 2 秒一样，用同一个元素放无声片段
//     占住（C21：元素不能有空档），环境放不了无声片段时才退回计时器。
//   index.html 的 paintLoopCueBox(box, item, phase)：phase 为 "en" 时只显示英文，
//     中文收起；其余时候中文照常显示、英文收起。
//   app.css 的 .loop-cue-en 字号比现在的 18px 大。
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   1. 家长选了「放两次」：每句英文听两遍，两遍之间隔 2 秒，两遍听完才轮到下一句的中文提示。
//   2. 家长选了「放一次」，或者从没设置过：每句英文只听一遍，放完马上接下一句，中间没有那 2 秒。
//   3. 设置里存了个不认识的值：按一次放，不报错、不乱放。
//   4. 选了两次，手机熄屏：两遍之间的 2 秒里，播放器一直在出声（放的是无声片段），
//      没有一个计时器在空等——系统才不会把页面挂起。
//   5. 选了两次，但这台手机放不了无声片段：退回计时器，间隔恰好 2 秒。
//   6. 选了两次，在两遍之间的 2 秒里看锁屏：播放条仍是「正在播放」，标题仍是这句英文；
//      按暂停再按播放，接着放的是第二遍，不是重放第一遍，也不是跳到下一句。
//   7. 选了两次，从第一遍开始放到第二遍放完，屏幕上始终只有这句英文：不出现中文，
//      不闪成别的句子，也不被清空。
//   8. 英文放的时候中文收起；轮到中文提示时中文回来、英文收起。
//   9. 英文放的时候，英文那行字比现在（18px）大。
//  10. 选了两次，第一遍还没放完就按了暂停，再按继续：第一遍放完后照样会放第二遍。
//  11. 选了两次，在两遍之间的 2 秒里拖滑块跳到别的句：先念那句的中文提示，
//      不会再把旧那句多放一遍。
//  12. 放着放着把设置从两次改成一次：下一句起只放一遍。
import { readFileSync } from "node:fs";
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
    play() {
      this.played.push(this._src); this.paused = false; if (this.onPlay) this.onPlay(this._src);
      this.ended = false;
      const C = this.constructor;
      if (this.rejectNextPlay || C.rejectNext) { this.rejectNextPlay = false; C.rejectNext = false; return Promise.reject(new Error("NotAllowedError")); }
      return Promise.resolve();
    }
    pause() { this.paused = true; }
    // 真的放完了：ended 属性是 true
    fire(n) { if (n === "ended") this.ended = true; for (const h of [...(this._h[n] || [])]) h({ target: this }); }
    // 迟到的旧事件：元素早就换了片段，ended 属性是 false（真浏览器里的样子）
    fireStale(n) { if (n === "ended") this.ended = false; for (const h of [...(this._h[n] || [])]) h({ target: this }); }
  };
}

function fakeMediaSession() {
  const handlers = {};
  return {
    metadata: null, playbackState: "none",
    setActionHandler(name, fn) { handlers[name] = fn; },
    press(name) { handlers[name]({ action: name }); },
  };
}
class FakeMediaMetadata { constructor(o) { Object.assign(this, o || {}); } }

const ROWS = ["a", "b", "c"].map((id, i) => ({ id, zh: "中" + (i + 1), en: "E" + (i + 1) }));
const SILENCE = "blob:silence";

async function setup({ repeat, silence = SILENCE, mediaSession = null, onLoopPhase = null, onLoopState = null } = {}) {
  const keys = new Set(ROWS.flatMap(r => [r.id, "zh:" + r.id]));
  const playback = playbackLib.create({
    getAudio: async k => { if (!keys.has(k)) return null; const b = new Blob([new Uint8Array(4)]); b._k = k; return b; },
    isAudioBacked: () => false,
    URL: { createObjectURL: b => "blob:" + b._k, revokeObjectURL: () => {} },
  });
  for (const k of keys) await playback.primeAudioUrl(k);
  const made = [], timers = [], cues = [];
  let timerSeq = 0;
  const cfg = { repeat };
  const AudioClass = fakeAudioClass(made);
  const deps = {
    Audio: AudioClass,
    setTimeout: (fn, ms) => { const id = ++timerSeq; timers.push({ fn, ms, id }); return id; },
    clearTimeout: id => { const at = timers.findIndex(t => t.id === id); if (at >= 0) timers.splice(at, 1); },
    audioUrlFor: id => playback.audioUrlFor(id),
    playableUrlFor: it => (cfg.gone && cfg.gone.has(it.id) ? null : playback.playableUrlFor(it)),
    silenceUrl: silence,
    getEnglishRepeat: () => cfg.repeat,
  };
  if (mediaSession) { deps.mediaSession = mediaSession; deps.MediaMetadata = FakeMediaMetadata; }
  if (onLoopPhase) deps.onLoopPhase = onLoopPhase;
  if (onLoopState) deps.onLoopState = onLoopState;
  const loop = loopLib.create(deps);
  const onCue = it => cues.push(it ? it.id : null);
  const el = () => made[0];
  const end = () => el().fire("ended");
  return { loop, made, timers, cues, onCue, el, end, cfg, AudioClass };
}

// 从 index.html 里取出真的画面函数，装进一个假盒子里跑。
function loadPaint() {
  const html = readFileSync(join(ROOT, "index.html"), "utf8");
  const at = html.indexOf("function paintLoopCueBox(");
  assert.ok(at >= 0, "index.html 里找不到 paintLoopCueBox");
  let i = html.indexOf("{", at), depth = 0, j = i;
  for (; j < html.length; j++) { if (html[j] === "{") depth++; else if (html[j] === "}") { depth--; if (!depth) break; } }
  const src = html.slice(at, j + 1);
  return new Function(src + "; return paintLoopCueBox;")();
}
function fakeBox() {
  const zh = { hidden: false, textContent: "" }, en = { hidden: true, textContent: "" };
  const box = { hidden: true, querySelector: s => (s === ".loop-cue-zh" ? zh : s === ".loop-cue-en" ? en : null) };
  const shown = el => (!el.hidden && el.textContent.trim() !== "" ? el.textContent.trim() : null);
  return { box, view: () => ({ boxShown: !box.hidden, zh: shown(zh), en: shown(en) }) };
}

// ══ 次数 ═════════════════════════════════════════════════════════════════

test("选了放两次：每句英文两遍，两遍之间一段静音，听完才轮到下一句的中文提示", async () => {
  const { loop, onCue, el, end } = await setup({ repeat: 2 });
  loop.toggleAudioLoop(ROWS, onCue);
  for (let i = 0; i < 8; i++) end();
  assert.deepEqual(el().played, [
    "blob:a", SILENCE, "blob:a",                    // 第 1 句：英文、2 秒、英文
    "blob:zh:b", SILENCE, "blob:b", SILENCE, "blob:b", // 第 2 句：中文、2 秒、英文、2 秒、英文
    "blob:zh:c",
  ]);
});

test("选了放一次：每句英文一遍，放完马上接下一句，中间没有那 2 秒（对照）", async () => {
  const { loop, onCue, el, end } = await setup({ repeat: 1 });
  loop.toggleAudioLoop(ROWS, onCue);
  for (let i = 0; i < 6; i++) end();
  assert.deepEqual(el().played, ["blob:a", "blob:zh:b", SILENCE, "blob:b", "blob:zh:c", SILENCE, "blob:c"]);
});

test("从没设置过、或存了个不认识的值：按一次放，不报错", async () => {
  for (const bad of [undefined, null, 0, 3, -1, "2", "abc", NaN, 1.5]) {
    const { loop, onCue, el, end } = await setup({ repeat: bad });
    assert.doesNotThrow(() => loop.toggleAudioLoop(ROWS, onCue));
    end(); end();
    assert.deepEqual(el().played.slice(0, 2), ["blob:a", "blob:zh:b"], `设置是 ${String(bad)} 时没按一次放`);
  }
  // 对照：真的设成 2 时不是这个结果，说明上面不是因为这个依赖根本没读
  const ok = await setup({ repeat: 2 });
  ok.loop.toggleAudioLoop(ROWS, ok.onCue); ok.end();
  assert.equal(ok.el().played[1], SILENCE, "控制组失败：设成 2 也没有间隔");
});

// ══ 间隔：2 秒、元素不能有空档（C21）══════════════════════════════════════

test("熄屏时两遍之间的 2 秒：播放器一直在出声（无声片段），没有计时器在空等", async () => {
  const { loop, onCue, el, end, timers } = await setup({ repeat: 2 });
  loop.toggleAudioLoop(ROWS, onCue);
  const before = el().played.length;
  end();                                                       // 第一遍英文放完
  assert.equal(el().played.length, before + 1, "第一遍放完，元素当场没接着放东西——出现了空档");
  assert.equal(el().played.at(-1), SILENCE, "两遍之间放的不是无声片段");
  assert.equal(el().paused, false, "间隔期间元素是停着的");
  assert.equal(timers.length, 0, "间隔靠计时器空等——熄屏时它不准时");
  end();                                                       // 2 秒放完
  assert.equal(el().played.at(-1), "blob:a", "2 秒之后放的不是同一句英文的第二遍");
  assert.equal(el().paused, false);
});

test("间隔用的无声片段就是 2 秒（和句首那 2 秒是同一段）", async () => {
  let blob = null;
  const url = loopLib.silenceWavUrl(loopLib.LOOP_PAUSE_MS, { Blob, URL: { createObjectURL: b => { blob = b; return "blob:real-silence"; } } });
  assert.equal(loopLib.LOOP_PAUSE_MS, 2000, "停顿不是 2 秒");
  const buf = new DataView(await blob.arrayBuffer());
  const seconds = buf.getUint32(40, true) / (buf.getUint32(24, true) * buf.getUint16(34, true) / 8);
  assert.equal(seconds, 2, `无声片段是 ${seconds} 秒`);
  const { loop, onCue, el, end } = await setup({ repeat: 2, silence: url });
  loop.toggleAudioLoop(ROWS, onCue); end();
  assert.equal(el().played.at(-1), url, "两遍之间放的不是那段 2 秒的无声片段");
});

test("这台手机放不了无声片段：退回计时器，两遍之间恰好 2000 毫秒", async () => {
  const { loop, onCue, el, end, timers } = await setup({ repeat: 2, silence: null });
  loop.toggleAudioLoop(ROWS, onCue);
  end();
  assert.equal(timers.length, 1, "两遍之间没有停顿");
  assert.equal(timers[0].ms, 2000, `停顿是 ${timers[0].ms} 毫秒`);
  assert.deepEqual(el().played, ["blob:a"], "计时器没到就放了第二遍");
  timers.shift().fn();
  assert.deepEqual(el().played, ["blob:a", "blob:a"], "计时器到了没放第二遍");
  // 对照：选一次时一个计时器也不该有
  const one = await setup({ repeat: 1, silence: null });
  one.loop.toggleAudioLoop(ROWS, one.onCue); one.end();
  assert.deepEqual(one.el().played, ["blob:a", "blob:zh:b"], "选一次时第一遍放完没马上接下一句");
  assert.equal(one.timers.length, 0, "选一次也多等了 2 秒");
});

test("两遍之间看锁屏：仍是正在播放、标题仍是这句英文；按暂停再按播放，接着放第二遍", async () => {
  const ms = fakeMediaSession();
  const states = [];
  const { loop, onCue, el, end } = await setup({ repeat: 2, mediaSession: ms, onLoopState: s => states.push(s) });
  loop.toggleAudioLoop(ROWS, onCue);
  end();                                                       // 进入两遍之间
  assert.equal(el().played.at(-1), SILENCE);
  assert.equal(ms.playbackState, "playing", "间隔期间锁屏播放条不是「正在播放」");
  assert.equal(ms.metadata.title, "E1", "间隔期间锁屏标题不是这句英文");
  assert.deepEqual(states, ["playing"], `间隔期间状态抖了：${states.join(",")}`);
  ms.press("pause");
  assert.equal(ms.playbackState, "paused");
  const n = el().played.length;
  ms.press("play");
  assert.equal(ms.playbackState, "playing");
  assert.equal(el().played.length, n + 1, "按播放没出声");
  assert.equal(el().played.at(-1), "blob:a", "接着放的不是这句英文的第二遍");
  end();                                                       // 第二遍放完
  assert.equal(el().played.at(-1), "blob:zh:b", "第二遍之后没接下一句的中文提示（多放了一遍或跳了）");
});

// ══ 屏幕：只看英文，不闪 ════════════════════════════════════════════════

test("选了两次：从第一遍到第二遍放完，屏幕上始终只有这句英文，没有中文、没换句、没清空", async () => {
  const paint = loadPaint();
  const { box, view } = fakeBox();
  const { loop, onCue, end } = await setup({
    repeat: 2,
    onLoopPhase: (item, phase) => paint(box, item, phase),
  });
  const snaps = [];
  const snap = label => snaps.push({ label, ...view() });
  // 提示阶段也要画（onCue 里），和 index.html 的接法一样
  loop.toggleAudioLoop(ROWS, it => { onCue(it); paint(box, it, "zh"); });
  snap("第一遍在放");
  end(); snap("两遍之间的 2 秒");
  end(); snap("第二遍在放");
  for (const s of snaps) {
    assert.equal(s.boxShown, true, `${s.label}：提示框被收起了`);
    assert.equal(s.en, "E1", `${s.label}：英文不是这句（${s.en}）`);
    assert.equal(s.zh, null, `${s.label}：屏幕上还有中文「${s.zh}」`);
  }
});

test("英文放的时候中文收起；轮到下一句的中文提示时中文回来、英文收起", async () => {
  const paint = loadPaint();
  const { box, view } = fakeBox();
  const { loop, onCue, end } = await setup({ repeat: 1, onLoopPhase: (item, phase) => paint(box, item, phase) });
  loop.toggleAudioLoop(ROWS, it => { onCue(it); paint(box, it, "zh"); });
  assert.deepEqual(view(), { boxShown: true, zh: null, en: "E1" }, "放英文时没有只剩英文");
  end();                                                       // 英文放完 → 下一句中文提示
  assert.deepEqual(view(), { boxShown: true, zh: "中2", en: null }, "中文提示阶段不是只有中文");
  end(); end();                                                // 中文念完 → 2 秒 → 英文
  assert.deepEqual(view(), { boxShown: true, zh: null, en: "E2" }, "第 2 句放英文时没有只剩英文");
});

test("英文那一行比现在（18px）大", () => {
  const css = readFileSync(join(ROOT, "app.css"), "utf8");
  const rule = css.match(/\.loop-cue-en\s*\{([^}]*)\}/);
  assert.ok(rule, "app.css 里没有 .loop-cue-en");
  const px = /font-size:\s*([\d.]+)px/.exec(rule[1]);
  assert.ok(px, ".loop-cue-en 没写 px 字号");
  assert.ok(Number(px[1]) > 18, `英文那行还是 ${px[1]}px，没有放大`);
});

// ══ 暂停 / 跳转 / 改设置 ═════════════════════════════════════════════════

test("选了两次，第一遍没放完就暂停，再按继续：第一遍放完后照样放第二遍", async () => {
  const { loop, onCue, el, end } = await setup({ repeat: 2 });
  loop.toggleAudioLoop(ROWS, onCue);                           // 开始
  loop.toggleAudioLoop(ROWS, onCue);                           // 暂停
  loop.toggleAudioLoop(ROWS, onCue);                           // 继续
  end();                                                       // 第一遍放完
  assert.equal(el().played.at(-1), SILENCE, "继续之后，第一遍放完没进入 2 秒间隔");
  end();
  assert.equal(el().played.at(-1), "blob:a", "继续之后没放第二遍");
  end();
  assert.equal(el().played.at(-1), "blob:zh:b", "第二遍放完没接下一句");
});

test("选了两次，在两遍之间的 2 秒里拖滑块跳到第 3 句：先念第 3 句中文，不再把第 1 句多放一遍", async () => {
  const { loop, onCue, el, end } = await setup({ repeat: 2 });
  loop.toggleAudioLoop(ROWS, onCue);
  end();                                                       // 进入间隔
  assert.equal(el().played.at(-1), SILENCE, "前提不成立：第一遍放完没进入 2 秒间隔");
  assert.equal(loop.jumpAudioLoop("c"), true);
  assert.equal(el().played.at(-1), "blob:zh:c", "跳过去之后没先念第 3 句的中文提示");
  end(); end();                                                // 中文 → 2 秒 → 英文
  assert.equal(el().played.at(-1), "blob:c");
  assert.ok(!el().played.slice(el().played.indexOf("blob:zh:c")).includes("blob:a"), "跳走之后又放了第 1 句");
});

test("放着放着把设置从两次改成一次：下一句起只放一遍", async () => {
  const { loop, onCue, el, end, cfg } = await setup({ repeat: 2 });
  loop.toggleAudioLoop(ROWS, onCue);
  end(); end(); end();                                         // a 放两遍 → 第 2 句中文
  assert.equal(el().played.at(-1), "blob:zh:b");
  cfg.repeat = 1;
  end(); end();                                                // 中文 → 2 秒 → b 的英文
  assert.equal(el().played.at(-1), "blob:b");
  end();                                                       // b 放完：只一遍，直接接 c 的中文
  assert.equal(el().played.at(-1), "blob:zh:c", "改成一次之后，下一句还放了两遍");
});

test("两遍之间的无声片段临场被拒：退回计时器，仍是 2000 毫秒，只放一次第二遍（被拒和报错同时到也不重复）", async () => {
  const { loop, onCue, el, end, timers } = await setup({ repeat: 2 });
  loop.toggleAudioLoop(ROWS, onCue);
  el().rejectNextPlay = true;
  end();                                                       // 第一遍放完，无声片段被拒
  await new Promise(r => setTimeout(r, 0));
  el().fire("error");                                          // 同时元素也报了错
  await new Promise(r => setTimeout(r, 0));
  assert.equal(timers.length, 1, `退回计时器的次数不是 1：${timers.length}`);
  assert.equal(timers[0].ms, 2000, `间隔不是 2000 毫秒：${timers[0].ms}`);
  assert.equal(el().played.filter(s => s === "blob:a").length, 1, "计时器没到就放了第二遍");
  el().fire("ended");                                          // 迟到的 ended 不该算数
  assert.equal(el().played.filter(s => s === "blob:a").length, 1, "迟到的 ended 又触发了第二遍");
  timers.shift().fn();
  assert.equal(el().played.filter(s => s === "blob:a").length, 2, "计时器到了没放第二遍");
  assert.equal(el().played.at(-1), "blob:a");
  assert.equal(timers.length, 0, "第二遍之外多出了别的计时器");
  end();
  assert.equal(el().played.at(-1), "blob:zh:b", "第二遍放完没接下一句（连跳或卡住）");
});

test("两遍之间的无声片段只被拒、没有报错：也退回计时器，2000 毫秒后放第二遍", async () => {
  const { loop, onCue, el, end, timers } = await setup({ repeat: 2 });
  loop.toggleAudioLoop(ROWS, onCue);
  el().rejectNextPlay = true;
  end();
  await new Promise(r => setTimeout(r, 0));
  assert.equal(timers.length, 1, "被拒之后没有退回计时器，连播卡在这里");
  assert.equal(timers[0].ms, 2000);
  timers.shift().fn();
  assert.equal(el().played.filter(s => s === "blob:a").length, 2);
});

test("两遍之间的无声片段只报错不被拒：同样退回计时器，不重复放第二遍", async () => {
  const { loop, onCue, el, end, timers } = await setup({ repeat: 2 });
  loop.toggleAudioLoop(ROWS, onCue);
  end();
  el().fire("error"); el().fire("error");
  assert.equal(timers.length, 1, "报两次错退回了不止一次计时器");
  assert.equal(timers[0].ms, 2000);
  timers.shift().fn();
  assert.equal(el().played.filter(s => s === "blob:a").length, 2);
});

test("第二遍的声音地址失效了：不卡死，直接接下一句的中文提示", async () => {
  const { loop, onCue, el, end, cfg } = await setup({ repeat: 2 });
  loop.toggleAudioLoop(ROWS, onCue);
  end();                                                       // 进入 2 秒间隔
  cfg.gone = new Set(["a"]);                                   // 这时第 1 句的地址被回收了
  end();                                                       // 间隔放完，要放第二遍却没有地址
  assert.equal(el().played.at(-1), "blob:zh:b", "地址没了，连播卡在这句或哑掉了");
  assert.equal(loop.audioLoopPlaying(), true);
});

test("放英文时点暂停，中文和英文都给看；继续后回到只看英文", () => {
  const paint = loadPaint();
  const { box, view } = fakeBox();
  const item = ROWS[0];
  paint(box, item, "en");
  assert.deepEqual(view(), { boxShown: true, zh: null, en: "E1" });
  paint(box, item, "both");
  assert.deepEqual(view(), { boxShown: true, zh: "中1", en: "E1" }, "暂停时不是中英文都在");
  paint(box, item, "en");
  assert.deepEqual(view(), { boxShown: true, zh: null, en: "E1" }, "继续后中文没有再收起");
});

test("英文行恰好 24px，「每句英文放」那行字恰好 16px", () => {
  const css = readFileSync(join(ROOT, "app.css"), "utf8");
  const px = sel => { const m = css.match(new RegExp(sel.replace(/\./g, "\\.") + "\\s*\\{([^}]*)\\}")); const f = m && /font-size:\s*([\d.]+)px/.exec(m[1]); return f && Number(f[1]); };
  assert.equal(px(".loop-cue-en"), 24);
  assert.equal(px(".loop-repeat-label"), 16);
});

const tick = () => new Promise(r => setTimeout(r, 0));
const countOf = (el, src) => el.played.filter(s => s === src).length;

test("计时器兜底已经开始放第二遍后，旧无声片段迟到的 ended 不会截断第二遍、不会跳句", async () => {
  const { loop, onCue, el, end, timers } = await setup({ repeat: 2 });
  loop.toggleAudioLoop(ROWS, onCue);
  el().rejectNextPlay = true;
  end(); await tick();                                         // 无声片段被拒 → 计时器
  timers.shift().fn();                                         // 2 秒到，第二遍开始
  assert.equal(el().played.at(-1), "blob:a");
  el().fireStale("ended");                                     // 旧无声片段迟到的 ended
  el().fireStale("error");
  assert.equal(el().played.at(-1), "blob:a", "迟到的旧事件把第二遍截断、跳去了下一句");
  assert.equal(countOf(el(), "blob:zh:b"), 0);
  end();                                                       // 第二遍真放完了
  assert.equal(el().played.at(-1), "blob:zh:b", "第二遍真放完之后没接下一句（迟到事件的防护把真事件也吞了）");
});

test("两遍之间拖滑块跳句：旧间隔迟到的 ended / error / 计时器都不影响新句", async () => {
  const { loop, onCue, el, end, timers } = await setup({ repeat: 2 });
  loop.toggleAudioLoop(ROWS, onCue);
  el().rejectNextPlay = true;
  end(); await tick();                                         // 退回计时器，旧计时器还挂着
  const oldTimers = timers.slice();
  assert.equal(loop.jumpAudioLoop("c"), true);
  const n = el().played.length;
  assert.equal(el().played.at(-1), "blob:zh:c");
  assert.equal(timers.length, 0, "跳句之后旧计时器还挂着");
  el().fireStale("ended"); el().fireStale("error");
  for (const t of oldTimers) t.fn();                           // 旧计时器就算漏网触发了，也该无效
  assert.equal(el().played.length, n, "旧间隔的迟到事件推进了状态：" + el().played.slice(n).join(","));
  end(); end();                                                // 新句：中文 → 2 秒 → 英文
  assert.equal(el().played.at(-1), "blob:c", "新句后来没按正常节奏走");
});

test("停止后重新开始：旧间隔迟到的事件和旧计时器都不影响新一轮", async () => {
  const { loop, onCue, el, end, timers } = await setup({ repeat: 2 });
  loop.toggleAudioLoop(ROWS, onCue);
  el().rejectNextPlay = true;
  end(); await tick();
  const stale = timers.slice();
  assert.equal(stale.length, 1);
  loop.stopAudioLoop();
  assert.equal(timers.length, 0, "停止之后旧计时器还挂着");
  loop.toggleAudioLoop(ROWS, onCue);                           // 新一轮：第 1 句英文
  const n = el().played.length;
  assert.equal(el().played.at(-1), "blob:a");
  el().fireStale("ended"); el().fireStale("error");
  stale[0].fn();
  assert.equal(el().played.length, n, "旧一轮的迟到事件或旧计时器推进了新一轮：" + el().played.slice(n).join(","));
  end();                                                       // 新一轮第一遍真放完 → 间隔
  assert.equal(el().played.at(-1), SILENCE, "新一轮没有按选两次的节奏走");
});

test("第一遍 play 被拒：绝不进入第二遍、也不放间隔，直接跳下一句；被拒又报错也不连跳两句", async () => {
  const { loop, onCue, el, AudioClass } = await setup({ repeat: 2 });
  AudioClass.rejectNext = true;
  loop.toggleAudioLoop(ROWS, onCue);
  await tick();
  assert.deepEqual(el().played, ["blob:a", "blob:zh:b"], "第一遍被拒后没有直接跳下一句：" + el().played.join(","));
  el().fireStale("error");                                     // 同一次失败的报错晚到
  assert.deepEqual(el().played, ["blob:a", "blob:zh:b"], "被拒又报错，连跳了两句");
});

test("第二遍 play 被拒、或元素报错：立刻跳下一句，不卡死、不连跳", async () => {
  const one = await setup({ repeat: 2 });
  one.loop.toggleAudioLoop(ROWS, one.onCue);
  one.end();                                                   // 间隔
  one.el().rejectNextPlay = true;
  one.end(); await tick();                                     // 第二遍被拒
  assert.equal(one.el().played.at(-1), "blob:zh:b", "第二遍被拒后卡住了");
  one.el().fireStale("error");
  assert.equal(one.el().played.at(-1), "blob:zh:b", "被拒又报错，连跳了两句");

  const two = await setup({ repeat: 2 });
  two.loop.toggleAudioLoop(ROWS, two.onCue);
  two.end(); two.end();                                        // 第二遍在放
  assert.equal(two.el().played.at(-1), "blob:a");
  two.el().fire("error");
  assert.equal(two.el().played.at(-1), "blob:zh:b", "第二遍报错后卡住了");
});

console.log("loop-repeat tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
