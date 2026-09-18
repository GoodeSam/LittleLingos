#!/usr/bin/env node
// sw.js 里收推送、点通知的那两段（ADR 0008；最初为试验 E 写，正式版沿用）。
//
// 推送是空的，所以通知写什么、点开去哪，全由 Service Worker 自己决定：
// 页面在订阅时把「复习」还是「连播」记进一个缓存，Service Worker 收到推送时
// 去读。和 sw.test.mjs 一样，在 vm 里跑真实的 sw.js，只把浏览器提供的东西
// （缓存、通知、窗口）换成记账的替身。
//
// iOS 有一条硬规则：收到推送却不弹出可见的通知，系统会吊销这个订阅。所以
// 「任何情况下都要弹」是这里最重要的一条。
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   1. 到点了，手机锁着屏 —— 一定出现一条通知，哪怕记录的目标读不出来。
//   2. 家长选的是「连播」—— 通知上说的是连播，点开也去连播。
//   3. 家长点了通知，App 没开着 —— 打开 App，直接落在复习（或连播）。
//   4. 家长点了通知，App 其实还开在后台 —— 不再开第二个，把它切到前台并
//      告诉它去哪一页。
//   5. 有人往通知里塞了奇怪的目标 —— 只会去复习或连播，不会去别的地方。
//   6. App 更新时清理旧缓存 —— 记录目标的那个缓存不会被误删。
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import assert from "node:assert/strict";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const swSrc = readFileSync(join(ROOT, "sw.js"), "utf8");

function makeSW({ target, cacheBroken = false, windows = [] } = {}) {
  const stores = new Map();
  if (target !== undefined) {
    stores.set("push-spike", new Map([["./__push-target", target]]));
  }
  const shown = [];
  const opened = [];
  let showGate = null;   // 让测试决定 showNotification 什么时候完成
  const listeners = {};
  const ctx = {
    self: {
      addEventListener: (t, fn) => { listeners[t] = fn; },
      skipWaiting: () => {},
      registration: {
        showNotification: (title, opts) => {
          shown.push({ title, opts });
          return showGate ? showGate.promise : Promise.resolve();
        },
      },
      clients: {
        claim: async () => {},
        matchAll: async (q) => { ctx.__matchQuery = q; return windows; },
        openWindow: async (url) => { opened.push(url); return {}; },
      },
    },
    caches: {
      open: async (name) => {
        if (cacheBroken) throw new Error("storage unavailable");
        if (!stores.has(name)) stores.set(name, new Map());
        const s = stores.get(name);
        return {
          addAll: async () => {},
          put: async (k, v) => { s.set(k, v); },
          match: async (k) => (s.has(k) ? { text: async () => s.get(k) } : undefined),
          delete: async (k) => s.delete(k),
        };
      },
      keys: async () => [...stores.keys()],
      delete: async (name) => stores.delete(name),
      match: async () => undefined,
    },
    location: { origin: "https://littlelingos.test" },
    URL,
    Response: class {},
    fetch: () => Promise.reject(new Error("no network in tests")),
    console,
  };
  vm.createContext(ctx);
  vm.runInContext(swSrc, ctx);
  return {
    listeners, shown, opened, stores, ctx,
    holdShow() {
      let resolve;
      showGate = { promise: new Promise(r => { resolve = r; }), resolve: () => resolve() };
      return showGate;
    },
  };
}

// 派发一个事件，收集它交给 waitUntil 的承诺。
function dispatch(listener, extra = {}) {
  const waits = [];
  const e = { waitUntil: p => waits.push(Promise.resolve(p)), ...extra };
  listener(e);
  return { e, waits, settled: () => Promise.all(waits) };
}

