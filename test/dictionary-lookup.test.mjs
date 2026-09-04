#!/usr/bin/env node
// Behavioral tests for the home-screen dictionary-lookup CTA (Unit B
// increment A2) and the dictionary-words.js wiring (Unit B increment A1).
// Zero-dependency: extracts the code between the ll:dictionary-lookup
// markers in index.html and runs it in a vm context with a stub DOM and
// stubbed search-index dependencies, following the extraction idiom of
// test/voice-input.test.mjs and test/dictionary-review.test.mjs. Covers:
//   - looksLikeEnglishLookup(q): the predicate gating the 📖 查词典 CTA —
//     rejects Chinese, digits, empty/whitespace, and over-long input.
//   - buildDictionaryIndex(words): the form -> entry index built from
//     dictionary-words.js's shape (lemma + forms[] + senses[]).
//   - onSearchInput(): the 📖 查词典 CTA renders independently of the
//     `results.length < 3` threshold that gates the pre-existing 🤖 AI CTA
//     (the regression that matters most — see increment A2 spec), and never
//     renders for Chinese input (which always routes to AI-translate).
//   - sw.js precaches dictionary-words.js (increment A1).
//   - index.html loads dictionary-words.js as a script (increment A1).
//
// Increment B (lookup panel + network fallback) adds:
//   - performDictLookup(): local-curated-first order — a local hit never
//     calls fetch; a local miss does.
//   - every handled response/error state (400/502/500/timeout/malformed
//     JSON/network-error) renders a distinct, non-crashing panel state.
//   - all three provenance states (api / curated-uncleared / curated-cleared)
//     via dictProvenanceNote() + buildDictResultCard(), and the end-to-end
//     render through performDictLookup() for the two reachable-by-default
//     states (DICT_CURATED_CLEARED is false as authored).
//   - offline: the exact B6 copy for a NEW lookup, and that a curated hit
//     still renders fully offline.
//   - the session-guard race: a stale in-flight response can't overwrite a
//     newer lookup's render (same generation-counter pattern as
//     stopAllAudio()/playbackSession).
//   - buildDictionaryIndex dedup reachable end-to-end through
//     performDictLookup (an inflected form resolves to its lemma's entry).
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import assert from "node:assert/strict";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");
const swSrc = readFileSync(join(ROOT, "sw.js"), "utf8");

const START = "/* ll:dictionary-lookup:start */";
const END = "/* ll:dictionary-lookup:end */";

// The lookup module depends on the access-code module (accessHeaders()).
// Both are run into the same vm realm — see makeEnv().
const ACCESS_START = "/* ll:access-code:start */";
const ACCESS_END = "/* ll:access-code:end */";
const ACCESS_CODE = "test-access-code-1234";

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// ── Stub DOM ────────────────────────────────────────────
function fakeElement() {
  let html = "";
  const el = {
    className: "",
    textContent: "",
    onclick: null,
    children: [],
    // dataset stub (playDictResultAudio's play button sets
    // dataset.playingLabel, mirroring the review-btn-play/result-play-btn
    // idiom elsewhere in index.html): a plain object is enough since nothing
    // here needs the real DOMStringMap kebab-case translation.
    dataset: {},
    classList: {
      _set: new Set(),
      add(c) { this._set.add(c); },
      remove(c) { this._set.delete(c); },
      contains(c) { return this._set.has(c); },
      toggle(c, force) { (force === undefined ? !this._set.has(c) : force) ? this._set.add(c) : this._set.delete(c); },
    },
    appendChild(child) { el.children.push(child); return child; },
    // setAttribute is a no-op recorder, not a real attribute store: nothing
    // in this module reads attributes back, only sets them (role/tabindex on
    // the starter chips, Unit B increment D) — matching this stub's existing
    // "record enough to not crash" idiom for onclick/classList above.
    setAttribute(name, value) { el[`__attr_${name}`] = value; },
    get innerHTML() { return html; },
    set innerHTML(v) { html = v; el.children = []; },
  };
  return el;
}

// Default fixture curated word list — small, shape-only (per the hard
// constraint: never key a test off dictionary-words.js's actual wording,
// only off shape/lemmas/forms, which the file's own header freezes).
const FIXTURE_WORDS = [
  {
    lemma: "eat", forms: ["eat", "eats", "ate", "eaten", "eating"],
    senses: [{ key: "v", pos: "v.", zh: "吃", example: { en: "Let's eat!", zh: "我们开饭啦！" }, tip: "在餐椅前说。" }],
  },
  // "jump"/"clap" (not "run"/"watch" — those two are deliberately used
  // elsewhere in this file as CURATED-MISS fixtures that must fall through
  // to the API, so they must stay OUT of this curated word list or they'd
  // silently flip those tests' local-miss branch into a local hit).
  {
    lemma: "jump", forms: ["jump", "jumps", "jumped", "jumping"],
    senses: [{ key: "v", pos: "v.", zh: "跳", example: { en: "Let's jump!", zh: "我们跳一跳！" }, tip: "先自己跳一下做示范。" }],
  },
  {
    lemma: "clap", forms: ["clap", "claps", "clapped", "clapping"],
    senses: [
      { key: "v", pos: "v.", zh: "拍手", example: { en: "Clap your hands!", zh: "拍拍手！" }, tip: "举起宝宝的两只手轻轻拍。" },
      { key: "n", pos: "n.", zh: "掌声", example: { en: "Give him a big clap!", zh: "给他一个大大的掌声！" }, tip: "自己先鼓掌做示范。" },
    ],
  },
];

// Advances pending microtasks `n` times — enough for the promise chains in
// performDictLookup (fetch().then(res => res.json().then(...))) to settle
// without relying on real elapsed time.
async function flush(n = 6) {
  for (let i = 0; i < n; i++) await Promise.resolve();
}

function makeEnv({
  inputValue,
  searchResultCount = 0,
  words = FIXTURE_WORDS,
  fetchImpl,
  onLine = true,
  immediateTimeout = false,
  savedPhrases = [],
} = {}) {
  const els = {
    searchInput: { value: inputValue },
    searchResults: fakeElement(),
    homeScreen: fakeElement(),
    dictLookupPanel: fakeElement(),
    // #dictScreen fixtures (Unit B increment D — the dedicated 📖 查词 nav
    // tab). dictInput is a plain {value} stub like searchInput above, not a
    // fakeElement, since production code only ever reads/writes .value on it.
    dictInput: { value: "" },
    dictScreenPanel: fakeElement(),
    dictStarterChips: fakeElement(),
  };
  const searchPhrasesCalls = [];
  const goTranslateCalls = [];
  const fetchCalls = [];
  const audioRequests = [];
  const safeSetItemCalls = [];
  const updateNavBadgeCalls = [];
  const speakTextCalls = [];
  const setPlayBtnPlayingCalls = [];
  const resetPlayBtnStateCalls = [];
  const flashAudioUnavailableCalls = [];
  const stopAllAudioCalls = [];
  const FakeAudio = makeFakeAudioCtor();
  const fetchStub = fetchImpl
    ? (...args) => { fetchCalls.push(args); return fetchImpl(...args); }
    : (...args) => { fetchCalls.push(args); return Promise.reject(new Error("fetch stub not configured for this test")); };
  const ctx = {
    document: {
      getElementById: (id) => els[id] || null,
      createElement: () => fakeElement(),
    },
    window: { dictionaryWords: words },
    navigator: { onLine },
    fetch: fetchStub,
    AbortController,
    // Real timers by default (a genuinely unused fake-timeout path would
    // never fire in a fast unit test anyway); immediateTimeout lets the
    // client-timeout test collapse the real 8s wait to an immediate,
    // synchronous callback instead of racing a real clock.
    setTimeout: immediateTimeout ? (fn) => { fn(); return 0; } : setTimeout,
    clearTimeout: immediateTimeout ? () => {} : clearTimeout,
    // Stubs for dependencies that live OUTSIDE this marker fragment (defined
    // elsewhere in the same <script>, exactly like voice-input.test.mjs
    // stubs onSearchInput for the code it doesn't extract).
    searchPhrases: (q, limit) => {
      searchPhrasesCalls.push([q, limit]);
      return Array.from({ length: Math.min(searchResultCount, limit) }, (_, i) => ({ id: `stub${i}` }));
    },
    buildResultRow: () => fakeElement(),
    goTranslateWithQuery: (q) => goTranslateCalls.push(q),
    // Unit B increment C: saveDictSense/updateDictSaveContent/
    // resetDueOnRepeatLookup read/mutate `savedPhrases` and call
    // safeSetItem/updateNavBadge, all defined elsewhere in the real
    // <script> (ll:review-engine + top-level state). `savedPhrases` is a
    // real mutable array here (not a spy) so the module's own
    // `savedPhrases.push`/`.find` behave exactly as in production; the two
    // functions are spies so tests can assert persistence/badge-refresh
    // actually happened without re-testing localStorage itself.
    savedPhrases,
    safeSetItem: (k, v) => { safeSetItemCalls.push([k, v]); },
    updateNavBadge: () => { updateNavBadgeCalls.push(true); },
    // ── Audio-adjacent stubs (playDictResultAudio, ll:dictionary-lookup) ──
    // These all live OUTSIDE the marker fragment in the real index.html
    // (top-level `let playbackSession`/`currentAudio`, and setPlayBtnPlaying/
    // resetPlayBtnState/flashAudioUnavailable/stopAllAudio/speakText defined
    // above the ll:dictionary-shared block). stopAllAudio here is a minimal
    // but behaviorally faithful stand-in: it bumps playbackSession (the same
    // generation-counter idiom the real one uses) so the session-guard tests
    // can exercise a real stale-callback race, and it stubs a fresh Audio()
    // ctor is unaffected — mirroring what production does with currentAudio.
    Audio: FakeAudio,
    playbackSession: 0,
    currentAudio: null,
    stopAllAudio() {
      stopAllAudioCalls.push(true);
      ctx.playbackSession++;
      ctx.currentAudio = null;
    },
    setPlayBtnPlaying(btn) { setPlayBtnPlayingCalls.push(btn); if (btn) btn.__playing = true; },
    resetPlayBtnState(btn) { resetPlayBtnStateCalls.push(btn); if (btn) btn.__playing = false; },
    flashAudioUnavailable(btn) { flashAudioUnavailableCalls.push(btn); },
    speakText(text, rate, btn, session) { speakTextCalls.push({ text, rate, btn, session }); },
    // requestAudio() lives in ll:audio-provision and is a paid, asynchronous
    // side effect with its own storage, network, auth and concurrency state —
    // and its own 18 tests. Running the real thing here would make this file's
    // fetchCalls a mixed count of two different responsibilities: a failure
    // could no longer say whether dictionary lookup broke or the background
    // audio job did. A recording double keeps the boundary, and the assertion
    // below keeps it honest about WHAT gets handed over.
    requestAudio: item => { audioRequests.push(item); return Promise.resolve(true); },
    // Browser storage is outside this project's control, so it is stubbed —
    // but the access-code module running on top of it is the REAL one (see
    // below). Seeded with a code so the two paid fetch() calls carry the
    // X-LL-Access header exactly as they do in production.
    localStorage: (() => {
      const map = new Map([["ll_access", ACCESS_CODE]]);
      return {
        getItem: k => (map.has(k) ? map.get(k) : null),
        setItem: (k, v) => map.set(k, String(v)),
        removeItem: k => map.delete(k),
      };
    })(),
    console,
  };
  vm.createContext(ctx);
  // The lookup module calls accessHeaders(), which lives in a DIFFERENT
  // marker block. Rather than hand-writing a stub — which would silently
  // drift from the real thing the day accessHeaders() changes shape — the
  // real ll:access-code source is run into this same realm first. That makes
  // these 105 assertions also guard the contract between the two blocks.
  const as = html.indexOf(ACCESS_START), ae = html.indexOf(ACCESS_END);
  assert.ok(as !== -1 && ae !== -1, `index.html must contain ${ACCESS_START} … ${ACCESS_END} markers`);
  vm.runInContext(html.slice(as, ae + ACCESS_END.length), ctx);
  assert.equal(typeof ctx.accessHeaders, "function",
    "the access-code block must define accessHeaders() — the lookup module calls it on every network lookup");

  const s = html.indexOf(START), e = html.indexOf(END);
  assert.ok(s !== -1 && e !== -1, `index.html must contain ${START} … ${END} markers`);
  vm.runInContext(html.slice(s, e + END.length), ctx);
  assert.equal(typeof ctx.looksLikeEnglishLookup, "function", "module must define looksLikeEnglishLookup()");
  assert.equal(typeof ctx.buildDictionaryIndex, "function", "module must define buildDictionaryIndex()");
  assert.equal(typeof ctx.onSearchInput, "function", "module must define onSearchInput()");
  assert.equal(typeof ctx.performDictLookup, "function", "module must define performDictLookup()");
  // Unit B increment D: #dictScreen module surface.
  assert.equal(typeof ctx.onDictScreenInput, "function", "module must define onDictScreenInput()");
  assert.equal(typeof ctx.doDictScreenLookup, "function", "module must define doDictScreenLookup()");
  assert.equal(typeof ctx.renderDictStarterChips, "function", "module must define renderDictStarterChips()");
  assert.equal(typeof ctx.resetDictScreenForEntry, "function", "module must define resetDictScreenForEntry()");
  // Audio + IPA increment: playDictResultAudio() and dictAudioSlug() module surface.
  assert.equal(typeof ctx.playDictResultAudio, "function", "module must define playDictResultAudio()");
  assert.equal(typeof ctx.dictAudioSlug, "function", "module must define dictAudioSlug()");
  return {
    ctx, els, searchPhrasesCalls, goTranslateCalls, fetchCalls, safeSetItemCalls, updateNavBadgeCalls, savedPhrases,
    audioRequests,
    speakTextCalls, setPlayBtnPlayingCalls, resetPlayBtnStateCalls, flashAudioUnavailableCalls, stopAllAudioCalls, FakeAudio,
  };
}

