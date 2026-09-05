#!/usr/bin/env node
// Behavioral tests for the shared saved/review-item classification module in
// index.html (Unit C of the dictionary build). Zero-dependency: extracts the
// code between the ll:dictionary-shared markers and runs it in a vm context
// with a stub `scenarios` object, per the extraction idiom of
// test/voice-input.test.mjs. Covers:
//   - isAudioBacked(item): the positive allowlist that replaced the old
//     `!id.startsWith("t_")` denylist (a future "w_" dictionary id must
//     never fall into the pregenerated-mp3 branch — guaranteed 404 bug).
//   - resolveItemLabel(item): the single label/icon resolver shared by
//     renderSavedScreen() and renderReviewCard() so a scenario phrase, an AI
//     translation, and a dictionary word each get a distinct, correct label
//     and the two render paths can never drift apart again.
//   - the three Severity-C `user-select: none` CSS fixes (raw text assert,
//     matching test/sw.test.mjs's file-content assertion style).
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import assert from "node:assert/strict";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");

const START = "/* ll:dictionary-shared:start */";
const END = "/* ll:dictionary-shared:end */";

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// ── Fixture scenario table (stand-in for the real scenarios.js) ────────
const FIXTURE_SCENARIOS = {
  bath: { icon: "🛁", name: "洗澡时间", color: "var(--blue)", phrases: {} },
  meal: { icon: "🍚", name: "吃饭时间", color: "var(--warm)", phrases: {} },
};

function loadModule() {
  const s = html.indexOf(START), e = html.indexOf(END);
  assert.ok(s !== -1 && e !== -1, `index.html must contain ${START} … ${END} markers`);
  const ctx = { scenarios: FIXTURE_SCENARIOS, console };
  vm.createContext(ctx);
  vm.runInContext(html.slice(s, e + END.length), ctx);
  assert.equal(typeof ctx.isAudioBacked, "function", "module must define isAudioBacked()");
  assert.equal(typeof ctx.resolveItemLabel, "function", "module must define resolveItemLabel()");
  assert.equal(typeof ctx.savedHeadline, "function", "module must define savedHeadline()");
  return ctx;
}

// ── isAudioBacked: positive allowlist ──────────────────────────────────
test("real scenario item IS audio-backed", () => {
  const { isAudioBacked } = loadModule();
  assert.equal(isAudioBacked({ id: "b01", scenario: "bath" }), true);
});

test("__dict__ item is NOT audio-backed (no mp3 exists for dictionary words)", () => {
  const { isAudioBacked } = loadModule();
  assert.equal(isAudioBacked({ id: "w_apple", scenario: "__dict__" }), false);
});

test("__translate__ item is NOT audio-backed", () => {
  const { isAudioBacked } = loadModule();
  assert.equal(isAudioBacked({ id: "t_1234567890", scenario: "__translate__" }), false);
});

test("legacy t_-prefixed item is NOT audio-backed even if scenario is stale/misleading", () => {
  const { isAudioBacked } = loadModule();
  // Regression guard: pre-"__translate__" saves (commit a1f7181) could carry
  // scenario: "bath" on an AI translation due to a fixed bug. The id prefix
  // must still win so those old localStorage records don't regress into a
  // 404'ing mp3 request.
  assert.equal(isAudioBacked({ id: "t_999", scenario: "bath" }), false);
});

test("item with an unresolvable/unknown scenario is NOT audio-backed", () => {
  const { isAudioBacked } = loadModule();
  assert.equal(isAudioBacked({ id: "x01", scenario: "not_a_real_scenario" }), false);
});

test("no mp3 URL is ever constructed for a non-audio-backed item (Audio ctor not called)", () => {
  const ctx = loadModule();
  const calls = [];
  ctx.Audio = function (url) { calls.push(url); };
  const dictItem = { id: "w_apple", scenario: "__dict__" };
  if (ctx.isAudioBacked(dictItem)) new ctx.Audio(`./audio/${dictItem.id}_normal.mp3`);
  assert.equal(calls.length, 0, "dictionary item must never construct an Audio() for a precached mp3");
});

test("a real scenario item still requests the expected mp3 URL", () => {
  const ctx = loadModule();
  const calls = [];
  ctx.Audio = function (url) { calls.push(url); };
  const item = { id: "b01", scenario: "bath" };
  if (ctx.isAudioBacked(item)) new ctx.Audio(`./audio/${item.id}_normal.mp3`);
  assert.deepEqual(calls, ["./audio/b01_normal.mp3"]);
});

