#!/usr/bin/env node
// 推送试验的服务端（ADR 0008 · 试验 E）。
//
// 这个 function 只做一件事：收到一台手机的推送地址，当场往那个地址推一条
// 空通知，然后忘掉。它存在的理由是回答平台问题——锁屏收不收得到、点开落
// 在哪、点开后能不能出声——而不是做产品功能。
//
// 这一组测试守着三条边界，每一条都是 ADR 0008 里写明的：
//   · 不存任何东西：地址进来、推一次、忘掉
//   · 只往真正的推送服务发请求：否则它就是一个能替任何人向任意地址发请求
//     的跳板
//   · 挡在邀请码后面（这一条由 access-control.test.mjs 的全接口扫描负责）
//
// 推送服务在本项目控制之外，所以打给它的请求被截下来；签名是真算、真验的。
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   1. 家长在设置里点「推给我」，手机很快收到一条通知 —— 服务器向苹果的
//      推送服务发了一次请求，带着能被验证的签名，内容是空的。
//   2. 有人把一个不是推送服务的地址塞进来，想借服务器去访问别的网站 ——
//      被拒绝，一个请求都没发出去。
//   3. 部署时忘了配签名密钥 —— 明确报错，不会发出一个没签名的请求。
//   4. 这台手机的推送授权已经失效 —— 家长看到的是「失效了」，而不是「成功」。
//   5. 家长想先锁屏再收通知，要求晚几秒推 —— 最多等 8 秒，填多少都不会更久，
//      乱填就不等。
//   6. 推送服务一时连不上 —— 给出明确的失败，而不是整个请求挂掉。
import assert from "node:assert/strict";
import { generateKeyPairSync, createPublicKey, verify } from "node:crypto";
import { readFileSync } from "node:fs";

const FILE = new URL("../netlify/functions/push-test.mjs", import.meta.url);
const CODE = "test-access-code-1234";
const APPLE = "https://web.push.apple.com/QGVkJ2FiY2RlZmdoaWprbG1ub3A";

// 每次跑都现生成一对，测试里没有任何写死的密钥。
const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const jwk = privateKey.export({ format: "jwk" });
const b64u = b => Buffer.from(b).toString("base64url");
const PUB = b64u(Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, "base64url"), Buffer.from(jwk.y, "base64url")]));
const KEYS = { LL_ACCESS_CODE: CODE, VAPID_PUBLIC_KEY: PUB, VAPID_PRIVATE_KEY: jwk.d };

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

function withEnv(vars, fn) {
  const prev = {};
  for (const [k, v] of Object.entries(vars)) {
    prev[k] = process.env[k];
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
  return Promise.resolve().then(fn).finally(() => {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  });
}

// 截下所有出站请求。reply 决定推送服务怎么回；默认 201（苹果的「已接收」）。
async function withPush(reply, fn) {
  const calls = [];
  const prevFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (reply instanceof Error) throw reply;
    return new Response(null, { status: reply ?? 201 });
  };
  try { return await fn(calls); } finally { globalThis.fetch = prevFetch; }
}

// 「晚几秒推」要真等的话，一条测试就是 8 秒。把计时器换成记账的：只记要等
// 多久，立刻放行。
async function withClock(fn) {
  const waits = [];
  const prev = globalThis.setTimeout;
  globalThis.setTimeout = (cb, ms) => { waits.push(ms); cb(); return 0; };
  try { return await fn(waits); } finally { globalThis.setTimeout = prev; }
}

const post = (body, { code = CODE, method = "POST" } = {}) => new Request("https://example.test/api/push-test", {
  method,
  headers: { "Content-Type": "application/json", ...(code ? { "X-LL-Access": code } : {}) },
  body: method === "GET" ? undefined : JSON.stringify(body),
});
const sub = endpoint => ({ subscription: { endpoint, keys: { p256dh: "x", auth: "y" } } });
const load = () => import(FILE).then(m => m.default);

