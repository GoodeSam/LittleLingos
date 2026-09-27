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
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { injectApi } from "./_storage-helper.mjs";

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
  vm.runInContext(slice("const TRANSLATE_TIMEOUT_MS", "translateChinese"), ctx);
  const at = html.indexOf("function translateFailureNotice(");
  assert.ok(at !== -1, "还没有 translateFailureNotice()——「失败了对家长说什么」要收在一处");
  vm.runInContext(html.slice(at, html.indexOf("\n}", at) + 2), ctx);
  return ctx;
}
const resp = (status, body) => async () => ({ ok: status < 300, status, json: async () => JSON.parse(body) });

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
