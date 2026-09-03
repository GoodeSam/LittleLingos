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

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
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
  vm.createContext(ctx);
  vm.runInContext(html.slice(s, e + END.length), ctx);
  for (const fn of ["getAccessCode", "setAccessCode", "accessHeaders", "accessErrorMessage"]) {
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
  vm.createContext(ctx);
  vm.runInContext(html.slice(s, e + END.length), ctx);
  assert.equal(ctx.getAccessCode(), "");
  assert.doesNotThrow(() => ctx.setAccessCode(CODE));
  assert.equal(ctx.getAccessCode(), CODE);
});

// ══ 3. 请求头 ═════════════════════════════════════════════════════════

test("the code rides on the header the server reads", () => {
  const store = fakeStorage();
  loadModule({ storage: store }).setAccessCode(CODE);
  const h = loadModule({ storage: store }).accessHeaders();
  assert.equal(h["X-LL-Access"], CODE);
});

test("the JSON content type is still set — the header helper replaces the whole object", () => {
  const store = fakeStorage();
  loadModule({ storage: store }).setAccessCode(CODE);
  const h = loadModule({ storage: store }).accessHeaders();
  assert.equal(h["Content-Type"], "application/json",
    "callers pass this straight to fetch; dropping the content type would 400 every request");
});

test("with no code, the header is absent rather than empty", () => {
  const h = loadModule().accessHeaders();
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
  for (const [label, marker] of [["translate", '"/api/translate"'], ["dictionary", '"/api/dictionary"']]) {
    const at = html.indexOf(`fetch(${marker}`);
    assert.ok(at !== -1, `${label} call site not found`);
    const block = html.slice(at, at + 400);
    assert.match(block, /headers:\s*accessHeaders\(\)/,
      `the ${label} call must use accessHeaders() — a hand-written headers object here is a call that forgets the code`);
  }
});

test("the free paths do not require a code", () => {
  // Preset phrases, saved-item review and the curated word list are resolved
  // on-device. If a code were needed for those, a parent without one would
  // find the whole app dead rather than two features unavailable.
  const s = html.indexOf(START), e = html.indexOf(END);
  const rest = html.slice(0, s) + html.slice(e);
  assert.ok(!/audio\/\$\{[^}]*\}[^)]*accessHeaders/.test(rest),
    "audio playback must not be gated");
  const calls = [...html.matchAll(/accessHeaders\(\)/g)];
  assert.ok(calls.length <= 4,
    `accessHeaders() appears ${calls.length} times — it belongs only at the paid call sites`);
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
