#!/usr/bin/env node
// 到点提醒（ADR 0008）的客户端逻辑：开启、关闭、复习后同步。
//
// 由来（ADR 0009 第十八块，2026-09-28）：这一段原来把 caches / Notification /
// serviceWorker / crypto / document 全抓全局，只能在真浏览器里跑，所以开启、
// 关闭、同步这三条流程此前**只有 e2e 守着**。搬进 reminder.js 之后浏览器零件
// 全部从 create(deps) 传入，这些流程第一次能在 Node 里逐条验。
// 只 mock 不受本项目控制的东西：网络（api）、浏览器零件、时钟。storage 用真的。
//
// 对应的用户情境（不含函数名）：
//   1. 一轮复习要点很多下，不能每点一下就打一次服务器——攒 1.5 秒发一次。
//   2. 复习时断网：先攒着，联网后补发，不丢。
//   3. 服务器说「没有这台手机的记录」：手机上也改成已关闭，不假装还开着。
//   4. 开启时推送地址被别的口令占着：换个新地址重来，家长不用管。
//   5. 关闭时断网：提醒还开着，界面把这件事说清楚，不说「已关闭」。
//   6. 邀请码不对：开不成，也不留下「开启时的确认通知」那个标记。
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const { createStorage } = require(join(ROOT, "storage.js"));

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

const flush = () => new Promise(res => setTimeout(res, 0));

// 一个假的世界：真 storage，假网络、假浏览器零件、可驱动的时钟。
function world({ responses = [], stored = null } = {}) {
  const map = new Map();
  if (stored) map.set("ll_reminder", JSON.stringify(stored));
  const storage = createStorage({
    backend: { getItem: k => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: k => map.delete(k) },
    onWriteFailed: () => {},
  });
  const online = { value: true };
  const posts = [], said = [], timers = [], cacheOps = [];
  let subs = 0;
  const api = {
    post: async (path, body) => {
      posts.push({ path, body });
      if (!online.value) return { kind: "network", status: 0, body: null };
      const r = responses.shift() || { status: 200, body: { ok: true } };
      return { kind: r.status === 200 ? "ok" : "server", status: r.status, body: r.body };
    },
  };
  const lib = require(join(ROOT, "reminder.js"));
  const r = lib.create({
    storage, api,
    getAccessCode: () => "code",
    capabilityFacts: () => ({ installEnv: { isIOS: true }, isStandalone: true, pushSupported: true }),
    say: msg => said.push(msg),
    paint: () => {},
    caches: { open: async () => ({ put: async (k) => cacheOps.push(["put", k]), delete: async (k) => cacheOps.push(["delete", k]) }) },
    Notification: { requestPermission: async () => "granted" },
    serviceWorker: { ready: Promise.resolve({ pushManager: {
      getSubscription: async () => null,
      subscribe: async () => ({ endpoint: "https://push.example/" + (++subs), unsubscribe: async () => {} }),
    } }) },
    pushKey: () => new Uint8Array(4),
    crypto: globalThis.crypto,
    setTimeout: (fn, ms) => { timers.push({ fn, ms, at: now + ms }); return timers.length; },
    clearTimeout: id => { if (timers[id - 1]) timers[id - 1].fn = null; },
  });
  // 时钟有时间轴：advance(ms) 让时间往前走，到点的计时器按先后依次触发。
  // 「攒 1.5 秒」这件事只有在时间轴上才验得出来——同步连点三下看不出差别。
  let now = 0;
  const advance = async (ms) => {
    now += ms;
    for (;;) {
      const due = timers.filter(t => t.fn && t.at <= now).sort((x, y) => x.at - y.at)[0];
      if (!due) break;
      const fn = due.fn; due.fn = null; fn(); await flush();
    }
  };
  // 只跑最早那个还活着的计时器（被 clearTimeout 掉的不算），不管时间
  const tick = () => { const live = timers.filter(t => t.fn); const t = live.shift(); if (!t) return false; const fn = t.fn; t.fn = null; fn(); return true; };
  return { r, storage, online, posts, said, timers, tick, advance, cacheOps, map };
}
const ON = { on: true, secret: "s3cret", endpoint: "https://push.example/0", target: "review" };

test("一轮复习每秒点一下、点了五下：只在最后一下之后 1.5 秒同步一次，不是每 1.5 秒打一次", async () => {
  // 2026-09-28 变异探测抓出来的：原来这条是同步连点三下，「防抖」和「每下各排一个」
  // 在那种输入下发出去的请求数一样（第一次同步成功就把待同步清掉了）。
  // 差别只在复习持续超过 1.5 秒时才出现——所以按真实节奏来：每秒一下。
  const w = world({ stored: ON });
  for (let i = 0; i < 5; i++) { w.r.reminderNoteReview(); await w.advance(1000); }
  assert.equal(w.posts.length, 0, `还在复习中就发了 ${w.posts.length} 次——没等家长点完`);
  await w.advance(1500);
  assert.equal(w.posts.length, 1, `发了 ${w.posts.length} 次，应当只有最后一下之后的那一次`);
  assert.equal(w.posts[0].body.action, "review");
  assert.ok(typeof w.posts[0].body.at === "number", "没带上复习时间");
  await w.advance(10000);
  assert.equal(w.posts.length, 1, "后面又发了——同一轮复习不该同步第二次");
});

