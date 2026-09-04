#!/usr/bin/env node
// Behavioral tests for the shared access gate on the paid endpoints.
//
// Fully offline: every call into a handler goes through withStub(), so a test
// can never reach Gemini or Azure. That is not a style preference — during
// the red phase the handlers have no gate yet, so an unstubbed call really
// does leave the machine.
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   1. 一个陌生人发现了这几个接口的地址，直接调用 —— 必须被拒绝，
//      而且是在花掉任何一分钱之前就拒绝，不是调用完了才发现没权限。
//
//   2. 有邀请码的家长照常使用 —— 功能不受影响，
//      而且原有的输入校验不能因为加了这道门就失效。
//
//   3. 部署时忘了配那串码 —— 这时应该拒绝所有人，而不是放行所有人。
//      "配置漏了就等于没有门"是这类功能最常见的翻车方式。
//
//   4. 有人拿着错误的码反复试探 —— 不能从回应内容里看出
//      "这个码存在但打错了"和"根本没带码"的区别。
//
//   5. 以后新增付费接口时，如果忘了给它装门 —— 这里必须变红。
//      这一组的存在理由就是"几个地方总会忘一个"，所以它自己
//      不能用硬编码的清单，否则它就是下一个会被忘掉的地方。
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

const FN_DIR = new URL("../netlify/functions/", import.meta.url);
const SHARED = new URL("../netlify/functions/_shared/access.mjs", import.meta.url);
const CODE = "test-access-code-1234";

// Top-level .mjs files under netlify/functions, discovered from disk rather
// than listed here — a hardcoded list is exactly the thing this file exists
// to prevent.
//
// Its reach is narrower than "every paid endpoint", and the gap is worth
// knowing: it does not see functions in subdirectories, other extensions, or
// endpoints defined elsewhere, and it would wrongly include a top-level file
// named _something.mjs (it is underscore-prefixed DIRECTORIES that Netlify
// skips). For the current layout — two flat .mjs endpoints plus _shared/ —
// it is exact.
const DISCOVERED = readdirSync(FN_DIR)
  .filter(f => f.endsWith(".mjs"))
  .map(f => ({ name: f.replace(/\.mjs$/, ""), file: f }))
  .sort((a, b) => a.name.localeCompare(b.name));

// Per-endpoint bodies. Only behavioral tests need an entry; the source-level
// checks run against everything discovered. A discovered endpoint with no
// entry fails its own test below rather than being silently skipped.
//
// The bodies must be UNIQUE per call and VALID. Unique because dictionary.mjs
// keeps a module-level Map that outlives each test, and a repeat would be
// served from it with no fetch at all — quietly turning "the paid API was
// reached" into a false negative. Valid because dictionary's WORD_RE accepts
// only letters, spaces, apostrophes and hyphens: a numeric suffix makes every
// request a 400 and the test then fails for a reason that has nothing to do
// with the gate. Hence letters, not digits.
// `reply` is the JSON each endpoint's own parser accepts, and `expect` is
// what a successful call must then return. They are per-endpoint on purpose:
// one shared fixture would pass whichever parser is looser, and asserting
// only "status 200" would go green on a fallback path or a wrongly-wrapped
// success. What the endpoints do share is the Gemini envelope around it.
const alpha = n => "aabcdefghij".slice(1)[n % 10].repeat(1 + Math.floor(n / 10));
const BEHAVIOR = {
  translate: {
    keys: { GEMINI_API_KEY: "k" },
    body: n => ({ zh: `今天很棒${alpha(n)}`, age: "1-2" }),
    stub: () => geminiEnvelope({ en: "Good job!", zh: "做得好！", tip: "蹲下来看着他说" }),
    expect: async res => {
      const b = await res.json();
      assert.equal(b.en, "Good job!");
      assert.equal(b.tip, "蹲下来看着他说");
      assert.equal(b.source, "gemini", "a 200 from the OpenAI fallback would mean the Gemini path failed");
    },
  },
  dictionary: {
    keys: { GEMINI_API_KEY: "k" },
    body: n => ({ word: `bedtime${alpha(n)}` }),
    stub: () => geminiEnvelope({ lemma: "bedtime", senses: [{ pos: "n.", definition: "就寝时间" }] }),
    expect: async res => {
      const b = await res.json();
      assert.equal(b.lemma, "bedtime");
      assert.equal(b.senses[0].definition, "就寝时间");
    },
  },
  tts: {
    keys: { AZURE_SPEECH_KEY: "k", AZURE_SPEECH_REGION: "eastus" },
    // Unique per call for the same reason as the other two, though tts keeps
    // no cache of its own: a shared body would stop proving each call is real.
    body: n => ({ text: `Time for bed ${alpha(n)}` }),
    // Azure hands back raw mp3 bytes, not JSON. That is a different transport
    // for a success, not a different access-control story — which is why this
    // endpoint takes every check below rather than sitting any of them out.
    stub: () => new Response(new Uint8Array([0xff, 0xfb, 0x90, 0x64]), {
      status: 200, headers: { "Content-Type": "audio/mpeg" },
    }),
    expect: async res => {
      assert.match(res.headers.get("Content-Type") || "", /^audio\/mpeg/,
        "a parent's phone stores this as audio — the wrong type is a file that never plays");
      assert.ok((await res.arrayBuffer()).byteLength > 0, "an empty body is a silent clip");
    },
  },
};

