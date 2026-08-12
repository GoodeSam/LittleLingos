#!/usr/bin/env node
// Behavioral tests for netlify/functions/dictionary.mjs (English -> Chinese
// word lookup). Zero-dependency, fully offline: globalThis.fetch is always
// stubbed, never real network. Never `netlify dev`. Modeled on the house
// style of test/sw.test.mjs (same pass/fail counting, same exit code).
//
// Contract under test (see netlify/functions/dictionary.mjs header comment
// for the authoritative version): POST { word: "<english word or phrase>" }
// -> { lemma: "<canonical form>", senses: [{ pos, definition }, ...], source }
// v1 is English -> Chinese ONLY; Chinese input is invalid input (400).
import assert from "node:assert/strict";

// Import fresh per test file run (module-level cache lives for the process
// lifetime of the Netlify function instance — here, for the test process).
const { default: handler } = await import("../netlify/functions/dictionary.mjs");

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// ── env helpers: stub the key, always restore ──────────────────────────
const ENV_KEY = "GEMINI_API_KEY";
function withKey(value, fn) {
  const prev = process.env[ENV_KEY];
  if (value === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = value;
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      if (prev === undefined) delete process.env[ENV_KEY];
      else process.env[ENV_KEY] = prev;
    });
}

// ── fetch stub helpers ──────────────────────────────────────────────────
function makeReq(body, { method = "POST" } = {}) {
  return {
    method,
    json: async () => {
      if (typeof body === "string") throw new Error("bad json"); // simulate parse failure path
      return body;
    },
  };
}

// A req whose .json() throws, simulating malformed JSON body from the client.
function makeMalformedJsonReq() {
  return {
    method: "POST",
    json: async () => { throw new SyntaxError("Unexpected token"); },
  };
}

function geminiOkFetchStub(payload, { calls } = {}) {
  return async (url, opts) => {
    if (calls) calls.push({ url, opts });
    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }],
      }),
    };
  };
}

// ── cases ────────────────────────────────────────────────────────────────

test("non-POST method -> 405", async () => {
  await withKey("k", async () => {
    const res = await handler(makeReq({ word: "run" }, { method: "GET" }));
    assert.equal(res.status, 405);
  });
});

test("API key not configured -> 500", async () => {
  await withKey(undefined, async () => {
    const res = await handler(makeReq({ word: "run" }));
    assert.equal(res.status, 500);
  });
});

test("invalid input: empty word -> 400", async () => {
  await withKey("k", async () => {
    const res = await handler(makeReq({ word: "" }));
    assert.equal(res.status, 400);
  });
});

test("invalid input: over-long word -> 400", async () => {
  await withKey("k", async () => {
    const res = await handler(makeReq({ word: "a".repeat(500) }));
    assert.equal(res.status, 400);
  });
});

test("invalid input: non-English/Chinese input (emoji/Korean) -> 400", async () => {
  await withKey("k", async () => {
    const res1 = await handler(makeReq({ word: "\u{1F600}\u{1F600}" }));
    assert.equal(res1.status, 400);
    const res2 = await handler(makeReq({ word: "안녕" })); // Korean
    assert.equal(res2.status, 400);
  });
});

test("invalid input: Chinese input -> 400 (v1 is en->zh only, no zh path)", async () => {
  await withKey("k", async () => {
    const res = await handler(makeReq({ word: "跑" })); // 跑
    assert.equal(res.status, 400);
  });
});

test("invalid input: non-string body -> 400", async () => {
  await withKey("k", async () => {
    const res = await handler(makeReq({ word: 12345 }));
    assert.equal(res.status, 400);
  });
});

test("invalid input: malformed JSON body -> 400", async () => {
  await withKey("k", async () => {
    const res = await handler(makeMalformedJsonReq());
    assert.equal(res.status, 400);
  });
});

test("cache hit: two identical lookups issue only one upstream fetch", async () => {
  await withKey("k", async () => {
    const calls = [];
    globalThis.fetch = geminiOkFetchStub(
      { lemma: "run", senses: [{ pos: "v.", definition: "跑，奔跑" }] },
      { calls }
    );
    const word = `cachetest-${Math.random()}`; // unique per test run, avoids cross-test collision
    const res1 = await handler(makeReq({ word: "cache" }));
    const res2 = await handler(makeReq({ word: "cache" }));
    assert.equal(res1.status, 200);
    assert.equal(res2.status, 200);
    assert.equal(calls.length, 1, "second identical lookup must be served from cache, not refetched");
    const body1 = await res1.json();
    const body2 = await res2.json();
    assert.deepEqual(body1, body2);
    void word;
  });
});

test("cache size cap: exceeding the cap evicts and size stays bounded", async () => {
  await withKey("k", async () => {
    let n = 0;
    globalThis.fetch = async () => {
      n++;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: JSON.stringify({ lemma: `w${n}`, senses: [{ pos: "n.", definition: `def${n}` }] }) }] } }],
        }),
      };
    };
    // Letters-only distinct words (the endpoint's charset rule rejects
    // digits) — base-26 suffix keeps every word unique across TOTAL runs.
    function toLetters(i) {
      let n = i + 1, s = "";
      while (n > 0) { n--; s = String.fromCharCode(97 + (n % 26)) + s; n = Math.floor(n / 26); }
      return s;
    }
    // Fire well past any reasonable cap (documented as 500 in the impl).
    const TOTAL = 520;
    for (let i = 0; i < TOTAL; i++) {
      const res = await handler(makeReq({ word: `capword${toLetters(i)}` }));
      assert.equal(res.status, 200);
    }
    assert.equal(n, TOTAL, "every distinct word must actually hit upstream (no accidental cache collision)");
    const cacheSize = handler.__cacheSizeForTest ? handler.__cacheSizeForTest() : undefined;
    assert.ok(cacheSize !== undefined, "dictionary.mjs must expose __cacheSizeForTest for cache-cap verification");
    assert.ok(cacheSize <= 500, `cache size ${cacheSize} must stay <= documented cap of 500`);
  });
});

test("upstream responds non-ok -> 502", async () => {
  await withKey("k", async () => {
    globalThis.fetch = async () => ({ ok: false, status: 503, json: async () => ({}) });
    const res = await handler(makeReq({ word: "nonokword" }));
    assert.equal(res.status, 502);
  });
});

test("upstream times out (AbortError) -> 502", async () => {
  await withKey("k", async () => {
    globalThis.fetch = async () => {
      const err = new Error("The operation was aborted");
      err.name = "AbortError";
      throw err;
    };
    const res = await handler(makeReq({ word: "timeoutword" }));
    assert.equal(res.status, 502);
  });
});

test("provider returns malformed JSON -> 502", async () => {
  await withKey("k", async () => {
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: "{not valid json" }] } }],
      }),
    });
    const res = await handler(makeReq({ word: "malformedword" }));
    assert.equal(res.status, 502);
  });
});

test("success: response body carries lemma + senses[{pos, definition}]", async () => {
  await withKey("k", async () => {
    globalThis.fetch = geminiOkFetchStub({
      lemma: "watch",
      senses: [
        { pos: "v.", definition: "看，观看" },
        { pos: "n.", definition: "手表" },
      ],
    });
    const res = await handler(makeReq({ word: "watch" }));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.lemma, "watch");
    assert.ok(Array.isArray(body.senses) && body.senses.length >= 2);
    for (const s of body.senses) {
      assert.ok(typeof s.pos === "string" && s.pos.length > 0);
      assert.ok(typeof s.definition === "string" && s.definition.length > 0);
    }
  });
});

console.log("dictionary.mjs API behavior tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.stack || e.message}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
