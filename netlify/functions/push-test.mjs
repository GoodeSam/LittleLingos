// netlify/functions/push-test.mjs — 推送试验（ADR 0008 · 试验 E）。
//
// 一台手机把自己的推送地址交上来，这里当场往那个地址推一条空通知，然后忘掉。
// 什么都不存：没有数据库、没有文件、没有模块级的表。它回答的是平台问题——
// 锁屏收不收得到、点开落在哪、点开后能不能出声——不是产品功能。
//
// 签名、地址白名单、发送都在 _shared/push.mjs，和正式的到点提醒共用一份。
//
//   POST { subscription: { endpoint }, delaySec? }
//     -> { sent, pushStatus, gone, host }
//
// Requires: LL_ACCESS_CODE, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY
// 两把钥匙只设在 Netlify 的 branch-deploy 环境里，生产环境没有。
import { isAuthorized, refuse } from "./_shared/access.mjs";
import { pushEndpoint, vapidFromEnv, sendEmptyPush } from "./_shared/push.mjs";

// 家长点完按钮要来得及锁屏。Netlify 同步 function 默认 10 秒超时，
// 等 8 秒再加一次推送请求刚好放得下。
const MAX_DELAY_S = 8;

// 试验里通知过时就没意义了，一分钟够。
const TTL_S = 60;

const bad = error => Response.json({ error }, { status: 400 });

export default async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "method not allowed" }, { status: 405 });
  }
  if (!isAuthorized(req)) return refuse();

  const vapid = vapidFromEnv();
  if (!vapid) return Response.json({ error: "push not configured" }, { status: 500 });

  let body;
  try { body = await req.json(); } catch { return bad("invalid json"); }

  const url = pushEndpoint(body && body.subscription && body.subscription.endpoint);
  if (!url) return bad("endpoint is not a known push service");

  const n = Number(body.delaySec);
  const delay = Number.isFinite(n) ? Math.min(Math.max(n, 0), MAX_DELAY_S) : 0;
  if (delay > 0) await new Promise(r => setTimeout(r, delay * 1000));

  const r = await sendEmptyPush(url, vapid, { ttl: TTL_S });
  if (r.error) {
    return Response.json({ sent: false, error: r.error, host: url.hostname }, { status: 502 });
  }
  return Response.json({ sent: r.sent, pushStatus: r.pushStatus, gone: r.gone, host: url.hostname });
};

export const config = { path: "/api/push-test" };