function makeNotification(data) {
  const n = { data, closed: false, close() { n.closed = true; } };
  return n;
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test("收到推送：一定弹出通知，而且在通知弹出之前不算处理完", async () => {
  const sw = makeSW();
  assert.equal(typeof sw.listeners.push, "function", "sw.js 没有处理推送");
  const gate = sw.holdShow();
  const d = dispatch(sw.listeners.push);
  assert.equal(d.waits.length, 1, "没有用 waitUntil 包住——iOS 会在通知弹出前把后台停掉");
  let done = false;
  d.waits[0].then(() => { done = true; });
  await new Promise(r => setTimeout(r, 20));
  assert.equal(sw.shown.length, 1, "收到推送没有弹通知——iOS 会因此吊销订阅");
  assert.equal(done, false, "通知还没弹完，处理就算结束了");
  gate.resolve();
  await d.settled();
  assert.equal(done, true);
  const { title, opts } = sw.shown[0];
  assert.ok(title && title.length > 0, "通知没有标题");
  assert.ok(opts.body && opts.body.length > 0, "通知没有正文");
  assert.ok(opts.tag, "没有 tag：连推几次会叠出一串通知");
  assert.equal(opts.data.to, "review", "没记录目标时应默认去复习");
});

test("家长选的是连播：通知上说连播，数据里记着连播", async () => {
  const sw = makeSW({ target: "loop" });
  await dispatch(sw.listeners.push).settled();
  assert.equal(sw.shown[0].opts.data.to, "loop");
  assert.match(sw.shown[0].opts.body, /连/, `正文没提连播：「${sw.shown[0].opts.body}」`);
  // 对照组：选复习时正文不提连播
  const sw2 = makeSW({ target: "review" });
  await dispatch(sw2.listeners.push).settled();
  assert.equal(sw2.shown[0].opts.data.to, "review");
  assert.doesNotMatch(sw2.shown[0].opts.body, /连/, "对照失败：选复习时正文不该提连播");
});

test("目标记录读不出来或是乱的：照样弹通知，按复习处理", async () => {
  for (const [label, opts] of [
    ["缓存打不开", { cacheBroken: true }],
    ["记录是乱写的", { target: "javascript:alert(1)" }],
    ["记录是空的", { target: "" }],
  ]) {
    const sw = makeSW(opts);
    await dispatch(sw.listeners.push).settled();
    assert.equal(sw.shown.length, 1, `${label}：没弹通知`);
    assert.equal(sw.shown[0].opts.data.to, "review", `${label}：目标不是复习`);
  }
});

test("点通知、App 没开着：打开 App，直接落在目标页，并关掉通知", async () => {
  for (const [to, url] of [["review", "./?to=review"], ["loop", "./?to=loop"]]) {
    const sw = makeSW();
    assert.equal(typeof sw.listeners.notificationclick, "function", "sw.js 没有处理点通知");
    const n = makeNotification({ to });
    const d = dispatch(sw.listeners.notificationclick, { notification: n });
    await d.settled();
    assert.equal(d.waits.length, 1, "没有用 waitUntil 包住打开窗口这一步");
    assert.equal(n.closed, true, "点过的通知还挂在那里");
    assert.deepEqual(sw.opened, [url], `目标 ${to} 打开的是 ${sw.opened.join(", ")}`);
    assert.equal(sw.ctx.__matchQuery.type, "window");
    assert.equal(sw.ctx.__matchQuery.includeUncontrolled, true,
      "只找受控窗口的话，刚更新过的 App 会被当成没开着，再开一个");
  }
});

test("点通知、App 还开在后台：不开第二个，切到前台并告诉它去哪", async () => {
  const messages = [];
  let focused = 0;
  const win = { postMessage: m => messages.push(m), focus: async () => { focused++; return win; } };
  const sw = makeSW({ windows: [win] });
  const n = makeNotification({ to: "loop" });
  await dispatch(sw.listeners.notificationclick, { notification: n }).settled();
  assert.deepEqual(sw.opened, [], "App 开着还又开了一个");
  assert.equal(focused, 1, "没把 App 切到前台");
  // 消息是在 vm 里造的，原型属于另一个运行环境；只比内容。
  assert.deepEqual(messages.map(m => ({ ...m })), [{ type: "ll-push-open", to: "loop" }]);
});

test("通知里的目标被改成奇怪的值：只会去复习", async () => {
  for (const data of [{ to: "https://evil.example" }, { to: "../../etc" }, null, undefined, {}]) {
    const sw = makeSW();
    await dispatch(sw.listeners.notificationclick, { notification: makeNotification(data) }).settled();
    assert.deepEqual(sw.opened, ["./?to=review"], `data=${JSON.stringify(data)} 打开了 ${sw.opened}`);
  }
});

test("App 更新清旧缓存时，记录目标的缓存不会被删", async () => {
  const sw = makeSW({ target: "loop" });
  sw.stores.set("ll-old", new Map());
  await dispatch(sw.listeners.activate).settled();
  assert.ok(!sw.stores.has("ll-old"), "对照失败：旧的 ll- 缓存本该被删");
  assert.ok(sw.stores.has("push-spike"), "记录推送目标的缓存被一起删了——下次推送就不知道去哪");
});

// ── 到点提醒（2026-09-18）──────────────────────────────────────────────
// 家长开启提醒时，服务器马上推一条确认通知。它和到点的提醒是同一种空推送，
// 分不出来——所以页面在开启前先留一个「这次是确认」的记号，Service Worker
// 收到时读到它就换一句话，并且把记号擦掉，只管这一次。
//
//   家长点「开启提醒」—— 手机上马上出现「到点提醒已开启」，而不是一句莫名
//   其妙的「到点了」；明天真到点时，看到的是正常的提醒。

test("开启时的确认通知：说「已开启」，只说这一次", async () => {
  const sw = makeSW({ target: "review" });
  sw.stores.get("push-spike").set("./__push-confirm", "1");
  await dispatch(sw.listeners.push).settled();
  assert.match(sw.shown[0].opts.body, /已开启/, `确认通知写的是「${sw.shown[0].opts.body}」`);
  assert.ok(!sw.stores.get("push-spike").has("./__push-confirm"), "记号没擦掉——明天的提醒也会说「已开启」");
  await dispatch(sw.listeners.push).settled();
  assert.doesNotMatch(sw.shown[1].opts.body, /已开启/, "第二条推送还在说「已开启」");
  assert.match(sw.shown[1].opts.body, /复习/, "对照失败：正常提醒该提到复习");
});

test("没有确认记号时：照常是到点提醒；缓存坏了也照常弹", async () => {
  const sw = makeSW({ target: "loop" });
  await dispatch(sw.listeners.push).settled();
  assert.doesNotMatch(sw.shown[0].opts.body, /已开启/);
  const broken = makeSW({ cacheBroken: true });
  await dispatch(broken.listeners.push).settled();
  assert.equal(broken.shown.length, 1, "缓存打不开时没弹通知");
});

console.log("service-worker push tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
