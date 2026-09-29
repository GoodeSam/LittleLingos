#!/usr/bin/env node
// 翻译失败时把原因说准（ADR 0009 判据 2 的功能 ①；PRD 6.8 第一行）。
//
// 现状：除了邀请码问题，任何失败家长看到的都是同一句「📴 离线建议」——断网、
// 超时、服务器故障、回复异常全被说成「离线」，家长会去检查一个其实正常的网络。
//
// 对应的用户情境（不含函数名）：
//   1. 断网：说「没有网络」，给本地匹配的建议，联网后能拿到 AI 翻译。
//   2. 超时：说「服务器响应太慢」，先给本地建议，稍后再试——不叫他去查网络。
//   3. 服务器故障（500 / 502 / 别的非 2xx / 回复不是 JSON）：说「AI 翻译暂时不可用」，
//      并写明「不是你的网络问题」。
//   4. 邀请码问题照旧：说的是邀请码，指路去设置。
//   5. 服务器回的英文原话，一个字都不许出现在给家长看的话里。
import assert from "node:assert/strict";
import vm from "node:vm";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { injectApi } from "./_storage-helper.mjs";

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

function slice(startMarker, endFn) {
  const s = html.indexOf(startMarker);
  assert.ok(s !== -1, `找不到 ${startMarker}`);
  const fnAt = html.indexOf(`function ${endFn}(`, s);
  assert.ok(fnAt !== -1, `找不到 ${endFn}`);
  return html.slice(s, html.indexOf("\n}", fnAt) + 2);
}

// 只 mock 不受本项目控制的东西：网络。翻译函数和 api-client 都是真的。
function load({ fetchImpl, code = "abc" } = {}) {
  const ctx = {
    console, JSON, Promise,
    fetch: fetchImpl,
    getAccessCode: () => code,
    accessErrorMessage: (status) => (status === 403 ? (code ? "邀请码不对 — 请到「设置」里重新填写" : "这个功能需要邀请码") : null),
    // 让超时在毫秒级发生，不用真等 12 秒
    setTimeout: (fn, ms) => globalThis.setTimeout(fn, Math.min(ms, 20)),
    clearTimeout: (t) => globalThis.clearTimeout(t),
    AbortController,
  };
  vm.createContext(ctx);
  injectApi(ctx);
  // 2026-09-28（ADR 0009 第十五块）：翻译搬进 translate-save.js，12 秒超时也在那里。
  Object.assign(ctx, require(join(ROOT, "translate-save.js")).create({
    api: ctx.llApi,
    accessErrorMessage: (st) => ctx.accessErrorMessage(st),
  }));
  const at = html.indexOf("function translateFailureNotice(");
  assert.ok(at !== -1, "还没有 translateFailureNotice()——「失败了对家长说什么」要收在一处");
  vm.runInContext(html.slice(at, html.indexOf("\n}", at) + 2), ctx);
  return ctx;
}
const resp = (status, body) => async () => ({ ok: status < 300, status, json: async () => JSON.parse(body) });

test("贴了一大段中文（超过 200 字）：不发请求，说明说的是「太长、拆短」，不说服务器不可用", async () => {
  // 2026-09-29 边缘情况：服务端 translate.mjs 有 200 字上限，客户端原来没有——超长照发，
  // 服务器回 400，界面却说「AI 翻译暂时不可用（不是你的网络问题）」，家长会一直重试。
  const calls = [];
  const ctx = load({ fetchImpl: async (...a) => { calls.push(a); return resp(200, JSON.stringify({ en: "x", tip: "y" }))(); } });
  const long = "今天我们一起去公园玩，然后回家吃饭。".repeat(12);   // 216 字
  assert.ok(long.length > 200, "对照：这段确实超过 200 字");
  const r = await ctx.translateChinese(long, "1-2");
  assert.equal(r.ok, false);
  assert.equal(r.error, "too-long", `超长没有被当成「太长」，而是 ${r.error}`);
  assert.equal(calls.length, 0, "超长的还是发出去了——服务器必拒，钱和等待都白花");
  const notice = ctx.translateFailureNotice("too-long");
  assert.match(notice, /200/, "说明里没告诉家长上限是多少");
  assert.match(notice, /拆|短/, "说明没告诉家长该怎么办（拆成短句）");
  assert.doesNotMatch(notice, /不可用|网络/, "把家长自己的输入问题说成了服务器或网络问题");
  // 正好 200 字要能发
  const ok = await ctx.translateChinese("好".repeat(200), "1-2");
  assert.equal(ok.ok, true, "正好 200 字被当成超长了");
});

