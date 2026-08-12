#!/usr/bin/env node
// Behavioral tests for the review-scheduling core (dueReviews + reviewAnswer)
// against a Unit B increment C dictionary save, proving dictionary saves
// flow through the EXISTING spaced-repetition engine rather than a second,
// parallel interval table (a hard constraint of the increment C spec).
// Zero-dependency: extracts the code between the ll:review-engine markers
// in index.html and runs it in a vm context, following the extraction idiom
// of test/dictionary-review.test.mjs / test/dictionary-lookup.test.mjs.
//
// Covers:
//   - REVIEW_INTERVALS in index.html has not silently drifted from the
//     value this suite assumes (guards against a second interval table
//     being added instead of reusing the real one).
//   - A dictionary-shaped saved item (scenario: "__dict__", id "w_..."),
//     indistinguishable to dueReviews()/reviewAnswer() from any other saved
//     item, is correctly selected by dueReviews() when due and correctly
//     advanced by reviewAnswer(true) through REVIEW_INTERVALS.
//   - reviewAnswer(false) on a dictionary item resets rv.s/rv.due exactly
//     like it does for any other saved item — the same semantics
//     resetDueOnRepeatLookup() in the ll:dictionary-lookup fragment reuses.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import assert from "node:assert/strict";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");

const START = "/* ll:review-engine:start */";
const END = "/* ll:review-engine:end */";

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// The value this suite assumes REVIEW_INTERVALS to be — verified against
// the real source below so this file itself can never become a silent
// second interval table.
const ASSUMED_REVIEW_INTERVALS = [1, 3, 7, 14, 30];

function makeEnv({ savedPhrases = [] } = {}) {
  const calls = { safeSetItem: [], updateNavBadge: 0, renderReviewStrip: 0, renderReviewCard: 0, renderReviewArea: 0 };
  const ctx = {
    savedPhrases,
    REVIEW_INTERVALS: ASSUMED_REVIEW_INTERVALS,
    // sortedBySavedAtDesc lives outside this marker (line ~2198) — reused
    // here as a faithful stand-in of its real, simple behavior (stable
    // descending sort on `.savedAt`) rather than re-testing it (it already
    // has its own coverage elsewhere in the suite).
    sortedBySavedAtDesc: (arr) => [...arr].sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0)),
    safeSetItem: (k, v) => calls.safeSetItem.push([k, v]),
    updateNavBadge: () => { calls.updateNavBadge++; },
    renderReviewStrip: () => { calls.renderReviewStrip++; },
    renderReviewCard: () => { calls.renderReviewCard++; },
    renderReviewArea: () => { calls.renderReviewArea++; },
    console,
  };
  vm.createContext(ctx);
  const s = html.indexOf(START), e = html.indexOf(END);
  assert.ok(s !== -1 && e !== -1, `index.html must contain ${START} … ${END} markers`);
  vm.runInContext(html.slice(s, e + END.length), ctx);
  assert.equal(typeof ctx.dueReviews, "function", "module must define dueReviews()");
  assert.equal(typeof ctx.reviewAnswer, "function", "module must define reviewAnswer()");
  return { ctx, calls, savedPhrases };
}

function dictSavedItem(overrides = {}) {
  return {
    id: "w_eat__v", en: "eat", zh: "吃", tip: "在餐椅前说。",
    scenario: "__dict__", savedAt: Date.now(), rv: { s: 0, due: Date.now() - 1000 },
    ...overrides,
  };
}

// ── Guard: no silent second interval table ──────────────────────────────
test("index.html's real REVIEW_INTERVALS matches what this suite assumes (no drift, no second table)", () => {
  const m = html.match(/const REVIEW_INTERVALS = (\[[^\]]*\]);/);
  assert.ok(m, "index.html must define `const REVIEW_INTERVALS = [...]`");
  const real = JSON.parse(m[1]);
  assert.deepEqual(real, ASSUMED_REVIEW_INTERVALS);
});

// ── dueReviews(): a dictionary save is due exactly like any other save ──
test("a due dictionary-shaped save (scenario: __dict__) is selected by dueReviews()", () => {
  const { ctx } = makeEnv({ savedPhrases: [dictSavedItem()] });
  const due = ctx.dueReviews();
  assert.equal(due.length, 1);
  assert.equal(due[0].id, "w_eat__v");
});

test("a NOT-yet-due dictionary save is excluded from dueReviews()", () => {
  const notDue = dictSavedItem({ rv: { s: 1, due: Date.now() + 86400000 } });
  const { ctx } = makeEnv({ savedPhrases: [notDue] });
  assert.equal(ctx.dueReviews().length, 0);
});

// ── reviewAnswer(true): advances a dictionary item through REVIEW_INTERVALS ──
test("reviewAnswer(true) advances a dictionary item's rv.s and sets rv.due via REVIEW_INTERVALS[0] on first success", () => {
  const item = dictSavedItem();
  const { ctx, savedPhrases, calls } = makeEnv({ savedPhrases: [item] });
  ctx.__primeReviewQueueForTest(ctx.dueReviews());
  const before = Date.now();
  ctx.reviewAnswer(true);
  assert.equal(item.rv.s, 1);
  const expectedDue = before + ASSUMED_REVIEW_INTERVALS[0] * 86400000;
  assert.ok(Math.abs(item.rv.due - expectedDue) < 5000, "rv.due must advance by REVIEW_INTERVALS[0] days");
  assert.ok(calls.safeSetItem.length >= 1, "must persist through the existing safeSetItem path");
  assert.deepEqual(savedPhrases[0], item, "no second/parallel record was created");
});

test("reviewAnswer(true) repeated advances through successive REVIEW_INTERVALS stages", () => {
  const item = dictSavedItem();
  const { ctx } = makeEnv({ savedPhrases: [item] });
  for (let i = 0; i < ASSUMED_REVIEW_INTERVALS.length + 2; i++) {
    ctx.__primeReviewQueueForTest([item]);
    const before = Date.now();
    ctx.reviewAnswer(true);
    const stage = Math.min(i + 1, ASSUMED_REVIEW_INTERVALS.length);
    assert.equal(item.rv.s, stage, `stage ${i}: rv.s must cap at REVIEW_INTERVALS.length`);
    const days = ASSUMED_REVIEW_INTERVALS[Math.min(stage - 1, ASSUMED_REVIEW_INTERVALS.length - 1)];
    assert.ok(Math.abs(item.rv.due - (before + days * 86400000)) < 5000);
  }
});

// ── reviewAnswer(false): same "forgot it" reset resetDueOnRepeatLookup() mirrors ──
test("reviewAnswer(false) resets a dictionary item's rv.s to 0 and rv.due to now", () => {
  const item = dictSavedItem({ rv: { s: 4, due: Date.now() + 30 * 86400000 } });
  const { ctx } = makeEnv({ savedPhrases: [item] });
  ctx.__primeReviewQueueForTest([item]);
  const before = Date.now();
  ctx.reviewAnswer(false);
  assert.equal(item.rv.s, 0);
  assert.ok(item.rv.due >= before);
});

// ── Runner ───────────────────────────────────────────────
console.log("dictionary-review-engine (Unit B increment C) tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