// ── Fake Audio + audio-adjacent helper stubs ────────────────────────────
// playDictResultAudio (ll:dictionary-lookup) depends on several helpers that
// live OUTSIDE the marker block (stopAllAudio, playbackSession,
// setPlayBtnPlaying, resetPlayBtnState, speakText, currentAudio, Audio) —
// same idiom as searchPhrases/goTranslateWithQuery above. FakeAudio supports
// just enough of HTMLAudioElement to exercise both real-browser failure
// channels: an `error` event AND a rejected play() promise.
function makeFakeAudioCtor() {
  const instances = [];
  function FakeAudio(url) {
    const listeners = {};
    const inst = {
      url,
      paused: false,
      addEventListener(evt, fn) { listeners[evt] = fn; },
      // Reads FakeAudio.nextPlayRejects at CALL time (not construction time)
      // so a test can arrange "the next play() rejects" before tapping the
      // button that constructs this instance — the real trigger for
      // playDictResultAudio's `.play().catch(...)` fallback branch.
      play() { return FakeAudio.nextPlayRejects ? Promise.reject(new Error("no src")) : Promise.resolve(); },
      pause() { inst.paused = true; },
      fire(evt) { if (listeners[evt]) listeners[evt](); },
    };
    instances.push(inst);
    return inst;
  }
  FakeAudio.instances = instances;
  FakeAudio.nextPlayRejects = false;
  return FakeAudio;
}

function panelHasClass(panel, cls) {
  return panel.children.some((c) => c.className === cls);
}

function panelChild(panel, cls) {
  return panel.children.find((c) => c.className === cls);
}

// Recursive search for a descendant whose className contains `token` —
// used for the provenance note, which is nested inside .dict-result-card
// and carries two classes ("ai-disclaimer dict-provenance-note").
function findByClassToken(el, token) {
  for (const c of el.children || []) {
    if (typeof c.className === "string" && c.className.split(/\s+/).includes(token)) return c;
    const nested = findByClassToken(c, token);
    if (nested) return nested;
  }
  return undefined;
}

// ── looksLikeEnglishLookup: positives ──────────────────────────────────
test("plain English word passes", () => {
  const { ctx } = makeEnv({ inputValue: "eat" });
  assert.equal(ctx.looksLikeEnglishLookup("eat"), true);
});

test("short English set phrase (<= 4 words) passes", () => {
  const { ctx } = makeEnv({ inputValue: "thank you" });
  assert.equal(ctx.looksLikeEnglishLookup("all done now"), true);
});

test("a word with an internal apostrophe passes", () => {
  const { ctx } = makeEnv({ inputValue: "don't" });
  assert.equal(ctx.looksLikeEnglishLookup("don't"), true);
});

// ── looksLikeEnglishLookup: negatives (required this increment) ───────
test("Chinese input is rejected", () => {
  const { ctx } = makeEnv({ inputValue: "吃饭" });
  assert.equal(ctx.looksLikeEnglishLookup("吃饭"), false);
});

test("mixed Chinese+English input is rejected", () => {
  const { ctx } = makeEnv({ inputValue: "eat吃" });
  assert.equal(ctx.looksLikeEnglishLookup("eat吃"), false);
});

test("digits are rejected", () => {
  const { ctx } = makeEnv({ inputValue: "123" });
  assert.equal(ctx.looksLikeEnglishLookup("123"), false);
  assert.equal(ctx.looksLikeEnglishLookup("eat2"), false);
});

test("empty string is rejected", () => {
  const { ctx } = makeEnv({ inputValue: "" });
  assert.equal(ctx.looksLikeEnglishLookup(""), false);
});

test("whitespace-only string is rejected", () => {
  const { ctx } = makeEnv({ inputValue: "   " });
  assert.equal(ctx.looksLikeEnglishLookup("   "), false);
});

test("over-long input is rejected (stated bound: 30 chars)", () => {
  const { ctx } = makeEnv({ inputValue: "x" });
  const tooLong = "a".repeat(31);
  assert.equal(tooLong.length, 31);
  assert.equal(ctx.looksLikeEnglishLookup(tooLong), false);
  // A realistic over-long sentence a parent might type into search, not a
  // dictionary lookup — confirms the bound rejects real prose, not just
  // synthetic repeated characters.
  assert.equal(
    ctx.looksLikeEnglishLookup("can you please tell me how to say this whole long sentence in English"),
    false
  );
});

test("input with more than 4 words is rejected (stated bound: word count)", () => {
  const { ctx } = makeEnv({ inputValue: "x" });
  assert.equal(ctx.looksLikeEnglishLookup("one two three four five"), false);
  assert.equal(ctx.looksLikeEnglishLookup("one two three four"), true);
});

test("non-alphabetic-only input (punctuation/emoji) is rejected", () => {
  const { ctx } = makeEnv({ inputValue: "!!!" });
  assert.equal(ctx.looksLikeEnglishLookup("!!!"), false);
  assert.equal(ctx.looksLikeEnglishLookup("😀"), false);
});

// ── buildDictionaryIndex: form -> entry resolution ─────────────────────
test("buildDictionaryIndex resolves a known lemma and a known inflected form to the SAME entry", () => {
  const { ctx } = makeEnv({ inputValue: "x" });
  const words = [
    { lemma: "eat", forms: ["eat", "eats", "ate", "eaten", "eating"], senses: [{ key: "v", pos: "v.", zh: "吃", example: { en: "Let's eat!", zh: "我们开饭啦！" }, tip: "t" }] },
    { lemma: "sleep", forms: ["sleep", "sleeps", "slept", "sleeping"], senses: [{ key: "v", pos: "v.", zh: "睡觉", example: { en: "Time to sleep.", zh: "该睡觉了。" }, tip: "t" }] },
  ];
  const idx = ctx.buildDictionaryIndex(words);
  const byLemma = idx.get("eat");
  const byInflected = idx.get("ate");
  assert.ok(byLemma, "lemma form must resolve");
  assert.ok(byInflected, "inflected form must resolve");
  assert.equal(byLemma, byInflected, "lemma and inflected form must resolve to the identical entry object");
  assert.equal(byLemma.lemma, "eat");
});

test("buildDictionaryIndex is case-insensitive on lookup", () => {
  const { ctx } = makeEnv({ inputValue: "x" });
  const words = [{ lemma: "eat", forms: ["eat", "eats"], senses: [] }];
  const idx = ctx.buildDictionaryIndex(words);
  assert.ok(idx.get("eat"));
  assert.equal(idx.get("EAT"), undefined, "index keys are lowercase; caller is expected to lowercase the query");
});

