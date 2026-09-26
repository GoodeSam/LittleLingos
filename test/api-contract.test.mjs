#!/usr/bin/env node
// 手机上的页面和服务器上的函数，说的是不是同一种话。
//
// 这两头各自都有很多测试，而且各自都是绿的——问题恰恰在这里。页面那头的测试
// 拿一份**手写的假响应**喂给页面；函数那头的测试拿一份**手写的假请求**喂给
// 函数。哪天函数把 `lemma` 改叫 `word`，函数的测试跟着改、照样绿；页面的测试
// 还在吃旧的假响应、也照样绿；而家长查词时看到的是「结果格式不对」。
// 两份手写的假货之间，没有任何东西保证它们还长得一样。
// （这不是假想：test/e2e.mjs 里那份假的词典响应，现在就已经和真函数对不上了。）
//
// 所以这里不写假响应，也不写假请求。页面里那段真代码发出的真请求，原样交给
// 真的函数；函数回的真响应，原样交还给页面里的真代码去读。假的只有最外面
// 那一层——Gemini、Azure、苹果的推送服务——因为那是要花钱、要联网的。
//
// 对应的用户情境（不含函数名）：
//   1. 家长打一句中文点「帮我说」：页面发出去的东西服务器认，服务器回来的东西
//      页面读得懂，屏幕上出现的是一句能用的英文，不是报错。
//   2. 家长查一个词库里没有的英文词：同上。
//   3. 家长收藏一句话：页面去要的那段声音，服务器肯给，给回来的页面存得下。
//   4. 服务器那头出事时（上游挂了、邀请码不对），页面读得懂那个「出事了」，
//      告诉家长的是真实原因，而不是把它当成另一种错。
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { injectStorage, injectApi } from "./_storage-helper.mjs";   // 真正的 storage.js，接在本测试的 localStorage 假件上

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");

const { default: translateFn } = await import("../netlify/functions/translate.mjs");
const { default: dictionaryFn } = await import("../netlify/functions/dictionary.mjs");
const { default: ttsFn } = await import("../netlify/functions/tts.mjs");

const SERVER = { "/api/translate": translateFn, "/api/dictionary": dictionaryFn, "/api/tts": ttsFn };
const CODE = "contract-test-code-1234";
const ENV = { LL_ACCESS_CODE: CODE, GEMINI_API_KEY: "k", OPENAI_API_KEY: undefined,
              AZURE_SPEECH_KEY: "k", AZURE_SPEECH_REGION: "eastus" };

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

function block(name) {
  const S = `/* ll:${name}:start */`, E = `/* ll:${name}:end */`;
  const s = html.indexOf(S), e = html.indexOf(E);
  assert.ok(s !== -1 && e !== -1, `index.html 里找不到 ${S} … ${E}`);
  return html.slice(s, e + E.length);
}

// Gemini 回话的样子。里面那段 JSON 是「模型说的话」，外面这层是 Google 的信封。
const gemini = (obj) => new Response(JSON.stringify(
  { candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] }),
  { status: 200, headers: { "Content-Type": "application/json" } });

