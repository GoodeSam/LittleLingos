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

// 把真正的 audio-controller.mjs 接到沙箱里：Audio 用测试自己的假件（ctx.Audio），
// 手机朗读用一个可检查的假件（挂在 ctx.__llSpeech 上）；按钮重画照 index.html 的
// 订阅接法（有 setPlayBtnPlaying / resetPlayBtnState 就用）。定时器 unref，免得 8 秒
// 加载超时把测试进程吊着。
const { createAudioController } = require(join(dirname(fileURLToPath(import.meta.url)), "..", "audio-controller.mjs"));   // Node 26：require 可直接加载 ESM
export function injectAudio(ctx) {
  const spoken = [];
  const speech = { spoken, cancel() {}, speak(u) { spoken.push(u); } };
  ctx.__llSpeech = speech;
  if (!ctx.window) ctx.window = {};   // 产品代码从 window.llAudio 取；沙箱没有 window 就给一个
  ctx.llAudio = createAudioController({
    Audio: function (url) { return new ctx.Audio(url); },
    speech,
    Utterance: function (text) { return { text }; },
  });
  ctx.window.llAudio = ctx.llAudio;
  let last = null;
  ctx.llAudio.subscribe((st) => {
    if (last && last !== st.owner && typeof ctx.resetPlayBtnState === "function") ctx.resetPlayBtnState(last);
    if (st.owner) {
      if (st.paused && typeof ctx.resetPlayBtnState === "function") ctx.resetPlayBtnState(st.owner);
      else if (!st.paused && typeof ctx.setPlayBtnPlaying === "function") ctx.setPlayBtnPlaying(st.owner);
    }
    last = st.owner;
  });
  return ctx;
}


// 真正的 review-engine.js 进沙箱（它没有依赖，直接挂）。
const llReviewLib = require(join(dirname(fileURLToPath(import.meta.url)), "..", "review-engine.js"));
export function injectReview(ctx) {
  ctx.llReview = llReviewLib;
  return ctx;
}

// 真正的 dict-logic.js 进沙箱（纯模块，直接挂）。
const llDictLib = require(join(dirname(fileURLToPath(import.meta.url)), "..", "dict-logic.js"));
export function injectDict(ctx) {
  ctx.llDict = llDictLib;
  return ctx;
}
