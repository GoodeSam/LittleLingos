#!/usr/bin/env node
// Behavioral tests for the install-environment detection module in
// index.html (WeChat-detection round, 2026-08-14). Zero-dependency: extracts
// the code between the ll:install-env markers and runs it in a vm context,
// following the extraction idiom of test/voice-input.test.mjs. Covers:
//   - detectInstallEnvironment(ua): total, pure UA classifier that fixed the
//     "WeChat parent shown Safari-only share-sheet steps that do nothing in
//     their browser" bug (previously there was zero WeChat detection in the
//     whole client).
//   - deriveOfflineReadiness(state): pure SW-registration-outcome deriver
//     that replaced the `.register('./sw.js').catch(() => {})` silent swallow.
// Also asserts (raw-text style, matching test/dictionary-review.test.mjs /
// test/sw.test.mjs) that index.html ships nina-cleared WeChat copy verbatim,
// and that the WeChat sheet body never contains the Safari share-sheet text.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import assert from "node:assert/strict";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");

const START = "/* ll:install-env:start */";
const END = "/* ll:install-env:end */";

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

function loadModule() {
  const s = html.indexOf(START), e = html.indexOf(END);
  assert.ok(s !== -1 && e !== -1, `index.html must contain ${START} … ${END} markers`);
  const ctx = { console };
  vm.createContext(ctx);
  vm.runInContext(html.slice(s, e + END.length), ctx);
  assert.equal(typeof ctx.detectInstallEnvironment, "function",
    "module must define detectInstallEnvironment()");
  assert.equal(typeof ctx.deriveOfflineReadiness, "function",
    "module must define deriveOfflineReadiness()");
  return ctx;
}

// ── Realistic UA fixtures ───────────────────────────────
const UA_WECHAT_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.49(0x18003128) NetType/WIFI Language/zh_CN";
const UA_WECHAT_ANDROID =
  "Mozilla/5.0 (Linux; Android 13; V2218A Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/107.0.5304.141 XWEB/1160117 MMWEBSDK/20231202 Mobile Safari/537.36 MMWEBID/1234 MicroMessenger/8.0.47.2560(0x28002F30) WeChat/arm64 Weixin NetType/WIFI Language/zh_CN ABI/arm64";
const UA_IOS_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
const UA_ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";

// ── detectInstallEnvironment ────────────────────────────
test("WeChat iOS UA -> isWeChat, isIOS, installPath 'wechat'", () => {
  const { detectInstallEnvironment } = loadModule();
  const r = detectInstallEnvironment(UA_WECHAT_IOS);
  assert.equal(r.isWeChat, true);
  assert.equal(r.isIOS, true);
  assert.equal(r.installPath, "wechat");
});

test("WeChat Android UA -> isWeChat, isAndroid, installPath 'wechat'", () => {
  const { detectInstallEnvironment } = loadModule();
  const r = detectInstallEnvironment(UA_WECHAT_ANDROID);
  assert.equal(r.isWeChat, true);
  assert.equal(r.isAndroid, true);
  assert.equal(r.installPath, "wechat");
});

test("plain iOS Safari UA -> installPath 'ios-safari', isWeChat false", () => {
  const { detectInstallEnvironment } = loadModule();
  const r = detectInstallEnvironment(UA_IOS_SAFARI);
  assert.equal(r.installPath, "ios-safari");
  assert.equal(r.isWeChat, false);
  assert.equal(r.isIOS, true);
});

test("plain Android Chrome UA -> installPath 'android-prompt', isWeChat false", () => {
  const { detectInstallEnvironment } = loadModule();
  const r = detectInstallEnvironment(UA_ANDROID_CHROME);
  assert.equal(r.installPath, "android-prompt");
  assert.equal(r.isWeChat, false);
  assert.equal(r.isAndroid, true);
});

test("empty string UA -> well-formed object, installPath 'unknown', no throw", () => {
  // Plain-field comparison, not assert.deepEqual: the object is constructed
  // inside a separate vm realm, so its Object prototype differs from this
  // file's even when every own-property value matches (same caveat noted in
  // test/dictionary-review.test.mjs).
  const { detectInstallEnvironment } = loadModule();
  const r = detectInstallEnvironment("");
  assert.equal(r.isIOS, false);
  assert.equal(r.isAndroid, false);
  assert.equal(r.isWeChat, false);
  assert.equal(r.installPath, "unknown");
});

test("undefined UA -> well-formed object, no throw", () => {
  const { detectInstallEnvironment } = loadModule();
  assert.doesNotThrow(() => detectInstallEnvironment(undefined));
  const r = detectInstallEnvironment(undefined);
  assert.equal(r.installPath, "unknown");
  assert.equal(r.isIOS, false);
  assert.equal(r.isAndroid, false);
  assert.equal(r.isWeChat, false);
});

