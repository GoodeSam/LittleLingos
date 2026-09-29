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
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const createPlayback = (d) => require(join(ROOT, "audio-playback.js")).create(d);   // 原 ll:audio-playback

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");


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
    // 手机拒了这一段就是这个样子：iOS 在非手势路径上会 reject（NotAllowedError）。
    // 默认成功；把 rejectNextPlay 打开就模拟被拒。
    play() {
      this.played.push(this._src);
      this.paused = false;
      if (this.rejectNextPlay) { this.rejectNextPlay = false; return Promise.reject(new Error("NotAllowedError")); }
      return Promise.resolve();
    }
    pause() { this.paused = true; }
    fire(name) { for (const h of [...(this._handlers[name] || [])]) h({ target: this }); }
  };
}

// A fake system voice that records every utterance and every cancel(), so the
// tests can prove the Chinese cue was spoken, in Chinese, and silenced on stop.
function fakeSpeech() {
  const spoken = [];
  let cancels = 0;
  const synth = {
    speak: u => spoken.push(u),
    cancel: () => { cancels++; },
    get cancels() { return cancels; },
    spoken,
  };
  class Utterance { constructor(text) { this.text = text; this.lang = ""; } }
  return { synth, Utterance };
}

// 锁屏 / 通知栏上的播放条（浏览器的 Media Session）。记下每个键的处理函数，
// 测试用 press() 模拟家长在锁屏上按了一下。
function fakeMediaSession() {
  const handlers = {};
  return {
    metadata: null,
    playbackState: "none",
    setActionHandler(name, fn) { handlers[name] = fn; },
    press(name) {
      const h = handlers[name];
      if (typeof h !== "function") throw new Error(`锁屏上没有「${name}」这个键`);
      h({ action: name });
    },
  };
}
class FakeMediaMetadata { constructor(o) { Object.assign(this, o || {}); } }

async function loadModule({ withAudio = ["a", "b", "c"], presetIds = [], speech = true,
                            mediaSession = null, silenceUrl = null, onLoopState = null, onLoopPhase = null } = {}) {
  // 2026-09-28（ADR 0009 第十六块）：整块搬进 audio-loop.js，九个依赖由 create(deps) 传入。
  const made = [];
  const timers = [];
  const ctx = {
    console,
    Audio: fakeAudioClass(made),
    // 预设短语的音频是随应用下发的文件，不在 IndexedDB 里。
    isAudioBacked: item => presetIds.includes(item && item.id),
    // ll:audio-playback 的真实源码跑进同一个 realm（见下）。playableUrlFor()
    // 是纯同步的一小段判定，属于同一个行为契约 —— 手写一份桩会漂移，
    // 而这次的 bug 恰恰就是「在循环里重写了一遍那个判定，写漏了预设短语」。
    getAudio: async id => {
      if (!withAudio.includes(id)) return null;
      const b = new Blob([new Uint8Array(4)], { type: "audio/mpeg" });
      b._id = id;                       // 让地址读得懂，断言才能写成 blob:a
      return b;
    },
    URL: { createObjectURL: b => `blob:${b._id}`, revokeObjectURL: () => {} },
    queueMicrotask,
    Blob,
    stopAllAudio: () => {},
    // Controllable clock: the pause between phrases is the difference between
    // a practice session and a wall of sound, so tests drive it explicitly.
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clearTimeout: () => {},
    _timers: timers,
  };
  // 系统语音默认存在；传 speech:false 模拟没有它的设备。
  const sp = speech ? fakeSpeech() : null;
  if (sp) { ctx.speechSynthesis = sp.synth; ctx.SpeechSynthesisUtterance = sp.Utterance; }
  vm.createContext(ctx);
  // 2026-09-28（ADR 0009 第十一块）：audioUrlFor / primeAudioUrl / playableUrlFor
  // 搬进 audio-playback.js。仍然用**真的**那一份，只是改成 create(deps) 注入。
  Object.assign(ctx, createPlayback({
    getAudio: ctx.getAudio, isAudioBacked: ctx.isAudioBacked, URL: ctx.URL,
  }));
  Object.assign(ctx, require(join(ROOT, "audio-loop.js")).create({
    Audio: ctx.Audio,
    speech: ctx.speechSynthesis || null,
    Utterance: ctx.SpeechSynthesisUtterance || null,
    setTimeout: ctx.setTimeout,
    clearTimeout: ctx.clearTimeout,
    audioUrlFor: (id) => ctx.audioUrlFor(id),
    playableUrlFor: (item) => ctx.playableUrlFor(item),
    stopAllAudio: () => ctx.stopAllAudio(),
    provisionLoopCues: (q) => ctx.provisionLoopCues && ctx.provisionLoopCues(q),
    // 2026-09-29 熄屏也能放：三个新依赖，不传就和以前一样。
    mediaSession: mediaSession,
    MediaMetadata: mediaSession ? FakeMediaMetadata : null,
    silenceUrl: silenceUrl,
    onLoopState: onLoopState,
    onLoopPhase: onLoopPhase,
  }));
  for (const fn of ["startAudioLoop", "stopAudioLoop", "audioLoopPlaying"]) {
    assert.equal(typeof ctx[fn], "function", `module must define ${fn}()`);
  }
  const tick = () => { const t = timers.shift(); if (t) t.fn(); return !!t; };
  // 真实路径里，地址是列表渲染时备好的。测试里显式做这一步。
  // 真实路径里，地址是列表渲染时备好的（renderSavedScreen 给每一行 prime）。
  // 这里替它做一遍，之后 audioUrlFor() 才答得出东西。
  for (const id of withAudio) await ctx.primeAudioUrl(id);
  return { ctx, made, timers, tick, speech: sp ? sp.synth : null };
}