test("复习时断网：先攒着，联网后补发，不丢", async () => {
  const w = world({ stored: ON, responses: [{ status: 200, body: { ok: true, nextAt: 777 } }] });
  w.online.value = false;
  w.r.reminderNoteReview(); w.tick(); await flush();
  assert.ok(w.r.reminderState().pendingAt, "断网那次没发成，却把「待同步」清掉了——这次复习丢了");
  w.online.value = true;
  await w.r.flushReminderReview();
  assert.equal(w.posts.length, 2, "联网后没有补发");
  assert.equal(w.r.reminderState().pendingAt, null, "补发成功了，「待同步」却还留着");
  assert.equal(w.r.reminderState().nextAt, 777, "服务器给的下一次提醒时间没记下来");
});

test("服务器说没有这台手机的记录：手机上也改成已关闭，不假装还开着", async () => {
  const w = world({ stored: ON, responses: [{ status: 404, body: {} }] });
  w.r.reminderNoteReview(); w.tick(); await flush();
  const s = w.r.reminderState();
  assert.equal(!!s.on, false, "服务器已经没有这台手机了，界面还显示开着——家长以为会来、其实永远不来");
  assert.equal(s.target, "review", "关掉的时候不该把「点开去哪」也丢了");
});

test("开启时推送地址被别的口令占着（409）：换个新地址重来，家长不用管", async () => {
  const w = world({ responses: [{ status: 409, body: {} }, { status: 200, body: { ok: true, nextAt: 999 } }] });
  await w.r.enableReminder();
  assert.equal(w.posts.length, 2, "409 之后没有重试");
  assert.notEqual(w.posts[0].body.endpoint, w.posts[1].body.endpoint, "重试用的还是被占着的那个地址");
  const s = w.r.reminderState();
  assert.equal(s.on, true, "最后没开成");
  assert.equal(s.nextAt, 999);
  assert.ok(w.said.at(-1).includes("已开启"), `最后说的是「${w.said.at(-1)}」`);
});

test("关闭时断网：提醒还开着，界面把这件事说清楚", async () => {
  const w = world({ stored: ON });
  w.online.value = false;
  await w.r.disableReminder();
  assert.equal(w.r.reminderState().on, true, "没连上服务器却把本机改成了已关闭——服务器那边还会继续推");
  assert.ok(/还开着/.test(w.said.at(-1)), `该说清「还开着」，实际说的是「${w.said.at(-1)}」`);
});

test("邀请码不对：开不成，也不留下「开启时的确认通知」那个标记", async () => {
  const w = world({ responses: [{ status: 403, body: { error: "forbidden" } }] });
  await w.r.enableReminder();
  assert.equal(!!w.r.reminderState().on, false);
  assert.ok(/邀请码/.test(w.said.at(-1)), `该指路去改邀请码，实际说的是「${w.said.at(-1)}」`);
  assert.deepEqual(w.cacheOps.at(-1), ["delete", "./__push-confirm"], "没开成，确认标记却留下了——下一条真正的提醒会被当成「开启时的确认」");
});

test("这一块住在自己的文件里，进了离线清单和缓存戳；index.html 里不留第二份", () => {
  const html = readFileSync(join(ROOT, "index.html"), "utf8");
  assert.ok(html.includes('<script src="./reminder.js"></script>'), 'index.html 里没有 <script src="./reminder.js"></script>');
  for (const fn of ["enableReminder", "disableReminder", "flushReminderReview", "reminderCapability"]) {
    assert.equal(html.includes(`function ${fn}(`), false, `index.html 里还留着一份 ${fn} —— 两份会打架`);
  }
  const sw = readFileSync(join(ROOT, "sw.js"), "utf8");
  const shell = sw.slice(sw.indexOf("const SHELL = ["), sw.indexOf("];", sw.indexOf("const SHELL = [")));
  assert.ok(shell.includes("reminder.js"), "sw.js 的 SHELL 里没有它 —— 离线打开会白屏");
  const stamp = readFileSync(join(ROOT, "scripts/stamp-sw.mjs"), "utf8");
  const sources = stamp.slice(stamp.indexOf("const SOURCES = ["), stamp.indexOf("]", stamp.indexOf("const SOURCES = [")));
  assert.ok(sources.includes("reminder.js"), "stamp-sw.mjs 的 SOURCES 里没有它 —— 改了它缓存戳不变");
});

console.log("reminder tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message.split("\n")[0]}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
