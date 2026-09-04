#!/usr/bin/env node
// Behavioral tests for adding a sentence to a self-made scenario: the parent
// writes Chinese, the app comes back with English and a voice.
//
// Zero-dependency: the ll:translate-save block is extracted from index.html
// and run in a vm context, per test/related-expressions.test.mjs.
//
// WHY. A scenario a parent cannot put anything into is a folder. This is the
// step that makes 「去医院」 worth creating — and the parent supplies the one
// thing they actually have, which is the Chinese they would have said anyway.
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   1. 家长在自己建的「去医院」里写「别怕，妈妈在这儿」，回来的是能对
//      孩子说的英文，还带着声音，而且就归在这个场景下。
//
//   2. 没网、或者没邀请码 —— 明确告诉他为什么没成，而不是加进去一句空的。
//
//   3. 同一句加两次，不会变成两条。
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import assert from "node:assert/strict";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");

const START = "/* ll:translate-save:start */";
const END = "/* ll:translate-save:end */";

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

const TAG = "custom_s_1";
const REPLY = { en: "Be brave, Mummy is here.", zh: "别怕，妈妈在这儿", tip: "蹲下来抱住他" };

function loadModule({ saved = [], code = "CODE", fetchImpl } = {}) {
  const s = html.indexOf(START), e = html.indexOf(END);
  const fetchCalls = [], requested = [];
  const ctx = {
    console, savedPhrases: saved, translateAge: "1-2",
    // 真实的那两个 —— 翻译带 12 秒超时，用假的会把「超时到底设没设」
    // 这件事变成不可验的。
    AbortController, setTimeout, clearTimeout, Headers, Response,
    safeSetItem: () => {}, updateNavBadge: () => {},
    requestAudio: item => { requested.push(item); return Promise.resolve(true); },
    getAccessCode: () => code,
    accessHeaders: () => (code ? { "Content-Type": "application/json", "X-LL-Access": code }
                               : { "Content-Type": "application/json" }),
    accessErrorMessage: st => (st === 403 ? "这个功能需要邀请码" : null),
    fetch: async (...args) => {
      fetchCalls.push(args);
      if (fetchImpl) return fetchImpl(...args);
      return new Response(JSON.stringify(REPLY), { status: 200, headers: { "Content-Type": "application/json" } });
    },
  };
  vm.createContext(ctx);
  vm.runInContext(html.slice(s, e + END.length), ctx);
  for (const fn of ["translateChinese", "addPhraseToScenario"]) {
    assert.equal(typeof ctx[fn], "function", `module must define ${fn}()`);
  }
  return { ctx, fetchCalls, requested, saved: ctx.savedPhrases };
}

// ══ 1. 写中文，得到能说的英文，归在这个场景下 ═════════════════════════

test("写一句中文，加进这个场景", async () => {
  const { ctx, saved } = loadModule();
  const r = await ctx.addPhraseToScenario("别怕，妈妈在这儿", TAG);
  assert.equal(r.ok, true, r.error);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].en, REPLY.en);
  assert.equal(saved[0].scenario, TAG, "归错了场景，家长在自己的场景里就看不到它");
});

test("家长自己写的中文保住了，不会被别的覆盖", async () => {
  // 他打的那句话是他自己会说的话。换成模型改写过的版本，
  // 下次复习时他会对不上号。
  const { ctx, saved } = loadModule({ fetchImpl: async () =>
    new Response(JSON.stringify({ en: "Be brave.", tip: "x" }), { status: 200 }) });
  await ctx.addPhraseToScenario("  别怕，妈妈在这儿  ", TAG);
  assert.equal(saved[0].zh, "别怕，妈妈在这儿", "首尾空格要去掉，内容不能变");
});

test("加进去的是一条正常收藏 —— 能复习、能生成声音", async () => {
  const { ctx, saved, requested } = loadModule();
  await ctx.addPhraseToScenario("别怕", TAG);
  assert.ok(saved[0].rv && typeof saved[0].rv.due === "number", "要能进复习队列");
  assert.ok(saved[0].id, "要有 id —— 声音存在那个键下");
  assert.equal(requested.length, 1, "存完必须去补声音");
  assert.equal(requested[0].id, saved[0].id);
});