// ══ 1. 一点就开始，一句接一句 ═════════════════════════════════════════

test("点一下，第一句就开始放", async () => {
  const { ctx, made } = await loadModule();
  ctx.startAudioLoop(ITEMS);
  assert.equal(made.length, 1, "整场只该有一个音频元素");
  assert.deepEqual(made[0].played, ["blob:a"]);
  assert.equal(ctx.audioLoopPlaying(), true);
});

test("一句放完，隔一段停顿再放下一句", async () => {
  // 停顿是这个功能和「一堵声音墙」的区别：家长要在缝里跟着念一遍。
  const { ctx, made, timers, tick } = await loadModule();
  ctx.startAudioLoop(ITEMS);
  made[0].fire("ended");
  assert.equal(made[0].played.length, 1, "还没到时候就不该抢着放下一句");
  assert.ok(timers.length === 1 && timers[0].ms >= 800,
    `句间停顿要够跟读一遍，现在是 ${timers[0] && timers[0].ms}ms`);
  tick();
  assert.deepEqual(made[0].played, ["blob:a", "blob:b"]);
});

test("放到最后一句之后，从头再来", async () => {
  const { ctx, made, tick } = await loadModule();
  ctx.startAudioLoop(ITEMS);
  for (let i = 0; i < 3; i++) { made[0].fire("ended"); tick(); }
  assert.deepEqual(made[0].played, ["blob:a", "blob:b", "blob:c", "blob:a"],
    "循环的意思是它自己会转回来，不用家长再点一次");
});

test("整场只用一个音频元素", async () => {
  // iOS 上只有被那次点击解锁的元素能继续播。每句新建一个的话，
  // 第二句开始会被静默拒绝，循环停在第一句而屏幕上什么都不说。
  const { ctx, made, tick } = await loadModule();
  ctx.startAudioLoop(ITEMS);
  for (let i = 0; i < 5; i++) { made[0].fire("ended"); tick(); }
  assert.equal(made.length, 1, `建了 ${made.length} 个元素`);
});

// ══ 2. 没有声音的跳过 ═════════════════════════════════════════════════

test("没有声音的条目被跳过，不插进一段机器音", async () => {
  // 中间掺进浏览器朗读，会把一段听力练习打断成两种质感 —— 而 C1 已经
  // 判定那个声音不可接受。
  const { ctx, made, tick } = await loadModule({ withAudio: ["a", "c"] });
  ctx.startAudioLoop(ITEMS);
  made[0].fire("ended"); tick();
  assert.deepEqual(made[0].played, ["blob:a", "blob:c"], "b 没有声音，直接跳过");
});

test("一条声音都没有时，明确地不开始，而不是静默装死", async () => {
  const { ctx, made } = await loadModule({ withAudio: [] });
  assert.equal(ctx.startAudioLoop(ITEMS), false, "调用方要靠这个告诉家长为什么没动静");
  assert.equal(made.length, 0);
  assert.equal(ctx.audioLoopPlaying(), false);

  const ok = await loadModule();
  assert.equal(ok.ctx.startAudioLoop(ITEMS), true, "对照：有声音时必须真的开始");
});

test("空列表也不开始", async () => {
  const { ctx } = await loadModule();
  assert.equal(ctx.startAudioLoop([]), false);
  assert.equal(ctx.startAudioLoop(null), false);
  assert.equal(ctx.startAudioLoop(ITEMS), true, "对照：正常列表必须开始");
});

// ══ 3. 停 ═════════════════════════════════════════════════════════════

test("停下来之后，正在响的那一句也停", async () => {
  const { ctx, made } = await loadModule();
  ctx.startAudioLoop(ITEMS);
  ctx.stopAudioLoop();
  assert.equal(ctx.audioLoopPlaying(), false);
  assert.equal(made[0].paused, true, "只停调度不停声音，等于按了停止还在响");
});

test("停下来之后，已经排好的下一句不会再冒出来", async () => {
  // 停止时可能正卡在句间停顿里。那个定时器到点还照放的话，
  // 家长会在按下停止几秒后又听到一句。
  const { ctx, made, tick } = await loadModule();
  ctx.startAudioLoop(ITEMS);
  made[0].fire("ended");        // 排好了下一句
  ctx.stopAudioLoop();
  tick();                        // 定时器到点
  assert.deepEqual(made[0].played, ["blob:a"], "停了就是停了");
});

test("停完还能再开", async () => {
  const { ctx, made } = await loadModule();
  ctx.startAudioLoop(ITEMS);
  ctx.stopAudioLoop();
  assert.equal(ctx.startAudioLoop(ITEMS), true);
  assert.equal(ctx.audioLoopPlaying(), true);
  assert.equal(made[0].played.length, 2, "复用同一个元素，从头再放");
});

test("已经在放的时候再点开始，不会变成两条线同时放", async () => {
  const { ctx, made, tick } = await loadModule();
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
  const { ctx, made, tick } = await loadModule();
  ctx.startAudioLoop(ITEMS);
  made[0].fire("error");
  tick();
  assert.deepEqual(made[0].played, ["blob:a", "blob:b"], "一句坏掉不该让整场停下");
});

// ══ 4b. 预设短语也要能进循环 ═══════════════════════════════════════════

test("收藏进来的预设短语也能连续播", async () => {
  // 那 1204 段是随应用下发的文件，不在 IndexedDB 里。只认 IndexedDB 的话，
  // 一个全是预设短语的收藏列表会被判定成「一条都不能播」。
  const P1 = { id: "p1", en: "Time for bed." };
  const { ctx, made } = await loadModule({ withAudio: [], presetIds: ["p1"] });
  assert.equal(ctx.startAudioLoop([P1]), true, "预设短语必须能开始");
  assert.equal(made[0].played.length, 1);
  assert.match(made[0].played[0], /p1_normal\.mp3/, "放的是随应用下发的那个文件");
});