test("客户端的上限和服务端 translate.mjs 的 MAX_INPUT_LEN 是同一个数——两边不一致时红", () => {
  const server = readFileSync(join(ROOT, "netlify/functions/translate.mjs"), "utf8").match(/const MAX_INPUT_LEN = (\d+)/);
  assert.ok(server, "服务端没有上限常量了？");
  const client = require(join(ROOT, "translate-save.js")).TRANSLATE_MAX_LEN;
  assert.equal(client, Number(server[1]), "客户端拦的长度和服务端拒的长度对不上——总有一段区间是发了也白发");
});

test("断网：归为「没有网络」，说明行说的是网络，并且给本地建议", async () => {
  const ctx = load({ fetchImpl: async () => { throw new TypeError("Failed to fetch"); } });
  const t = await ctx.translateChinese("洗手", "1-2");
  assert.equal(t.ok, false);
  assert.equal(t.error, "network", `断网被归成了 ${t.error}`);
  const say = ctx.translateFailureNotice(t.error);
  assert.match(say, /没有网络|网络/, say);
  assert.match(say, /本地/, "要说明这是本地匹配的建议：" + say);
});

test("超时：说「太慢 / 超时」，不叫他去检查网络", async () => {
  const ctx = load({ fetchImpl: (url, init) => new Promise((_, rej) => init.signal.addEventListener("abort", () => { const e = new Error("x"); e.name = "AbortError"; rej(e); })) });
  const t = await ctx.translateChinese("洗手", "1-2");
  assert.equal(t.error, "timeout", `超时被归成了 ${t.error}`);
  const say = ctx.translateFailureNotice(t.error);
  assert.match(say, /太慢|超时/, say);
  assert.doesNotMatch(say, /检查网络|没有网络/, "超时不是网络断了，别让他去重启路由器：" + say);
});

test("服务器故障（500 / 502 / 其他 / 回复不是 JSON）：说「暂时不可用」，并写明不是他的网络问题", async () => {
  for (const [label, fetchImpl] of [
    ["500", resp(500, '{"error":"GEMINI_API_KEY missing"}')],
    ["502", resp(502, '{"error":"upstream 429"}')],
    ["418", resp(418, "{}")],
    ["回复不是 JSON", async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError("bad"); } })],
  ]) {
    const ctx = load({ fetchImpl });
    const t = await ctx.translateChinese("洗手", "1-2");
    assert.equal(t.ok, false, label);
    assert.ok(["server", "upstream", "malformed"].includes(t.error), `${label} 被归成了 ${t.error}`);
    const say = ctx.translateFailureNotice(t.error);
    assert.match(say, /暂时不可用/, `${label}：${say}`);
    assert.match(say, /不是.*网络/, `${label} 要写明不是他的网络问题：${say}`);
    assert.doesNotMatch(say, /GEMINI|upstream|missing|429/i, `${label} 把服务器原话抄给家长了：${say}`);
  }
});

test("回复缺了英文或提示：归为不完整，家长看到的也是「暂时不可用」", async () => {
  const ctx = load({ fetchImpl: resp(200, '{"en":"Wash hands"}') });
  const t = await ctx.translateChinese("洗手", "1-2");
  assert.equal(t.error, "incomplete");
  assert.match(ctx.translateFailureNotice(t.error), /暂时不可用/);
});

test("邀请码问题照旧：说的是邀请码", async () => {
  const ctx = load({ fetchImpl: resp(403, '{"error":"forbidden"}') });
  const t = await ctx.translateChinese("洗手", "1-2");
  assert.equal(t.error, "access");
  assert.match(t.message, /邀请码/);
});

test("每一种失败的说明都带「📴」之外自己的记号，且没有一种落回那句笼统的「离线建议」", () => {
  const ctx = load({ fetchImpl: resp(500, "{}") });
  const seen = new Set();
  for (const k of ["network", "timeout", "server", "upstream", "malformed", "incomplete"]) {
    const say = ctx.translateFailureNotice(k);
    assert.ok(say && say.length > 8, `${k} 没有话`);
    seen.add(say);
  }
  assert.ok(seen.size >= 3, "六种失败至少要分成三种不同的话：网络 / 太慢 / 不可用");
  for (const say of seen) assert.doesNotMatch(say, /^📴 离线建议（本地匹配/, "还是那句老的笼统话：" + say);
});

let pass = 0, fail = 0;
for (const t of tests) {
  try { await t.fn(); console.log(`  ✓ ${t.name}`); pass++; }
  catch (e) { console.log(`  ✗ ${t.name}\n    ${e.message.split("\n")[0]}`); fail++; }
}
console.log(fail ? `✗ ${fail} failed, ${pass} passed` : `✓ all ${pass} tests passed`);
process.exit(fail ? 1 : 0);
