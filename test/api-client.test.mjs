#!/usr/bin/env node
// 往自家服务器打电话，从今往后只有一个出口：api-client.js。
//
// 为什么（ADR 0009 第三块）：index.html 里四处 fetch("/api/…")，拼请求的写法
// 完全一样（POST + 邀请码头 + JSON），但「状态码怎么归类」每处各写一遍：
// 查词把 500 当「没配密钥」、翻译把它当「上游挂了」、提醒把它当「没配置」……
// 09-23 那个「500 reminder not configured 甩给家长」就是没有统一出口的结果。
//
// 这个模块只管两件事：把请求拼对（含超时）、把结果归成几类。
// **说什么中文**仍归各界面管（查词面板、翻译卡、提醒设置各有各的话）。
// 和前两个模块一样是纯的：fetch、AbortController、邀请码都从外面传进来。
// 用普通脚本 + CommonJS 出口（同 storage.js）：沙箱测试要同步 require 它。
//
// 对应的用户情境（不含函数名）：
//   1. 家长填了邀请码去翻译：请求带着码；没填就不带（不带 ≠ 带一个空的，服务器
//      对这两种回的话不一样）。
//   2. 邀请码不对：归为「邀请码问题」，界面据此指路去设置，而不是说软件坏了。
//   3. 服务器自己没配好（500）、上游挂了（502）、请求不合法（400）：三种分开，
//      不然家长会被指去改一个不相干的东西。
//   4. 服务器回了东西但不是合法 JSON：归为「格式不对」，不当成网络断了。
//   5. 等太久（超时）和根本连不上（断网）：分开归类，界面说的话不一样。
//   6. 提醒那条路要读非 2xx 回复里的正文（"reminder not configured" 就在里面）：
//      不管什么状态码，正文能解析就带回来。
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MODULE_PATH = join(ROOT, "api-client.js");
const require = createRequire(import.meta.url);

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// 假的 fetch：只 mock 不受本项目控制的东西。可以指定回什么、或者根本不回（模拟卡住）。
function fakeFetch({ status = 200, body = "{}", hang = false, throws = null } = {}) {
  const calls = [];
  const fn = (url, init) => {
    calls.push({ url, init });
    if (throws) return Promise.reject(throws);
    if (hang) return new Promise((_, rej) => {
      // 真 fetch 在 signal 被 abort 时以 AbortError 失败
      if (init && init.signal) init.signal.addEventListener("abort", () => { const e = new Error("aborted"); e.name = "AbortError"; rej(e); });
    });
    return Promise.resolve({
      ok: status >= 200 && status < 300, status,
      json: () => { try { return Promise.resolve(JSON.parse(body)); } catch (e) { return Promise.reject(e); } },
    });
  };
  fn.calls = calls;
  return fn;
}

function load({ code = "", ...fetchOpts } = {}) {
  assert.ok(existsSync(MODULE_PATH), "api-client.js 还不存在——这条测试就是用来逼它出生的");
  const lib = require(MODULE_PATH);
  assert.equal(typeof lib.createApiClient, "function", "要导出 createApiClient(deps)");
  const fetch = fakeFetch(fetchOpts);
  const api = lib.createApiClient({ fetch, getAccessCode: () => code, AbortController, setTimeout, clearTimeout });
  return { api, fetch };
}

// ── 1：请求拼对 ─────────────────────────────────────────────
test("填了邀请码：请求是 POST、JSON、带着码", async () => {
  const { api, fetch } = load({ code: "abc" });
  await api.post("/api/translate", { zh: "洗手", age: "1-2" });
  assert.equal(fetch.calls.length, 1);
  const { url, init } = fetch.calls[0];
  assert.equal(url, "/api/translate");
  assert.equal(init.method, "POST");
  assert.equal(init.headers["Content-Type"], "application/json");
  assert.equal(init.headers["X-LL-Access"], "abc");
  assert.deepEqual(JSON.parse(init.body), { zh: "洗手", age: "1-2" });
});

test("没填邀请码：请求里根本没有那个头（不是带个空的）", async () => {
  const { api, fetch } = load({ code: "" });
  await api.post("/api/dictionary", { word: "bath" });
  assert.equal("X-LL-Access" in fetch.calls[0].init.headers, false, "空码不该变成一个空头——服务器对这两种回的话不一样");
});

// ── 2～5：归类 ─────────────────────────────────────────────
test("2xx 且正文合法：归为 ok，正文带回来", async () => {
  const { api } = load({ status: 200, body: '{"en":"Wash hands","tip":"x"}' });
  const r = await api.post("/api/translate", {});
  assert.equal(r.kind, "ok");
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { en: "Wash hands", tip: "x" });
});

test("403：归为邀请码问题——界面据此指路去设置，不说软件坏了", async () => {
  const { api } = load({ status: 403, body: '{"error":"forbidden"}' });
  const r = await api.post("/api/translate", {});
  assert.equal(r.kind, "access");
  assert.equal(r.status, 403);
});

