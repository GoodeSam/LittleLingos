#!/usr/bin/env node
// 到点提醒的服务端接口 /api/reminder（ADR 0008）。
//
// 一个接口，四个动作：开启、复习同步、关闭、检查到点（tick）。全部挡在邀请码
// 后面（门本身由 access-control.test.mjs 的全接口扫描守着）。
//
// 服务器上每台手机只存一条记录，字段是 Victor 2026-09-18 同意的那五个：
// 推送地址、上次复习时间、上次发送时间、时区、设备口令的指纹。不存目标页、
// 不存推送加密钥匙、不存口令本身。
//
// 存储（Netlify Blobs）和推送服务都在本项目控制之外：存储换成内存替身
// （REMINDER_STORE=memory:…），推送请求被截下。提醒规则、口令比对、条件写入
// 这些核心逻辑都是真实现。
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   1. 家长在设置里开启提醒 —— 服务器记下这台手机，只记同意过的五样；
//      手机马上收到一条「已开启」的通知，证明这条路是通的。
//   2. 乱填的地址、太短的口令、不存在的时区 —— 拒绝，什么都不记、不发。
//   3. 有人拿到了这台手机的推送地址，想用自己的口令改掉它的设置 —— 拒绝。
//   4. 家长复习了一轮 —— 服务器把「上次复习」往后挪；手机时钟不准报了个
//      未来的时间，按现在算；离线时攒下的旧时间，不会把它往回拨。
//   5. 家长关掉提醒 —— 服务器那条记录删掉；别人的口令删不掉。
//   6. 到点了 —— 该提醒的每台手机推一次，没到点的不推；推送地址已失效的
//      顺手删掉；推送服务一时出错的，下次检查再补，不会就此跳过一整天。
//   7. 两个检查同时跑（钟重复敲了一下）—— 同一台手机只推一次。
//   8. 部署时忘了配存储 —— 明确报错，什么都不发。
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import handler from "../netlify/functions/reminder.mjs";
import { __memoryStoreForTest, MAX_RECORDS } from "../netlify/functions/_shared/reminder-store.mjs";

const CODE = "test-access-code-1234";
const jwk = generateKeyPairSync("ec", { namedCurve: "P-256" }).privateKey.export({ format: "jwk" });
const PUB = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, "base64url"), Buffer.from(jwk.y, "base64url")]).toString("base64url");
const BASE_ENV = { LL_ACCESS_CODE: CODE, VAPID_PUBLIC_KEY: PUB, VAPID_PRIVATE_KEY: jwk.d };

const HOUR = 3600 * 1000;
const SECRET = "s".repeat(43);
const OTHER_SECRET = "o".repeat(43);
let n = 0;
const endpoint = () => `https://web.push.apple.com/device-${++n}`;

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// 每条测试一个独立的内存存储，互不串味。
async function withSetup(fn, { push = 201, env = {} } = {}) {
  const storeName = `memory:t${++n}`;
  const vars = { ...BASE_ENV, REMINDER_STORE: storeName, ...env };
  const prev = {};
  for (const [k, v] of Object.entries(vars)) { prev[k] = process.env[k]; if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  const calls = [];
  const prevFetch = globalThis.fetch;
  let reply = push;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    const r = typeof reply === "function" ? reply(String(url)) : reply;
    if (r instanceof Error) throw r;
    return new Response(null, { status: r });
  };
  try {
    return await fn({ store: __memoryStoreForTest(storeName), calls, setPush: r => { reply = r; } });
  } finally {
    globalThis.fetch = prevFetch;
    for (const [k, v] of Object.entries(prev)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
}

const call = async (body, { code = CODE } = {}) => {
  const res = await handler(new Request("https://example.test/api/reminder", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(code ? { "X-LL-Access": code } : {}) },
    body: JSON.stringify(body),
  }));
  let out = null;
  try { out = await res.json(); } catch {}
  return { status: res.status, out };
};
const enable = (ep, extra = {}) => call({ action: "enable", endpoint: ep, secret: SECRET, tz: "Asia/Shanghai", ...extra });
async function recordOf(store, ep) {
  for (const { key } of (await store.list()).blobs) {
    const r = await store.get(key, { type: "json" });
    if (r && r.endpoint === ep) return { key, rec: r };
  }
  return null;
}
async function seed(store, rec) {
  const key = `seed-${++n}`;
  await store.setJSON(key, { secretHash: "x", tz: "Asia/Shanghai", lastSentAt: null, ...rec });
  return key;
}