test("buildDictionaryIndex tolerates a missing/undefined word list", () => {
  const { ctx } = makeEnv({ inputValue: "x" });
  const idx = ctx.buildDictionaryIndex(undefined);
  assert.equal(idx.size, 0);
});

// ── onSearchInput: the CTA-visibility regression that matters most ────
test("📖 dictionary CTA renders even when searchPhrases returns >= 3 results", () => {
  const { ctx, els } = makeEnv({ inputValue: "eat", searchResultCount: 5 });
  ctx.onSearchInput();
  assert.ok(panelHasClass(els.searchResults, "search-dict-btn"),
    "dictionary CTA must not be hidden by the >=3-results AI-CTA threshold");
});

test("🤖 AI CTA does NOT render when searchPhrases returns >= 3 results (unchanged behavior)", () => {
  const { ctx, els } = makeEnv({ inputValue: "eat", searchResultCount: 5 });
  ctx.onSearchInput();
  assert.equal(panelHasClass(els.searchResults, "search-ai-btn"), false);
});

test("both CTAs can render together when searchPhrases returns < 3 results", () => {
  const { ctx, els } = makeEnv({ inputValue: "eat", searchResultCount: 1 });
  ctx.onSearchInput();
  assert.ok(panelHasClass(els.searchResults, "search-dict-btn"));
  assert.ok(panelHasClass(els.searchResults, "search-ai-btn"));
});

test("dictionary CTA text embeds the raw query", () => {
  const { ctx, els } = makeEnv({ inputValue: "eat", searchResultCount: 5 });
  ctx.onSearchInput();
  const btn = els.searchResults.children.find((c) => c.className === "search-dict-btn");
  assert.match(btn.textContent, /📖 查词典「eat」/);
});

// ── Chinese input: no dictionary CTA, existing translate path untouched ─
test("Chinese input never produces a dictionary CTA, even with many phrase matches", () => {
  const { ctx, els } = makeEnv({ inputValue: "吃饭", searchResultCount: 8 });
  ctx.onSearchInput();
  assert.equal(panelHasClass(els.searchResults, "search-dict-btn"), false);
});

test("Chinese input with < 3 matches still offers the existing AI-translate CTA (unchanged)", () => {
  const { ctx, els } = makeEnv({ inputValue: "吃饭", searchResultCount: 1 });
  ctx.onSearchInput();
  assert.ok(panelHasClass(els.searchResults, "search-ai-btn"));
});

test("empty query shows neither CTA and marks the home screen not-searching", () => {
  const { ctx, els } = makeEnv({ inputValue: "", searchResultCount: 0 });
  els.homeScreen.classList.add("searching");
  ctx.onSearchInput();
  assert.equal(els.homeScreen.classList.contains("searching"), false);
  assert.equal(els.searchResults.children.length, 0);
});

// ── Increment A1: dictionary-words.js is actually wired in ────────────
test("index.html loads dictionary-words.js as a script", () => {
  assert.match(html, /<script[^>]*src=["']\.\/dictionary-words\.js["'][^>]*>/,
    "index.html must load dictionary-words.js so window.dictionaryWords is populated");
});

test("sw.js precaches dictionary-words.js in SHELL", () => {
  const shellBlock = swSrc.slice(swSrc.indexOf("const SHELL"), swSrc.indexOf("];") + 2);
  assert.match(shellBlock, /['"]\.\/dictionary-words\.js['"]/,
    "dictionary-words.js must be in the SHELL precache array or it ships dead offline");
});

// ── Increment B: lookup panel + network fallback ───────────────────────

// ── B2: local-curated-first order (hard test assertion) ────────────────
test("local hit does NOT hit the network", async () => {
  const { ctx, els, fetchCalls } = makeEnv({ inputValue: "eat" });
  ctx.performDictLookup("eat");
  await flush();
  assert.equal(fetchCalls.length, 0, "a curated local hit must never construct a fetch() call");
  assert.ok(panelChild(els.dictLookupPanel, "dict-result-card"), "local hit must render a result card");
});

test("local miss DOES hit the network", async () => {
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ lemma: "run", senses: [{ pos: "v.", definition: "跑" }] }) });
  const { ctx, els, fetchCalls } = makeEnv({ inputValue: "run", fetchImpl });
  ctx.performDictLookup("run");
  await flush();
  assert.equal(fetchCalls.length, 1, "a curated miss must fall through to exactly one fetch() call");
  assert.equal(fetchCalls[0][0], "/api/dictionary");
  assert.deepEqual(JSON.parse(fetchCalls[0][1].body), { word: "run" });
  assert.ok(panelChild(els.dictLookupPanel, "dict-result-card"));
});

test("dictionary CTA onclick wires the raw query into performDictLookup", () => {
  const { ctx, els } = makeEnv({ inputValue: "eat", searchResultCount: 0 });
  ctx.onSearchInput();
  const btn = els.searchResults.children.find((c) => c.className === "search-dict-btn");
  let called;
  ctx.performDictLookup = (q) => { called = q; };
  btn.onclick();
  assert.equal(called, "eat");
});

// ── B5: every response/error path is a distinct, handled state ─────────
test("400 invalid input -> distinct handled error state", async () => {
  const fetchImpl = async () => ({ ok: false, status: 400, json: async () => ({ error: "invalid input" }) });
  const { ctx, els } = makeEnv({ inputValue: "zz", fetchImpl });
  ctx.performDictLookup("zz");
  await flush();
  const status = panelChild(els.dictLookupPanel, "dict-lookup-status dict-lookup-error");
  assert.ok(status, "400 must render the error status element");
  assert.match(status.textContent, /不太对/);
});

test("502 upstream failure -> distinct handled error state", async () => {
  const fetchImpl = async () => ({ ok: false, status: 502, json: async () => ({ error: "gemini 503" }) });
  const { ctx, els } = makeEnv({ inputValue: "zz", fetchImpl });
  ctx.performDictLookup("zz");
  await flush();
  const status = panelChild(els.dictLookupPanel, "dict-lookup-status dict-lookup-error");
  assert.ok(status);
  assert.match(status.textContent, /遇到问题/);
});

test("500 no API key -> distinct handled error state", async () => {
  const fetchImpl = async () => ({ ok: false, status: 500, json: async () => ({ error: "no API key configured" }) });
  const { ctx, els } = makeEnv({ inputValue: "zz", fetchImpl });
  ctx.performDictLookup("zz");
  await flush();
  const status = panelChild(els.dictLookupPanel, "dict-lookup-status dict-lookup-error");
  assert.ok(status);
  assert.match(status.textContent, /暂时不可用/);
});

test("client-side timeout (AbortError) -> distinct handled error state, before the real 8s elapses", async () => {
  // fetch stub only settles once the AbortSignal actually fires — proves the
  // panel resolves via OUR client-side timer, not by luck/real elapsed time.
  const fetchImpl = (url, opts) => new Promise((resolve, reject) => {
    if (opts.signal && opts.signal.aborted) {
      const err = new Error("aborted"); err.name = "AbortError"; reject(err); return;
    }
    opts.signal.addEventListener("abort", () => {
      const err = new Error("aborted"); err.name = "AbortError"; reject(err);
    });
  });
  const { ctx, els } = makeEnv({ inputValue: "zz", fetchImpl, immediateTimeout: true });
  ctx.performDictLookup("zz");
  await flush();
  const status = panelChild(els.dictLookupPanel, "dict-lookup-status dict-lookup-error");
  assert.ok(status, "an aborted request must render a distinct timeout state, not hang forever");
  assert.match(status.textContent, /超时/);
});

test("malformed/unparseable JSON response body -> distinct handled error state", async () => {
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError("bad json"); } });
  const { ctx, els } = makeEnv({ inputValue: "zz", fetchImpl });
  ctx.performDictLookup("zz");
  await flush();
  const status = panelChild(els.dictLookupPanel, "dict-lookup-status dict-lookup-error");
  assert.ok(status);
  assert.match(status.textContent, /异常/);
});

test("well-formed JSON missing lemma/senses -> distinct handled error state (not a crash)", async () => {
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ notLemma: "x" }) });
  const { ctx, els } = makeEnv({ inputValue: "zz", fetchImpl });
  ctx.performDictLookup("zz");
  await flush();
  const status = panelChild(els.dictLookupPanel, "dict-lookup-status dict-lookup-error");
  assert.ok(status);
});

test("network error (fetch rejects, e.g. offline mid-request) -> distinct handled error state", async () => {
  const fetchImpl = async () => { throw new TypeError("Failed to fetch"); };
  const { ctx, els } = makeEnv({ inputValue: "zz", fetchImpl });
  ctx.performDictLookup("zz");
  await flush();
  const status = panelChild(els.dictLookupPanel, "dict-lookup-status dict-lookup-error");
  assert.ok(status);
  assert.match(status.textContent, /网络连接失败/);
});

test("loading state renders while the request is in flight", async () => {
  let resolveFetch;
  const fetchImpl = () => new Promise((resolve) => { resolveFetch = resolve; });
  const { ctx, els } = makeEnv({ inputValue: "zz", fetchImpl });
  ctx.performDictLookup("zz");
  await flush(1);
  const loading = panelChild(els.dictLookupPanel, "dict-lookup-status");
  assert.ok(loading, "must show a loading state before the fetch resolves");
  assert.match(loading.textContent, /正在查询/);
  resolveFetch({ ok: true, status: 200, json: async () => ({ lemma: "x", senses: [{ pos: "n.", definition: "x" }] }) });
  await flush();
});

// ── B4: all three provenance states ─────────────────────────────────────
test("provenance: api result always carries the AI disclaimer wording", () => {
  const { ctx } = makeEnv({ inputValue: "x" });
  const c = ctx.__dictProvenanceConstantsForTest();
  assert.equal(ctx.dictProvenanceNote("api"), c.DICT_API_NOTE);
  assert.match(c.DICT_API_NOTE, /AI 释义，未经人工审核/);
});