test("400 / 500 / 502 三种分开：请求不合法、服务器自己没配好、上游挂了", async () => {
  assert.equal((await load({ status: 400 }).api.post("/x", {})).kind, "invalid");
  assert.equal((await load({ status: 500 }).api.post("/x", {})).kind, "server");
  assert.equal((await load({ status: 502 }).api.post("/x", {})).kind, "upstream");
  assert.equal((await load({ status: 503 }).api.post("/x", {})).kind, "upstream", "没见过的 5xx 按上游算");
  assert.equal((await load({ status: 418 }).api.post("/x", {})).kind, "upstream", "没见过的 4xx 也按上游算（和原来「!res.ok → upstream」一致）");
});

test("2xx 但正文不是合法 JSON：归为格式不对，不当成断网", async () => {
  const { api } = load({ status: 200, body: "<html>oops" });
  const r = await api.post("/x", {});
  assert.equal(r.kind, "malformed");
});

test("等太久：到点归为超时，并且真的把请求掐掉", async () => {
  const { api, fetch } = load({ hang: true });
  const r = await api.post("/x", {}, { timeoutMs: 15 });
  assert.equal(r.kind, "timeout");
  assert.equal(fetch.calls[0].init.signal.aborted, true, "超时了却没把请求掐掉——钱照花");
});

test("根本连不上（断网）：归为网络问题，和超时分开", async () => {
  const { api } = load({ throws: new TypeError("Failed to fetch") });
  const r = await api.post("/x", {});
  assert.equal(r.kind, "network");
});

// ── 6：非 2xx 的正文也要带回来 ────────────────────────────
test("非 2xx 的回复正文也带回来——提醒那条路要读它（\"reminder not configured\" 就在里面）", async () => {
  const { api } = load({ status: 500, body: '{"error":"reminder not configured"}' });
  const r = await api.post("/api/reminder", { action: "enable" });
  assert.equal(r.kind, "server");
  assert.deepEqual(r.body, { error: "reminder not configured" });
  const bad = await load({ status: 500, body: "not json" }).api.post("/x", {});
  assert.deepEqual(bad.body, null, "非 2xx 且正文不是 JSON：正文给 null，归类仍按状态码");
});

test("要原始回复的（生成声音要读二进制）：raw() 只拼请求，不归类", async () => {
  const { api, fetch } = load({ code: "abc", status: 200 });
  const res = await api.raw("/api/tts", { text: "hi", voice: "v1" });
  assert.equal(res.status, 200);
  assert.equal(fetch.calls[0].init.headers["X-LL-Access"], "abc");
  assert.deepEqual(JSON.parse(fetch.calls[0].init.body), { text: "hi", voice: "v1" });
});

// ── 模块本身的规矩 ─────────────────────────────────────────
test("这个文件是纯的：不碰 window、document，不自己抓 fetch 或 localStorage", () => {
  const src = readFileSync(MODULE_PATH, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
  for (const bad of ["window.", "document.", "localStorage", "globalThis.fetch", "\nfetch(", " fetch("]) {
    assert.ok(!src.includes(bad), `api-client.js 里出现了「${bad}」——fetch 和邀请码要从 createApiClient(deps) 传进来`);
  }
});

test("index.html 里往 /api/ 打电话的只剩模块这一个出口，且它进了离线缓存清单", () => {
  const html = readFileSync(join(ROOT, "index.html"), "utf8");
  const code = html.replace(/<!--[\s\S]*?-->/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const direct = code.match(/\bfetch\(\s*["'`]\/api\//g) || [];
  assert.equal(direct.length, 0, `index.html 里还有 ${direct.length} 处直接 fetch("/api/…")——一律走 llApi`);
  const bare = code.match(/\bfetch\(\s*path\b/g) || [];
  assert.equal(bare.length, 0, "pushApiPost 那处 fetch(path) 也要走 llApi");
  assert.ok(code.includes('<script src="./api-client.js"></script>'), 'index.html 里没有 <script src="./api-client.js"></script>');
  const sw = readFileSync(join(ROOT, "sw.js"), "utf8");
  const shell = sw.slice(sw.indexOf("const SHELL = ["), sw.indexOf("];", sw.indexOf("const SHELL = [")));
  assert.ok(shell.includes("api-client.js"), "sw.js 的 SHELL 里没有 api-client.js——离线打开会白屏");
  const stamp = readFileSync(join(ROOT, "scripts/stamp-sw.mjs"), "utf8");
  const sources = stamp.slice(stamp.indexOf("const SOURCES = ["), stamp.indexOf("]", stamp.indexOf("const SOURCES = [")));
  assert.ok(sources.includes("api-client.js"), "stamp-sw.mjs 的 SOURCES 里没有它——改了它缓存戳不变");
});

let pass = 0, fail = 0;
for (const t of tests) {
  try { await t.fn(); console.log(`  ✓ ${t.name}`); pass++; }
  catch (e) { console.log(`  ✗ ${t.name}\n    ${e.message.split("\n")[0]}`); fail++; }
}
console.log(fail ? `✗ ${fail} failed, ${pass} passed` : `✓ all ${pass} tests passed`);
process.exit(fail ? 1 : 0);
