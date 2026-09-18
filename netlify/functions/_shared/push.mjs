// 发一条空推送。试验（push-test）和正式的到点提醒（reminder）共用这一份。
//
// 为什么是空推送：带内容的推送要按 RFC 8291 加密，通常得装 web-push 库。
// 空推送只需要 VAPID 签名（RFC 8292），Node 自带的 crypto 就够；通知写什么
// 由 Service Worker 决定。2026-09-17 在 iPhone 主屏幕版上实测可行（C17）。
//
// 为什么只认几家推送服务：调用方交来一个「地址」，这里就往那个地址发 POST。
// 不设白名单，它就是一个能打任意网址的跳板（包括云平台的内网元数据地址）。
import { createPrivateKey, sign } from "node:crypto";

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

// 让推送服务在手机离线时替我们留一会儿。提醒晚一小时还有用，晚一天就没有了。
const TTL_S = 3600;
const PUSH_TIMEOUT_MS = 1500;

const b64u = buf => Buffer.from(buf).toString("base64url");

// 合格的推送地址返回 URL 对象，否则 null。
export function pushEndpoint(raw) {
  let url;
  try { url = new URL(raw); } catch { return null; }
  if (url.protocol !== "https:" || !PUSH_HOSTS.some(re => re.test(url.hostname))) return null;
  return url;
}

// 从环境变量拼出签名用的钥匙。公钥必须是 65 字节的未压缩点（0x04 开头），
// 否则说明配错了——宁可返回 null 让调用方报错，也不要发一个苹果会拒收的签名。
export function vapidFromEnv(env = process.env) {
  const pub = env.VAPID_PUBLIC_KEY, d = env.VAPID_PRIVATE_KEY;
  if (!pub || !d) return null;
  const raw = Buffer.from(pub, "base64url");
  if (raw.length !== 65 || raw[0] !== 4) return null;
  try {
    const key = createPrivateKey({
      key: { kty: "EC", crv: "P-256", d, x: b64u(raw.subarray(1, 33)), y: b64u(raw.subarray(33)) },
      format: "jwk",
    });
    return { pub, key };
  } catch {
    return null;
  }
}

function vapidJwt(aud, key) {
  const header = b64u(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const payload = b64u(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: SUBJECT }));
  const sig = sign("sha256", Buffer.from(`${header}.${payload}`), { key, dsaEncoding: "ieee-p1363" });
  return `${header}.${payload}.${b64u(sig)}`;
}

// 返回 { sent, pushStatus, gone, error? }。从不抛错：推送服务连不上是
// 「这一次没发成」，不是「整个请求失败」。
export async function sendEmptyPush(url, vapid, { ttl = TTL_S } = {}) {
  try {
    const res = await fetch(url.href, {
      method: "POST",
      headers: {
        TTL: String(ttl),
        Urgency: "high",
        Authorization: `vapid t=${vapidJwt(url.origin, vapid.key)}, k=${vapid.pub}`,
        "Content-Length": "0",
      },
      signal: AbortSignal.timeout(PUSH_TIMEOUT_MS),
    });
    return {
      sent: res.status >= 200 && res.status < 300,
      pushStatus: res.status,
      gone: res.status === 404 || res.status === 410,
    };
  } catch {
    return { sent: false, pushStatus: 0, gone: false, error: "push service unreachable" };
  }
}
