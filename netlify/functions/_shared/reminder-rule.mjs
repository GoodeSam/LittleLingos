// 到点提醒的规则：什么时候该提醒（ADR 0008，Victor 2026-09-18 选定）。
//
//   · 上次复习后 23.5 小时提醒（Duolingo 后来改用的形式：不让家长挑时间，
//     跟着他自己的节奏走，每天略提前半小时，免得一点点往后漂）
//   · 提醒发了却没复习：那次提醒之后 24 小时再提醒一次，不轰炸，也不沉默
//   · 夜里 22:00～07:00 不打扰：落在这段里的推到当地早上 7 点
//
// 纯函数，不碰存储、不碰网络，所以能单独测到每一个边界。
const MIN = 60 * 1000;
const DEFAULT_AFTER_MIN = 23.5 * 60;
const DEFAULT_RETRY_MIN = 24 * 60;
const QUIET = { start: 22, end: 7 };   // 跨午夜
const MAX_MIN = 7 * 24 * 60;           // 设置里再大也没有意义，当成填错

function minutes(v, fallback) {
  if (typeof v !== "string" || !/^\d+$/.test(v)) return fallback;
  const n = Number(v);
  return n >= 1 && n <= MAX_MIN ? n : fallback;
}

// 开发时要在几分钟内验完：REMINDER_AFTER_MINUTES / REMINDER_RETRY_MINUTES
// 可以临时缩短，REMINDER_QUIET_HOURS=off 可以临时关掉夜间规则。只在别名的
// branch-deploy 环境里设；乱填一律退回默认，不会让提醒失控。
export function ruleFromEnv(env = process.env) {
  return {
    afterMs: minutes(env.REMINDER_AFTER_MINUTES, DEFAULT_AFTER_MIN) * MIN,
    retryMs: minutes(env.REMINDER_RETRY_MINUTES, DEFAULT_RETRY_MIN) * MIN,
    quiet: env.REMINDER_QUIET_HOURS === "off" ? null : QUIET,
  };
}

export function isValidTimeZone(tz) {
  if (typeof tz !== "string" || !tz || tz.length > 64) return false;
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; }
}

// 某一刻在某个时区里的「墙上时间」。
function wall(t, tz) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(t));
  const get = type => Number(parts.find(p => p.type === type).value);
  return { y: get("year"), mo: get("month"), d: get("day"), h: get("hour"), mi: get("minute"), s: get("second") };
}

// 这个时区在这一刻比 UTC 快多少毫秒。
function offsetAt(t, tz) {
  const w = wall(t, tz);
  return Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s) - Math.floor(t / 1000) * 1000;
}

// 当地某年某月某日某点整，对应的真实时刻。算两遍，夏令时切换那天也对。
function wallToInstant(y, mo, d, h, tz) {
  const guess = Date.UTC(y, mo - 1, d, h);
  const first = guess - offsetAt(guess, tz);
  return guess - offsetAt(first, tz);
}

function deferPastQuiet(t, tz, quiet) {
  const w = wall(t, tz);
  if (w.h >= quiet.end && w.h < quiet.start) return t;
  // 在夜里：晚上那半段推到第二天早上，凌晨那半段推到当天早上
  const day = new Date(Date.UTC(w.y, w.mo - 1, w.d + (w.h >= quiet.start ? 1 : 0)));
  return wallToInstant(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), quiet.end, tz);
}

export function nextReminderAt(rec, rule) {
  const review = rec.lastReviewAt || 0;
  const sent = rec.lastSentAt || 0;
  // 上次提醒之后还没复习过：从那次提醒往后等一整天
  const base = sent > review ? sent + rule.retryMs : review + rule.afterMs;
  if (!rule.quiet || !isValidTimeZone(rec.tz)) return base;
  return deferPastQuiet(base, rec.tz, rule.quiet);
}

export function isDue(rec, now, rule) {
  return now >= nextReminderAt(rec, rule);
}