// ── resolveItemLabel: single shared resolver, three distinct kinds ─────
test("scenario item resolves to the scenario's own icon + name", () => {
  const { resolveItemLabel } = loadModule();
  // Plain-field comparison, not assert.deepEqual: the label object is
  // constructed inside a separate vm realm, so its Object prototype differs
  // from this file's even when every own-property value matches.
  const label = resolveItemLabel({ id: "b01", scenario: "bath" });
  assert.equal(label.icon, "🛁");
  assert.equal(label.name, "洗澡时间");
});

test("__translate__ item resolves to a distinct AI-translation label", () => {
  const { resolveItemLabel } = loadModule();
  const label = resolveItemLabel({ id: "t_1234567890", scenario: "__translate__" });
  assert.match(label.name, /翻译/);
  assert.notEqual(label.icon, "🛁");
});

test("legacy t_-prefixed item resolves to the AI-translation label, not a scenario label", () => {
  const { resolveItemLabel } = loadModule();
  const label = resolveItemLabel({ id: "t_999", scenario: "bath" });
  assert.match(label.name, /翻译/);
});

test("__dict__ item resolves to its own distinct dictionary label, never the translation label", () => {
  const { resolveItemLabel } = loadModule();
  const label = resolveItemLabel({ id: "w_apple", scenario: "__dict__" });
  assert.doesNotMatch(label.name, /翻译/);
  assert.equal(label.icon, "📖");
});

test("all three kinds produce mutually distinct name+icon pairs", () => {
  const { resolveItemLabel } = loadModule();
  const scenarioLabel = resolveItemLabel({ id: "b01", scenario: "bath" });
  const translateLabel = resolveItemLabel({ id: "t_1", scenario: "__translate__" });
  const dictLabel = resolveItemLabel({ id: "w_1", scenario: "__dict__" });
  const keys = [scenarioLabel, translateLabel, dictLabel].map(l => l.icon + "|" + l.name);
  assert.equal(new Set(keys).size, 3, "each kind must be visually and textually distinguishable");
});

// ── savedHeadline: the "(pos)"-in-`en` replacement, en · senseLabel ────
// (founder-approved revision, replacing the earlier "en carries the sense's
// pos in parentheses" design — see buildDictSaveEntry's comment block,
// ll:dictionary-lookup, and the devon-frontend-engineer handoff report.)
test("savedHeadline: bare en when senseLabel is absent (single-sense save / scenario phrase / AI translation)", () => {
  const { savedHeadline } = loadModule();
  assert.equal(savedHeadline({ en: "eat" }), "eat");
});

test("savedHeadline: bare en when senseLabel is an empty string (never a stray separator)", () => {
  const { savedHeadline } = loadModule();
  assert.equal(savedHeadline({ en: "eat", senseLabel: "" }), "eat");
});

test("savedHeadline: never renders a stray \"· \" or \"· undefined\" when senseLabel is missing", () => {
  const { savedHeadline } = loadModule();
  const out = savedHeadline({ en: "eat" });
  assert.doesNotMatch(out, /·/, "no separator dot must appear without a real senseLabel");
  assert.doesNotMatch(out, /undefined/);
});

test("savedHeadline: \"en · senseLabel\" when senseLabel is present and non-empty", () => {
  const { savedHeadline } = loadModule();
  assert.equal(savedHeadline({ en: "clap", senseLabel: "拍手" }), "clap · 拍手");
});

test("savedHeadline: distinct senseLabels for two saves of the same lemma render distinct headlines", () => {
  const { savedHeadline } = loadModule();
  const a = savedHeadline({ en: "clap", senseLabel: "拍手" });
  const b = savedHeadline({ en: "clap", senseLabel: "掌声" });
  assert.notEqual(a, b, "two senses of one lemma must be visually distinguishable in the saved list again");
});

test("savedHeadline: tolerates a missing/null item without throwing", () => {
  const { savedHeadline } = loadModule();
  assert.equal(savedHeadline(null), "");
  assert.equal(savedHeadline(undefined), "");
});

