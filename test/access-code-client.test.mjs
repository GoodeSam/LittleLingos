#!/usr/bin/env node
// Behavioral tests for the client half of the access gate: where the code is
// kept, and how it rides along on the two calls that need it.
// Zero-dependency: the module is extracted from index.html between its
// markers and run in a vm context, per test/data-export.test.mjs.
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   1. 家长拿到一串邀请码，在设置里粘一次，以后就不用再管。
//
//   2. 他换到另一台设备、或把网页版和主屏幕版搞混了 —— 那边是空的，
//      要重新粘一次。这不是 bug，是 iOS 上两个存储空间本来就隔离
//      （见 tech-constraints C9）。所以「存不下去」也必须能用，
//      不能因为存储被禁用就整个功能都点不动。
//
//   3. 他没填码就去点翻译 —— 要明确告诉他"需要邀请码"并指到填写的地方，
//      而不是一个看不懂的错误，更不是默默什么都没发生。
//
//   4. 码填错了 —— 同样要说清是码的问题，而不是让他以为网络坏了。
//
//   5. 那些不花钱的功能（预设短语、已收藏的复习、精选词）
//      不受影响 —— 没有码也照常能用。
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { injectStorage } from "./_storage-helper.mjs";   // 真正的 storage.js，接在本测试的 localStorage 假件上

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const html = readFileSync(join(ROOT, "index.html"), "utf8");

const START = "/* ll:access-code:start */";
const END = "/* ll:access-code:end */";

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// A localStorage that can be told to fail. Private browsing and a full quota
// both make setItem throw, and on iOS the installed PWA and Safari have
// separate stores — so "the code did not save" is a normal state, not a bug.
function fakeStorage({ throwOnWrite = false } = {}) {
  const map = new Map();
  return {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => {
      if (throwOnWrite) throw new DOMException("QuotaExceededError");
      map.set(k, String(v));
    },
    removeItem: k => map.delete(k),
    _map: map,
  };
}

function loadModule({ storage = fakeStorage() } = {}) {
  const s = html.indexOf(START), e = html.indexOf(END);
  assert.ok(s !== -1 && e !== -1, `index.html must contain ${START} … ${END} markers`);
  const ctx = { localStorage: storage, console };
  injectStorage(ctx);
  vm.createContext(ctx);
  vm.runInContext(html.slice(s, e + END.length), ctx);
  for (const fn of ["getAccessCode", "setAccessCode", "accessErrorMessage"]) {
    assert.equal(typeof ctx[fn], "function", `module must define ${fn}()`);
  }
  return ctx;
}

const CODE = "test-access-code-1234";

// ══ 1. 粘一次，以后不用再管 ═══════════════════════════════════════════

test("a saved code is still there on the next visit", () => {
  const store = fakeStorage();
  loadModule({ storage: store }).setAccessCode(CODE);
  // A second load is a fresh page: the code must come from storage, not from
  // anything the first load left in memory.
  assert.equal(loadModule({ storage: store }).getAccessCode(), CODE);
});

test("with no code saved, the reported code is an empty string — never undefined or null", () => {
  const { getAccessCode } = loadModule();
  assert.equal(getAccessCode(), "", "a caller that string-formats this must not print 'undefined' to a parent");
});

test("surrounding whitespace is trimmed on save — a pasted code often carries a trailing space", () => {
  const store = fakeStorage();
  loadModule({ storage: store }).setAccessCode("  " + CODE + "\n");
  assert.equal(loadModule({ storage: store }).getAccessCode(), CODE);
});

test("clearing the code empties it rather than storing the word 'null'", () => {
  const store = fakeStorage();
  const m = loadModule({ storage: store });
  m.setAccessCode(CODE);
  m.setAccessCode("");
  assert.equal(loadModule({ storage: store }).getAccessCode(), "");
});

// ══ 2. 存不下去也必须能用 ═════════════════════════════════════════════