let seq = 0;
function reqWith(name, headers, bodyOverride) {
  return new Request("https://example.test/api/x", {
    method: "POST",
    headers: new Headers(headers),
    body: JSON.stringify(bodyOverride ?? BEHAVIOR[name].body(++seq)),
  });
}

function withEnv(vars, fn) {
  const prev = {};
  for (const [k, v] of Object.entries(vars)) {
    prev[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return Promise.resolve().then(fn).finally(() => {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });
}

// Every handler call runs inside this. `calls` is the evidence for the tests
// that matter most: a request that returns 403 but has already called the paid
// API has failed, because the money is spent either way.
//
// The stubbed response comes from the endpoint's own `stub` factory rather
// than one hardcoded shape. Two endpoints unwrap a Gemini envelope; tts gets
// raw mp3 bytes back from Azure. That difference is in the TRANSPORT of a
// success, not in the access-control semantics — so it must not become a
// reason for an endpoint to sit out any of the checks below.
//
// Pass no spec for the refusal tests: nothing should reach the stub there
// anyway, and an unusable reply makes an accidental call show up as a failure
// rather than passing quietly.
const geminiEnvelope = reply => new Response(JSON.stringify({
  candidates: [{ content: { parts: [{ text: JSON.stringify(reply ?? {}) }] } }],
}), { status: 200, headers: { "Content-Type": "application/json" } });

async function withStub(spec, fn) {
  const calls = [];
  const prev = globalThis.fetch;
  globalThis.fetch = async (...args) => {
    calls.push(args);
    return spec?.stub ? spec.stub() : geminiEnvelope(null);
  };
  try { return await fn(calls); }
  finally { globalThis.fetch = prev; }
}

const load = ep => import(`../netlify/functions/${ep.file}`).then(m => m.default);
const EXERCISED = DISCOVERED.filter(ep => BEHAVIOR[ep.name]);

// ══ 0. 覆盖面本身 ═════════════════════════════════════════════════════

test("at least one endpoint was discovered — an empty sweep makes every test below vacuous", () => {
  assert.ok(DISCOVERED.length > 0, `no .mjs endpoints found under ${FN_DIR}`);
});

test("every discovered endpoint is exercised here", () => {
  const missing = DISCOVERED.filter(ep => !BEHAVIOR[ep.name]).map(ep => ep.name);
  assert.deepEqual(missing, [],
    `these endpoints exist but are not exercised: ${missing.join(", ")} — add them to BEHAVIOR`);
});

// ══ 1. 没有码的人一律进不来，且不花钱 ═════════════════════════════════

for (const ep of EXERCISED) {
  // Status and cost asserted together on purpose: separating them lets a
  // version that returns 403 *after* paying pass one test and fail the other,
  // which reads like two unrelated problems.
  test(`${ep.name}: no code — refused, and the paid API is never called`, async () => {
    const handler = await load(ep);
    await withEnv({ LL_ACCESS_CODE: CODE, ...BEHAVIOR[ep.name].keys }, () =>
      withStub(BEHAVIOR[ep.name], async calls => {
        const res = await handler(reqWith(ep.name, { "Content-Type": "application/json" }));
        assert.equal(res.status, 403);
        assert.equal(calls.length, 0, "a refused request must not reach the paid API");
      }));
  });

  test(`${ep.name}: wrong code — refused, and the paid API is never called`, async () => {
    const handler = await load(ep);
    await withEnv({ LL_ACCESS_CODE: CODE, ...BEHAVIOR[ep.name].keys }, () =>
      withStub(BEHAVIOR[ep.name], async calls => {
        const res = await handler(reqWith(ep.name, {
          "Content-Type": "application/json", "X-LL-Access": "wrong-code-000000000",
        }));
        assert.equal(res.status, 403);
        assert.equal(calls.length, 0);
      }));
  });

  test(`${ep.name}: the refusal says why, in a shape the app can act on`, async () => {
    const handler = await load(ep);
    await withEnv({ LL_ACCESS_CODE: CODE, ...BEHAVIOR[ep.name].keys }, () =>
      withStub(null, async () => {
        const res = await handler(reqWith(ep.name, { "Content-Type": "application/json" }));
        const body = await res.json();
        assert.equal(typeof body.error, "string");
        assert.ok(body.error.length > 0, "an empty body gives the app nothing to show a parent");
      }));
  });

  test(`${ep.name}: a wrong code and a missing code are indistinguishable`, async () => {
    const handler = await load(ep);
    await withEnv({ LL_ACCESS_CODE: CODE, ...BEHAVIOR[ep.name].keys }, () =>
      withStub(null, async () => {
        const none = await handler(reqWith(ep.name, { "Content-Type": "application/json" }));
        const wrong = await handler(reqWith(ep.name, {
          "Content-Type": "application/json", "X-LL-Access": "wrong-code-000000000",
        }));
        assert.equal(none.status, wrong.status);
        assert.deepEqual(await none.json(), await wrong.json(),
          "a different message for a wrong code tells a prober the code exists and is close");
      }));
  });

  // The method check keeps its existing position, ahead of the gate. A 403
  // would not hide the endpoint either — it says just as plainly that the
  // path is real — while 405 is the correct HTTP answer and avoids turning a
  // CORS preflight into a refusal. What matters is that neither path pays.
  test(`${ep.name}: a non-POST is still 405, and still costs nothing`, async () => {
    const handler = await load(ep);
    await withEnv({ LL_ACCESS_CODE: CODE, ...BEHAVIOR[ep.name].keys }, () =>
      withStub(BEHAVIOR[ep.name], async calls => {
        const res = await handler(new Request("https://example.test/api/x", { method: "GET" }));
        assert.equal(res.status, 405);
        assert.equal(calls.length, 0);
      }));
  });
}

// ══ 2. 有码的人照常使用，原有校验不受影响 ═════════════════════════════

for (const ep of EXERCISED) {
  test(`${ep.name}: the right code goes through and comes back with a real answer`, async () => {
    const handler = await load(ep);
    const spec = BEHAVIOR[ep.name];
    await withEnv({ LL_ACCESS_CODE: CODE, ...spec.keys }, () =>
      withStub(spec, async calls => {
        const res = await handler(reqWith(ep.name, {
          "Content-Type": "application/json", "X-LL-Access": CODE,
        }));
        // Not merely "not refused": a gate that swallowed every request would
        // also never return 403.
        assert.ok(calls.length > 0, "an authorized request must actually reach the API");
        assert.equal(res.status, 200, "a parent with a code must get a real answer, not an error");
        // And not merely 200: a fallback path or a wrongly-wrapped success
        // would also be 200, and this test would go green while the feature
        // was quietly broken.
        await spec.expect(res);
      }));
  });

  test(`${ep.name}: the gate does not swallow the existing input validation`, async () => {
    const handler = await load(ep);
    await withEnv({ LL_ACCESS_CODE: CODE, ...BEHAVIOR[ep.name].keys }, () =>
      withStub(BEHAVIOR[ep.name], async calls => {
        const res = await handler(reqWith(ep.name, {
          "Content-Type": "application/json", "X-LL-Access": CODE,
        }, { nonsense: true }));
        assert.equal(res.status, 400, "bad input must still be 400 — a new door must not break the locks inside");
        assert.equal(calls.length, 0, "invalid input must not reach the paid API either");
      }));
  });
}

// translate's own boundaries, checked through the gate: an out-of-range age
// and an over-length string were 400 before this change and must stay 400.
test("translate: its age and length limits still apply behind the gate", async () => {
  const handler = await load(DISCOVERED.find(e => e.name === "translate"));
  await withEnv({ LL_ACCESS_CODE: CODE, GEMINI_API_KEY: "k" }, () =>
    withStub(BEHAVIOR.translate, async calls => {
      const hdr = { "Content-Type": "application/json", "X-LL-Access": CODE };
      const badAge = await handler(reqWith("translate", hdr, { zh: "你好", age: "0-1" }));
      assert.equal(badAge.status, 400, "0-1 is not a translate age band");
      const tooLong = await handler(reqWith("translate", hdr, { zh: "字".repeat(201), age: "1-2" }));
      assert.equal(tooLong.status, 400, "over 200 characters must stay refused");
      assert.equal(calls.length, 0);
    }));
});

// ══ 3. 部署时漏配那串码 —— 拒绝所有人，不是放行所有人 ═══════════════

for (const ep of EXERCISED) {
  test(`${ep.name}: with LL_ACCESS_CODE unset, EVERYONE is refused (fail closed)`, async () => {
    const handler = await load(ep);
    await withEnv({ LL_ACCESS_CODE: undefined, ...BEHAVIOR[ep.name].keys }, () =>
      withStub(BEHAVIOR[ep.name], async calls => {
        const noCode = await handler(reqWith(ep.name, { "Content-Type": "application/json" }));
        assert.equal(noCode.status, 403);
        const anyCode = await handler(reqWith(ep.name, {
          "Content-Type": "application/json", "X-LL-Access": "anything-at-all",
        }));
        assert.equal(anyCode.status, 403,
          "an unset variable must not turn the gate into a pass-through — that is how endpoints end up open by accident");
        assert.equal(calls.length, 0);
      }));
  });
}

test("an empty LL_ACCESS_CODE is treated as unset, whatever the caller sends", async () => {
  const { isAuthorized } = await import("../netlify/functions/_shared/access.mjs");
  await withEnv({ LL_ACCESS_CODE: "" }, () => {
    const mk = c => new Request("https://example.test/x", {
      method: "POST", headers: new Headers(c === null ? {} : { "X-LL-Access": c }),
    });
    assert.equal(isAuthorized(mk(null)), false, "no header");
    assert.equal(isAuthorized(mk("")), false, "empty string must never match empty config");
    assert.equal(isAuthorized(mk("anything")), false);
  });
});

// ══ 4. 码的匹配是精确的 ═══════════════════════════════════════════════

test("a code differing at any position is refused — first byte and last byte alike", async () => {
  const { isAuthorized } = await import("../netlify/functions/_shared/access.mjs");
  await withEnv({ LL_ACCESS_CODE: CODE }, () => {
    const mk = c => new Request("https://example.test/x", {
      method: "POST", headers: new Headers({ "X-LL-Access": c }),
    });
    assert.equal(isAuthorized(mk("Xest-access-code-1234")), false);
    assert.equal(isAuthorized(mk("test-access-code-123X")), false);
    assert.equal(isAuthorized(mk(CODE)), true);
  });
});

test("length and case are part of the code — no forgiving normalization", async () => {
  const { isAuthorized } = await import("../netlify/functions/_shared/access.mjs");
  await withEnv({ LL_ACCESS_CODE: CODE }, () => {
    const mk = c => new Request("https://example.test/x", {
      method: "POST", headers: new Headers({ "X-LL-Access": c }),
    });
    assert.equal(isAuthorized(mk(CODE + "x")), false);
    assert.equal(isAuthorized(mk(CODE.slice(0, -1))), false);
    // A future "helpful" toLowerCase() would widen what counts as the code,
    // and nothing else in this file would notice.
    assert.equal(isAuthorized(mk(CODE.toUpperCase())), false, "different case");
  });
});

// Leading and trailing spaces are deliberately NOT asserted here. HTTP
// normalizes the optional whitespace around a field value, and Headers does
// the same, so `" " + CODE` arrives as CODE — the two are not distinguishable
// inputs at this boundary and a test for them would be checking a case that
// cannot occur. (A `.trim()` added to this module later would likewise change
// nothing: by then the whitespace is already gone.) If this module is ever
// fed raw header bytes instead of a parsed Request, the whitespace policy
// becomes a real decision and needs its own test.

// The tests above check the ANSWER, and a plain `===` gives the same answers
// — verified against a naive implementation, which passed all of them. What
// `===` also does is return at the first differing byte, and that timing
// difference is what lets someone recover the code one character at a time.
//
// A real timing measurement is flaky on a shared machine, and this project's
// rule is that a test which sometimes passes is not green. Nor can a regex
// over the source prove the property: a loop with `if (...) return false`
// inside it has a loop and no `===`, and still exits early.
//
// So the requirement is on the primitive, not on a shape: use the one Node
// ships for this. That is checkable, and it moves the property from "the
// author wrote the loop correctly" to "the platform implements it".
test("the comparison uses Node's own constant-time primitive, not a hand-written loop", () => {
  const src = readFileSync(SHARED, "utf8");
  assert.match(src, /from\s+["']node:crypto["']/, "must import from node:crypto");
  assert.match(src, /timingSafeEqual/, "must use crypto.timingSafeEqual");
  assert.ok(!/charCodeAt/.test(src),
    "a hand-rolled character loop is what this requirement exists to rule out");
});

test("the code's length does not change the work done — digests are compared, not raw strings", async () => {
  const { isAuthorized } = await import("../netlify/functions/_shared/access.mjs");
  await withEnv({ LL_ACCESS_CODE: CODE }, () => {
    const mk = c => new Request("https://example.test/x", {
      method: "POST", headers: new Headers({ "X-LL-Access": c }),
    });
    // A bare `if (a.length !== b.length) return false` answers "how long is
    // the real code?" on the first call. Hashing to a fixed size removes that
    // question; these must be refused the same way a same-length wrong code is.
    assert.equal(isAuthorized(mk("x")), false);
    assert.equal(isAuthorized(mk("x".repeat(500))), false);
  });
});

// ══ 5. 一处定义，不是每个端点一份拷贝 ═════════════════════════════════

test("every discovered endpoint imports the one shared gate", () => {
  for (const ep of DISCOVERED) {
    const src = readFileSync(new URL(ep.file, FN_DIR), "utf8");
    assert.match(src, /import\s*\{[^}]*\}\s*from\s*["'][^"']*_shared\/access\.mjs["']/,
      `${ep.name} must import the shared gate — a copy per endpoint is a place to forget`);
    assert.ok(!/charCodeAt|function\s+timingSafeEqual/.test(src),
      `${ep.name} must not carry its own comparison routine`);
  }
});

// ── Runner ───────────────────────────────────────────────
console.log("access-control tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