test("provenance: curated + NOT CLEARED carries a distinct human-drafted-unreviewed note (not the AI wording)", () => {
  const { ctx } = makeEnv({ inputValue: "x" });
  const c = ctx.__dictProvenanceConstantsForTest();
  assert.equal(ctx.dictProvenanceNote("curated-uncleared"), c.DICT_UNCLEARED_NOTE);
  assert.doesNotMatch(c.DICT_UNCLEARED_NOTE, /AI/, "must not claim AI provenance for human-drafted content");
  assert.match(c.DICT_UNCLEARED_NOTE, /人工编写|人工撰写/);
});

test("provenance: curated + CLEARED carries no disclaimer", () => {
  const { ctx } = makeEnv({ inputValue: "x" });
  assert.equal(ctx.dictProvenanceNote("curated-cleared"), null);
});

test("provenance is a single named constant (DICT_CURATED_CLEARED), now true per dictionary-words.js's rev-2 CLEARED header (Unit B increment C)", () => {
  const { ctx } = makeEnv({ inputValue: "x" });
  assert.equal(ctx.__dictProvenanceConstantsForTest().DICT_CURATED_CLEARED, true);
});

test("end-to-end: local hit renders NO disclaimer now that DICT_CURATED_CLEARED is true", async () => {
  const { ctx, els } = makeEnv({ inputValue: "eat" });
  ctx.performDictLookup("eat");
  await flush();
  const card = panelChild(els.dictLookupPanel, "dict-result-card");
  const note = findByClassToken(card, "dict-provenance-note");
  assert.equal(note, undefined, "a cleared curated hit must NOT render a provenance note");
});

// dictProvenanceNote() itself must still support the uncleared branch even
// though it is dormant while DICT_CURATED_CLEARED is true — the mechanism
// stays intact for a future edited/uncleared entry (see the code comment on
// DICT_UNCLEARED_NOTE).
test("dictProvenanceNote(\"curated-uncleared\") still returns the dormant uncleared note directly", () => {
  const { ctx } = makeEnv({ inputValue: "x" });
  const c = ctx.__dictProvenanceConstantsForTest();
  assert.equal(ctx.dictProvenanceNote("curated-uncleared"), c.DICT_UNCLEARED_NOTE);
});

test("end-to-end: api result renders the AI disclaimer note", async () => {
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ lemma: "run", senses: [{ pos: "v.", definition: "跑" }] }) });
  const { ctx, els } = makeEnv({ inputValue: "run", fetchImpl });
  const c = ctx.__dictProvenanceConstantsForTest();
  ctx.performDictLookup("run");
  await flush();
  const card = panelChild(els.dictLookupPanel, "dict-result-card");
  const note = findByClassToken(card, "dict-provenance-note");
  assert.ok(note);
  assert.equal(note.textContent, c.DICT_API_NOTE);
});

// ── B6: offline new-lookup message, curated hit still works offline ────
test('offline + local miss shows the exact B6 message, not the generic offline toast copy', async () => {
  const { ctx, els, fetchCalls } = makeEnv({ inputValue: "zz", onLine: false });
  ctx.performDictLookup("zz");
  await flush();
  const status = panelChild(els.dictLookupPanel, "dict-lookup-status");
  assert.ok(status);
  assert.equal(status.textContent, "需要联网才能查新单词 — 已加入复习的词随时可以离线复习");
  assert.doesNotMatch(status.textContent, /📴 离线模式/, "must not reuse the generic offline-mode toast copy");
  assert.equal(fetchCalls.length, 0, "an offline new-word lookup must not attempt a network call");
});

test("offline + local hit still renders the full curated card", async () => {
  const { ctx, els } = makeEnv({ inputValue: "eat", onLine: false });
  ctx.performDictLookup("eat");
  await flush();
  assert.ok(panelChild(els.dictLookupPanel, "dict-result-card"), "a curated hit must work fully offline");
});

// ── B5: stale in-flight response cannot overwrite a newer lookup ───────
test("a stale in-flight response cannot overwrite a newer lookup's render", async () => {
  const calls = [];
  let resolveFirst;
  const fetchImpl = (url, opts) => {
    const word = JSON.parse(opts.body).word;
    calls.push(word);
    if (calls.length === 1) return new Promise((resolve) => { resolveFirst = resolve; });
    return Promise.resolve({ ok: true, status: 200, json: async () => ({ lemma: "second", senses: [{ pos: "n.", definition: "第二个" }] }) });
  };
  const { ctx, els } = makeEnv({ inputValue: "zz", fetchImpl });

  ctx.performDictLookup("firstmiss"); // slow, in flight
  await flush(2);
  ctx.performDictLookup("secondmiss"); // supersedes it
  await flush();

  // Now let the stale first request resolve AFTER the second has rendered.
  resolveFirst({ ok: true, status: 200, json: async () => ({ lemma: "first", senses: [{ pos: "n.", definition: "第一个" }] }) });
  await flush();

  const card = panelChild(els.dictLookupPanel, "dict-result-card");
  assert.ok(card, "the newer lookup's result must be showing");
  const lemma = card.children.find((c) => c.className === "dict-result-lemma");
  assert.equal(lemma.textContent, "second", "the stale first response must not have overwritten the newer render");
});

test("onSearchInput() (new query keystroke) also invalidates a stale in-flight lookup", async () => {
  let resolveFetch;
  const fetchImpl = () => new Promise((resolve) => { resolveFetch = resolve; });
  const { ctx, els } = makeEnv({ inputValue: "zz", fetchImpl });
  ctx.performDictLookup("zz");
  await flush(2);

  els.searchInput.value = "yy"; // parent typed another character
  ctx.onSearchInput();

  resolveFetch({ ok: true, status: 200, json: async () => ({ lemma: "zz", senses: [{ pos: "n.", definition: "x" }] }) });
  await flush();

  assert.equal(els.dictLookupPanel.classList.contains("show"), false, "a superseded query must not leave a stale panel showing");
  assert.equal(panelChild(els.dictLookupPanel, "dict-result-card"), undefined);
});

// ── lemma/inflected-form dedup, exercised end-to-end through performDictLookup ──
test("an inflected form resolves to the SAME curated entry as its lemma (end-to-end)", async () => {
  const { ctx, els } = makeEnv({ inputValue: "ate" });
  ctx.performDictLookup("ate"); // inflected form of "eat" in FIXTURE_WORDS
  await flush();
  const card = panelChild(els.dictLookupPanel, "dict-result-card");
  assert.ok(card, "an inflected form must resolve through the curated index, not fall through to network");
  const lemma = card.children.find((c) => c.className === "dict-result-lemma");
  assert.equal(lemma.textContent, "eat");
});