test("预设短语和自己生成的混在一起，都能放", async () => {
  const P1 = { id: "p1", en: "Time for bed." };
  const { ctx, made, tick } = await loadModule({ withAudio: ["a"], presetIds: ["p1"] });
  ctx.startAudioLoop([P1, ITEMS[0]]);
  made[0].fire("ended"); tick();
  assert.equal(made[0].played.length, 2, "两种来源都该被放出来");
  assert.match(made[0].played[0], /p1_normal\.mp3/);
  assert.equal(made[0].played[1], "blob:a");
});

test("整个收藏都是预设短语时，不该说「没有可播放的声音」", async () => {
  // 这正是家长报的那句话。
  const P1 = { id: "p1" }, P2 = { id: "p2" };
  const { ctx } = await loadModule({ withAudio: [], presetIds: ["p1", "p2"] });
  assert.equal(ctx.startAudioLoop([P1, P2]), true);
});

test("判断一条能不能播这件事，只有一处实现", async () => {
  // 复习卡的播放路径本来就分得清两种来源。循环里重写一遍就写漏了预设短语。
  // 2026-09-28（ADR 0009 第十六块）：这一块搬进 audio-loop.js 了。
  const src = readFileSync(join(ROOT, "audio-loop.js"), "utf8");
  assert.match(src, /playableUrlFor\(/, "循环必须用共用的那个判定");
  assert.ok(!/_normal\.mp3/.test(src),
    "预设短语的路径拼装不该在这个块里再出现一次 —— 两处拼装迟早会分叉");
});

// ══ 5. 界面接上了 ═════════════════════════════════════════════════════

test("收藏页有一个一键连续播放的入口", async () => {
  assert.match(html, /toggleAudioLoop\(|startAudioLoop\(/,
    "算得出来但没人点，等于没做");
  // 2026-09-28：按钮要分得清三种状态——没放 / 在放 / 暂停着。暂停着的时候写「继续」，
  // 不然家长按了一下停住，看着还是「连续播放全部」，以为要从头来。
  assert.match(html, /audioLoopPaused\(\)/, "收藏页没有问模块「是不是暂停着」，按钮画不出「继续」");
  assert.match(html, /继续/, "暂停之后按钮上没有「继续」");
  const at = html.indexOf("function renderSavedScreen");
  const body = html.slice(at, html.indexOf("\nfunction ", at + 10));
  assert.match(body, /AudioLoop/, "入口要在收藏页上，那是家长复习时待的地方");
});


// ══ 6. 先中文提示，停一下，再放英文 ═══════════════════════════════════
//
// 2026-09-07 之前，连播是「英文、停顿、英文」。家长在停顿里跟着念——
// 那是听力练习，不是记忆练习：他从头到尾没有一次要自己想出英文来。
// Pimsleur 的做法是先给母语提示、停顿、再给答案，停顿里人在检索而不是在听。
// 这一组把播放序列改成那个形状。改的只是顺序和停顿，不动基础设施。
//
// 第一句例外：它是被那次点击直接放出来的（iOS 只认这一次手势），所以
// 第一句先听一遍，从第二句起每一句都是「中文 → 停 → 英文」；转回来时
// 第一句也照此办理。
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   1. 一句英文放完，家长先听到下一句的中文，屏幕上也看得到。然后是一段
//      够他自己想出英文的安静，之后才放英文——他在停顿里是在回忆。
//
//   2. 中文提示念的是中文。念成英文等于把答案先说了。
//
//   3. 手机没有系统语音时，中文照样显示在屏幕上，循环照常往下走。
//
//   4. 按下停止，正在念的中文提示也立刻停。
//
//   5. 收藏页上那个按钮真的把提示接到了屏幕上。

const ZH_ITEMS = [
  { id: "a", en: "Time for bed.", zh: "该睡觉了" },
  { id: "b", en: "Wash your hands.", zh: "洗手" },
  { id: "c", en: "Good job!", zh: "做得好" },
];

test("一句放完，先念下一句的中文，再停够时间想，然后才放英文", async () => {
  const { ctx, made, timers, tick, speech } = await loadModule();
  ctx.startAudioLoop(ZH_ITEMS);
  made[0].fire("ended");
  assert.equal(speech.spoken.length, 1, "英文一停，下一句的中文提示就该念出来");
  assert.equal(speech.spoken[0].text, "洗手", "念的是下一句的中文，不是刚放完那句的");
  assert.equal(made[0].played.length, 1, "中文提示还在，英文不能抢着放");
  assert.ok(timers.length === 1 && timers[0].ms >= 3000,
    `停顿要够家长自己想出英文，现在是 ${timers[0] && timers[0].ms}ms`);
  tick();
  assert.deepEqual(made[0].played, ["blob:a", "blob:b"], "停顿到了才放英文");
});

test("中文提示念的是中文", async () => {
  const { ctx, made, speech } = await loadModule();
  ctx.startAudioLoop(ZH_ITEMS);
  made[0].fire("ended");
  assert.match(speech.spoken[0].lang, /^zh/, `提示的语言是 ${JSON.stringify(speech.spoken[0].lang)}`);
});

test("屏幕上同步显示正在提示的那句中文", async () => {
  const shown = [];
  const { ctx, made, tick } = await loadModule();
  ctx.startAudioLoop(ZH_ITEMS, item => shown.push(item.zh));
  assert.deepEqual(shown, ["该睡觉了"], "第一句放的时候，屏幕就该说明放的是哪句");
  made[0].fire("ended");
  assert.deepEqual(shown, ["该睡觉了", "洗手"], "英文一停，屏幕先换成下一句的中文");
  tick();
  assert.deepEqual(shown, ["该睡觉了", "洗手"], "英文放出来时不再换字——家长在对答案");
});

test("没有中文的条目，跳过提示但照常停顿、照常放英文", async () => {
  // 旧收藏可能没有中文。不能因此卡住，也不能念一句空的。
  const { ctx, made, tick, speech } = await loadModule();
  ctx.startAudioLoop([ZH_ITEMS[0], { id: "b", en: "Wash your hands." }]);
  made[0].fire("ended");
  assert.equal(speech.spoken.length, 0, "没有中文就不念");
  tick();
  assert.deepEqual(made[0].played, ["blob:a", "blob:b"]);
});

test("没有系统语音的手机上，中文照样显示，循环照常走", async () => {
  const shown = [];
  const { ctx, made, tick } = await loadModule({ speech: false });
  assert.equal(ctx.startAudioLoop(ZH_ITEMS, item => shown.push(item.zh)), true);
  made[0].fire("ended");
  assert.deepEqual(shown, ["该睡觉了", "洗手"], "念不出来，也得显示出来");
  tick();
  assert.deepEqual(made[0].played, ["blob:a", "blob:b"], "没有语音不该让循环停下");
});

test("按停止，正在念的中文提示也停", async () => {
  const { ctx, made, speech } = await loadModule();
  ctx.startAudioLoop(ZH_ITEMS);
  made[0].fire("ended");            // 中文提示开始念
  const before = speech.cancels;
  ctx.stopAudioLoop();
  assert.ok(speech.cancels > before, "按了停止，中文提示还在念，等于没停");
});

test("从最后一句转回第一句时，第一句也先给中文提示", async () => {
  const { ctx, made, tick, speech } = await loadModule();
  ctx.startAudioLoop(ZH_ITEMS);
  for (let i = 0; i < 2; i++) { made[0].fire("ended"); tick(); }
  made[0].fire("ended");            // c 放完，该转回 a
  assert.equal(speech.spoken.at(-1).text, "该睡觉了", "第一句只在开头例外一次，转回来时照样先提示");
});

test("收藏页把中文提示接到了屏幕上", async () => {
  const at = html.indexOf("function renderSavedScreen");
  const body = html.slice(at, html.indexOf("\nfunction ", at + 10));
  assert.match(body, /loop-cue/, "循环里算出了提示，收藏页却没地方显示它，等于没做");
});

// ══ 暂停要真的是暂停：再按一下从停的地方接着放 ═══════════════════════
// 2026-09-28 真机报上来的：连播按一下停住，再按一下从第一句重来。家长在第七句
// 被叫走，回来得从头听六句。和 09-22 那次「⏸ 变重播」是同一类问题。
// 「停掉」（别的播放键让路、切页面、从通知进来兜底）仍然是停掉——只有按钮自己
// 那一下是暂停。

// 起播并推进到第二句正在放英文的状态；返回元素
async function playingSecondClip(ctx, made, tick, items) {
  assert.equal(ctx.startAudioLoop(items, () => {}), true);
  const el = made[made.length - 1];
  el.fire("ended");                           // 第一句放完 → 念第二句的中文
  for (let i = 0; i < 3; i++) tick();         // 中文念完、停顿过去 → 放第二句的英文
  await new Promise(r => queueMicrotask(r));
  assert.equal(el.played.at(-1), "blob:b", "对照：现在该在放第二句的英文");
  return el;
}
const THREE = [{ id: "a", zh: "洗手" }, { id: "b", zh: "睡觉" }, { id: "c", zh: "吃饭" }];

test("放到第二句时按一下：声音停住，但位置留着——是暂停，不是停掉", async () => {
  const { ctx, made, tick } = await loadModule();
  const el = await playingSecondClip(ctx, made, tick, THREE);
  assert.equal(ctx.toggleAudioLoop(THREE, () => {}), false, "第二下该返回「没在放」");
  assert.equal(el.paused, true, "按了暂停声音还在响");
  assert.equal(ctx.audioLoopPlaying(), false);
  assert.equal(ctx.audioLoopPaused(), true, "模块不知道自己是暂停着的——按钮就没法写「继续」");
});

test("再按一下：从暂停的地方接着放第二句，不从第一句重来", async () => {
  const { ctx, made, tick } = await loadModule();
  const cued = [];
  const el = await playingSecondClip(ctx, made, tick, THREE);
  ctx.toggleAudioLoop(THREE, it => cued.push(it.id));       // 暂停
  const before = el.played.length;
  assert.equal(ctx.toggleAudioLoop(THREE, it => cued.push(it.id)), true, "第三下该接着放");
  await new Promise(r => queueMicrotask(r));
  assert.equal(el.paused, false, "按了继续，声音没响");
  assert.equal(el.src, "blob:b", "接着放的不是暂停时那一句——从头重来了");
  assert.equal(el.played.slice(before).filter(u => u === "blob:a").length, 0, "又从第一句开始放了");
  assert.deepEqual(cued, [], "接着放的时候不该重新提示第一句");
  assert.equal(ctx.audioLoopPlaying(), true);
  assert.equal(ctx.audioLoopPaused(), false);
});

test("暂停在中文提示念到一半（手机合成）：接着放时把这句中文重新念一遍，再放它的英文", async () => {
  const { ctx, made, speech } = await loadModule();
  ctx.startAudioLoop(THREE, () => {});
  const el = made[made.length - 1];
  el.fire("ended");                           // 第一句放完 → 手机开始念第二句的中文
  assert.equal(speech.spoken.length, 1, "对照：中文提示该在念");
  ctx.toggleAudioLoop(THREE, () => {});       // 暂停：念到一半
  assert.ok(speech.cancels >= 1, "暂停了中文还在念");
  ctx.toggleAudioLoop(THREE, () => {});       // 继续
  assert.equal(speech.spoken.length, 2, "接着放的时候没有把念到一半的中文重新念一遍");
  assert.equal(String(speech.spoken.at(-1).text), "睡觉", "重新念的不是第二句的中文");
});

test("暂停期间收藏列表变了（删了一句）：再按是按新列表从头开始，不是接着旧队列", async () => {
  const { ctx, made, tick } = await loadModule();
  const cued = [];
  const el = await playingSecondClip(ctx, made, tick, THREE);
  ctx.toggleAudioLoop(THREE, () => {});       // 暂停
  const TWO = [THREE[0], THREE[2]];           // 第二句被删了
  assert.equal(ctx.toggleAudioLoop(TWO, it => cued.push(it.id)), true);
  assert.equal(el.src, "blob:a", "列表变了却还接着旧队列——会放出一句已经删掉的");
  assert.deepEqual(cued, ["a"]);
});

// ══ 从通知点开去连播：得知道此刻有没有真的在出声 ═══════════════════════
// iOS 上 App 本来关着时不让直接出声（C6）：起播 1.5 秒后要看一眼有没有声音，
// 没有就停掉并告诉家长点哪里。2026-09-28 发现 openFromPush 里直接读模块私有的 loopEl，
// 第十六块搬走之后那里是 ReferenceError——连播在 iOS 上会显示「停止」却一片安静。

test("连播起来之后模块能回答「此刻在出声」；停了之后答「没有」", async () => {
  const { ctx } = await loadModule();
  assert.equal(typeof ctx.loopAudible, "function", "模块没有「此刻在出声吗」这个问法");
  assert.equal(ctx.loopAudible(), false, "还没起播就说在出声");
  ctx.startAudioLoop([{ id: "a", zh: "洗手" }], () => {});
  assert.equal(ctx.loopAudible(), true, "起播了却说没在出声——从通知进来会被当成 iOS 拦了而停掉");
  ctx.stopAudioLoop();
  assert.equal(ctx.loopAudible(), false, "停了还说在出声");
});

// ══ 一段放不出来时，整轮不能就此卡死 ═══════════════════════════════════
// 2026-09-28 搬这一块（ADR 0009 第十六块）时发现：09-11 重做时序时删掉了
// scheduleNextLoopClip()，两处调用却留在原地——「这一段放不出来就往下走」
// 这条路踩下去抛 ReferenceError。家长看到的是：连播按钮亮着，声音再也不响，
// 界面什么都不说，而且他没有任何办法知道为什么。

test("手机拒了某一段（iOS 常有），跳到下一句，不是整轮哑在这里", async () => {
  const { ctx, made, tick } = await loadModule();
  const items = [{ id: "a", zh: "洗手" }, { id: "b", zh: "睡觉" }, { id: "c", zh: "吃饭" }];
  assert.equal(ctx.startAudioLoop(items, () => {}), true);
  // 同一个元素整轮复用（iOS 那条规矩），所以停了再起拿到的还是它。
  ctx.stopAudioLoop();
  const el = made[made.length - 1];
  el.rejectNextPlay = true;
  const before = el.played.length;
  assert.equal(ctx.startAudioLoop(items, () => {}), true);
  await new Promise(r => queueMicrotask(r));
  await new Promise(r => queueMicrotask(r));
  for (let i = 0; i < 3; i++) tick();     // 下一句的中文提示念完，轮到它的英文
  // 被拒之后要往下走。走不动的话，这个元素不会再被 play 第二次，
  // 声音从此不再响——而按钮仍然显示「正在连播」。
  assert.ok(el.played.length > before + 1,
    `被拒的那一段之后再没有任何一段开始放（played 停在 ${el.played.length - before} 段）—— 整轮哑在这里`);
});

test("队列里某一句的地址中途没了，跳过它，不是整轮哑在这里", async () => {
  // 生成好的地址是会被浏览器清掉的（releaseAudioUrls 就是干这个的）。
  const { ctx, made, tick } = await loadModule({ withAudio: ["a", "b"] });
  const items = [{ id: "a", zh: "洗手" }, { id: "b", zh: "睡觉" }];
  const cued = [];
  assert.equal(ctx.startAudioLoop(items, it => cued.push(it.id)), true);
  ctx.releaseAudioUrls();                 // 这一轮进行中，地址全没了
  const el = made[made.length - 1];
  el.fire("ended");                       // 第一句放完 → 念第二句的中文
  const before = cued.length;
  // 第二句也拿不到地址。它必须继续往下推到再下一句（这里就是绕回第一句），
  // 不能停在一句放不出来的地方 —— 停住的样子是：按钮亮着，永远没有声音。
  for (let i = 0; i < 6 && cued.length <= before; i++) { tick(); await new Promise(r => queueMicrotask(r)); }
  assert.ok(cued.length > before,
    `一句拿不到地址之后就再没有推进过（提示停在第 ${cued.length} 句）—— 整轮哑在这里`);
  assert.equal(ctx.audioLoopPlaying(), true, "一句没地址就把整轮停掉了");
});

// ── Runner ───────────────────────────────────────────────
// ══ 中文提示：音质，和不许抢跑 ═══════════════════════════════════════
//
// Victor 2026-09-11 报的两件事：
//   一、中文提示是手机自带的语音合成念的，音质差。国产浏览器和微信里
//       尤其糟，有的干脆没有中文嗓子。
//   二、中文还没念完英文就开始了，两个声音叠在一起听不清。
//
// 第二件的原因很具体：原来的 scheduleNextLoopClip() 念出中文之后，直接起了
// 一个 4 秒的固定计时器。它量的是「从开口那一刻算起 4 秒」，而不是「念完了
// 再等」。句子一长，或者设备语音慢，4 秒到了人还在念，英文就压上去了。
//
// 两件事的修法是同一个：中文也走 Azure 生成的音频，用同一个 audio 元素放，
// 靠它的 ended 事件接续——然后停 2 秒，再放英文。

test("中文提示优先用生成好的音频，不用手机自带的合成", async () => {
  const { ctx, made, speech } = await loadModule({ withAudio: ["a", "b", "c", "zh:b"] });
  ctx.startAudioLoop(ITEMS);
  made[0].fire("ended");                 // 第一句英文放完，该提示第二句了
  assert.ok(made[0].played.includes("blob:zh:b"),
    `中文提示没有走生成好的音频：${made[0].played.join(" → ")}`);
  assert.equal(speech.spoken.length, 0,
    "有现成的中文音频却还是用了手机自带的合成");
});

test("中文的音频放完之后，停两秒才放英文", async () => {
  // 「停两秒」是家长的反应时间：他要在这个缝里自己先说一遍。
  const { ctx, made, timers, tick } = await loadModule({ withAudio: ["a", "b", "c", "zh:b"] });
  ctx.startAudioLoop(ITEMS);
  made[0].fire("ended");                 // → 开始放中文
  assert.equal(made[0].played[made[0].played.length - 1], "blob:zh:b");
  assert.equal(timers.length, 0, "中文才刚开始念，就已经在给英文倒计时了");

  made[0].fire("ended");                 // → 中文念完了
  assert.equal(timers.length, 1, "中文念完之后没有安排停顿");
  assert.ok(timers[0].ms >= 2000, `停顿只有 ${timers[0].ms}ms，不够家长反应`);
  tick();
  assert.equal(made[0].played[made[0].played.length - 1], "blob:b",
    "停顿结束后没有放英文");
});

test("没有中文音频时退回手机合成，也不按固定时间抢跑", async () => {
  // 退回这条路上同样不能「从开口算 N 秒」。念完了要么靠 onend，要么靠一个
  // 兜底计时——而兜底的那个必须把停顿也算进去，不能刚好卡在人还在念的时候。
  const { ctx, made, timers, speech } = await loadModule();  // 没有 zh: 片段
  ctx.startAudioLoop(ZH_ITEMS);
  made[0].fire("ended");
  assert.equal(speech.spoken.length, 1, "没有音频时该退回手机合成");
  assert.equal(speech.spoken[0].lang, "zh-CN", "退回时没有说这是中文");
  assert.equal(timers.length, 1, "退回这条路上该有一个兜底计时");
  assert.ok(timers[0].ms >= 2000,
    `兜底计时只有 ${timers[0].ms}ms——人还在念，英文就压上去了`);

  // onend 来了就按它走，不等兜底
  const u = speech.spoken[0];
  if (typeof u.onend === "function") {
    u.onend();
    const last = timers[timers.length - 1];
    assert.ok(last.ms >= 2000, `念完之后的停顿只有 ${last.ms}ms`);
  }
});

test("中文和英文用同一个音频元素", async () => {
  // iOS 上只有被那次点击解锁的元素能继续播。中文另起一个 new Audio()，
  // Safari 会静默拒绝，循环会在第一句之后停住，屏幕上什么也不说。
  const { ctx, made } = await loadModule({ withAudio: ["a", "b", "c", "zh:b"] });
  ctx.startAudioLoop(ITEMS);
  made[0].fire("ended");
  assert.equal(made.length, 1, `中文提示另起了一个音频元素，一共 ${made.length} 个`);
});

test("按停止时，正在念的中文也要停", async () => {
  const { ctx, made, speech } = await loadModule({ withAudio: ["a", "b", "c", "zh:b"] });
  ctx.startAudioLoop(ITEMS);
  made[0].fire("ended");                 // 中文在放
  ctx.stopAudioLoop();
  assert.equal(made[0].paused, true, "停止之后中文还在放");
  assert.ok(speech.cancels >= 1, "手机合成那条路也要一起停");
});


// ══ 熄屏也能放 ═══════════════════════════════════════════════════════
// 2026-09-29 Victor：「让收藏下面的连续播放在手机熄屏的情况下也可以播放」。
// 手机一熄屏，网页的计时器就不可靠了（iOS 会把页面挂起，安卓 Chrome 会把
// 计时器拖慢），而连播里「中文念完 → 停 2 秒 → 英文」那 2 秒正是一个计时器。
// 音频元素本身在放的东西，系统会让它放下去；停 2 秒时元素是闲着的，正是
// 系统把页面挂起的时机。所以停顿改成用同一个元素放一段无声音频占住，靠它
// 的 ended 接续——整轮从头到尾元素都在放，和一个播客 App 没有区别。
// 另外把「现在放的是哪句」告诉系统的播放条（Media Session）：锁屏上能看到
// 这句英文、能按暂停 / 播放，且系统会把这个页面当成正在放音乐的 App 对待。
//
// 这一组测试对应的用户情境（不含函数名）：
//   1. 连播开着，锁屏上显示正在放的那句英文；念中文提示时只见中文、英文先不露。
//   2. 在锁屏上按暂停，声音停住；再按播放，从停的地方接着放，屏幕上的按钮也跟着变。
//   3. 停止之后锁屏上的播放条撤掉。
//   4. 句间停顿不再空等，是一段无声音频在放；那段放不出来也不能卡住。
//   5. 屏幕上：英文开始放时才把英文亮出来，中文提示阶段先不露（那 2 秒是让家长自己想的）。

const ZH3 = [
  { id: "a", en: "Wash your hands.", zh: "洗手" },
  { id: "b", en: "Time for bed.", zh: "睡觉" },
  { id: "c", en: "Let's eat.", zh: "吃饭" },
];
const WITH_ZH = ["a", "b", "c", "zh:a", "zh:b", "zh:c"];
const flush = () => new Promise(r => setImmediate(r));

test("连播一开始，锁屏 / 通知栏的播放条上就是正在放的这句英文", async () => {
  const ms = fakeMediaSession();
  const { ctx } = await loadModule({ mediaSession: ms });
  ctx.startAudioLoop(ZH3, () => {});
  assert.ok(ms.metadata, "系统的播放条上什么都没写——熄屏后家长不知道在放什么，也没有键可按");
  assert.equal(ms.metadata.title, "Wash your hands.", "播放条的标题不是正在放的英文");
  assert.equal(ms.playbackState, "playing", "没告诉系统「正在放」——锁屏上会显示成暂停");
});

test("念中文提示时，锁屏上只见中文；英文开始放了才换成英文", async () => {
  const ms = fakeMediaSession();
  const { ctx, made } = await loadModule({ mediaSession: ms, withAudio: WITH_ZH, silenceUrl: "blob:silence" });
  ctx.startAudioLoop(ZH3, () => {});
  const el = made[0];
  el.fire("ended");                                    // 第一句英文放完 → 念第二句中文
  assert.equal(el.src, "blob:zh:b", "对照：现在该在念第二句的中文");
  assert.equal(ms.metadata.title, "睡觉", "念中文时播放条该显示这句中文——这是给家长的提示");
  assert.ok(!Object.values(ms.metadata).includes("Time for bed."),
    "中文提示阶段把英文写在播放条上了——答案提前露出来，那 2 秒就白停了");
  el.fire("ended");                                    // 中文念完 → 无声停顿
  el.fire("ended");                                    // 停顿过去 → 放英文
  assert.equal(el.src, "blob:b", "对照：现在该在放第二句的英文");
  assert.equal(ms.metadata.title, "Time for bed.", "英文放了，播放条还停在中文上");
});

test("锁屏上按暂停：声音停住、位置留着；再按播放：从停的地方接着放", async () => {
  const ms = fakeMediaSession();
  const { ctx, made } = await loadModule({ mediaSession: ms });
  ctx.startAudioLoop(ZH3, () => {});
  const el = made[0];
  ms.press("pause");
  assert.equal(el.paused, true, "锁屏上按了暂停，声音还在响");
  assert.equal(ctx.audioLoopPlaying(), false);
  assert.equal(ctx.audioLoopPaused(), true, "模块不知道自己被锁屏暂停了——屏幕上的按钮会写错");
  assert.equal(ms.playbackState, "paused", "锁屏上的键还显示成「正在放」");
  const before = el.played.length;
  ms.press("play");
  await flush();
  assert.equal(el.paused, false, "锁屏上按了播放，没声音");
  assert.equal(el.played.length, before + 1, "按播放之后元素没有再放");
  assert.equal(el.src, "blob:a", "接着放的不是暂停时那一句");
  assert.equal(ctx.audioLoopPlaying(), true);
  assert.equal(ms.playbackState, "playing");
});

test("锁屏上按了暂停 / 播放，屏幕上的按钮也要跟着变", async () => {
  // 按钮的字（⏸ 暂停 / ▶ 继续）是收藏页画的；锁屏那一下没经过按钮，
  // 模块得主动说一声，不然回到屏幕上会看到「⏸ 暂停」而其实早停了。
  const ms = fakeMediaSession();
  const states = [];
  const { ctx } = await loadModule({ mediaSession: ms, onLoopState: s => states.push(s) });
  ctx.startAudioLoop(ZH3, () => {});
  assert.deepEqual(states, ["playing"], "起播时该告诉屏幕一声（对照）");
  ms.press("pause");
  assert.equal(states.at(-1), "paused", "锁屏暂停了，屏幕没被告知");
  ms.press("play");
  assert.equal(states.at(-1), "playing", "锁屏继续了，屏幕没被告知");
  ctx.stopAudioLoop();
  assert.equal(states.at(-1), "stopped", "停掉了，屏幕没被告知");
});

test("停止连播之后，锁屏上的播放条撤掉", async () => {
  const ms = fakeMediaSession();
  const { ctx } = await loadModule({ mediaSession: ms });
  ctx.startAudioLoop(ZH3, () => {});
  assert.equal(ms.playbackState, "playing", "对照：起播后该是「正在放」");
  ctx.stopAudioLoop();
  assert.equal(ms.playbackState, "none", "停了，锁屏上还挂着一条像在放的播放条");
});

test("句间停顿是一段无声音频在放，不是空等一个计时器", async () => {
  const { ctx, made, timers } = await loadModule({ withAudio: WITH_ZH, silenceUrl: "blob:silence" });
  ctx.startAudioLoop(ZH3, () => {});
  const el = made[0];
  el.fire("ended");                                    // 英文 a 放完 → 中文 b
  assert.equal(el.src, "blob:zh:b", "对照：该在念第二句中文");
  el.fire("ended");                                    // 中文念完 → 停顿
  assert.equal(el.played.at(-1), "blob:silence", "停顿没有用无声音频占住——熄屏后页面会在这 2 秒里被挂起");
  assert.equal(timers.length, 0, "还是起了计时器——熄屏后它不会准时响");
  assert.equal(made.length, 1, "无声那段另起了一个元素——iOS 上不是被点击解锁的那个放不出来");
  el.fire("ended");                                    // 停顿过去 → 英文
  assert.equal(el.played.at(-1), "blob:b", "无声放完没有接着放英文");
});

test("无声那段放不出来（被拒、出错），直接放英文，不能卡在停顿里", async () => {
  const { ctx, made } = await loadModule({ withAudio: WITH_ZH, silenceUrl: "blob:silence" });
  ctx.startAudioLoop(ZH3, () => {});
  const el = made[0];
  el.fire("ended");                                    // → 中文 b
  el.rejectNextPlay = true;
  el.fire("ended");                                    // 中文念完 → 无声被拒
  await flush();
  assert.equal(el.played.at(-1), "blob:b", "无声被拒之后没有放英文——整轮卡在这里，按钮还亮着");
  el.fire("ended");                                    // 英文 b 放完 → 中文 c
  el.fire("ended");                                    // 中文念完 → 无声
  assert.equal(el.src, "blob:silence", "对照：该在放无声");
  el.fire("error");                                    // 无声出错
  assert.equal(el.played.at(-1), "blob:c", "无声出错之后没有放英文");
});

test("无声停顿里按了暂停，再按继续：接着停顿，然后放这句的英文，不跳过", async () => {
  const { ctx, made } = await loadModule({ withAudio: WITH_ZH, silenceUrl: "blob:silence" });
  ctx.startAudioLoop(ZH3, () => {});
  const el = made[0];
  el.fire("ended"); el.fire("ended");                  // → 无声停顿中
  assert.equal(el.src, "blob:silence", "对照");
  ctx.toggleAudioLoop(ZH3, () => {});                  // 暂停
  assert.equal(el.paused, true);
  ctx.toggleAudioLoop(ZH3, () => {});                  // 继续
  await flush();
  assert.equal(el.paused, false);
  el.fire("ended");                                    // 停顿过去
  assert.equal(el.played.at(-1), "blob:b", "继续之后跳过了这句的英文");
});

test("无声片段是一段合法的 WAV，长度正好是句间停顿那么久", async () => {
  // 不随应用带文件：一段全零的 PCM 在代码里现做，几十行字节头。iOS 与安卓都认 WAV。
  const lib = require(join(ROOT, "audio-loop.js"));
  assert.equal(typeof lib.silenceWavUrl, "function", "没有造无声片段的办法");
  let blob = null;
  const url = lib.silenceWavUrl(2000, { Blob, URL: { createObjectURL: b => { blob = b; return "blob:silence"; } } });
  assert.equal(url, "blob:silence");
  assert.ok(blob && blob.type === "audio/wav", `不是 WAV（type=${blob && blob.type}）`);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const tag = (at) => String.fromCharCode(...bytes.slice(at, at + 4));
  assert.equal(tag(0), "RIFF"); assert.equal(tag(8), "WAVE"); assert.equal(tag(36), "data");
  const view = new DataView(bytes.buffer);
  const sampleRate = view.getUint32(24, true);
  const dataLen = view.getUint32(40, true);
  assert.equal(bytes.length, 44 + dataLen, "data 块长度和文件不符——播放器会报格式错");
  assert.equal(dataLen, sampleRate * 2, `无声长度是 ${dataLen / sampleRate} 秒，不是 2 秒`);
});

// ══ 屏幕上显示正在放的英文 ═══════════════════════════════════════════
// 2026-09-29 Victor：「当下正在播放的那一条的英文文字也显示出来」。
// 显示的时机跟着声音走：中文提示阶段只给中文（那 2 秒是让家长自己先说的，
// 英文先露出来就没得想了），英文一开始放，就把英文亮出来。

test("第一句英文开始放时，屏幕上就能看到这句英文", async () => {
  const phases = [];
  const { ctx } = await loadModule({ onLoopPhase: (it, phase) => phases.push([it.id, phase]) });
  ctx.startAudioLoop(ZH3, () => {});
  assert.deepEqual(phases.at(-1), ["a", "en"], "起播时没有告诉屏幕「正在放 a 的英文」");
});

test("之后每句：先只给中文提示，英文开始放时才把英文亮出来", async () => {
  const phases = [];
  const { ctx, made } = await loadModule({ withAudio: WITH_ZH, silenceUrl: "blob:silence",
                                            onLoopPhase: (it, phase) => phases.push([it.id, phase]) });
  ctx.startAudioLoop(ZH3, () => {});
  const el = made[0];
  el.fire("ended");                                    // → 念第二句中文
  assert.deepEqual(phases.at(-1), ["b", "zh"], "念中文时没有告诉屏幕这是提示阶段");
  assert.ok(!phases.some(c => c[0] === "b" && c[1] === "en"), "英文还没放就把英文亮出来了");
  el.fire("ended"); el.fire("ended");                  // 中文念完、停顿过去 → 英文
  assert.deepEqual(phases.at(-1), ["b", "en"], "英文放了，屏幕上没有亮出英文");
});

test("收藏页把英文接到了屏幕上，且中文提示阶段不露英文", () => {
  const at = html.indexOf("function renderSavedScreen");
  const body = html.slice(at, html.indexOf("\nfunction ", at + 10));
  assert.match(body, /loop-cue-en/, "循环报了英文，收藏页却没地方显示它，等于没做");
  // 画字的那个函数可以在 renderSavedScreen 外面，但得真的取这句的英文
  assert.match(html, /loop-cue-en[\s\S]{0,600}\.en\b/, "收藏页没有取这句的英文来显示");
  assert.match(html, /onLoopPhase\s*:/, "index.html 没把「此刻放到哪一段」接给屏幕");
});

console.log("audio-loop tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
