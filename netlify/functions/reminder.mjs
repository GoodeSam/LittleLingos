// netlify/functions/reminder.mjs — 到点提醒（ADR 0008）。
//
// 一个接口，四个动作，全部挡在邀请码后面：
//
//   enable  { endpoint, secret, tz }        开启：记下这台手机，推一条确认通知
//   review  { endpoint, secret, at, tz? }   复习同步：把「上次复习」往后挪
//   disable { endpoint, secret }            关闭：删掉这台手机的记录
//   tick    {}                              检查到点：给该提醒的手机各推一次
//
// 服务器上每台手机一条记录，只有 Victor 2026-09-18 同意的五个字段：
// endpoint、lastReviewAt、lastSentAt、tz、secretHash。目标页（复习 / 连播）
// 只存在手机上——空推送用不上它。
//
// 设备口令（secret）：手机开启提醒时自己生成一串随机字符，服务器只存它的
// 指纹。之后改、关都要出示它。推送地址不能当凭证用（Codex 2026-09-18）：
// 它会经过推送服务、会出现在日志里，谁拿到了都不该能改这台手机的设置。
//
// tick 现在由别名上的外部钟（GitHub Actions）敲，上生产后换成 Netlify 的
// 定时任务调用同一段 runTick()。去重靠条件写入：先读到记录和它的版本号，
// 用「只有版本没变才写」把 lastSentAt 占下来，占到了才推；钟重复敲一下，
// 第二次占不到，就不会推第二次。推送失败就把占位退回去，下次检查补上。
//
// Requires: LL_ACCESS_CODE, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, REMINDER_STORE
// 可选（只在别名上、只为开发）：REMINDER_AFTER_MINUTES, REMINDER_RETRY_MINUTES,
// REMINDER_QUIET_HOURS=off
import { createHash, timingSafeEqual } from "node:crypto";
import { isAuthorized, refuse } from "./_shared/access.mjs";
import { pushEndpoint, vapidFromEnv, sendEmptyPush } from "./_shared/push.mjs";
import { ruleFromEnv, nextReminderAt, isDue, isValidTimeZone } from "./_shared/reminder-rule.mjs";
import { openReminderStore, MAX_RECORDS } from "./_shared/reminder-store.mjs";

const SECRET_RE = /^[A-Za-z0-9_-]{32,128}$/;
const sha256 = s => createHash("sha256").update(String(s), "utf8").digest("hex");
const keyFor = endpoint => sha256(endpoint);
const secretMatches = (rec, secret) =>
  typeof secret === "string" && !!rec.secretHash &&
  timingSafeEqual(Buffer.from(sha256(secret)), Buffer.from(String(rec.secretHash).padEnd(64).slice(0, 64)));

const json = (body, status = 200) => Response.json(body, { status });
const bad = error => json({ error }, 400);

async function enable(store, vapid, body, rule) {
  const url = pushEndpoint(body.endpoint);
  if (!url) return bad("endpoint is not a known push service");
  if (typeof body.secret !== "string" || !SECRET_RE.test(body.secret)) return bad("invalid secret");
  if (!isValidTimeZone(body.tz)) return bad("invalid time zone");

  const key = keyFor(url.href);
  const existing = await store.getWithMetadata(key, { type: "json" });
  if (existing && !secretMatches(existing.data, body.secret)) {
    return json({ error: "this device is registered with a different secret" }, 409);
  }
  if (!existing) {
    const { blobs } = await store.list();
    if (blobs.length >= MAX_RECORDS) return json({ error: "reminder capacity reached" }, 429);
  }

  const rec = {
    endpoint: url.href,
    secretHash: sha256(body.secret),
    tz: body.tz,
    lastReviewAt: Date.now(),
    lastSentAt: existing ? existing.data.lastSentAt ?? null : null,
  };
  await store.setJSON(key, rec);

  // 确认通知：证明这条路现在就是通的，不用等到明天才知道
  const confirm = await sendEmptyPush(url, vapid);
  if (confirm.gone) {
    await store.delete(key);
    return json({ ok: false, gone: true, confirm });
  }
  return json({ ok: true, nextAt: nextReminderAt(rec, rule), confirm });
}