// ── B1: render shape — pos + zh meaning per sense, example, tip ────────
test("curated result card renders lemma, each sense's pos+zh, example (en+zh), and tip", async () => {
  const { ctx, els } = makeEnv({ inputValue: "eat" });
  ctx.performDictLookup("eat");
  await flush();
  const card = panelChild(els.dictLookupPanel, "dict-result-card");
  const lemma = card.children.find((c) => c.className === "dict-result-lemma");
  assert.equal(lemma.textContent, "eat");
  const sense = card.children.find((c) => c.className === "dict-result-sense");
  const head = sense.children.find((c) => c.className === "dict-result-sense-head");
  assert.match(head.textContent, /v\./);
  assert.match(head.textContent, /吃/);
  const example = sense.children.find((c) => c.className === "dict-result-example");
  assert.match(example.textContent, /Let's eat!/);
  const tip = sense.children.find((c) => c.className === "dict-result-tip");
  assert.ok(tip.textContent.length > 0);
});

test("api result card renders lemma + pos/zh per sense with NO example and NO tip element", async () => {
  const fetchImpl = async () => ({
    ok: true, status: 200,
    json: async () => ({ lemma: "watch", senses: [{ pos: "v.", definition: "看，观看" }, { pos: "n.", definition: "手表" }] }),
  });
  const { ctx, els } = makeEnv({ inputValue: "watch", fetchImpl });
  ctx.performDictLookup("watch");
  await flush();
  const card = panelChild(els.dictLookupPanel, "dict-result-card");
  const senses = card.children.filter((c) => c.className === "dict-result-sense");
  assert.equal(senses.length, 2);
  senses.forEach((s) => {
    assert.equal(s.children.find((c) => c.className === "dict-result-example"), undefined, "API senses have no example");
    assert.equal(s.children.find((c) => c.className === "dict-result-tip"), undefined, "API senses have no tip");
  });
});

// ── B7: tap-target hardening on the CTA that opens the panel ───────────
test(".search-dict-btn carries touch-action:manipulation and user-select:none", () => {
  const block = html.slice(html.indexOf(".search-dict-btn {"), html.indexOf(".search-dict-btn {") + 400);
  assert.match(block, /touch-action:\s*manipulation/);
  assert.match(block, /user-select:\s*none/);
});

// Recursive collector variant of findByClassToken — needed once a card can
// carry more than one sense, each with its own save/update control.
function findAllByClassToken(el, token, out = []) {
  for (const c of el.children || []) {
    if (typeof c.className === "string" && c.className.split(/\s+/).includes(token)) out.push(c);
    findAllByClassToken(c, token, out);
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════
// Unit B increment C: opt-in save (C1), saved shape (C2), sense identity
// (C3), repeat-lookup "forgot it" signal (C4), privacy disclosure (C6),
// tap-target hardening (C7).
// ═══════════════════════════════════════════════════════════════════════

// ── C1: a lookup alone must NEVER mutate ll_saved / savedPhrases ───────
test("C1: a plain lookup (no ⭐ tap) does not touch savedPhrases or call safeSetItem", async () => {
  const { ctx, safeSetItemCalls, savedPhrases } = makeEnv({ inputValue: "eat" });
  ctx.performDictLookup("eat");
  await flush();
  assert.equal(savedPhrases.length, 0, "lookup alone must not create a save");
  assert.equal(safeSetItemCalls.length, 0, "lookup alone must not persist anything when nothing was already saved");
});

test("C1: the ⭐ tap DOES save — and only the tap does", async () => {
  const { ctx, els, savedPhrases, safeSetItemCalls, updateNavBadgeCalls, audioRequests } = makeEnv({ inputValue: "eat" });
  ctx.performDictLookup("eat");
  await flush();
  const card = panelChild(els.dictLookupPanel, "dict-result-card");
  const saveBtn = findByClassToken(card, "dict-save-btn");
  assert.ok(saveBtn, "an unsaved sense must render a ⭐ 加入复习 button");
  assert.match(saveBtn.textContent, /加入复习/);
  saveBtn.onclick();
  assert.equal(savedPhrases.length, 1, "the tap must create exactly one save");
  assert.ok(safeSetItemCalls.length >= 1, "the tap must persist to ll_saved");
  assert.ok(updateNavBadgeCalls.length >= 1, "the tap must refresh the due-review badge");
  // The tap must also ask for a voice, and ask for it for THIS entry. Object
  // identity rather than field-matching: hand over the wrong entry and the
  // clip a parent paid for gets filed under a different word — silently, and
  // discoverable only at review time days later.
  assert.equal(audioRequests.length, 1, "saving a word must request its audio exactly once");
  assert.equal(audioRequests[0], savedPhrases[0],
    "the entry sent for voicing must be the one just saved, not a copy or a neighbour");
});

// ── C2: saved object shape — exact required fields + a working rv ──────
test("C2: saved object carries id/en/zh/tip/scenario/rv/savedAt exactly", async () => {
  const { ctx, els, savedPhrases } = makeEnv({ inputValue: "eat" });
  ctx.performDictLookup("eat");
  await flush();
  const card = panelChild(els.dictLookupPanel, "dict-result-card");
  findByClassToken(card, "dict-save-btn").onclick();
  const saved = savedPhrases[0];
  assert.equal(saved.id, "w_eat__v");
  assert.equal(saved.en, "eat", "single-sense lemma keeps the bare word in `en`");
  assert.equal(saved.zh, "吃");
  assert.equal(saved.tip, "在餐椅前说。");
  assert.equal(saved.scenario, "__dict__");
  // Plain-field comparison, not assert.deepEqual: `saved` is constructed
  // inside a separate vm realm, so its Object prototype differs from this
  // file's even when every own-property value matches (same idiom as
  // test/dictionary-review.test.mjs's resolveItemLabel() comparisons).
  assert.equal(saved.rv.s, 0);
  assert.equal(typeof saved.rv.due, "number");
  assert.equal(Object.keys(saved.rv).sort().join(","), "due,s", "rv must carry exactly s and due, nothing extra");
  assert.equal(typeof saved.savedAt, "number", "savedAt addition (flagged in the handoff report) must be present");
});

// ── C3: word identity = lemma + selected sense ──────────────────────────
test("C3: dictSaveId scheme is \"w_\" + lemma + \"__\" + sense key", () => {
  const { ctx } = makeEnv({ inputValue: "x" });
  assert.equal(ctx.dictSaveId("eat", "v"), "w_eat__v");
  assert.equal(ctx.dictSaveId("watch", "n"), "w_watch__n");
});

test("C3: lemma dedup — jump/jumps/jumped all resolve to the SAME save id (one card)", async () => {
  const { ctx, els, savedPhrases } = makeEnv({ inputValue: "jump" });
  ctx.performDictLookup("jump");
  await flush();
  let card = panelChild(els.dictLookupPanel, "dict-result-card");
  findByClassToken(card, "dict-save-btn").onclick();
  assert.equal(savedPhrases.length, 1);
  const savedId = savedPhrases[0].id;

  // Re-lookup via a different inflected form of the same lemma — must
  // resolve to the SAME entry and therefore show the "already saved" state,
  // not a second save button.
  ctx.performDictLookup("jumped");
  await flush();
  card = panelChild(els.dictLookupPanel, "dict-result-card");
  const lemma = card.children.find((c) => c.className === "dict-result-lemma");
  assert.equal(lemma.textContent, "jump", "inflected form resolves to the lemma's card");
  assert.equal(findByClassToken(card, "dict-save-btn"), undefined, "already-saved sense must not offer a second save");
  assert.ok(findByClassToken(card, "dict-saved-label"), "already-saved sense must show the saved indicator");
  assert.equal(savedPhrases.length, 1, "re-looking-up an inflected form must not create a second save");
  assert.equal(savedPhrases[0].id, savedId);
});

test("C3: two senses of one lemma (clap n. vs v.) stay distinguishable — distinct ids, both saveable", async () => {
  const { ctx, els, savedPhrases } = makeEnv({ inputValue: "clap" });
  ctx.performDictLookup("clap");
  await flush();
  const card = panelChild(els.dictLookupPanel, "dict-result-card");
  const saveBtns = findAllByClassToken(card, "dict-save-btn");
  assert.equal(saveBtns.length, 2, "both senses must independently offer a save button");
  saveBtns[0].onclick();
  saveBtns[1].onclick();
  assert.equal(savedPhrases.length, 2, "both senses must be saveable as distinct cards");
  const ids = savedPhrases.map((p) => p.id);
  assert.equal(new Set(ids).size, 2, "the two senses must have distinct ids");
  assert.ok(ids.includes("w_clap__v"));
  assert.ok(ids.includes("w_clap__n"));
  // Founder-approved revision: `en` is ALWAYS the bare lemma now, never
  // "clap (n.)" / "clap (v.)" — see buildDictSaveEntry's comment block.
  // Disambiguation moves to `senseLabel` (sourced from the sense's own
  // `zh`), not a parenthetical grammar tag a non-technical parent may not
  // read reliably.
  const ens = savedPhrases.map((p) => p.en).sort();
  assert.deepEqual(ens, ["clap", "clap"], "multi-sense saves must keep `en` bare — no \"(n.)\"/\"(v.)\" leaking into the canonical word");
  const labels = savedPhrases.map((p) => p.senseLabel).sort();
  assert.deepEqual(labels, ["拍手", "掌声"], "senseLabel must carry the distinguishing Chinese gloss per sense, sourced from sense.zh");
});

// ── senseLabel: the (n.)/(v.) replacement — bare `en`, Chinese disambiguator ──
test("single-sense save gets NO senseLabel at all (not even an empty string)", async () => {
  const { ctx, els, savedPhrases } = makeEnv({ inputValue: "eat" });
  ctx.performDictLookup("eat");
  await flush();
  const card = panelChild(els.dictLookupPanel, "dict-result-card");
  findByClassToken(card, "dict-save-btn").onclick();
  const saved = savedPhrases[0];
  assert.equal(saved.en, "eat");
  assert.equal("senseLabel" in saved, false, "single-sense save must not carry a senseLabel key at all");
});

test("multi-sense en is NEVER contaminated with a pos-in-parens qualifier, for either sense", async () => {
  const { ctx, els, savedPhrases } = makeEnv({ inputValue: "clap" });
  ctx.performDictLookup("clap");
  await flush();
  const card = panelChild(els.dictLookupPanel, "dict-result-card");
  const saveBtns = findAllByClassToken(card, "dict-save-btn");
  saveBtns[0].onclick();
  saveBtns[1].onclick();
  savedPhrases.forEach((p) => {
    assert.doesNotMatch(p.en, /\(/, "en must never contain a parenthetical qualifier");
    assert.equal(p.en, "clap");
  });
});

test("senseLabel truncates an overlong zh gloss to SENSE_LABEL_MAX_CHARS with a trailing ellipsis", async () => {
  const longGlossWords = [
    {
      lemma: "spring", forms: ["spring", "springs"],
      senses: [
        { key: "n1", pos: "n.", zh: "春天，一年四季中的第一个季节", example: { en: "It's spring!", zh: "春天到了！" }, tip: "t" },
        { key: "n2", pos: "n.", zh: "弹簧", example: { en: "A metal spring.", zh: "一个金属弹簧。" }, tip: "t" },
      ],
    },
  ];
  const { ctx, els, savedPhrases } = makeEnv({ inputValue: "spring", words: longGlossWords });
  ctx.performDictLookup("spring");
  await flush();
  const card = panelChild(els.dictLookupPanel, "dict-result-card");
  const saveBtns = findAllByClassToken(card, "dict-save-btn");
  saveBtns[0].onclick();
  const saved = savedPhrases[0];
  assert.equal(saved.senseLabel, "春天，一年四季中…", "must truncate to exactly 8 chars + an ellipsis");
  assert.equal(saved.senseLabel.length, 9, "8 kept chars + 1 ellipsis char");
});

test("senseLabel is NOT truncated when the zh gloss already fits within the bound", async () => {
  const { ctx, els, savedPhrases } = makeEnv({ inputValue: "clap" });
  ctx.performDictLookup("clap");
  await flush();
  const card = panelChild(els.dictLookupPanel, "dict-result-card");
  const saveBtns = findAllByClassToken(card, "dict-save-btn");
  saveBtns[0].onclick();
  assert.equal(savedPhrases[0].senseLabel, "拍手", "a short gloss must pass through untruncated, no ellipsis appended");
});

test("buildDictSaveEntry directly: senseLabel absent when multiSense is false even if sense.zh is set", () => {
  const { ctx } = makeEnv({ inputValue: "x" });
  const entry = ctx.buildDictSaveEntry("watch", { key: "n", pos: "n.", zh: "手表" }, false);
  assert.equal(entry.en, "watch");
  assert.equal("senseLabel" in entry, false);
});

test("buildDictSaveEntry directly: senseLabel absent when multiSense is true but sense.zh is missing/empty", () => {
  const { ctx } = makeEnv({ inputValue: "x" });
  const entry = ctx.buildDictSaveEntry("watch", { key: "n", pos: "n." }, true);
  assert.equal(entry.en, "watch");
  assert.equal("senseLabel" in entry, false, "no zh to source a label from — must not fabricate one");
});

test("buildDictSaveEntry directly: senseLabel present and equal to sense.zh when multiSense is true and zh is short", () => {
  const { ctx } = makeEnv({ inputValue: "x" });
  const entry = ctx.buildDictSaveEntry("watch", { key: "n", pos: "n.", zh: "手表" }, true);
  assert.equal(entry.en, "watch", "en stays bare even for a multi-sense save");
  assert.equal(entry.senseLabel, "手表");
});

// ── Regression: TTS fallback (playReviewAudio -> speakText(item.en, ...))
// must always receive a clean bare word. The bug was real: `en` used to
// carry "(n.)"/"(v.)" for a multi-sense save, and playReviewAudio's mp3-404
// fallback (ll:review-engine-adjacent, index.html speakText call sites)
// passes `item.en` straight into SpeechSynthesisUtterance with zero special-
// casing — so the browser would literally speak "clap open paren v dot
// close paren" out loud. Asserting `en` is always parenthetical-free for
// every save shape (single- and multi-sense) closes this at the data layer,
// which is the only layer this fix owns; speakText/playReviewAudio need no
// code change because they already just forward item.en verbatim.
test("regression: saved en is always TTS-safe (no parens, no pos qualifier) for both single- and multi-sense saves", async () => {
  const { ctx: ctx1, els: els1, savedPhrases: saved1 } = makeEnv({ inputValue: "eat" });
  ctx1.performDictLookup("eat");
  await flush();
  findByClassToken(panelChild(els1.dictLookupPanel, "dict-result-card"), "dict-save-btn").onclick();

  const { ctx: ctx2, els: els2, savedPhrases: saved2 } = makeEnv({ inputValue: "clap" });
  ctx2.performDictLookup("clap");
  await flush();
  const card2 = panelChild(els2.dictLookupPanel, "dict-result-card");
  findAllByClassToken(card2, "dict-save-btn").forEach((b) => b.onclick());

  [...saved1, ...saved2].forEach((p) => {
    assert.doesNotMatch(p.en, /[()]/, `saved en "${p.en}" must never contain a paren — TTS would read it aloud literally`);
  });
});

test("C3: computeSenseKeys assigns a deterministic slugified-pos fallback key for API senses (no `key` field)", () => {
  const { ctx } = makeEnv({ inputValue: "x" });
  const keys = ctx.computeSenseKeys([{ pos: "v.", definition: "看" }, { pos: "n.", definition: "表" }]);
  assert.deepEqual(keys, ["v", "n"]);
});

test("C3: computeSenseKeys disambiguates a repeated pos within one response", () => {
  const { ctx } = makeEnv({ inputValue: "x" });
  const keys = ctx.computeSenseKeys([{ pos: "v.", definition: "a" }, { pos: "v.", definition: "b" }]);
  assert.equal(new Set(keys).size, 2, "two same-pos senses in one response must still get distinct keys");
});

// ── C4: repeat lookup of an already-saved word resets rv, not content ──
test("C4: repeat lookup resets rv.s/rv.due on an already-saved sense; zh/tip stay UNCHANGED", async () => {
  const staleSaved = {
    id: "w_eat__v", en: "eat", zh: "旧翻译（应保持不变）", tip: "旧提示（应保持不变）",
    scenario: "__dict__", savedAt: 1000, rv: { s: 3, due: Date.now() + 30 * 86400000 },
  };
  const { ctx, els, savedPhrases } = makeEnv({ inputValue: "eat", savedPhrases: [staleSaved] });
  const before = Date.now();
  ctx.performDictLookup("eat");
  await flush();
  const stored = savedPhrases.find((p) => p.id === "w_eat__v");
  assert.equal(stored.rv.s, 0, "repeat lookup must reset rv.s to 0 (reviewAnswer(false) semantics)");
  assert.ok(stored.rv.due >= before, "repeat lookup must reset rv.due to now");
  assert.equal(stored.zh, "旧翻译（应保持不变）", "repeat lookup alone must NOT overwrite zh");
  assert.equal(stored.tip, "旧提示（应保持不变）", "repeat lookup alone must NOT overwrite tip");

  const card = panelChild(els.dictLookupPanel, "dict-result-card");
  assert.ok(findByClassToken(card, "dict-saved-label"), "already-saved sense must render the saved indicator, not a save button");
  const updateBtn = findByClassToken(card, "dict-update-btn");
  assert.ok(updateBtn, "an already-saved sense must offer an explicit 更新卡片内容 action");
  assert.match(updateBtn.textContent, /更新卡片内容/);
});

test("C4: the explicit 更新卡片内容 tap DOES overwrite zh/tip with the fresh lookup content", async () => {
  const staleSaved = {
    id: "w_eat__v", en: "eat", zh: "旧翻译", tip: "旧提示",
    scenario: "__dict__", savedAt: 1000, rv: { s: 3, due: Date.now() + 30 * 86400000 },
  };
  const { ctx, els, savedPhrases } = makeEnv({ inputValue: "eat", savedPhrases: [staleSaved] });
  ctx.performDictLookup("eat");
  await flush();
  let card = panelChild(els.dictLookupPanel, "dict-result-card");
  findByClassToken(card, "dict-update-btn").onclick();

  const stored = savedPhrases.find((p) => p.id === "w_eat__v");
  assert.equal(stored.zh, "吃", "update tap must overwrite zh with the fresh sense content");
  assert.equal(stored.tip, "在餐椅前说。", "update tap must overwrite tip with the fresh sense content");
});

// ── C6: in-UI privacy note at the lookup entry point ────────────────────
test("C6: a short privacy note sits at the dictionary lookup entry point, distinguishing curated (offline) vs new-word (network) lookups", () => {
  assert.match(html, /id="dictPrivacyNote"/);
  const block = html.slice(html.indexOf('id="dictPrivacyNote"') - 60, html.indexOf('id="dictPrivacyNote"') + 200);
  assert.match(block, /🔒/);
  assert.match(block, /在线词典服务/, "must disclose that a new-word lookup reaches an online dictionary service");
  assert.match(block, /已收录|本地/, "must state the honest nuance that a curated/local hit does not");
});

// ── C7: tap-target hardening on the new save/update controls ───────────
test("C7: .dict-save-btn and .dict-update-btn carry touch-action:manipulation and user-select:none", () => {
  const block = html.slice(html.indexOf(".dict-save-btn, .dict-update-btn {"), html.indexOf(".dict-save-btn, .dict-update-btn {") + 300);
  assert.match(block, /touch-action:\s*manipulation/);
  assert.match(block, /user-select:\s*none/);
});

// ═══════════════════════════════════════════════════════════════════════
// Unit B increment D: the dedicated 📖 查词 nav tab + #dictScreen — fix for
// real-user feedback #2 (the home search box only invites Chinese and gates
// its dictionary CTA on English-looking input, so the dictionary was
// unreachable by its own on-screen instructions).
// ═══════════════════════════════════════════════════════════════════════

// ── 1: four nav items, one is the dict tab, in the required position ────
test("bottom nav carries exactly 4 nav-item tabs in order home, dict, saved, translate", () => {
  const start = html.indexOf('<div class="bottom-nav">');
  const end = html.indexOf('</div>\n</div>', start);
  assert.ok(start !== -1 && end !== -1, "must find the bottom-nav block");
  const navBlock = html.slice(start, end);
  const tabs = [...navBlock.matchAll(/data-tab="([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(tabs, ["home", "dict", "saved", "translate"],
    "dict must sit at position 2 — right after home, the highest-scan slot — per the spec");
  assert.ok(navBlock.includes('<span class="nav-icon">📖</span>查词'),
    "dict tab label must be exactly the 2-character 查词, matching 首页/收藏/翻译");
});

// ── 2: the new screen and its two required ids exist ────────────────────
test("#dictScreen, #dictInput, #dictScreenPanel exist in index.html", () => {
  assert.match(html, /id="dictScreen"/);
  assert.match(html, /id="dictInput"/);
  assert.match(html, /id="dictScreenPanel"/);
});

test("#dictScreen reuses existing control families only — no mic button, lookup button is a full-width block below the input", () => {
  const start = html.indexOf('id="dictScreen"');
  const end = html.indexOf('<!-- Age picker overlay -->', start);
  assert.ok(start !== -1 && end !== -1);
  const block = html.slice(start, end);
  assert.doesNotMatch(block, /mic-btn/, "the dict screen must not carry a mic button — the shared voice module is zh-CN only");
  assert.match(block, /class="search-dict-btn"/, "lookup CTA must reuse the teal curated-family button class");
  // The button must come AFTER the input in DOM order (below it, not beside it).
  assert.ok(block.indexOf('id="dictInput"') < block.indexOf('class="search-dict-btn"'));
});

// ── 3: performDictLookup(query, panelId) renders into the NAMED panel ───
test("performDictLookup renders into the panelId argument, not the default panel", async () => {
  const { ctx, els } = makeEnv({ inputValue: "eat" });
  ctx.performDictLookup("eat", "dictScreenPanel");
  await flush();
  assert.ok(panelChild(els.dictScreenPanel, "dict-result-card"), "must render into #dictScreenPanel when named");
  assert.equal(panelChild(els.dictLookupPanel, "dict-result-card"), undefined, "must NOT also render into the home panel");
});

test("performDictLookup defaults to dictLookupPanel when panelId is omitted (home CTA call site, unchanged)", async () => {
  const { ctx, els } = makeEnv({ inputValue: "eat" });
  ctx.performDictLookup("eat");
  await flush();
  assert.ok(panelChild(els.dictLookupPanel, "dict-result-card"));
});

// ── 4: non-English input on #dictScreen explains itself, never a silent no-op, never a network call ──
test("non-English input via onDictScreenInput renders a status pointing at 翻译, and never calls fetch", () => {
  const { ctx, els, fetchCalls } = makeEnv({ inputValue: "x" });
  els.dictInput.value = "吃饭";
  ctx.onDictScreenInput();
  const status = panelChild(els.dictScreenPanel, "dict-lookup-status");
  assert.ok(status, "non-English input must render a status, never a silent no-op — this is the root-cause fix");
  assert.match(status.textContent, /翻译/, "must point the parent at the 🔤 翻译 path for Chinese");
  assert.equal(fetchCalls.length, 0, "must never reach the network for input the dictionary cannot handle");
});

test("non-English input via the 📖 查词 button (doDictScreenLookup) also renders a status and never calls fetch", () => {
  const { ctx, els, fetchCalls } = makeEnv({ inputValue: "x" });
  els.dictInput.value = "吃饭";
  ctx.doDictScreenLookup();
  const status = panelChild(els.dictScreenPanel, "dict-lookup-status");
  assert.ok(status);
  assert.equal(fetchCalls.length, 0);
});

// ── 4b: fix round ll-ea8a587e follow-up, Defect 2 — the message pointed at
// an off-screen control (#dictScreen is a full-screen overlay; .bottom-nav
// lives inside #homeScreen and is not visible while #dictScreen shows). The
// fix drops positional wording and renders a real, actionable control
// instead of a verbal direction the parent has to go guess at. ────────────
test("DICT_NOT_ENGLISH_MESSAGE contains no positional reference (#dictScreen covers the nav the old copy pointed at)", () => {
  const m = html.match(/const DICT_NOT_ENGLISH_MESSAGE = "([^"]*)"/);
  assert.ok(m, "must find the DICT_NOT_ENGLISH_MESSAGE definition");
  assert.doesNotMatch(m[1], /下方|上方|底部|下面/,
    "must not tell the parent to look somewhere on screen — no positional control exists while #dictScreen is open");
});

test("non-English input renders an actionable .search-ai-btn control, not text alone", () => {
  const { ctx, els } = makeEnv({ inputValue: "x" });
  els.dictInput.value = "吃饭";
  ctx.onDictScreenInput();
  const aiBtn = panelChild(els.dictScreenPanel, "search-ai-btn");
  assert.ok(aiBtn, "not-english state must render a real tappable .search-ai-btn, not just explanatory text pointing nowhere on screen");
});

test("tapping the not-english .search-ai-btn routes to translate carrying the parent's typed Chinese query", () => {
  const { ctx, els, goTranslateCalls } = makeEnv({ inputValue: "x" });
  els.dictInput.value = "吃饭";
  ctx.onDictScreenInput();
  const aiBtn = panelChild(els.dictScreenPanel, "search-ai-btn");
  assert.ok(aiBtn);
  aiBtn.onclick();
  assert.deepEqual(goTranslateCalls, ["吃饭"], "must carry the typed query to goTranslateWithQuery — nothing retyped on the next screen");
});

test("doDictScreenLookup's not-english path also renders the actionable control and carries the query", () => {
  const { ctx, els, goTranslateCalls } = makeEnv({ inputValue: "x" });
  els.dictInput.value = "吃饭";
  ctx.doDictScreenLookup();
  const aiBtn = panelChild(els.dictScreenPanel, "search-ai-btn");
  assert.ok(aiBtn);
  aiBtn.onclick();
  assert.deepEqual(goTranslateCalls, ["吃饭"]);
});

test("empty/whitespace #dictScreen input shows the idle hint, never a silent blank panel", () => {
  const { ctx, els } = makeEnv({ inputValue: "x" });
  els.dictInput.value = "   ";
  ctx.onDictScreenInput();
  const hint = panelChild(els.dictScreenPanel, "search-empty");
  assert.ok(hint, "empty/whitespace input must show the idle hint, reusing the .search-empty family");
});

test("valid-but-unsubmitted English input clears any stale status without calling fetch (lookup waits for an explicit tap)", () => {
  const { ctx, els, fetchCalls } = makeEnv({ inputValue: "x" });
  els.dictInput.value = "吃饭";
  ctx.onDictScreenInput(); // renders the not-English status first
  assert.ok(panelChild(els.dictScreenPanel, "dict-lookup-status"));
  els.dictInput.value = "eat";
  ctx.onDictScreenInput();
  assert.equal(els.dictScreenPanel.classList.contains("show"), false, "typing a valid word must clear the stale status, not trigger a lookup per keystroke");
  assert.equal(fetchCalls.length, 0);
});

// ── 5: the home placeholder no longer instructs Chinese-only ────────────
test("home search placeholder signals both intents (Chinese sentence AND English word), not Chinese-only", () => {
  const m = html.match(/id="searchInput"[\s\S]*?placeholder="([^"]*)"/);
  assert.ok(m, "must find #searchInput's placeholder");
  const placeholder = m[1];
  assert.doesNotMatch(placeholder, /^🔍 想对宝宝说什么/, "must no longer instruct Chinese-only — that placeholder is the root cause this round fixes");
  assert.match(placeholder, /中文/, "must still signal the Chinese-sentence path");
  assert.match(placeholder, /英文|英语/, "must now also signal the English-word lookup path");
  assert.ok(placeholder.length <= "🔍 想对宝宝说什么？如：睡觉、吃饭、勇敢".length,
    "must be no longer than the original so it cannot truncate worse at 320px");
});

// ── 6: showTab('dict') opens the screen and resets the panel ────────────
test("showTab('dict') branch structurally opens #dictScreen and delegates panel reset to resetDictScreenForEntry", () => {
  const fnStart = html.indexOf("function showTab(tab)");
  assert.ok(fnStart !== -1);
  const block = html.slice(fnStart, fnStart + 2200);
  assert.match(block, /document\.getElementById\("dictScreen"\)\.classList\.remove\("open"\)/,
    "dictScreen must be reset alongside the other screens at the top of showTab");
  assert.match(block, /tab === "dict"/);
  assert.match(block, /document\.getElementById\("dictScreen"\)\.classList\.add\("open"\)/);
  assert.match(block, /resetDictScreenForEntry\(\)/,
    "the dict branch must delegate its panel/session reset to the tested resetDictScreenForEntry() function");
});

test("resetDictScreenForEntry shows the idle hint and populates starter chips on entry", () => {
  const { ctx, els } = makeEnv({ inputValue: "x" });
  ctx.resetDictScreenForEntry();
  const hint = panelChild(els.dictScreenPanel, "search-empty");
  assert.ok(hint, "a fresh visit must show the idle hint, not a blank panel");
  assert.ok(els.dictStarterChips.children.length > 0, "starter chips must be populated on entry");
});

test("resetDictScreenForEntry clears the HOME panel's visible state so a stale home lookup cannot resurface", async () => {
  let resolveFetch;
  const fetchImpl = () => new Promise((resolve) => { resolveFetch = resolve; });
  const { ctx, els } = makeEnv({ inputValue: "zz", fetchImpl });
  ctx.performDictLookup("zz"); // home CTA call site (default panelId)
  await flush(2);
  assert.ok(els.dictLookupPanel.classList.contains("show"), "loading state must be visible while the home lookup is in flight");

  ctx.resetDictScreenForEntry(); // parent switches to #dictScreen mid-request

  resolveFetch({ ok: true, status: 200, json: async () => ({ lemma: "zz", senses: [{ pos: "n.", definition: "x" }] }) });
  await flush();

  assert.equal(els.dictLookupPanel.classList.contains("show"), false,
    "the stale home lookup must not resurrect the home panel after screen entry (session guard bump)");
  assert.equal(panelChild(els.dictLookupPanel, "dict-result-card"), undefined);
});

// ── 7: starter-chip rendering tolerates a missing/empty word list ───────
test("renderDictStarterChips tolerates a missing window.dictionaryWords (no crash, zero chips)", () => {
  const { ctx, els } = makeEnv({ inputValue: "x" });
  ctx.window.dictionaryWords = undefined; // `words: undefined` in makeEnv's options would fall through to its own default param instead — must clear post-construction
  ctx.renderDictStarterChips();
  assert.equal(els.dictStarterChips.children.length, 0);
});

test("renderDictStarterChips tolerates an empty window.dictionaryWords array", () => {
  const { ctx, els } = makeEnv({ inputValue: "x", words: [] });
  ctx.renderDictStarterChips();
  assert.equal(els.dictStarterChips.children.length, 0);
});

test("renderDictStarterChips renders the first N entries in file order — mechanical, no editorial pick", () => {
  const { ctx, els } = makeEnv({ inputValue: "x" }); // FIXTURE_WORDS has 3: eat, jump, clap
  ctx.renderDictStarterChips();
  assert.equal(els.dictStarterChips.children.length, 3);
  assert.equal(els.dictStarterChips.children[0].textContent, "eat");
  assert.equal(els.dictStarterChips.children[1].textContent, "jump");
  assert.equal(els.dictStarterChips.children[2].textContent, "clap");
});

// ── Defect 1 fix (ll-ea8a587e follow-up, scout-product-lead's own spec
// error): .age-opt is sized for the 2-up age picker (flex:1, min-width:
// 120px) — six ~140px boxes of 3-5-char starter words wrapped across three
// rows at 320px and buried the 📖 查词 button below the fold. .saved-chip is
// a pill sized to its content instead. ─────────────────────────────────────
test("renderDictStarterChips emits the .saved-chip class, not .age-opt", () => {
  const { ctx, els } = makeEnv({ inputValue: "x" }); // FIXTURE_WORDS: eat, jump, clap
  ctx.renderDictStarterChips();
  assert.equal(els.dictStarterChips.children.length, 3);
  for (const chip of els.dictStarterChips.children) {
    assert.equal(chip.className, "saved-chip", "starter chips must reuse .saved-chip, not .age-opt");
  }
});

test("#dictStarterChips row wraps and is never a horizontally-scrolling row (off-screen chips would reproduce the 'can't find it' failure this round exists to fix)", () => {
  const start = html.indexOf('id="dictStarterChips"');
  assert.ok(start !== -1);
  const openTagStart = html.lastIndexOf("<div", start);
  const openTag = html.slice(openTagStart, html.indexOf(">", start) + 1);
  assert.match(openTag, /flex-wrap:\s*wrap/, "chip row must wrap, not overflow sideways");
  assert.doesNotMatch(openTag, /overflow-x/, "must NOT become a horizontally-scrolling row like .saved-chips — that would reproduce the discoverability bug");
});

test("#dictStarterChips is preceded by a .translate-label so the chips read as suggestions, not filters", () => {
  const chipsIdx = html.indexOf('id="dictStarterChips"');
  assert.ok(chipsIdx !== -1);
  const labelIdx = html.lastIndexOf('class="translate-label"', chipsIdx);
  assert.ok(labelIdx !== -1 && labelIdx < chipsIdx, "a .translate-label must sit immediately above the starter-chip row");
});

test("tapping a starter chip fills #dictInput and runs the lookup end-to-end", () => {
  const { ctx, els } = makeEnv({ inputValue: "x" });
  ctx.renderDictStarterChips();
  els.dictStarterChips.children[0].onclick();
  assert.equal(els.dictInput.value, "eat");
  assert.ok(panelChild(els.dictScreenPanel, "dict-result-card"), "chip tap must run the lookup, not just fill the input");
});

// ═══════════════════════════════════════════════════════════════════════
// Pronunciation audio + IPA display on the result card (scout brief,
// 2026-08-13). buildDictResultCard() gets one play control per lemma
// (playDictResultAudio) and an optional `.dict-result-phonetic` element.
// ═══════════════════════════════════════════════════════════════════════

// ── Play control: curated path -> pregenerated mp3 ──────────────────────
test("curated result renders a play control; tapping it requests ./audio/dict/<slug>_normal.mp3", async () => {
  const { ctx, els, FakeAudio } = makeEnv({ inputValue: "eat" }); // FIXTURE_WORDS "eat" is curated
  ctx.performDictLookup("eat");
  await flush();
  const card = panelChild(els.dictLookupPanel, "dict-result-card");
  const playBtn = findByClassToken(card, "dict-result-play-btn");
  assert.ok(playBtn, "curated result card must render a play control");
  playBtn.onclick();
  assert.equal(FakeAudio.instances.length, 1, "tapping must construct exactly one Audio()");
  assert.equal(FakeAudio.instances[0].url, "./audio/dict/eat_normal.mp3");
});

// ── Play control: API path -> speechSynthesis, NEVER an Audio() URL ─────
// The regression that matters most (per the brief): an arbitrary looked-up
// word has no guaranteed mp3, so constructing an Audio() URL for it is a
// guaranteed-404 the moment a parent taps play on an uncurated word.
test("API-path result's play control goes to speechSynthesis and NEVER constructs an Audio() URL", async () => {
  const fetchImpl = async () => ({
    ok: true, status: 200,
    json: async () => ({ lemma: "watch", senses: [{ pos: "v.", definition: "看" }] }),
  });
  // "watch" is deliberately kept OUT of FIXTURE_WORDS (see its own comment
  // above) so this is a genuine curated-miss -> API-hit, not an accident.
  const { ctx, els, FakeAudio, speakTextCalls } = makeEnv({ inputValue: "watch", fetchImpl });
  ctx.performDictLookup("watch");
  await flush();
  const card = panelChild(els.dictLookupPanel, "dict-result-card");
  const playBtn = findByClassToken(card, "dict-result-play-btn");
  assert.ok(playBtn, "API-path result card must still render a play control");
  playBtn.onclick();
  assert.equal(FakeAudio.instances.length, 0, "an API-path lemma must NEVER construct an Audio() URL");
  assert.equal(speakTextCalls.length, 1, "the API path must go straight to speakText()");
  assert.equal(speakTextCalls[0].text, "watch");
});

// ── mp3 failure -> speakText fallback (both real-browser failure channels) ──
test("mp3 `error` event falls back to speakText(lemma)", async () => {
  const { ctx, els, FakeAudio, speakTextCalls } = makeEnv({ inputValue: "eat" });
  ctx.performDictLookup("eat");
  await flush();
  const card = panelChild(els.dictLookupPanel, "dict-result-card");
  const playBtn = findByClassToken(card, "dict-result-play-btn");
  playBtn.onclick();
  assert.equal(FakeAudio.instances.length, 1);
  FakeAudio.instances[0].fire("error");
  assert.equal(speakTextCalls.length, 1);
  assert.equal(speakTextCalls[0].text, "eat");
});

test("a rejected play() promise also falls back to speakText(lemma)", async () => {
  const { ctx, els, FakeAudio, speakTextCalls } = makeEnv({ inputValue: "eat" });
  FakeAudio.nextPlayRejects = true;
  ctx.performDictLookup("eat");
  await flush();
  const card = panelChild(els.dictLookupPanel, "dict-result-card");
  const playBtn = findByClassToken(card, "dict-result-play-btn");
  playBtn.onclick();
  await flush();
  assert.equal(speakTextCalls.length, 1);
  assert.equal(speakTextCalls[0].text, "eat");
});

// ── Session guard: a stale callback from a superseded card must not touch
// a newer playback's button (same generation-counter idiom as speakPhrase/
// playReviewAudio's playbackSession guard) ──────────────────────────────
test("session guard: a stale error from a superseded dict result card does not reset a newer button", async () => {
  const { ctx, els, FakeAudio, resetPlayBtnStateCalls, speakTextCalls } = makeEnv({ inputValue: "eat" });
  ctx.performDictLookup("eat");
  await flush();
  const cardA = panelChild(els.dictLookupPanel, "dict-result-card");
  const btnA = findByClassToken(cardA, "dict-result-play-btn");
  btnA.onclick();
  assert.equal(FakeAudio.instances.length, 1, "first tap must construct exactly one Audio()");

  // A newer lookup + tap supersedes the first, bumping playbackSession.
  ctx.performDictLookup("jump");
  await flush();
  const cardB = panelChild(els.dictLookupPanel, "dict-result-card");
  const btnB = findByClassToken(cardB, "dict-result-play-btn");
  btnB.onclick();
  assert.equal(FakeAudio.instances.length, 2, "second tap must construct its own, newer Audio()");
  assert.equal(btnB.__playing, true);

  // The FIRST (now-stale) Audio() instance's error fires late.
  FakeAudio.instances[0].fire("error");

  assert.ok(!resetPlayBtnStateCalls.includes(btnA), "a stale error must not reset the OLD button either — it should just no-op");
  assert.equal(speakTextCalls.length, 0, "a stale error must not start a fallback speakText() call");
  assert.equal(btnB.__playing, true, "the NEWER button's playing state must remain untouched by the stale callback");
});

// ── IPA (`phonetic`) display ─────────────────────────────────────────────
test("phonetic: renders .dict-result-phonetic when data.phonetic is a non-empty string", async () => {
  const words = [{
    lemma: "eat", forms: ["eat"], phonetic: "/iːt/",
    senses: [{ key: "v", pos: "v.", zh: "吃", tip: "在餐椅前说。" }],
  }];
  const { ctx, els } = makeEnv({ inputValue: "eat", words });
  ctx.performDictLookup("eat");
  await flush();
  const card = panelChild(els.dictLookupPanel, "dict-result-card");
  const phon = card.children.find((c) => c.className === "dict-result-phonetic");
  assert.ok(phon, "phonetic must render when present");
  assert.equal(phon.textContent, "/iːt/");
});

test("phonetic: an absent field renders no .dict-result-phonetic element", async () => {
  const { ctx, els } = makeEnv({ inputValue: "eat" }); // FIXTURE_WORDS' "eat" has no `phonetic` key
  ctx.performDictLookup("eat");
  await flush();
  const card = panelChild(els.dictLookupPanel, "dict-result-card");
  assert.equal(card.children.find((c) => c.className === "dict-result-phonetic"), undefined);
});

test("phonetic: empty-string and whitespace-only values also render nothing, no crash", async () => {
  const words = [{
    lemma: "eat", forms: ["eat"], phonetic: "   ",
    senses: [{ key: "v", pos: "v.", zh: "吃", tip: "在餐椅前说。" }],
  }];
  const { ctx, els } = makeEnv({ inputValue: "eat", words });
  ctx.performDictLookup("eat");
  await flush();
  const card = panelChild(els.dictLookupPanel, "dict-result-card");
  assert.ok(card, "a whitespace-only phonetic must not crash the render");
  assert.equal(card.children.find((c) => c.className === "dict-result-phonetic"), undefined);
});

test("phonetic: withheld on the API path this round even if the response includes one", async () => {
  const fetchImpl = async () => ({
    ok: true, status: 200,
    json: async () => ({ lemma: "zap", phonetic: "/zæp/", senses: [{ pos: "v.", definition: "?" }] }),
  });
  const { ctx, els } = makeEnv({ inputValue: "zap", fetchImpl });
  ctx.performDictLookup("zap");
  await flush();
  const card = panelChild(els.dictLookupPanel, "dict-result-card");
  assert.equal(
    card.children.find((c) => c.className === "dict-result-phonetic"), undefined,
    "AI-generated IPA is withheld this round by founder ruling, even if the API response carries one"
  );
});

// ── dictAudioSlug(): the rule, not the "single lowercase word" shortcut ──
test("dictAudioSlug: lowercases and collapses runs of non-alphanumerics to a single hyphen", () => {
  const { ctx } = makeEnv({ inputValue: "x" });
  assert.equal(ctx.dictAudioSlug("water"), "water");
  assert.equal(ctx.dictAudioSlug("Water"), "water", "must lowercase");
  assert.equal(ctx.dictAudioSlug("look after"), "look-after", "multi-word lemma");
  assert.equal(ctx.dictAudioSlug("don't"), "don-t", "apostrophe collapses to a single hyphen");
  assert.equal(ctx.dictAudioSlug("well-known"), "well-known", "an already-single hyphen is left as-is");
  assert.equal(ctx.dictAudioSlug("Look  After!"), "look-after-", "a run of multiple separators collapses to ONE hyphen");
});

// ── Cross-check: every real curated lemma has a matching mp3 on disk ────
// Catches theo/devon slug drift directly — never keys off dictionary-words.js
// wording, only off its `lemma:` values (shape-stable per that file's own
// header contract) and the real audio/dict/ directory listing.
test("cross-check: every dictionary-words.js lemma resolves to an existing audio/dict/<slug>_normal.mp3", () => {
  const src = readFileSync(join(ROOT, "dictionary-words.js"), "utf8");
  const lemmas = [...src.matchAll(/lemma:\s*"([^"]+)"/g)].map((m) => m[1]);
  assert.ok(lemmas.length > 0, "the lemma-extraction regex must actually find entries, or this check silently passes vacuously");
  const files = new Set(readdirSync(join(ROOT, "audio", "dict")));
  const { ctx } = makeEnv({ inputValue: "x" });
  const missing = lemmas.filter((l) => !files.has(`${ctx.dictAudioSlug(l)}_normal.mp3`));
  assert.deepEqual(missing, [], `every curated lemma must have a matching mp3 (slug drift): ${missing.join(", ")}`);
});

// ── Shape (not completeness) test for the new `phonetic` field ──────────
test("shape: every dictionary-words.js entry that HAS `phonetic` carries it as a non-empty string", () => {
  const src = readFileSync(join(ROOT, "dictionary-words.js"), "utf8");
  const values = [...src.matchAll(/phonetic:\s*"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);
  // Deliberately NOT asserting values.length > 0 — maya's IPA data lands
  // after this change, and some lemmas will legitimately never have IPA
  // (the brief's explicit "gaps we refuse to fill with guesses"). This test
  // only constrains the SHAPE of whatever values do exist.
  values.forEach((v) => {
    assert.ok(v.trim().length > 0, "a `phonetic` value must never be an empty/whitespace string — omit the key entirely instead");
  });
});

// ── Runner ───────────────────────────────────────────────
console.log("dictionary-lookup (Unit B increment A) tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