test("when storage refuses the write, the code still works for this session", () => {
  // Private browsing, a full quota, or a locked-down webview. Losing the code
  // on reload is acceptable; refusing to translate at all is not.
  const m = loadModule({ storage: fakeStorage({ throwOnWrite: true }) });
  m.setAccessCode(CODE);
  assert.equal(m.getAccessCode(), CODE, "an unsaved code must still be usable until the page closes");
});

test("saving reports whether it will survive a reload, so the UI can say so", () => {
  const ok = loadModule({ storage: fakeStorage() });
  assert.equal(ok.setAccessCode(CODE), true);
  const nope = loadModule({ storage: fakeStorage({ throwOnWrite: true }) });
  assert.equal(nope.setAccessCode(CODE), false,
    "a parent who will have to retype this after every reload deserves to be told");
});

test("a missing localStorage does not break the module", () => {
  // Some embedded webviews expose no storage at all.
  const s = html.indexOf(START), e = html.indexOf(END);
  const ctx = { console };            // no localStorage in this realm at all
  injectStorage(ctx);
  vm.createContext(ctx);
  vm.runInContext(html.slice(s, e + END.length), ctx);
  assert.equal(ctx.getAccessCode(), "");
  assert.doesNotThrow(() => ctx.setAccessCode(CODE));
  assert.equal(ctx.getAccessCode(), CODE);
});

// ══ 3. 请求头 ═════════════════════════════════════════════════════════
// 2026-09-26（ADR 0009）：请求头由 api-client.js 统一拼，用的是这个块的 getAccessCode()。
// 下面三条验的事没变，只是拼头的代码换了地方——所以拿真的 api-client 来拼。
const { createApiClient } = require(join(ROOT, "api-client.js"));
function headersVia(ctx) {
  let seen = null;
  const api = createApiClient({ fetch: (url, init) => { seen = init.headers; return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) }); }, getAccessCode: () => ctx.getAccessCode() });
  api.raw("/x", {});
  return seen;
}

test("the code rides on the header the server reads", () => {
  const store = fakeStorage();
  loadModule({ storage: store }).setAccessCode(CODE);
  const h = headersVia(loadModule({ storage: store }));
  assert.equal(h["X-LL-Access"], CODE);
});

test("the JSON content type is still set — the header helper replaces the whole object", () => {
  const store = fakeStorage();
  loadModule({ storage: store }).setAccessCode(CODE);
  const h = headersVia(loadModule({ storage: store }));
  assert.equal(h["Content-Type"], "application/json",
    "callers pass this straight to fetch; dropping the content type would 400 every request");
});

test("with no code, the header is absent rather than empty", () => {
  const h = headersVia(loadModule());
  assert.ok(!("X-LL-Access" in h),
    "an empty header would look like an attempt with a blank code rather than no attempt");
  assert.equal(h["Content-Type"], "application/json");
});

// ══ 4. 说清楚是码的问题 ═══════════════════════════════════════════════

test("403 is explained as a code problem, and says where to fix it", () => {
  const msg = loadModule().accessErrorMessage(403);
  assert.match(msg, /邀请码/, "the message must name the thing that is wrong");
  assert.match(msg, /收藏|设置/, "and point at where it is entered");
});

test("a 403 with no code saved reads differently from a 403 with a wrong one", () => {
  const store = fakeStorage();
  const withCode = loadModule({ storage: store });
  withCode.setAccessCode(CODE);
  const wrong = loadModule({ storage: store }).accessErrorMessage(403);
  const missing = loadModule().accessErrorMessage(403);
  assert.notEqual(wrong, missing,
    "'you have not entered one' and 'the one you entered is wrong' are different problems to a parent");
});

test("other failures are not blamed on the code", () => {
  const { accessErrorMessage } = loadModule();
  // 500 is a server config problem, 502 an upstream one, 400 bad input.
  // Telling a parent to check their code would send them to fix the wrong thing.
  for (const status of [400, 500, 502, 0]) {
    assert.equal(accessErrorMessage(status), null, `${status} is not an access problem`);
  }
});

