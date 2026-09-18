#!/usr/bin/env node
// 到点提醒的「什么时候该提醒」规则（ADR 0008）。
//
// 规则来自 Victor 2026-09-18 的选择：上次复习后 23.5 小时提醒；提醒发了却没
// 复习，就在那次提醒之后 24 小时再提醒；夜里 22:00～07:00 不打扰，落在这段
// 里的推到早上 7 点。「夜里」按手机所在的时区算，所以要测一个有夏令时的地方。
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   1. 家长晚上 8 点 05 分复习完，第二天晚上 7 点 35 分收到提醒。
//   2. 那条提醒来了，家长没理 —— 再过一天同一时间又提醒一次，不会每 5 分钟
//      轰炸一次，也不会从此沉默。
//   3. 提醒之后家长复习了 —— 下一次从这次复习重新算。
//   4. 家长半夜 11 点才复习 —— 第二天夜里 10 点半不吵人，推到后天早上 7 点。
//   5. 家长在美国过夏令时切换的那一夜 —— 早上 7 点还是当地的早上 7 点。
//   6. 开发时要在几分钟内验完 —— 间隔可以临时缩短、夜间规则可以临时关掉；
//      乱填的设置不会让提醒失控，而是退回默认。
import assert from "node:assert/strict";
import { nextReminderAt, isDue, ruleFromEnv, isValidTimeZone } from "../netlify/functions/_shared/reminder-rule.mjs";

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

const MIN = 60 * 1000, HOUR = 60 * MIN;
const SH = "Asia/Shanghai";          // UTC+8，没有夏令时
const at = iso => Date.parse(iso);   // 测试里的时间都写成带时区的 ISO，读起来就是当地时间
const DEFAULT = ruleFromEnv({});
const show = t => new Date(t).toISOString();

test("复习后 23.5 小时提醒", () => {
  const rec = { tz: SH, lastReviewAt: at("2026-09-18T20:05:00+08:00"), lastSentAt: null };
  assert.equal(show(nextReminderAt(rec, DEFAULT)), show(at("2026-09-19T19:35:00+08:00")));
});

test("提醒发了但没复习：24 小时后再提醒一次", () => {
  const rec = { tz: SH, lastReviewAt: at("2026-09-18T20:05:00+08:00"), lastSentAt: at("2026-09-19T19:35:00+08:00") };
  assert.equal(show(nextReminderAt(rec, DEFAULT)), show(at("2026-09-20T19:35:00+08:00")));
});

test("提醒之后复习了：从这次复习重新算", () => {
  const rec = { tz: SH, lastReviewAt: at("2026-09-19T20:00:00+08:00"), lastSentAt: at("2026-09-19T19:35:00+08:00") };
  assert.equal(show(nextReminderAt(rec, DEFAULT)), show(at("2026-09-20T19:30:00+08:00")));
});

test("落在夜里 22:00～07:00 的推到早上 7 点，边界两侧各一条", () => {
  const cases = [
    // [上次复习, 期望的提醒时间, 说明]
    ["2026-09-18T23:00:00+08:00", "2026-09-20T07:00:00+08:00", "算出来是次日 22:30 → 推到后天 7 点"],
    ["2026-09-18T03:00:00+08:00", "2026-09-19T07:00:00+08:00", "算出来是次日 02:30 → 推到当天 7 点"],
    ["2026-09-17T22:29:00+08:00", "2026-09-18T21:59:00+08:00", "21:59 不在夜里，照常"],
    ["2026-09-17T22:30:00+08:00", "2026-09-19T07:00:00+08:00", "正好 22:00 算夜里"],
    ["2026-09-17T07:30:00+08:00", "2026-09-18T07:00:00+08:00", "正好 07:00 不算夜里，照常"],
  ];
  for (const [review, want, why] of cases) {
    const got = nextReminderAt({ tz: SH, lastReviewAt: at(review), lastSentAt: null }, DEFAULT);
    assert.equal(show(got), show(at(want)), why);
  }
});

test("有夏令时的时区：夏令时结束那一夜，早上 7 点还是当地 7 点", () => {
  // 洛杉矶 2026-11-01 凌晨 2 点夏令时结束（-07:00 → -08:00）。
  // 上次复习在 10-30 23:30（-07:00），+23.5 小时 = 10-31 23:00，落在夜里，
  // 应推到 11-01 07:00 —— 那时已经是 -08:00。
  const rec = { tz: "America/Los_Angeles", lastReviewAt: at("2026-10-30T23:30:00-07:00"), lastSentAt: null };
  assert.equal(show(nextReminderAt(rec, DEFAULT)), show(at("2026-11-01T07:00:00-08:00")),
    "按夏令时前的偏移去算，会差一个小时");
});

test("到没到点：差一分钟不到，到了就到", () => {
  const rec = { tz: SH, lastReviewAt: at("2026-09-18T20:05:00+08:00"), lastSentAt: null };
  const due = at("2026-09-19T19:35:00+08:00");
  assert.equal(isDue(rec, due - MIN, DEFAULT), false);
  assert.equal(isDue(rec, due, DEFAULT), true);
  assert.equal(isDue(rec, due + 3 * HOUR, DEFAULT), true, "晚了（比如检查漏跑）也要补上");
});

test("开发时可以缩短间隔、关掉夜间规则；乱填的退回默认", () => {
  const quick = ruleFromEnv({ REMINDER_AFTER_MINUTES: "3", REMINDER_RETRY_MINUTES: "2", REMINDER_QUIET_HOURS: "off" });
  const night = { tz: SH, lastReviewAt: at("2026-09-18T23:00:00+08:00"), lastSentAt: null };
  assert.equal(show(nextReminderAt(night, quick)), show(at("2026-09-18T23:03:00+08:00")),
    "关掉夜间规则后，半夜也照算");
  const sent = { ...night, lastSentAt: at("2026-09-18T23:03:00+08:00") };
  assert.equal(show(nextReminderAt(sent, quick)), show(at("2026-09-18T23:05:00+08:00")));

  for (const bad of ["abc", "0", "-5", "", "1.5e9"]) {
    const r = ruleFromEnv({ REMINDER_AFTER_MINUTES: bad, REMINDER_RETRY_MINUTES: bad });
    assert.equal(r.afterMs, 23.5 * HOUR, `REMINDER_AFTER_MINUTES=${JSON.stringify(bad)} 没退回 23.5 小时`);
    assert.equal(r.retryMs, 24 * HOUR, `REMINDER_RETRY_MINUTES=${JSON.stringify(bad)} 没退回 24 小时`);
  }
  // 夜间规则只有明确写 off 才关
  for (const v of [undefined, "", "on", "OFF "]) {
    assert.ok(ruleFromEnv({ REMINDER_QUIET_HOURS: v }).quiet, `REMINDER_QUIET_HOURS=${JSON.stringify(v)} 不该关掉夜间规则`);
  }
});

test("时区校验：真的时区才算数", () => {
  for (const tz of ["Asia/Shanghai", "America/Los_Angeles", "UTC"]) assert.equal(isValidTimeZone(tz), true, tz);
  for (const tz of ["Mars/Base", "", null, 123, "Asia/Shanghai".repeat(10)]) {
    assert.equal(isValidTimeZone(tz), false, `${JSON.stringify(tz)} 被当成了时区`);
  }
});

console.log("reminder rule tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