// ── 1. 开启 ───────────────────────────────────────────────────────────

test("开启提醒：只记同意过的五样，口令只存指纹；马上推一条确认通知", async () => {
  await withSetup(async ({ store, calls }) => {
    const ep = endpoint();
    const before = Date.now();
    const { status, out } = await enable(ep, { target: "loop", keys: { p256dh: "p", auth: "a" } });
    assert.equal(status, 200, JSON.stringify(out));
    assert.equal(out.ok, true);
    const found = await recordOf(store, ep);
    assert.ok(found, "服务器没记下这台手机");
    assert.deepEqual(Object.keys(found.rec).sort(),
      ["endpoint", "lastReviewAt", "lastSentAt", "secretHash", "tz"],
      `记了同意范围之外的东西：${Object.keys(found.rec).join(", ")}`);
    assert.notEqual(found.rec.secretHash, SECRET, "口令原样存进了服务器");
    assert.ok(!JSON.stringify(found.rec).includes(SECRET), "口令原文出现在记录里");
    assert.ok(found.rec.lastReviewAt >= before && found.rec.lastReviewAt <= Date.now(),
      "第一次提醒应从开启的那一刻算起");
    assert.equal(found.rec.lastSentAt, null);
    assert.equal(calls.length, 1, "开启时应推一条确认通知");
    assert.equal(calls[0].url, ep);
    assert.equal(out.confirm && out.confirm.sent, true);
    assert.ok(out.nextAt > Date.now(), "没告诉家长下一次什么时候提醒");
  });
});

test("开启时乱填：拒绝，什么都不记、不发", async () => {
  await withSetup(async ({ store, calls }) => {
    const bad = [
      { endpoint: "https://evil.example/x" },
      { endpoint: "not a url" },
      { secret: "short" },
      { secret: "has spaces and 中文 ".repeat(4) },
      { secret: undefined },
      { tz: "Mars/Base" },
      { tz: undefined },
    ];
    for (const patch of bad) {
      const { status } = await enable(endpoint(), patch);
      assert.equal(status, 400, `${JSON.stringify(patch)} 没被拒绝（${status}）`);
    }
    const { status } = await call({ action: "fly", endpoint: endpoint(), secret: SECRET });
    assert.equal(status, 400, "不认识的动作也该拒绝");
    assert.equal((await store.list()).blobs.length, 0, "被拒的请求留下了记录");
    assert.equal(calls.length, 0, "被拒的请求发出了推送");
    // 对照组：同样的环境里，填对了就能开
    assert.equal((await enable(endpoint())).status, 200, "对照失败：正确的开启被拒了");
  });
});

test("有人拿着同一个推送地址、换了口令来开启：拒绝，原记录不变", async () => {
  await withSetup(async ({ store }) => {
    const ep = endpoint();
    await enable(ep);
    const before = (await recordOf(store, ep)).rec;
    const { status } = await enable(ep, { secret: OTHER_SECRET, tz: "UTC" });
    assert.equal(status, 409);
    assert.deepEqual((await recordOf(store, ep)).rec, before, "冒充者改动了原记录");
    // 对照组：原主人用原口令再开一次是可以的（比如换了时区）
    const again = await enable(ep, { tz: "UTC" });
    assert.equal(again.status, 200, "对照失败：原主人重新开启被拒了");
    assert.equal((await recordOf(store, ep)).rec.tz, "UTC");
  });
});