test("null UA -> well-formed object, no throw", () => {
  const { detectInstallEnvironment } = loadModule();
  assert.doesNotThrow(() => detectInstallEnvironment(null));
  const r = detectInstallEnvironment(null);
  assert.equal(r.installPath, "unknown");
});

test("garbage (non-string) UA input -> well-formed object, no throw", () => {
  const { detectInstallEnvironment } = loadModule();
  for (const garbage of [42, {}, [], true, () => {}]) {
    assert.doesNotThrow(() => detectInstallEnvironment(garbage));
    const r = detectInstallEnvironment(garbage);
    assert.equal(r.installPath, "unknown");
    assert.equal(r.isWeChat, false);
  }
});

test("lowercase 'micromessenger' is still detected (X5 casing variance)", () => {
  const { detectInstallEnvironment } = loadModule();
  const r = detectInstallEnvironment("Mozilla/5.0 (iPhone) micromessenger/8.0.1 blah");
  assert.equal(r.isWeChat, true);
  assert.equal(r.installPath, "wechat");
});

test("mixed-case 'MicroMessenger' is detected", () => {
  const { detectInstallEnvironment } = loadModule();
  const r = detectInstallEnvironment("some ua MICROMESSENGER/1.0 more text");
  assert.equal(r.isWeChat, true);
});

// ── deriveOfflineReadiness ──────────────────────────────
test("SW unsupported -> offlineReady false, status 'unsupported', no toast", () => {
  const { deriveOfflineReadiness } = loadModule();
  const r = deriveOfflineReadiness({ supported: false });
  assert.equal(r.offlineReady, false);
  assert.equal(r.status, "unsupported");
  assert.equal(r.showFailureToast, false);
});

test("registration pending, no controller yet -> offlineReady false, no toast", () => {
  const { deriveOfflineReadiness } = loadModule();
  const r = deriveOfflineReadiness({ supported: true, registrationState: "pending", hasController: false });
  assert.equal(r.offlineReady, false);
  assert.equal(r.status, "pending");
  assert.equal(r.showFailureToast, false);
});

test("registration succeeded, controller present -> offlineReady true, no toast", () => {
  const { deriveOfflineReadiness } = loadModule();
  const r = deriveOfflineReadiness({ supported: true, registrationState: "success", hasController: true });
  assert.equal(r.offlineReady, true);
  assert.equal(r.status, "success");
  assert.equal(r.showFailureToast, false);
});

test("registration succeeded, no controller yet (first load) -> offlineReady false, no toast", () => {
  const { deriveOfflineReadiness } = loadModule();
  const r = deriveOfflineReadiness({ supported: true, registrationState: "success", hasController: false });
  assert.equal(r.offlineReady, false);
  assert.equal(r.showFailureToast, false);
});

test("registration failed, no controller -> offlineReady false, toast shown", () => {
  const { deriveOfflineReadiness } = loadModule();
  const r = deriveOfflineReadiness({ supported: true, registrationState: "failed", hasController: false });
  assert.equal(r.offlineReady, false);
  assert.equal(r.status, "failed");
  assert.equal(r.showFailureToast, true);
});

test("registration failed but a controller already exists (transient re-register failure) -> no false-alarm toast", () => {
  const { deriveOfflineReadiness } = loadModule();
  const r = deriveOfflineReadiness({ supported: true, registrationState: "failed", hasController: true });
  assert.equal(r.offlineReady, true);
  assert.equal(r.showFailureToast, false);
});

test("garbage state input -> well-formed object, defaults to 'pending', no throw", () => {
  const { deriveOfflineReadiness } = loadModule();
  for (const garbage of [undefined, null, 42, "nope"]) {
    assert.doesNotThrow(() => deriveOfflineReadiness(garbage));
    const r = deriveOfflineReadiness(garbage);
    assert.equal(r.offlineReady, false);
    assert.equal(r.showFailureToast, false);
  }
});

test("unrecognized registrationState string defaults to 'pending'", () => {
  const { deriveOfflineReadiness } = loadModule();
  const r = deriveOfflineReadiness({ supported: true, registrationState: "bogus", hasController: false });
  assert.equal(r.status, "pending");
});

// ── Structural: index.html wiring ───────────────────────
test("index.html calls detectInstallEnvironment(navigator.userAgent) at startup (outside the tested fragment)", () => {
  const afterModule = html.slice(html.indexOf(END) + END.length);
  assert.match(afterModule, /detectInstallEnvironment\(navigator\.userAgent\)/,
    "production wiring must invoke the module with the real navigator.userAgent");
});

