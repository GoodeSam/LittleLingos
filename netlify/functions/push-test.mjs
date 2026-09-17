// netlify/functions/push-test.mjs — 推送试验（ADR 0008 · 试验 E）。
//
// 一台手机把自己的推送地址交上来，这里当场往那个地址推一条空通知，然后忘掉。
// 什么都不存：没有数据库、没有文件、没有模块级的表。它回答的是平台问题——
// 锁屏收不收得到、点开落在哪、点开后能不能出声——不是产品功能。
//
// 为什么是空通知：带内容的推送要按 RFC 8291 加密，通常得装 web-push 库，
// 而这个项目一个依赖都没有。空通知只需要 VAPID 签名（RFC 8292），Node 自带
// 的 crypto 就够。代价是通知文字只能由 Service Worker 写死。
//
// 为什么只认几家推送服务的地址：这个 function 会替调用者向「地址」发 POST。
// 不设白名单，它就是一个能打任意网址的跳板（包括云平台的内网元数据地址）。
//
//   POST { subscription: { endpoint }, delaySec? }
//     -> { sent, pushStatus, gone, host }
//
// Requires: LL_ACCESS_CODE, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
// 两把钥匙只设在 Netlify 的 branch-deploy 环境里，生产环境没有。
import { createPrivateKey, sign } from "node:crypto";
import { isAuthorized, refuse } from "./_shared/access.mjs";

// 苹果要求 sub 是 https 地址或 mailto；用站点地址，不暴露邮箱。
const SUBJECT = "https://littlelingos.netlify.app";

// 苹果（iPhone/Mac）、谷歌（Chrome/安卓）、Mozilla（Firefox）、微软（Edge）。
// 只认 https，主机名整段匹配——「web.push.apple.com.evil.example」不算。
const PUSH_HOSTS = [
  /^web\.push\.apple\.com$/,
  /^fcm\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^[a-z0-9-]+\.notify\.windows\.com$/,
];

// 家长点完按钮要来得及锁屏。Netlify 同步 function 默认 10 秒超时，
// 等 8 秒再加一次推送请求刚好放得下。
const MAX_DELAY_S = 8;
const PUSH_TIMEOUT_MS = 1500;

// 让推送服务在手机离线时替我们留一会儿。试验里通知过时就没意义了，一分钟够。
const TTL_S = 60;

const b64u = buf => Buffer.from(buf).toString("base64url");
const bad = error => Response.json({ error }, { status: 400 });

// 从环境变量拼出签名用的私钥。公钥必须是 65 字节的未压缩点（0x04 开头），
// 否则说明配错了——宁可报错，也不要发一个苹果会拒收的签名。
function signingKey(pubB64, dB64) {
  const pub = Buffer.from(pubB64, "base64url");
  if (pub.length !== 65 || pub[0] !== 4) return null;
  try {
    return createPrivateKey({
      key: { kty: "EC", crv: "P-256", d: dB64, x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33)) },
      format: "jwk",
    });
  } catch {
    return null;
  }
}

function vapidJwt(aud, key) {
  const header = b64u(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const payload = b64u(JSON.stringify({
    aud,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: SUBJECT,
  }));
  const sig = sign("sha256", Buffer.from(`${header}.${payload}`), { key, dsaEncoding: "ieee-p1363" });
  return `${header}.${payload}.${b64u(sig)}`;
}

export default async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "method not allowed" }, { status: 405 });
  }
  if (!isAuthorized(req)) return refuse();

  const pub = process.env.VAPID_PUBLIC_KEY;
  const key = pub && process.env.VAPID_PRIVATE_KEY
    ? signingKey(pub, process.env.VAPID_PRIVATE_KEY) : null;
  if (!key) return Response.json({ error: "push not configured" }, { status: 500 });

  let body;
  try { body = await req.json(); } catch { return bad("invalid json"); }

  let url;
  try { url = new URL(body && body.subscription && body.subscription.endpoint); }
  catch { return bad("invalid endpoint"); }
  if (url.protocol !== "https:" || !PUSH_HOSTS.some(re => re.test(url.hostname))) {
    return bad("endpoint is not a known push service");
  }

  const n = Number(body.delaySec);
  const delay = Number.isFinite(n) ? Math.min(Math.max(n, 0), MAX_DELAY_S) : 0;
  if (delay > 0) await new Promise(r => setTimeout(r, delay * 1000));

  let res;
  try {
    res = await fetch(url.href, {
      method: "POST",
      headers: {
        TTL: String(TTL_S),
        Urgency: "high",
        Authorization: `vapid t=${vapidJwt(url.origin, key)}, k=${pub}`,
        "Content-Length": "0",
      },
      signal: AbortSignal.timeout(PUSH_TIMEOUT_MS),
    });
  } catch {
    return Response.json({ sent: false, error: "push service unreachable", host: url.hostname }, { status: 502 });
  }

  return Response.json({
    sent: res.status >= 200 && res.status < 300,
    pushStatus: res.status,
    gone: res.status === 404 || res.status === 410,
    host: url.hostname,
  });
};

export const config = { path: "/api/push-test" };