test(`记录数封顶 ${MAX_RECORDS} 条：满了拒绝新的，已有的照常`, async () => {
  await withSetup(async ({ store }) => {
    for (let i = 0; i < MAX_RECORDS; i++) await seed(store, { endpoint: `https://web.push.apple.com/full-${i}`, lastReviewAt: Date.now() });
    const { status } = await enable(endpoint());
    assert.equal(status, 429, "满了还在收");
    assert.equal((await store.list()).blobs.length, MAX_RECORDS);
  });
});

test("确认通知被推送服务告知已失效：删掉记录，告诉家长", async () => {
  await withSetup(async ({ store }) => {
    const ep = endpoint();
    const { out } = await enable(ep);
    assert.equal(out.ok, false);
    assert.equal(out.gone, true);
    assert.equal(await recordOf(store, ep), null, "失效的地址还留在服务器上");
  }, { push: 410 });
});

// ── 2. 复习同步 ───────────────────────────────────────────────────────

test("复习同步：往后挪；未来的时间按现在算；旧时间不往回拨；口令不对不改", async () => {
  await withSetup(async ({ store }) => {
    const ep = endpoint();
    await enable(ep);
    // 把「上次复习」拨回 10 小时前，后面的时间才有确定的先后
    const { key, rec } = await recordOf(store, ep);
    const t0 = Date.now() - 10 * HOUR;
    await store.setJSON(key, { ...rec, lastReviewAt: t0 });

    const later = t0 + 5 * HOUR;
    assert.equal((await call({ action: "review", endpoint: ep, secret: SECRET, at: later })).status, 200);
    assert.equal((await recordOf(store, ep)).rec.lastReviewAt, later, "复习时间没往后挪");

    const before = Date.now();
    await call({ action: "review", endpoint: ep, secret: SECRET, at: Date.now() + 10 * HOUR });
    const clamped = (await recordOf(store, ep)).rec.lastReviewAt;
    assert.ok(clamped >= before && clamped <= Date.now(), "未来的时间没被按现在算");

    await call({ action: "review", endpoint: ep, secret: SECRET, at: t0 - 5 * HOUR });
    assert.equal((await recordOf(store, ep)).rec.lastReviewAt, clamped, "离线攒下的旧时间把「上次复习」往回拨了");

    const wrong = await call({ action: "review", endpoint: ep, secret: OTHER_SECRET, at: Date.now() });
    assert.equal(wrong.status, 403);
    assert.equal((await recordOf(store, ep)).rec.lastReviewAt, clamped, "口令不对也改了");

    const unknown = await call({ action: "review", endpoint: endpoint(), secret: SECRET, at: Date.now() });
    assert.equal(unknown.status, 404, "没开过提醒的手机，同步应告诉它记录不在了");
  });
});

// ── 3. 关闭 ───────────────────────────────────────────────────────────

test("关闭提醒：记录删掉；别人的口令删不掉；关两次也不出错", async () => {
  await withSetup(async ({ store, calls }) => {
    const ep = endpoint();
    await enable(ep);
    const wrong = await call({ action: "disable", endpoint: ep, secret: OTHER_SECRET });
    assert.equal(wrong.status, 403);
    assert.ok(await recordOf(store, ep), "别人的口令把记录删了");
    assert.equal((await call({ action: "disable", endpoint: ep, secret: SECRET })).status, 200);
    assert.equal(await recordOf(store, ep), null, "关了提醒，记录还在");
    assert.equal((await call({ action: "disable", endpoint: ep, secret: SECRET })).status, 200, "关第二次报错了");
    assert.equal(calls.length, 1, "关闭不该发推送（那 1 次是开启时的确认）");
  });
});

// ── 4. 检查到点 ───────────────────────────────────────────────────────

test("检查到点：到点的推一次并记下时间，没到点的不推", async () => {
  await withSetup(async ({ store, calls }) => {
    const now = Date.now();
    const dueEp = "https://web.push.apple.com/due", notEp = "https://web.push.apple.com/not-yet";
    const dueKey = await seed(store, { endpoint: dueEp, lastReviewAt: now - 25 * HOUR });
    const notKey = await seed(store, { endpoint: notEp, lastReviewAt: now - 1 * HOUR });
    const { status, out } = await call({ action: "tick" });
    assert.equal(status, 200);
    assert.deepEqual(calls.map(c => c.url), [dueEp], `推给了：${calls.map(c => c.url).join(", ")}`);
    assert.equal(out.sent, 1);
    const due = await store.get(dueKey, { type: "json" });
    assert.ok(due.lastSentAt >= now, "推过了却没记下发送时间——下一次检查会再推");
    assert.equal((await store.get(notKey, { type: "json" })).lastSentAt, null);
  }, { env: { REMINDER_QUIET_HOURS: "off" } });
});

