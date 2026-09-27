#!/usr/bin/env node
// 到点提醒按平台能力诚实呈现（ADR 0009 判据 2 功能 ②；R21 收窄版；PRD 6.4 支持矩阵）。
//
// 现状：安卓、微信、桌面一律显示看似可开启的「开启提醒」。PRD 6.4 分三档：
// 已验过（iPhone 主屏幕版）/ 基础可用待验（微信、国产浏览器）/ 推送不承诺（安卓、微信内）。
// 界面上一档都没体现——拿不到推送的家长会以为自己开成了。
//
// 对应的用户情境（不含函数名）：
//   1. iPhone 主屏幕版：一切照旧，能开，没有多余警告。
//   2. iPhone 在 Safari 里：不给「开启提醒」，给「先添加到主屏幕」。
//   3. 微信里：说清「微信里收不到提醒」并指路；不可开启；不断言安卓微信「不能」。
//   4. 安卓等没验证过的环境、浏览器支持通知：允许开，但标明「没验证过，可能收不到」。
//   5. 浏览器不支持通知：说不支持，不可点。
//   6. 乱七八糟的输入：不抛，退到最保守的那档。
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

function load() {
  const at = html.indexOf("function reminderCapability(");
  assert.ok(at !== -1, "还没有 reminderCapability()——「这个环境能不能开提醒、对家长说什么」要收在一处");
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(html.slice(at, html.indexOf("\n}", at) + 2), ctx);
  return ctx.reminderCapability;
}
const env = (o) => ({ isIOS: false, isAndroid: false, isWeChat: false, installPath: "unknown", ...o });

test("iPhone 主屏幕版、浏览器支持通知：能开，没有多余警告", () => {
  const c = load()({ installEnv: env({ isIOS: true, installPath: "ios-safari" }), isStandalone: true, pushSupported: true });
  assert.equal(c.canEnable, true);
  assert.equal(c.level, "ready");
  assert.equal(c.note, "", `已验过的环境不该有警告：「${c.note}」`);
  assert.equal(c.action, "enable");
});

test("iPhone 在 Safari 里（没装主屏幕）：不给「开启提醒」，给「先添加到主屏幕」", () => {
  const c = load()({ installEnv: env({ isIOS: true, installPath: "ios-safari" }), isStandalone: false, pushSupported: false });
  assert.equal(c.canEnable, false);
  assert.equal(c.level, "ios-install-first");
  assert.equal(c.action, "install", "按钮该带家长去装，不是装作能开");
  assert.match(c.buttonLabel, /主屏幕/, c.buttonLabel);
  assert.match(c.note, /主屏幕/, c.note);
});

test("微信里：说清收不到并指路，不可开启；不断言安卓微信「不能」", () => {
  const f = load();
  for (const [label, e] of [["iOS 微信", env({ isIOS: true, isWeChat: true, installPath: "wechat" })], ["安卓微信", env({ isAndroid: true, isWeChat: true, installPath: "wechat" })]]) {
    const c = f({ installEnv: e, isStandalone: false, pushSupported: false });
    assert.equal(c.canEnable, false, label);
    assert.equal(c.level, "wechat", label);
    assert.match(c.note, /微信/, `${label}：${c.note}`);
    assert.match(c.note, /Safari|浏览器/, `${label} 要指路：${c.note}`);
    assert.doesNotMatch(c.note, /安卓.{0,6}(不能|无法)/, `${label} 不许断言安卓不能——那没验过：${c.note}`);
  }
});

test("微信里但浏览器有通知能力（安卓 X5 之类）：归「没验证过」而不是「收不到」——收不到只在没能力时才是事实", () => {
  const c = load()({ installEnv: env({ isAndroid: true, isWeChat: true, installPath: "wechat" }), isStandalone: false, pushSupported: true });
  assert.equal(c.level, "unverified");
  assert.equal(c.canEnable, true);
  assert.match(c.note, /微信/, c.note);
  assert.match(c.note, /没验证|未验证/, c.note);
  assert.doesNotMatch(c.note, /收不到提醒。/, `有能力的微信不该一口咬定收不到：${c.note}`);
});

test("安卓等没验证过的环境、浏览器支持通知：允许开，但标明没验证过、可能收不到", () => {
  const f = load();
  for (const [label, e] of [["安卓 Chrome", env({ isAndroid: true, installPath: "android-prompt" })], ["桌面/未知", env({})]]) {
    const c = f({ installEnv: e, isStandalone: false, pushSupported: true });
    assert.equal(c.canEnable, true, `${label} 该允许开——没验证不等于不能`);
    assert.equal(c.level, "unverified", label);
    assert.match(c.note, /没验证|未验证|可能收不到/, `${label}：${c.note}`);
    assert.equal(c.action, "enable");
  }
});

test("浏览器不支持通知（不是 iPhone、不是微信）：说不支持，不可点", () => {
  const c = load()({ installEnv: env({ isAndroid: true, installPath: "android-prompt" }), isStandalone: false, pushSupported: false });
  assert.equal(c.canEnable, false);
  assert.equal(c.level, "unsupported");
  assert.match(c.note, /不支持/, c.note);
  assert.equal(c.action, "none");
});

test("乱七八糟的输入：不抛，退到最保守的那档", () => {
  const f = load();
  for (const bad of [undefined, null, {}, { installEnv: null }, { installEnv: "x", isStandalone: "yes", pushSupported: 1 }]) {
    let c; assert.doesNotThrow(() => { c = f(bad); });
    assert.equal(typeof c.canEnable, "boolean");
    assert.equal(typeof c.note, "string");
    assert.equal(c.canEnable, false, `坏输入不该放行开启：${JSON.stringify(bad)}`);
  }
});

test("每一档的话里都没有服务器英文、没有「一定收得到」这种没验过的承诺", () => {
  const f = load();
  const all = [
    f({ installEnv: env({ isIOS: true, installPath: "ios-safari" }), isStandalone: false, pushSupported: false }),
    f({ installEnv: env({ isWeChat: true, installPath: "wechat" }), isStandalone: false, pushSupported: false }),
    f({ installEnv: env({ isAndroid: true, installPath: "android-prompt" }), isStandalone: false, pushSupported: true }),
    f({ installEnv: env({}), isStandalone: false, pushSupported: false }),
  ];
  for (const c of all) {
    assert.doesNotMatch(c.note, /[A-Za-z]{8,}/, `说明里混进了英文原话（Safari / iPhone 这种产品名可以）：${c.note}`);
    assert.doesNotMatch(c.note, /一定|保证/, `没验过的事不许承诺：${c.note}`);
  }
});

let pass = 0, fail = 0;
for (const t of tests) {
  try { await t.fn(); console.log(`  ✓ ${t.name}`); pass++; }
  catch (e) { console.log(`  ✗ ${t.name}\n    ${e.message.split("\n")[0]}`); fail++; }
}
console.log(fail ? `✗ ${fail} failed, ${pass} passed` : `✓ all ${pass} tests passed`);
process.exit(fail ? 1 : 0);