function decodeJwt(t) {
  const [h, p, s] = t.split(".");
  return {
    header: JSON.parse(Buffer.from(h, "base64url")),
    payload: JSON.parse(Buffer.from(p, "base64url")),
    signed: Buffer.from(`${h}.${p}`),
    sig: Buffer.from(s, "base64url"),
  };
}

test("有码、地址是苹果推送服务：只发一次，签名验得过，内容为空", async () => {
  const handler = await load();
  await withEnv(KEYS, () => withPush(201, async calls => {
    const res = await handler(post(sub(APPLE)));
    assert.equal(res.status, 200);
    const out = await res.json();
    assert.equal(out.sent, true, "推送服务收下了，却没告诉家长发出去了");
    assert.equal(out.pushStatus, 201);

    assert.equal(calls.length, 1, `应该只发一次，实际 ${calls.length} 次`);
    const { url, init } = calls[0];
    assert.equal(url, APPLE, "发去的不是手机给的那个地址");
    assert.equal(init.method, "POST");
    const h = new Headers(init.headers);
    assert.ok(Number(h.get("TTL")) > 0, "没有 TTL：推送服务可能直接丢弃");
    assert.ok(!init.body || init.body.length === 0, "试验只发空通知，内容里不该有东西");

    const m = /^vapid t=([^,]+),\s*k=(.+)$/.exec(h.get("Authorization") || "");
    assert.ok(m, `签名头格式不对：${h.get("Authorization")}`);
    assert.equal(m[2], PUB, "签名头里的公钥不是配置的那把");
    const jwt = decodeJwt(m[1]);
    assert.equal(jwt.header.alg, "ES256");
    assert.equal(jwt.payload.aud, "https://web.push.apple.com", "aud 必须是推送服务的 origin");
    const now = Math.floor(Date.now() / 1000);
    assert.ok(jwt.payload.exp > now && jwt.payload.exp <= now + 24 * 3600, "有效期必须在 24 小时内");
    assert.match(jwt.payload.sub, /^(https:\/\/|mailto:)/, "苹果要求 sub 是 https 地址或 mailto");
    const pubKey = createPublicKey({ key: { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y }, format: "jwk" });
    assert.ok(verify("sha256", jwt.signed, { key: pubKey, dsaEncoding: "ieee-p1363" }, jwt.sig),
      "签名用配置的公钥验不过——苹果会拒收");
  }));
});

test("地址不是已知推送服务：拒绝，一个请求都不发", async () => {
  const handler = await load();
  const bad = [
    "https://evil.example/collect",
    "http://web.push.apple.com/x",            // 不是 https
    "https://web.push.apple.com.evil.example/x",
    "http://169.254.169.254/latest/meta-data",
    "not a url",
  ];
  await withEnv(KEYS, () => withPush(201, async calls => {
    for (const endpoint of bad) {
      const res = await handler(post(sub(endpoint)));
      assert.equal(res.status, 400, `${endpoint} 没被拒绝（${res.status}）`);
    }
    const res = await handler(post({}));
    assert.equal(res.status, 400, "没带地址也该拒绝");
    assert.equal(calls.length, 0, `被拒的请求里有 ${calls.length} 个发出去了`);
    // 对照组：同一个环境下，真的推送服务地址是放行的
    const ok = await handler(post(sub("https://fcm.googleapis.com/fcm/send/abc")));
    assert.equal(ok.status, 200, "对照失败：谷歌的推送地址本该放行");
    assert.equal(calls.length, 1);
  }));
});

test("没配签名密钥：明确报错，不发请求", async () => {
  const handler = await load();
  for (const missing of ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"]) {
    await withEnv({ ...KEYS, [missing]: undefined }, () => withPush(201, async calls => {
      const res = await handler(post(sub(APPLE)));
      assert.equal(res.status, 500, `缺 ${missing} 时应该报错，实际 ${res.status}`);
      assert.equal(calls.length, 0, `缺 ${missing} 时还是发出去了`);
    }));
  }
  // 公钥长得不对（不是 65 字节的未压缩点）也算没配好
  await withEnv({ ...KEYS, VAPID_PUBLIC_KEY: "abc" }, () => withPush(201, async calls => {
    const res = await handler(post(sub(APPLE)));
    assert.equal(res.status, 500, "公钥格式不对却没报错");
    assert.equal(calls.length, 0);
  }));
});

