#!/usr/bin/env node
// Behavioral tests for handing a stored clip to the player — the last step of
// ADR 0003, and the first one a parent can hear.
//
// Zero-dependency: the module is extracted from index.html between its markers
// and run in a vm context, per test/audio-store.test.mjs.
//
// WHY THIS MODULE EXISTS AT ALL, rather than just reading the clip when the
// play button is tapped: reading from IndexedDB is asynchronous, and on iOS an
// audio element that starts playing after an await may no longer count as
// "started by that tap" — Safari can refuse it silently. The whole point of
// paying for these clips is that they play. So the Blob is turned into a
// playable address when the card RENDERS, and the tap itself stays
// synchronous, exactly as it is today for the 1204 preset phrases.
//
// ⚠️ That iOS rule is the reason for the design, and it is NOT verified here.
// Node has no audio and no gesture model. What these tests cover is that a
// synchronous lookup is possible and correct; whether Safari would have
// refused the async version is a question only a real iPhone answers.
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   1. 家长复习一条自己收藏的翻译，听到的是真人质感的声音——就是保存时
//      生成、存在这台手机上的那一段。不联网也一样。
//
//   2. 那一条没有声音（生成失败过、或者是从备份恢复来的），照样能点，
//      只是退回浏览器朗读。没有一条是点了没反应的。
//
//   3. 预设短语仍然走它原来那条路。它们的 mp3 是随应用一起下发的，
//      不在这套按条生成的机制里。
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import assert from "node:assert/strict";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");

const START = "/* ll:audio-playback:start */";
const END = "/* ll:audio-playback:end */";

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

const ID = "t_1725300000000";
const mp3 = () => new Blob([new Uint8Array(64).fill(0xff)], { type: "audio/mpeg" });

function fakeStore({ present = [ID], failGet = false } = {}) {
  const map = new Map(present.map(id => [id, mp3()]));
  return { getAudio: async id => (failGet ? null : (map.get(id) ?? null)) };
}

function loadModule({ store = fakeStore() } = {}) {
  const s = html.indexOf(START), e = html.indexOf(END);
  assert.ok(s !== -1 && e !== -1, `index.html must contain ${START} … ${END} markers`);
  const made = [], revoked = [];
  let seq = 0;
  const ctx = {
    ...store,
    console,
    queueMicrotask,
    Blob,
    URL: {
      createObjectURL: b => { const u = `blob:fake/${++seq}`; made.push({ url: u, blob: b }); return u; },
      revokeObjectURL: u => revoked.push(u),
    },
  };
  vm.createContext(ctx);
  vm.runInContext(html.slice(s, e + END.length), ctx);
  for (const fn of ["primeAudioUrl", "audioUrlFor", "releaseAudioUrls"]) {
    assert.equal(typeof ctx[fn], "function", `module must define ${fn}()`);
  }
  return { ctx, made, revoked };
}

// ══ 1. 准备好之后，点一下就能立刻播 ═══════════════════════════════════

test("准备过的条目，取地址这一步是同步的——不需要等", async () => {
  // 这一条是整个模块存在的理由。iOS 上，一次点击之后如果还要等一个
  // 异步读取才开始播，那次播放可能被判定为「不是这次点击发起的」而
  // 被静默拒绝。所以点击那一刻必须已经有地址在手。
  const { ctx } = loadModule();
  await ctx.primeAudioUrl(ID);
  const url = ctx.audioUrlFor(ID);          // 注意：没有 await
  assert.equal(typeof url, "string");
  assert.ok(url.length > 0, "点击那一刻必须已经拿得到地址");
});

test("准备之前同步取，得到的是「没有」而不是报错", async () => {
  const { ctx } = loadModule();
  assert.equal(ctx.audioUrlFor(ID), null, "调用方据此退回浏览器朗读");
  // 对照：准备过之后必须真的给得出来，否则上面那个 null
  // 只说明这个模块什么都给不出来。
  await ctx.primeAudioUrl(ID);
  assert.ok(ctx.audioUrlFor(ID), "对照：准备过就必须拿得到");
});

test("拿到的地址是那段音频本身变来的", async () => {
  const { ctx, made } = loadModule();
  await ctx.primeAudioUrl(ID);
  assert.equal(made.length, 1);
  assert.ok(made[0].blob instanceof Blob, "必须由存下来的那段音频生成，不是别的什么");
  assert.equal(ctx.audioUrlFor(ID), made[0].url);
});

// ══ 2. 没有声音的条目，安静地退回 ═════════════════════════════════════

test("这条根本没存过声音时，准备的结果是「没有」", async () => {
  // 生成失败过的、从备份恢复来的（备份不带音频，见 ADR 0003）都属于这一类。
  const none = loadModule({ store: fakeStore({ present: [] }) });
  assert.equal(await none.ctx.primeAudioUrl(ID), null);
  assert.equal(none.ctx.audioUrlFor(ID), null);

  const has = loadModule();
  assert.ok(await has.ctx.primeAudioUrl(ID), "对照：存过的必须准备得出来");
});

test("存储整个用不了时，也只是「没有声音」，不抛异常", async () => {
  const bad = loadModule({ store: { getAudio: async () => { throw new Error("库炸了"); } } });
  await assert.doesNotReject(() => bad.ctx.primeAudioUrl(ID));
  assert.equal(await bad.ctx.primeAudioUrl(ID), null);
  assert.equal(bad.ctx.audioUrlFor(ID), null);

  const ok = loadModule();
  assert.ok(await ok.ctx.primeAudioUrl(ID), "对照：库正常时必须准备得出来");
});