// 一次往返的全部布景：环境变量、上游、和那座桥。
async function world({ upstream, code = CODE }, fn) {
  const prevEnv = {};
  for (const [k, v] of Object.entries(ENV)) {
    prevEnv[k] = process.env[k];
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
  const prevFetch = globalThis.fetch;
  const upstreamCalls = [];
  // 函数往外打的电话：只有这一层是假的。
  globalThis.fetch = async (url, init) => { upstreamCalls.push(String(url)); return upstream(String(url), init); };

  const crossed = [];
  // 桥：页面的 fetch。不回假数据——把真请求交给真函数。
  const bridge = async (url, init = {}) => {
    const path = String(url);
    const handler = SERVER[path];
    assert.ok(handler, `页面打了一个服务器上不存在的地址：${path}`);
    const req = new Request("http://ll.test" + path,
      { method: init.method || "GET", headers: init.headers, body: init.body });
    const res = await handler(req);
    crossed.push({ path, body: init.body, status: res.status });
    return res;
  };

  const store = new Map([["ll_access", code]]);
  const ctx = {
    console, setTimeout, clearTimeout, queueMicrotask, AbortController, Blob, Response, Intl, Date, JSON, Math,
    navigator: { onLine: true },
    fetch: bridge,
    localStorage: { getItem: k => (store.has(k) ? store.get(k) : null),
                    setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
  };
  injectStorage(ctx);
  vm.createContext(ctx);
  injectApi(ctx);
  try { return await fn({ ctx, crossed, upstreamCalls }); }
  finally {
    globalThis.fetch = prevFetch;
    for (const [k, v] of Object.entries(prevEnv)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
}

let uniq = 0;
const fresh = (zh) => `${zh}${++uniq}`;   // 翻译函数自己有缓存；每条用一句新的，免得吃到上一条的结果

// ── 帮我说 ────────────────────────────────────────────────
const GOOD_TRANSLATION = { en: "Bath time, sweetie!", zh: "宝贝，洗澡啦！", tip: "一边放水一边说。",
  related: [{ en: "Let's get you clean!", zh: "我们洗干净吧！" }, { en: "Splash splash!", zh: "哗啦哗啦！" },
            { en: "Water's nice and warm.", zh: "水温刚刚好。" }] };

function loadTranslate(ctx) {
  vm.runInContext(block("access-code"), ctx);
  vm.runInContext(block("translate-save"), ctx);
  assert.equal(typeof ctx.translateChinese, "function", "页面里那段翻译代码不见了");
}

test("家长打一句中文：页面发的服务器认，服务器回的页面读得懂", async () => {
  await world({ upstream: async () => gemini(GOOD_TRANSLATION) }, async ({ ctx, crossed }) => {
    loadTranslate(ctx);
    const out = await ctx.translateChinese(fresh("我们去洗澡吧"), "1-2");
    assert.equal(crossed.length, 1, "页面根本没去问服务器");
    assert.equal(crossed[0].status, 200,
      `服务器不认页面发来的东西（${crossed[0].status}）。页面发的是：${crossed[0].body}`);
    assert.equal(out.ok, true, `服务器回了 200，页面却读不懂：${JSON.stringify(out)}`);
    assert.equal(out.result.en, GOOD_TRANSLATION.en);
    assert.equal(out.result.tip, GOOD_TRANSLATION.tip);
    assert.ok(Array.isArray(out.result.related) && out.result.related.length >= 3,
      "「相关说法」在路上丢了");
  });
});

test("页面上能选的每一档年龄，服务器都认（成人档也一样）", async () => {
  // 从页面源码里读出能选的档位，而不是在这里再抄一遍——抄的那份会过期。
  // 注意是 data-tage（「帮我说」自己那一排），不是 data-age（场景的年龄档）——
  // 后者有 0-1，而翻译从来不提供 0-1。第一次写这条时读错了，红了一次。
  const ages = [...new Set([...html.matchAll(/data-tage="([^"]+)"/g)].map(m => m[1]))];
  assert.ok(ages.length >= 4, `页面里只找到 ${ages.length} 个年龄档，读法可能坏了：${ages}`);
  for (const age of ages) {
    await world({ upstream: async () => gemini(GOOD_TRANSLATION) }, async ({ ctx, crossed }) => {
      loadTranslate(ctx);
      const out = await ctx.translateChinese(fresh("该睡觉了"), age);
      assert.equal(crossed[0].status, 200, `「${age}」这一档页面能选，服务器却不认（${crossed[0].status}）`);
      assert.equal(out.ok, true, `「${age}」：${JSON.stringify(out)}`);
    });
  }
});

test("Gemini 挂了：页面读得懂「出事了」，退回本地建议，而不是当成邀请码问题", async () => {
  await world({ upstream: async () => new Response("quota", { status: 429 }) }, async ({ ctx, crossed }) => {
    loadTranslate(ctx);
    const out = await ctx.translateChinese(fresh("吃饭了"), "2-3");
    assert.equal(crossed[0].status, 502, `上游挂了，服务器该回 502，回的是 ${crossed[0].status}`);
    assert.equal(out.ok, false);
    assert.equal(out.error, "upstream", `页面把「上游挂了」读成了别的：${out.error}`);
  });
});

test("邀请码不对：服务器在花钱之前就拒绝，页面告诉家长的是邀请码的事", async () => {
  await world({ upstream: async () => gemini(GOOD_TRANSLATION), code: "wrong-code-0000000000" },
    async ({ ctx, crossed, upstreamCalls }) => {
      loadTranslate(ctx);
      const out = await ctx.translateChinese(fresh("穿鞋子"), "1-2");
      assert.ok([401, 403].includes(crossed[0].status), `该拒绝，回的是 ${crossed[0].status}`);
      assert.equal(upstreamCalls.length, 0, "已经拒绝了，钱却花出去了——上游被调用了");
      assert.equal(out.error, "access", `页面把「邀请码不对」读成了别的：${out.error}`);
      assert.ok(out.message && out.message.length > 0, "没有一句给家长看的话");
    });
});

// ── 查词 ──────────────────────────────────────────────────
const GOOD_ENTRY = { lemma: "splash", senses: [{ pos: "v.", definition: "溅，泼" }, { pos: "n.", definition: "溅起的水花" }] };

function loadDictionary(ctx) {
  // 查词那段代码会画界面；这里不看它画了什么，只看它**判定**成了什么。
  const states = [];
  ctx.window = ctx;
  Object.assign(ctx, {
    document: { getElementById: () => null, createElement: () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {} },
                appendChild() {}, setAttribute() {}, addEventListener() {} }), querySelectorAll: () => [] },
    savedPhrases: [], safeSetItem() {}, updateNavBadge() {}, showOfflineToast() {},
  });
  vm.runInContext(block("access-code"), ctx);
  vm.runInContext(block("translate-save"), ctx);
  vm.runInContext(block("dictionary-shared"), ctx);
  vm.runInContext(block("dictionary-lookup"), ctx);
  assert.equal(typeof ctx.performDictLookup, "function", "页面里那段查词代码不见了");
  ctx.renderDictLookupPanel = (_panel, s) => { states.push(s); };
  ctx.resetDueOnRepeatLookup = () => {};
  return states;
}
const settle = () => new Promise(r => setTimeout(r, 30));

test("家长查一个词库里没有的词：服务器回的，页面当成「查到了」而不是「格式不对」", async () => {
  await world({ upstream: async () => gemini(GOOD_ENTRY) }, async ({ ctx, crossed }) => {
    const states = loadDictionary(ctx);
    ctx.performDictLookup("splash", {});
    await settle();
    assert.equal(crossed.length, 1, "页面根本没去问服务器");
    assert.equal(crossed[0].status, 200, `服务器不认页面发来的东西（${crossed[0].status}）：${crossed[0].body}`);
    const last = states[states.length - 1];
    assert.equal(last.state, "result",
      `服务器回了 200，页面却判成了「${last.state}」——两头对一个响应长什么样的理解不一样了`);
    assert.equal(last.data.senses.length, 2, "词义在路上丢了");
  });
});

test("对照：服务器回一份缺了词头的东西，页面认得出来它不对", async () => {
  // 没有这一条，上一条就分不清「页面读懂了」和「页面什么都当成读懂了」。
  // 换一个词：服务器会记住查过的词，用同一个词会吃到上一条留下的好结果，
  // 这条对照就成了摆设（第一次写时正是这样假绿的反面——假红）。
  await world({ upstream: async () => gemini({ senses: GOOD_ENTRY.senses }) }, async ({ ctx, crossed }) => {
    const states = loadDictionary(ctx);
    ctx.performDictLookup("drizzle", {});
    await settle();
    const last = states[states.length - 1];
    assert.notEqual(last.state, "result", "缺了词头的响应也被当成查到了");
    assert.notEqual(crossed[0].status, 200, "服务器把一份残缺的模型回答原样放行了");
  });
});

// ── 收藏时配声音 ──────────────────────────────────────────
const MP3 = new Uint8Array([0xff, 0xfb, 0x90, 0x64, 0, 1, 2, 3, 4, 5, 6, 7]);

function loadAudio(ctx) {
  const kept = new Map();
  Object.assign(ctx, {
    putAudio: async (id, blob) => { kept.set(id, blob); return true; },
    getAudio: async id => kept.get(id) ?? null,
    hasAudio: async id => kept.has(id),
    deleteAudio: async id => { kept.delete(id); },
    whichHaveAudio: async ids => new Set(ids.filter(i => kept.has(i))),
    refreshAudioMarks() {},
  });
  vm.runInContext(block("access-code"), ctx);
  vm.runInContext(block("audio-provision"), ctx);
  assert.equal(typeof ctx.provisionAudio, "function", "页面里那段配声音的代码不见了");
  return kept;
}

test("家长收藏一句话：页面去要声音，服务器肯给，给回来的页面存得下", async () => {
  let ssml = "";
  await world({ upstream: async (_u, init) => { ssml = String(init.body); return new Response(MP3, { status: 200, headers: { "Content-Type": "audio/mpeg" } }); } },
    async ({ ctx, crossed }) => {
      const kept = loadAudio(ctx);
      const item = { id: "t_1758400000000", en: "Time for bed, sweetie.", zh: "该睡觉了" };
      const ok = await ctx.provisionAudio(item, item.id);
      assert.equal(crossed.length, 1, "页面根本没去要声音");
      assert.equal(crossed[0].status, 200, `服务器不认页面发来的东西（${crossed[0].status}）：${crossed[0].body}`);
      assert.ok(ssml.includes("Time for bed, sweetie."), "送去 Azure 的不是那句英文");
      assert.ok(!ssml.includes("该睡觉了"), "中文被送出去了——只有英文该出门");
      assert.equal(ok, true, "服务器给了声音，页面却说没拿到");
      assert.equal(kept.size, 1, "声音没存下来");
      const bytes = new Uint8Array(await [...kept.values()][0].arrayBuffer());
      assert.deepEqual([...bytes], [...MP3], "存下来的不是服务器给的那段——路上被改过");
    });
});

test("设置里能挑的每一把嗓子，服务器都认", async () => {
  // 上游必须自称是音频：服务器会拒收不是 audio/* 的 200（防止把一张报错网页当声音存进手机）。
  await world({ upstream: async () => new Response(MP3, { status: 200, headers: { "Content-Type": "audio/mpeg" } }) }, async ({ ctx, crossed }) => {
    loadAudio(ctx);
    const voices = vm.runInContext("typeof VOICE_OPTIONS !== 'undefined' ? VOICE_OPTIONS.map(v => v.id) : []", ctx);
    assert.ok(voices.length >= 2, `页面里只读到 ${voices.length} 把嗓子，读法可能坏了`);
    for (const v of voices) {
      const res = await ctx.ttsFetch("Hello.", v);
      assert.equal(res.status, 200, `「${v}」页面能挑，服务器却不认（${res.status}）`);
    }
    assert.equal(crossed.length, voices.length);
  });
});

console.log("api contract tests（页面 ↔ 服务器）");
let passed = 0, failed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