test("检查到点：推送地址已失效的删掉；推送服务一时出错的下次补上", async () => {
  await withSetup(async ({ store, calls, setPush }) => {
    const now = Date.now();
    const goneEp = "https://web.push.apple.com/gone", flakyEp = "https://web.push.apple.com/flaky";
    const goneKey = await seed(store, { endpoint: goneEp, lastReviewAt: now - 25 * HOUR });
    const flakyKey = await seed(store, { endpoint: flakyEp, lastReviewAt: now - 25 * HOUR });
    setPush(url => (url === goneEp ? 410 : url === flakyEp ? 500 : 201));
    const { out } = await call({ action: "tick" });
    assert.equal(out.gone, 1);
    assert.equal(out.failed, 1);
    assert.equal(await store.get(goneKey, { type: "json" }), null, "失效的地址没删");
    assert.equal((await store.get(flakyKey, { type: "json" })).lastSentAt, null,
      "推送失败却记成发过了——这一天的提醒就丢了");
    // 下一次检查，推送服务恢复了：补上
    setPush(201);
    calls.length = 0;
    const second = await call({ action: "tick" });
    assert.deepEqual(calls.map(c => c.url), [flakyEp], "恢复后没补推");
    assert.equal(second.out.sent, 1);
    // 推送服务连不上（网络错误）也按一时出错处理
    await store.setJSON(flakyKey, { ...(await store.get(flakyKey, { type: "json" })), lastSentAt: null });
    setPush(new Error("ECONNRESET"));
    const third = await call({ action: "tick" });
    assert.equal(third.status, 200, "推送服务连不上时，整个检查不该失败");
    assert.equal((await store.get(flakyKey, { type: "json" })).lastSentAt, null);
  }, { env: { REMINDER_QUIET_HOURS: "off" } });
});

test("两个检查同时跑：同一台手机只推一次", async () => {
  await withSetup(async ({ store, calls }) => {
    await seed(store, { endpoint: "https://web.push.apple.com/once", lastReviewAt: Date.now() - 25 * HOUR });
    const [a, b] = await Promise.all([call({ action: "tick" }), call({ action: "tick" })]);
    assert.equal(calls.length, 1, `推了 ${calls.length} 次`);
    assert.equal(a.out.sent + b.out.sent, 1);
  }, { env: { REMINDER_QUIET_HOURS: "off" } });
});

test("开发时缩短间隔：几分钟后就到点", async () => {
  await withSetup(async ({ store, calls }) => {
    await seed(store, { endpoint: "https://web.push.apple.com/quick", lastReviewAt: Date.now() - 4 * 60 * 1000 });
    await call({ action: "tick" });
    assert.equal(calls.length, 1, "设成 3 分钟后，4 分钟前复习过的应该到点了");
  }, { env: { REMINDER_AFTER_MINUTES: "3", REMINDER_QUIET_HOURS: "off" } });
});

// ── 5. 配置 ───────────────────────────────────────────────────────────

test("没配存储或签名钥匙：明确报错，什么都不发", async () => {
  for (const missing of ["REMINDER_STORE", "VAPID_PRIVATE_KEY"]) {
    await withSetup(async ({ calls }) => {
      const { status } = await enable(endpoint());
      assert.equal(status, 500, `缺 ${missing} 时应该报错`);
      const tick = await call({ action: "tick" });
      assert.equal(tick.status, 500, `缺 ${missing} 时检查也应该报错`);
      assert.equal(calls.length, 0);
    }, { env: { [missing]: undefined } });
  }
});

console.log("reminder endpoint tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
