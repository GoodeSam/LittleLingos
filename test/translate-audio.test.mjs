#!/usr/bin/env node
// Behavioral tests for voicing a translation the moment it arrives, before it
// is saved.
//
// Zero-dependency: the ll:audio-provision block is extracted from index.html
// and run in a vm context, per test/audio-provision.test.mjs.
//
// WHY. Reported from real use: "复习页面的语音和翻译后产生的语音是不同的音色".
// Both clips come from the same Azure voice with identical prosody — the
// difference is that the translate screen was never playing a clip at all. It
// fell back to browser speech, because generation only happened at save time
// and nothing had been saved yet.
//
// So the parent hears the machine voice FIRST, on the screen where they decide
// whether the phrase is any good, and the real one only afterwards. C1 in
// tech-constraints calls that browser voice unacceptable; it was sitting in
// the first-impression slot.
//
// THE COST OF FIXING IT THIS WAY, stated plainly: every translation now costs
// a generation, including the ones glanced at and discarded. Translate ten,
// keep one, and nine clips were paid for and never wanted. That was the
// explicit choice — the alternative was making the parent wait three seconds
// the first time they tap play.
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   1. 翻译一出来，家长点播放听到的就是真人发音——和之后复习时听到的
//      是同一个声音，不是先机器音后真人音。
//
//   2. 他听完觉得好，点收藏。那一段声音**直接被认下来**，不重新生成，
//      也就不再花第二次钱。
//
//   3. 连着翻译几句，各是各的声音，不会串。
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import assert from "node:assert/strict";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");

const START = "/* ll:audio-provision:start */";
const END = "/* ll:audio-provision:end */";

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

const CODE = "test-access-code-1234";
const mp3 = () => new Blob([new Uint8Array(64).fill(0xff)], { type: "audio/mpeg" });

function fakeStore({ present = [] } = {}) {
  const map = new Map(present.map(id => [id, mp3()]));
  return {
    _map: map,
    putAudio: async (id, blob) => { map.set(id, blob); return true; },
    getAudio: async id => map.get(id) ?? null,
    hasAudio: async id => map.has(id),
    deleteAudio: async id => { map.delete(id); },
    whichHaveAudio: async ids => new Set(ids.filter(i => map.has(i))),
  };
}

function loadModule({ store = fakeStore(), code = CODE, onLine = true, fetchImpl } = {}) {
  const s = html.indexOf(START), e = html.indexOf(END);
  assert.ok(s !== -1 && e !== -1, `index.html must contain ${START} … ${END} markers`);
  const fetchCalls = [], primed = [];
  const ctx = {
    ...store, console, queueMicrotask, setTimeout, Blob,
    navigator: { onLine },
    getAccessCode: () => code,
    accessHeaders: () => (code ? { "Content-Type": "application/json", "X-LL-Access": code }
                               : { "Content-Type": "application/json" }),
    refreshAudioMarks: () => {},
    // From ll:audio-playback. Storing a clip is not enough — until its address
    // is prepared, the play path finds nothing and falls back to the browser
    // voice, which is exactly the bug this file exists for.
    primeAudioUrl: id => { primed.push(id); return Promise.resolve("blob:fake"); },
    fetch: async (...args) => {
      fetchCalls.push(args);
      if (fetchImpl) return fetchImpl(...args);
      return new Response(mp3(), { status: 200, headers: { "Content-Type": "audio/mpeg" } });
    },
  };
  vm.createContext(ctx);
  vm.runInContext(html.slice(s, e + END.length), ctx);
  assert.equal(typeof ctx.provisionTranslation, "function", "module must define provisionTranslation()");
  return { ctx, store, fetchCalls, primed };
}

// ══ 1. 翻译一出来就去生成 ═════════════════════════════════════════════

test("翻译结果一出来就去生成声音，不等家长收藏", async () => {
  const { ctx, store, fetchCalls } = loadModule();
  const result = { en: "Time for bed, sweetie.", zh: "该睡觉了" };
  assert.equal(await ctx.provisionTranslation(result), true);
  assert.equal(fetchCalls.length, 1, "必须真的去生成");
  assert.ok(await store.getAudio(result.id), "生成完必须存在本机，等着被播");
});

test("这句话在这时候就有了身份，收藏时用的还是它", async () => {
  // 收藏时另铸一个 id 的话，刚才那段声音就成了孤儿：认不回来，
  // 于是同一句话被生成第二次，钱花两遍。
  const { ctx } = loadModule();
  const result = { en: "Wash your hands.", zh: "洗手" };
  await ctx.provisionTranslation(result);
  assert.ok(result.id, "结果本身必须带上 id");
  assert.match(String(result.id), /^t_/, "沿用既有的翻译条目命名");
});

test("已经有身份的，不会被换一个新的", async () => {
  // 界面重绘、或者同一个结果被处理两次时，换 id 等于把刚生成的声音丢掉。
  const { ctx, fetchCalls } = loadModule();
  const result = { en: "Good job!", zh: "做得好" };
  await ctx.provisionTranslation(result);
  const first = result.id;
  await ctx.provisionTranslation(result);
  assert.equal(result.id, first, "身份不能变");
  assert.equal(fetchCalls.length, 1, "第二次不该再花一次钱");
});

test("连着翻译两句，各是各的身份", async () => {
  const { ctx, store } = loadModule();
  const a = { en: "Time for bed.", zh: "睡觉" };
  const b = { en: "Time to eat.", zh: "吃饭" };
  await ctx.provisionTranslation(a);
  await new Promise(r => setTimeout(r, 2));   // Date.now() 至少差 1ms
  await ctx.provisionTranslation(b);
  assert.notEqual(a.id, b.id, "两句话共用一个 id 会让第二句放出第一句的声音");
  assert.ok(await store.getAudio(a.id));
  assert.ok(await store.getAudio(b.id));
});