test("SW registration failure path calls deriveOfflineReadiness and suppresses the toast for installPath === 'wechat'", () => {
  const swSection = html.slice(html.indexOf("── Service Worker"), html.indexOf("── Install prompt"));
  assert.match(swSection, /register\('\.\/sw\.js'\)\.catch/, "must still register the SW");
  assert.doesNotMatch(swSection, /\.catch\(\(\) => \{\}\)/, "the silent .catch(() => {}) swallow must be gone");
  assert.match(swSection, /deriveOfflineReadiness\(/, "failure path must derive offline readiness from actual state");
  assert.match(swSection, /installEnv\.installPath !== 'wechat'/, "toast must be suppressed on the wechat path");
});

test("dismissInstall() uses a distinct localStorage key for the WeChat banner", () => {
  const fnSrc = html.slice(html.indexOf("function dismissInstall"), html.indexOf("function openIosSheet"));
  assert.match(fnSrc, /ll_wechat_install_dismissed/);
  assert.match(fnSrc, /ll_ios_install_dismissed/);
  assert.match(fnSrc, /ll_install_dismissed/);
});

test("WeChat path does not also bind beforeinstallprompt or the install-prompt click handler", () => {
  const start = html.indexOf("installEnv.installPath === 'wechat'");
  const wechatBranch = html.slice(start, html.indexOf("} else if (isIOS)"));
  assert.doesNotMatch(wechatBranch, /addEventListener\(['"]beforeinstallprompt['"]/,
    "wechat branch must not register a beforeinstallprompt listener");
  assert.doesNotMatch(wechatBranch, /deferredInstallPrompt\.prompt/,
    "wechat branch must not bind the install-prompt click handler");
});

// ── Raw-text: nina-cleared WeChat copy ships verbatim ───
test("index.html contains the WeChat banner copy verbatim", () => {
  assert.match(html, /微信里无法安装到主屏幕/);
  assert.match(html, /换个浏览器打开，几秒就能装/);
  assert.match(html, /看方法/);
});

test("index.html contains the WeChat sheet copy verbatim", () => {
  assert.match(html, /🌐 用浏览器打开/);
  assert.match(html, /微信内置浏览器不能把 LittleLingos 添加到主屏幕，也无法保存音频。换成手机浏览器，几秒钟就好。/);
  assert.match(html, /点击右上角的「···」/);
  assert.match(html, /点击「在浏览器打开」或「在Safari中打开」/);
  assert.match(html, /在浏览器里就能添加到主屏幕，离线也能听！/);
});

test("index.html contains the SW-failure toast copy verbatim", () => {
  assert.match(html, /⚠️ 离线功能暂不可用 — 联网时可正常使用/);
});

test("the WeChat sheet body does not contain the Safari share-sheet instruction text", () => {
  const bodyStart = html.indexOf('id="iosSheetWeChatBody"');
  const bodyEnd = html.indexOf('<button class="ios-close-btn"');
  const wechatBody = html.slice(bodyStart, bodyEnd);
  assert.doesNotMatch(wechatBody, /分享按钮/, "WeChat body must never show the Safari share-button step");
  assert.doesNotMatch(wechatBody, /添加到主屏幕」/, "WeChat body must never show the Safari add-to-home-screen step");
});

test("the two sheet bodies are wrapped in plain divs with `hidden` toggled on the wrapper, not on a .ios-step", () => {
  const sheetSrc = html.slice(html.indexOf('id="iosSheet"'), html.indexOf('<!-- Offline toast -->'));
  assert.match(sheetSrc, /<div id="iosSheetSafariBody">/);
  assert.match(sheetSrc, /<div id="iosSheetWeChatBody" hidden>/);
  // No .ios-step element itself carries the hidden attribute.
  assert.doesNotMatch(sheetSrc, /class="ios-step"[^>]*hidden/);
  assert.doesNotMatch(sheetSrc, /hidden[^>]*class="ios-step"/);
});

test("openIosSheet() toggles hidden on the two body wrappers based on installEnv.installPath", () => {
  const fnSrc = html.slice(html.indexOf("function openIosSheet"), html.indexOf("function closeIosSheet"));
  assert.match(fnSrc, /iosSheetSafariBody['"]\)\.hidden\s*=/);
  assert.match(fnSrc, /iosSheetWeChatBody['"]\)\.hidden\s*=/);
});

// ── Runner: async-aware so future await-based tests can't false-pass ──
console.log("install-env module tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