test("推送授权已失效（404 / 410）：告诉家长失效了，不说成功", async () => {
  const handler = await load();
  for (const status of [404, 410]) {
    await withEnv(KEYS, () => withPush(status, async () => {
      const res = await handler(post(sub(APPLE)));
      const out = await res.json();
      assert.equal(out.sent, false, `推送服务回 ${status}，却说发出去了`);
      assert.equal(out.gone, true, `推送服务回 ${status}，没说授权已失效`);
      assert.equal(out.pushStatus, status);
    }));
  }
  // 对照组：201 时 gone 必须是 false
  await withEnv(KEYS, () => withPush(201, async () => {
    const out = await (await handler(post(sub(APPLE)))).json();
    assert.equal(out.gone, false, "对照失败：正常收下时不该说失效");
  }));
});

test("晚几秒推：最多等 8 秒，乱填就不等", async () => {
  const handler = await load();
  const cases = [[3, 3000], [8, 8000], [99, 8000], [-5, 0], ["abc", 0], [undefined, 0]];
  for (const [delaySec, want] of cases) {
    await withEnv(KEYS, () => withPush(201, () => withClock(async waits => {
      await handler(post({ ...sub(APPLE), delaySec }));
      const total = waits.reduce((a, b) => a + b, 0);
      assert.equal(total, want, `delaySec=${JSON.stringify(delaySec)} 等了 ${total}ms，应为 ${want}ms`);
    })));
  }
});

test("推送服务连不上：返回 502，不抛错", async () => {
  const handler = await load();
  await withEnv(KEYS, () => withPush(new Error("ECONNRESET"), async () => {
    const res = await handler(post(sub(APPLE)));
    assert.equal(res.status, 502);
    const out = await res.json();
    assert.equal(out.sent, false);
  }));
});

test("只接受 POST", async () => {
  const handler = await load();
  await withEnv(KEYS, () => withPush(201, async calls => {
    const res = await handler(post(null, { method: "GET" }));
    assert.equal(res.status, 405);
    assert.equal(calls.length, 0);
  }));
});

// 找出源码里「可能在存东西」的迹象：引入文件/存储模块，或模块顶层的
// Map / Set / 空数组（这些都可能被拿来攒地址）。
function storageSmells(raw) {
  const src = raw.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const smells = [];
  if (/from\s+["'](node:)?fs(\/promises)?["']|require\(["'](node:)?fs|@netlify\/blobs/.test(src)) smells.push("引入了文件或存储模块");
  for (const l of src.split("\n")) {
    if (/^(const|let|var)\s/.test(l) && /new (Map|Set)\b|=\s*\[\s*\]/.test(l)) smells.push(l.trim());
  }
  return smells;
}

test("服务端什么都不存：不读写文件、不用存储服务、没有模块级的地址表", () => {
  // 对照组：这个检查真的认得出「在存东西」的写法。空壳什么都不存，照样能让
  // 本条变绿，所以得先证明它不是对什么都说没问题。
  for (const leaky of [
    'import { getStore } from "@netlify/blobs";',
    'import { writeFileSync } from "node:fs";',
    'import fs from "fs/promises";',
    "const seen = new Map();",
    "let endpoints = [];",
  ]) {
    assert.ok(storageSmells(leaky).length > 0, `对照失败：没认出「${leaky}」`);
  }
  assert.deepEqual(storageSmells("// const seen = new Map();\nconst MAX = 8;"), [],
    "对照失败：注释里的写法和普通常量不该被当成在存东西");

  const smells = storageSmells(readFileSync(FILE, "utf8"));
  assert.deepEqual(smells, [], `有可能在存数据：\n${smells.join("\n")}`);
});

test("网址是 /api/push-test", async () => {
  const mod = await import(FILE);
  assert.equal(mod.config && mod.config.path, "/api/push-test");
});

console.log("push-test endpoint tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
