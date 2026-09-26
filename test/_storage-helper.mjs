// 给沙箱测试用：把真正的 storage.js 接到测试自己造的 localStorage 假件上。
// 这样测试里跑的是产品代码里同一个存储模块，不是又一份 mock（ADR 0009）。
// 上下文里没有 localStorage 的（模拟「这个浏览器根本没有存储」），给一个一碰就抛的后端。
import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { createStorage } = require(join(dirname(fileURLToPath(import.meta.url)), "..", "storage.js"));

export function injectStorage(ctx) {
  const ls = ctx.localStorage;
  const backend = ls ? {
    getItem: (k) => ls.getItem(k),
    setItem: (k, v) => ls.setItem(k, v),
    removeItem: (k) => ls.removeItem(k),
  } : {
    getItem() { throw new Error("no storage"); },
    setItem() { throw new Error("no storage"); },
    removeItem() { throw new Error("no storage"); },
  };
  ctx.llStorage = createStorage({ backend, onWriteFailed: () => {} });
  return ctx;
}

// 把真正的 persistSaved() 放进沙箱——它是 index.html 顶层的函数，不在任何标记块里，
// 而收藏的改动散在四个块里都会叫它。塞的是从 index.html 切出来的原函数，不是复制品。
import { readFileSync } from "node:fs";
import vm from "node:vm";
export function injectPersistSaved(ctx) {
  const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "index.html"), "utf8");
  const at = html.indexOf("function persistSaved(");
  if (at === -1) throw new Error("index.html 里没有 persistSaved()");
  vm.runInContext(html.slice(at, html.indexOf("\n}", at) + 2), ctx);
  return ctx;
}

// 把真正的 api-client.js 接到沙箱自己的 fetch 假件上：fetch、邀请码、AbortController
// 都在调用那一刻从上下文里现取（access-code 块可能在这之后才加载）。
const { createApiClient } = require(join(dirname(fileURLToPath(import.meta.url)), "..", "api-client.js"));
export function injectApi(ctx) {
  ctx.llApi = createApiClient({
    fetch: (...a) => ctx.fetch(...a),
    getAccessCode: () => (typeof ctx.getAccessCode === "function" ? ctx.getAccessCode() : ""),
    AbortController: ctx.AbortController || globalThis.AbortController,
    setTimeout: (...a) => (ctx.setTimeout || globalThis.setTimeout)(...a),
    clearTimeout: (...a) => (ctx.clearTimeout || globalThis.clearTimeout)(...a),
  });
  return ctx;
}