// ── renderSavedScreen / renderReviewCard / renderSavedChips must all route
// the headline through savedHeadline() (no drift, same idiom as the
// resolveItemLabel checks above) ────────────────────────────────────────
test("renderSavedScreen, renderReviewCard, and renderSavedChips source code all call savedHeadline (no drift)", () => {
  const savedChipsSrc = html.slice(html.indexOf("function renderSavedChips"), html.indexOf("function renderSavedScreen"));
  const savedScreenSrc = html.slice(html.indexOf("function renderSavedScreen"), html.indexOf("function removeSaved"));
  // reviewAnswer() was relocated (Unit B increment C, ll:review-engine
  // marker) to sit adjacent to dueReviews(), so it now appears BEFORE
  // renderReviewCard in source order — playReviewAudio, the next function
  // after renderReviewCard, is the stable boundary now.
  const reviewCardSrc = html.slice(html.indexOf("function renderReviewCard"), html.indexOf("function playReviewAudio"));
  assert.match(savedChipsSrc, /savedHeadline\(/, "renderSavedChips must use the shared headline builder");
  assert.match(savedScreenSrc, /savedHeadline\(/, "renderSavedScreen must use the shared headline builder");
  assert.match(reviewCardSrc, /savedHeadline\(/, "renderReviewCard must use the shared headline builder");
});

test("renderSavedScreen and renderReviewCard no longer assign bare p.en/item.en directly to their headline element", () => {
  const savedScreenSrc = html.slice(html.indexOf("function renderSavedScreen"), html.indexOf("function removeSaved"));
  const reviewCardSrc = html.slice(html.indexOf("function renderReviewCard"), html.indexOf("function playReviewAudio"));
  assert.doesNotMatch(savedScreenSrc, /enDiv\.textContent\s*=\s*p\.en\s*;/, "must route through savedHeadline(), not raw p.en");
  assert.doesNotMatch(reviewCardSrc, /en\.textContent\s*=\s*item\.en\s*;/, "must route through savedHeadline(), not raw item.en");
});

// ── renderSavedScreen / renderReviewCard must use the SAME resolver ────
test("renderSavedScreen and renderReviewCard source code both call resolveItemLabel (no drift)", () => {
  const savedScreenSrc = html.slice(html.indexOf("function renderSavedScreen"), html.indexOf("function removeSaved"));
  // reviewAnswer() was relocated (Unit B increment C, ll:review-engine
  // marker) to sit adjacent to dueReviews(), so it now appears BEFORE
  // renderReviewCard in source order — playReviewAudio, the next function
  // after renderReviewCard, is the stable boundary now.
  const reviewCardSrc = html.slice(html.indexOf("function renderReviewCard"), html.indexOf("function playReviewAudio"));
  assert.match(savedScreenSrc, /resolveItemLabel\(/, "renderSavedScreen must use the shared label resolver");
  assert.match(reviewCardSrc, /resolveItemLabel\(/, "renderReviewCard must use the shared label resolver");
});

test("renderSavedScreen and renderReviewCard no longer hand-roll the old disagreeing fallback labels", () => {
  const savedScreenSrc = html.slice(html.indexOf("function renderSavedScreen"), html.indexOf("function removeSaved"));
  // reviewAnswer() was relocated (Unit B increment C, ll:review-engine
  // marker) to sit adjacent to dueReviews(), so it now appears BEFORE
  // renderReviewCard in source order — playReviewAudio, the next function
  // after renderReviewCard, is the stable boundary now.
  const reviewCardSrc = html.slice(html.indexOf("function renderReviewCard"), html.indexOf("function playReviewAudio"));
  assert.doesNotMatch(savedScreenSrc, /'翻译'/, "old bare '翻译' fallback must be gone");
  assert.doesNotMatch(reviewCardSrc, /"AI 翻译"/, "old inline \"AI 翻译\" literal must route through the shared resolver instead");
});

// ── playReviewAudio must gate on isAudioBacked, not the old id-prefix denylist ──
test("playReviewAudio source no longer branches on the raw t_ id-prefix denylist", () => {
  const fnSrc = html.slice(html.indexOf("function playReviewAudio"), html.indexOf("// ── Translate"));
  assert.doesNotMatch(fnSrc, /startsWith\("t_"\)/, "playReviewAudio must not re-implement the id-prefix denylist inline");
  assert.match(fnSrc, /isAudioBacked\(/, "playReviewAudio must gate on the shared isAudioBacked() allowlist");
});

// ── C3: Severity-C user-select fixes (raw-text assertions, sw.test.mjs style) ──
test(".review-cta carries user-select: none (Sev C touch-hygiene fix)", () => {
  const block = html.slice(html.indexOf(".review-cta {"), html.indexOf(".review-cta.show"));
  assert.match(block, /user-select:\s*none/);
});

test(".review-btn-reveal carries user-select: none (Sev C touch-hygiene fix)", () => {
  const block = html.slice(html.indexOf(".review-btn-reveal {"), html.indexOf(".review-btn-again"));
  assert.match(block, /user-select:\s*none/);
});

// ── Runner ───────────────────────────────────────────────
console.log("dictionary-review (Unit C) tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