test("传一个空的 id 进来，不去查也不报错", async () => {
  const { ctx, made } = loadModule();
  for (const bad of [null, undefined, ""]) {
    assert.equal(await ctx.primeAudioUrl(bad), null);
    assert.equal(ctx.audioUrlFor(bad), null);
  }
  assert.equal(made.length, 0, "空 id 不该产生任何一份内存占用");
  assert.ok(await ctx.primeAudioUrl(ID), "对照：正常 id 必须准备得出来");
});

// ══ 3. 不重复占用内存 ═════════════════════════════════════════════════

test("同一条准备两次，只占一份内存", async () => {
  // 每个地址都占着一份音频不放，直到被显式释放。复习界面每渲染一次
  // 就多一份的话，一个下午下来手机上会堆着几十份同样的音频。
  const { ctx, made } = loadModule();
  await ctx.primeAudioUrl(ID);
  await ctx.primeAudioUrl(ID);
  assert.equal(made.length, 1, "第二次必须复用第一次那份");
});

test("同时准备两次，也只占一份", async () => {
  const { ctx, made } = loadModule();
  await Promise.all([ctx.primeAudioUrl(ID), ctx.primeAudioUrl(ID)]);
  assert.equal(made.length, 1);
});

test("释放之后，那份内存真的还回去了", async () => {
  const { ctx, made, revoked } = loadModule();
  await ctx.primeAudioUrl(ID);
  ctx.releaseAudioUrls();
  assert.deepEqual(revoked, [made[0].url], "不还回去就是一直占着");
  assert.equal(ctx.audioUrlFor(ID), null, "释放之后不能再把旧地址交出去——那已经是个死链接");
});

test("释放之后还能重新准备", async () => {
  const { ctx, made } = loadModule();
  await ctx.primeAudioUrl(ID);
  ctx.releaseAudioUrls();
  await ctx.primeAudioUrl(ID);
  assert.equal(made.length, 2, "释放过就该重新生成，而不是永远拿不到");
  assert.equal(ctx.audioUrlFor(ID), made[1].url);
});

test("什么都没准备过就释放，安安静静地什么都不做", async () => {
  const { ctx, revoked } = loadModule();
  assert.doesNotThrow(() => ctx.releaseAudioUrls());
  assert.equal(revoked.length, 0);
  // 对照：准备过之后释放，必须真的还回去——否则上面那个 0
  // 只说明这个模块从不释放任何东西。
  await ctx.primeAudioUrl(ID);
  ctx.releaseAudioUrls();
  assert.equal(revoked.length, 1, "对照：准备过的必须被还回去");
});

// ══ 4. 复习那条路真的接上了 ═══════════════════════════════════════════

test("复习播放先问本机有没有存好的声音，再谈别的", async () => {
  // 断言源码，因为这个函数要 DOM 和音频对象才能跑。要紧的是它确实
  // 先看了本机——不看的话，家长花钱生成的声音永远没人放。
  const at = html.indexOf("function playReviewAudio");
  assert.ok(at !== -1, "playReviewAudio not found");
  const body = html.slice(at, html.indexOf("\n}", at));
  assert.match(body, /playableUrlFor\(/,
    "复习播放必须先问「这一条的声音从哪儿来」——共用那个判定，不自己再写一遍");
  const usesStored = body.indexOf("playableUrlFor(");
  const fallsBack = body.indexOf("speakText(");
  assert.ok(usesStored < fallsBack,
    "必须先查本机、查不到才退回浏览器朗读，顺序反了等于那些声音白生成了");
  // 只看代码，不看注释 —— 注释里提到那个路径是在解释，不是在拼装。
  const code = body.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
  assert.ok(!/_normal\.mp3/.test(code),
    "预设短语的路径拼装已经收进 playableUrlFor()，这里不该再出现第二份");
});

test("复习卡渲染时会去准备，否则第一次点击必然落空", async () => {
  const at = html.indexOf("function renderReviewCard");
  assert.ok(at !== -1, "renderReviewCard not found");
  const body = html.slice(at, html.indexOf("\nfunction ", at + 10));
  assert.match(body, /primeAudioUrl\(/,
    "不在渲染时准备的话，点击那一刻地址还没有，每次都会退回浏览器朗读");
});

test("预设短语仍然走它自己那条路", async () => {
  // 那 1204 个 mp3 是随应用一起下发的文件，不在这套按条生成的机制里。
  // 把它们也塞进 IndexedDB 会白占几百 MB，而且它们本来就能离线播。
  //
  // 这一条是回归护栏，不约束新模块——它在改动前后都该是绿的。
  // 用空壳探测时它会「通过」，那是设计如此，不是假绿。
  const at = html.indexOf("function playReviewAudio");
  const body = html.slice(at, html.indexOf("\n}", at));
  // 判断本身收进了 playableUrlFor()，所以在这里验它，而不是在调用点。
  const at2 = html.indexOf("function playableUrlFor");
  assert.ok(at2 !== -1, "playableUrlFor not found");
  const pf = html.slice(at2, html.indexOf("\n}", at2));
  assert.match(pf, /isAudioBacked\(/, "预设短语的判断不能被去掉");
  assert.match(pf, /_normal\.mp3/, "预设短语仍然直接播随应用下发的那个文件");
});

// ── Runner ───────────────────────────────────────────────
console.log("audio-playback tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