test("送去翻译的是那句中文，带着年龄段和邀请码", async () => {
  const { ctx, fetchCalls } = loadModule();
  await ctx.addPhraseToScenario("别怕", TAG);
  const [url, opts] = fetchCalls[0];
  assert.equal(String(url), "/api/translate");
  assert.deepEqual(JSON.parse(opts.body), { zh: "别怕", age: "1-2" });
  assert.equal(new Headers(opts.headers).get("X-LL-Access"), "CODE");
});

// ══ 2. 加不成的时候，说清为什么 ═══════════════════════════════════════

test("空的输入不发请求", async () => {
  const { ctx, fetchCalls } = loadModule();
  for (const bad of [null, undefined, "", "   "]) {
    const r = await ctx.addPhraseToScenario(bad, TAG);
    assert.equal(r.ok, false);
  }
  assert.equal(fetchCalls.length, 0);
  assert.equal((await ctx.addPhraseToScenario("别怕", TAG)).ok, true, "对照：正常输入必须成功");
});

test("没有邀请码时，说的是「需要邀请码」而不是「网络错误」", async () => {
  const { ctx, saved } = loadModule({ fetchImpl: async () => new Response("{}", { status: 403 }) });
  const r = await ctx.addPhraseToScenario("别怕", TAG);
  assert.equal(r.ok, false);
  assert.match(r.message || "", /邀请码/, "说成网络问题会让他去重启路由器");
  assert.equal(saved.length, 0, "没翻译成就不该加进去一条半成品");
});

test("断网时安静地失败，不加半条进去", async () => {
  const { ctx, saved } = loadModule({ fetchImpl: async () => { throw new TypeError("fetch failed"); } });
  const r = await ctx.addPhraseToScenario("别怕", TAG);
  assert.equal(r.ok, false);
  assert.equal(saved.length, 0);

  const ok = loadModule();
  assert.equal((await ok.ctx.addPhraseToScenario("别怕", TAG)).ok, true, "对照：有网时必须成功");
});

test("上游出错时也不加进去", async () => {
  const { ctx, saved } = loadModule({ fetchImpl: async () => new Response("{}", { status: 502 }) });
  assert.equal((await ctx.addPhraseToScenario("别怕", TAG)).ok, false);
  assert.equal(saved.length, 0);
});

test("同一句加两次，不会变成两条", async () => {
  const { ctx, saved } = loadModule();
  assert.equal((await ctx.addPhraseToScenario("别怕", TAG)).ok, true);
  const again = await ctx.addPhraseToScenario("别怕", TAG);
  assert.equal(again.ok, false);
  assert.equal(again.error, "duplicate", "调用方要能说「这句已经在里面了」");
  assert.equal(saved.length, 1);
});

// ══ 3. 不归场景的收藏，行为一点不变 ═══════════════════════════════════

test("不指定场景时，仍然进通用那个桶", async () => {
  // 翻译页和备选句都走同一个保存实现，它们没有场景。
  const { ctx, saved } = loadModule();
  const r = { en: "Hello.", zh: "你好" };
  ctx.assignTranslationIds(r);
  ctx.saveTranslatedPhrase(r);
  assert.equal(saved[0].scenario, "__translate__");
});

// ══ 4. 翻译这件事只有一处实现 ═════════════════════════════════════════

test("翻译页和场景加句，调的是同一个翻译实现", async () => {
  // 抄第二份的话，两处的超时、错误分类、邀请码处理迟早会分叉。
  const at = html.indexOf("async function doTranslate");
  assert.ok(at !== -1, "doTranslate not found");
  const body = html.slice(at, html.indexOf("\n}", at));
  assert.match(body, /translateChinese\(/, "翻译页必须走共用那个");
  assert.ok(!/fetch\("\/api\/translate"/.test(body),
    "第二份 fetch 调用正是两处会分叉的地方");
});

// ══ 5. 界面接上了 ═════════════════════════════════════════════════════

test("场景里有个加一句的入口", async () => {
  assert.match(html, /addPhraseToScenario\(/, "加不进句子的话，自建场景就只是个空壳");
  const at = html.indexOf("function renderSavedScreen");
  const body = html.slice(at, html.indexOf("\nfunction ", at + 10));
  assert.match(body, /addPhraseToScenario\(|newScenarioPhrase\(/,
    "入口要在场景里面 —— 那是家长想加句子时待的地方");
});

console.log("scenario-add-phrase tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
