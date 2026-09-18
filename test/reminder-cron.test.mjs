#!/usr/bin/env node
// 正式版的钟：Netlify 定时任务 reminder-cron（ADR 0008）。
//
// 别名上的钟是临时的（手动或外部敲 /api/reminder 的 tick）；上生产后，每 5 分钟
// 由 Netlify 自己叫醒这个函数，跑的是和 tick 同一段 runTick()。所以这里不重测
// 「谁该提醒」「只推一次」——那些在 reminder-api.test.mjs 里——只测这个函数
// 自己的职责：按时被叫醒、真的去检查、配置缺了就明确报错。
//
// 存储与推送服务照旧换成替身（REMINDER_STORE=memory:…、截下 fetch）。
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   1. 正式版上线后，没有人去敲钟 —— 每 5 分钟自己醒一次，到点的手机收到提醒。
//   2. 上线时忘了配存储或签名钥匙 —— 定时任务明确报错（Netlify 日志里看得到），
//      什么都不发。
//   3. 这个函数只写了时间表、没写网址。（这条只检查配置本身；「没写网址就
//      调不到」要等正式版上线后从外面请求一次才算核实。）
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import cron, { config } from "../netlify/functions/reminder-cron.mjs";
import { __memoryStoreForTest } from "../netlify/functions/_shared/reminder-store.mjs";

const jwk = generateKeyPairSync("ec", { namedCurve: "P-256" }).privateKey.export({ format: "jwk" });
const PUB = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, "base64url"), Buffer.from(jwk.y, "base64url")]).toString("base64url");
const HOUR = 3600 * 1000;

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
let n = 0;

async function withEnv(vars, fn) {
  const prev = {};
  for (const [k, v] of Object.entries(vars)) { prev[k] = process.env[k]; if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  const calls = [];
  const prevFetch = globalThis.fetch;
  globalThis.fetch = async (url) => { calls.push(String(url)); return new Response(null, { status: 201 }); };
  const prevErr = console.error, prevLog = console.log;
  const logged = [];
  console.error = (...a) => logged.push(a.join(" "));
  console.log = (...a) => logged.push(a.join(" "));
  try { return await fn({ calls, logged }); }
  finally {
    globalThis.fetch = prevFetch;
    console.error = prevErr; console.log = prevLog;
    for (const [k, v] of Object.entries(prev)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  }
}

// Netlify 叫醒定时任务时，请求体里带着下一次运行的时间
const scheduledCall = () => cron(new Request("https://example.test/.netlify/functions/reminder-cron", {
  method: "POST", body: JSON.stringify({ next_run: new Date(Date.now() + 5 * 60 * 1000).toISOString() }),
}));

test("每 5 分钟醒一次，配置里没写网址", () => {
  assert.equal(config.schedule, "*/5 * * * *", `时间表是「${config.schedule}」`);
  assert.equal(config.path, undefined, "定时任务写了网址，就成了谁都能叫的接口，得装门");
});

test("醒来就检查：到点的推，没到点的不推，记下发送时间", async () => {
  const store = `memory:cron${++n}`;
  const s = __memoryStoreForTest(store);
  await s.setJSON("due", { endpoint: "https://web.push.apple.com/due", secretHash: "x", tz: "Asia/Shanghai", lastReviewAt: Date.now() - 25 * HOUR, lastSentAt: null });
  await s.setJSON("later", { endpoint: "https://web.push.apple.com/later", secretHash: "x", tz: "Asia/Shanghai", lastReviewAt: Date.now() - HOUR, lastSentAt: null });
  await withEnv({ VAPID_PUBLIC_KEY: PUB, VAPID_PRIVATE_KEY: jwk.d, REMINDER_STORE: store, REMINDER_QUIET_HOURS: "off" }, async ({ calls, logged }) => {
    const res = await scheduledCall();
    assert.ok(res.status < 300, `定时任务返回 ${res.status}`);
    assert.deepEqual(calls, ["https://web.push.apple.com/due"]);
    assert.ok((await s.get("due")).lastSentAt > 0, "推过了却没记下，下一次会再推");
    assert.ok(logged.some(l => /"sent":1/.test(l)), "日志里看不出这次推了几条——上线后只能靠它确认钟在走");
  });
});

test("忘了配存储或签名钥匙：明确报错，什么都不发", async () => {
  for (const missing of ["REMINDER_STORE", "VAPID_PRIVATE_KEY"]) {
    const env = { VAPID_PUBLIC_KEY: PUB, VAPID_PRIVATE_KEY: jwk.d, REMINDER_STORE: `memory:cron${++n}` };
    env[missing] = undefined;
    await withEnv(env, async ({ calls, logged }) => {
      const res = await scheduledCall();
      assert.equal(res.status, 500, `缺 ${missing} 时返回 ${res.status}`);
      assert.equal(calls.length, 0);
      assert.ok(logged.some(l => /not configured/.test(l)), `缺 ${missing} 时日志里没说`);
    });
  }
});

console.log("reminder cron tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