// 读一条记录并核对口令。返回 { key, rec, etag } 或一个 Response。
async function owned(store, body) {
  const url = pushEndpoint(body.endpoint);
  if (!url) return bad("endpoint is not a known push service");
  if (typeof body.secret !== "string" || !SECRET_RE.test(body.secret)) return bad("invalid secret");
  const key = keyFor(url.href);
  const got = await store.getWithMetadata(key, { type: "json" });
  if (!got) return null;
  if (!secretMatches(got.data, body.secret)) return json({ error: "secret mismatch" }, 403);
  return { key, rec: got.data, etag: got.etag };
}

async function review(store, body, rule) {
  const at = Number(body.at);
  if (!Number.isFinite(at) || at <= 0) return bad("invalid review time");
  for (let attempt = 0; attempt < 3; attempt++) {
    const o = await owned(store, body);
    if (o === null) return json({ error: "no reminder for this device" }, 404);
    if (o instanceof Response) return o;
    // 手机时钟不准报了未来的时间，按现在算；离线攒下的旧时间不往回拨
    const t = Math.min(at, Date.now());
    const rec = {
      ...o.rec,
      lastReviewAt: Math.max(o.rec.lastReviewAt || 0, t),
      tz: isValidTimeZone(body.tz) ? body.tz : o.rec.tz,
    };
    const w = await store.setJSON(o.key, rec, { onlyIfMatch: o.etag });
    if (w.modified) return json({ ok: true, nextAt: nextReminderAt(rec, rule) });
  }
  return json({ error: "busy, try again" }, 503);
}

async function disable(store, body) {
  const o = await owned(store, body);
  if (o === null) return json({ ok: true });      // 关两次不算错
  if (o instanceof Response) return o;
  await store.delete(o.key);
  return json({ ok: true });
}

export async function runTick(store, vapid, rule, now = Date.now()) {
  const out = { checked: 0, sent: 0, gone: 0, failed: 0, skipped: 0 };
  const { blobs } = await store.list();
  for (const { key } of blobs) {
    const got = await store.getWithMetadata(key, { type: "json" });
    if (!got) continue;
    out.checked++;
    const rec = got.data;
    if (!isDue(rec, now, rule)) continue;
    const url = pushEndpoint(rec.endpoint);
    if (!url) { await store.delete(key); out.gone++; continue; }

    // 先占位：只有版本没变才写得进去。占不到说明另一次检查已经处理了它。
    const claim = await store.setJSON(key, { ...rec, lastSentAt: now }, { onlyIfMatch: got.etag });
    if (!claim.modified) { out.skipped++; continue; }

    const r = await sendEmptyPush(url, vapid);
    if (r.sent) { out.sent++; continue; }
    if (r.gone) { await store.delete(key); out.gone++; continue; }
    // 一时出错：把占位退回去，下次检查补上
    await store.setJSON(key, rec, { onlyIfMatch: claim.etag });
    out.failed++;
  }
  return out;
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  if (!isAuthorized(req)) return refuse();

  let body;
  try { body = await req.json(); } catch { return bad("invalid json"); }
  if (!body || typeof body !== "object") return bad("invalid body");
  const { action } = body;
  if (!["enable", "review", "disable", "tick"].includes(action)) return bad("unknown action");

  const vapid = vapidFromEnv();
  const store = await openReminderStore();
  if (!vapid || !store) return json({ error: "reminder not configured" }, 500);
  const rule = ruleFromEnv();

  if (action === "enable") return enable(store, vapid, body, rule);
  if (action === "review") return review(store, body, rule);
  if (action === "disable") return disable(store, body);
  return json(await runTick(store, vapid, rule));
};

export const config = { path: "/api/reminder" };