// ══ 5. 两个付费调用点都带上了码 ═══════════════════════════════════════

test("both paid endpoints send the header — neither is left behind", () => {
  // Asserted against the source because these two calls live in page code
  // that needs a DOM to run. What matters is that no paid call is left
  // constructing its own bare headers object.
  // 2026-09-26（ADR 0009）：两处付费调用都改走 api-client.js，邀请码头由它统一加。
  // 意图不变：没有哪一处付费调用是自己拼 headers 的。
  const client = readFileSync(join(ROOT, "api-client.js"), "utf8");
  assert.match(client, /X-LL-Access/, "api-client.js 不再加邀请码头——每一处付费调用都会忘了带码");
  for (const [label, marker] of [["translate", '"/api/translate"'], ["dictionary", '"/api/dictionary"']]) {
    assert.ok(html.indexOf(`llApi.post(${marker}`) !== -1, `${label} call site must go through llApi.post()`);
    assert.equal(html.indexOf(`fetch(${marker}`), -1, `${label} still has a bare fetch() — a call that builds its own headers is a call that forgets the code`);
  }
});

test("the free paths do not require a code", () => {
  // Preset phrases, saved-item review and the curated word list are resolved
  // on-device. If a code were needed for those, a parent without one would
  // find the whole app dead rather than two features unavailable.
  const s = html.indexOf(START), e = html.indexOf(END);
  const rest = html.slice(0, s) + html.slice(e);
  assert.ok(!/audio\/\$\{[^}]*\}[^)]*llApi\./.test(rest),
    "audio playback must not be gated");
  // 2026-09-26（ADR 0009）：带码的请求一律走 llApi.post() / llApi.raw()，数它们的调用点。
  // 4 → 5（2026-09-17，Victor 同意）：第 5 个是推送相关请求共用的 pushApiPost()
  // （到点提醒 /api/reminder）。它不花钱，但 ADR 0008 要求它挡在邀请码后面。
  const calls = [...html.matchAll(/llApi\.(post|raw)\(/g)];
  assert.ok(calls.length <= 5,
    `llApi is called ${calls.length} times — it belongs only at the paid call sites`);
  assert.equal([...html.matchAll(/accessHeaders\(\)/g)].length, 0, "accessHeaders() 已删，不该再冒出第二份拼头的代码");
});

// ══ 6. 换个入口要重填，界面得说清这不是故障 ═══════════════════════════

test("the invite-code section explains that the home-screen app and the browser keep separate codes", () => {
  // 家长在 Safari 里填好了码，第二天从主屏幕图标进去，发现又要填一次。
  // 如果界面什么都不说，他唯一合理的结论是"这软件把我的码弄丢了"——
  // 而这正是 tech-constraints C9 记录的平台事实（iOS 上 PWA 与 Safari
  // 存储隔离），2026-09-03 在生产版本上第三次被真机确认。
  //
  // 这一条锁的是文案本身，不是代码行为。没有它，将来任何一次"精简文案"
  // 都可能顺手把这句删掉，而没有任何东西会发现。
  const from = html.indexOf('<div class="backup-title">邀请码</div>');
  assert.ok(from !== -1, "invite-code section not found");
  const to = html.indexOf('id="accessCodeStatus"', from);
  assert.ok(to !== -1 && to > from, "invite-code section end not found");
  const section = html.slice(from, to);

  assert.match(section, /主屏幕/,
    "must name the home-screen app — a parent needs to know WHICH two places differ");
  assert.match(section, /浏览器|Safari/,
    "must name the browser as the other place, or 'two places' is meaningless");
  assert.match(section, /不是.{0,6}(错|坏|问题|故障)/,
    "must say this is normal — without it a parent concludes the app lost their code");
});

// ── Runner ───────────────────────────────────────────────
console.log("access-code client tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
