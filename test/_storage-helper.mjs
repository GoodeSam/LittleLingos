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