// ══ 2. 收藏时不再花第二次钱 ═══════════════════════════════════════════

test("收藏刚翻译的这一句，直接认下已有的那段声音", async () => {
  // 这是选「翻译时就生成」这条路的全部前提：翻译已经付过一次，
  // 收藏不该再付一次。
  const { ctx, fetchCalls } = loadModule();
  const result = { en: "Time for bed.", zh: "睡觉" };
  await ctx.provisionTranslation(result);
  assert.equal(fetchCalls.length, 1);
  // 收藏走的是同一个 id
  await ctx.requestAudio({ id: result.id, en: result.en });
  assert.equal(fetchCalls.length, 1, "收藏时又生成一遍，等于每句话花两次钱");
});

// ══ 3. 生成不了的时候，翻译本身照样能用 ═══════════════════════════════

test("生成失败时，翻译结果仍然是好的，只是没有真人声音", async () => {
  const bad = loadModule({ fetchImpl: async () => new Response("x", { status: 502 }) });
  const result = { en: "Time for bed.", zh: "睡觉" };
  assert.equal(await bad.ctx.provisionTranslation(result), false);
  assert.ok(result.id, "失败也要留下身份，否则之后重试都无从谈起");

  const ok = loadModule();
  const r2 = { en: "Time for bed.", zh: "睡觉" };
  assert.equal(await ok.ctx.provisionTranslation(r2), true, "对照：正常情况下必须成功");
});

test("离线时不去发那个必然失败的请求", async () => {
  const off = loadModule({ onLine: false });
  const result = { en: "Time for bed.", zh: "睡觉" };
  assert.equal(await off.ctx.provisionTranslation(result), false);
  assert.equal(off.fetchCalls.length, 0);

  const on = loadModule();
  await on.ctx.provisionTranslation({ en: "Time for bed.", zh: "睡觉" });
  assert.equal(on.fetchCalls.length, 1, "对照：有网时必须真的去生成");
});

test("空结果传进来，不崩也不花钱", async () => {
  const { ctx, fetchCalls } = loadModule();
  for (const bad of [null, undefined, {}, { zh: "只有中文" }]) {
    assert.equal(await ctx.provisionTranslation(bad), false);
  }
  assert.equal(fetchCalls.length, 0);
  assert.equal(await ctx.provisionTranslation({ en: "Hi there." }), true, "对照：正常结果必须去生成");
});

test("生成好之后，那段声音马上就能被播放路径取到", async () => {
  // 这一条对应一个真实的漏网之鱼：片段存进了本机，但没人把它变成
  // 可播的地址，于是翻译页照样退回浏览器朗读 —— 声音在那儿，没人拿。
  const { ctx, primed } = loadModule();
  const result = { en: "Time for bed.", zh: "睡觉" };
  await ctx.provisionTranslation(result);
  assert.deepEqual(primed, [result.id], "存完必须把它备成可播的地址，用的是同一个 id");
});

test("没生成出来的时候，不去备一个空地址", async () => {
  const bad = loadModule({ fetchImpl: async () => new Response("x", { status: 502 }) });
  await bad.ctx.provisionTranslation({ en: "Time for bed.", zh: "睡觉" });
  assert.equal(bad.primed.length, 0);

  const ok = loadModule();
  await ok.ctx.provisionTranslation({ en: "Time for bed.", zh: "睡觉" });
  assert.equal(ok.primed.length, 1, "对照：成功时必须备");
});

test("去一趟复习页再回来，翻译那段声音还在", async () => {
  // 复习卡原来会把全部地址清空。清掉之后翻译页就取不到自己那段了，
  // 而家长完全看不出为什么声音变了。
  const at = html.indexOf("function renderReviewCard");
  const body = html.slice(at, html.indexOf("\nfunction ", at + 10));
  assert.ok(!/releaseAudioUrls\(/.test(body),
    "复习卡不该清空全部地址 —— 那会把翻译页和列表的一起清掉");
});

// ══ 4. 三处真的接上了 ═════════════════════════════════════════════════

test("翻译结果一显示就去补声音", async () => {
  const at = html.indexOf("function showTranslateResult");
  assert.ok(at !== -1, "showTranslateResult not found");
  const body = html.slice(at, html.indexOf("\n}", at));
  assert.match(body, /provisionTranslation\(/, "不在这里补，家长听到的第一声就是机器音");
});

test("收藏用的是翻译时那个身份，不另铸一个", async () => {
  const at = html.indexOf("function saveTranslation");
  const body = html.slice(at, html.indexOf("\n}", at));
  assert.ok(!/id:\s*"t_"\s*\+\s*Date\.now\(\)/.test(body),
    "在这里另铸 id，会让翻译时生成的那段声音成为孤儿，同一句话付两次钱");
  assert.match(body, /r\.id|result\.id/, "必须沿用翻译结果自己的 id");
});

test("翻译页播放先看本机有没有生成好的那段", async () => {
  const at = html.indexOf("function playResultAudio");
  assert.ok(at !== -1, "playResultAudio not found");
  const body = html.slice(at, html.indexOf("\n}", at));
  assert.match(body, /audioUrlFor\(/, "不查的话，生成出来的声音永远没人放");
  const usesStored = body.indexOf("audioUrlFor(");
  const fallsBack = body.indexOf("speakText(");
  assert.ok(usesStored !== -1 && (fallsBack === -1 || usesStored < fallsBack),
    "必须先查本机、查不到才退回浏览器朗读");
});

// ── Runner ───────────────────────────────────────────────
console.log("translate-audio tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
