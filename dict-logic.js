// 查词的**纯逻辑**（ADR 0009 第八块）：判断输入像不像英文、把服务器回的结果规整成
// 统一形状、算义项的身份、拼收藏条目、拼音频文件名。
//
// 为什么只搬一半：ll:dictionary-lookup 原来 774 行里，14 个函数碰 DOM 或网络（画卡片、
// 画面板、发请求、读输入框），另外 14 个不碰任何外部东西。**画界面的留在 index.html，
// 算什么的搬到这里**——这是第一块需要把一个块劈成两半的，前七块都是整块搬。
//
// 搬的时候一个字没改（连注释一起搬）。纯的：不碰 document / window / 存储 / 网络。
// 普通脚本 + CommonJS 出口（同 storage.js）。
(function (root) {
  "use strict";

  // True only for input that plausibly names a single English word or short
  // set phrase to look up — never Chinese (the /api/dictionary backend 400s on
  // Chinese input; there is no zh->en direction in v1, Chinese always routes to
  // the existing AI-translate screen instead), never digits/empty, and never
  // something long enough to really be a sentence (that belongs on the
  // AI-translate path, not a dictionary card).
  //
  // The character class deliberately mirrors WORD_RE in
  // netlify/functions/dictionary.mjs (the already-shipped /api/dictionary
  // backend this CTA will eventually call in increment B): Latin letters plus
  // a single internal space/apostrophe/hyphen between letter runs. Reusing
  // that allowlist rejects Chinese, digits, emoji, and stray punctuation with
  // one rule instead of a second, potentially drifting blocklist, and it means
  // the CTA only ever offers a query the backend would actually accept.
  //
  // DICT_LOOKUP_MAX_LEN (30) is intentionally TIGHTER than the backend's
  // MAX_INPUT_LEN (40): the backend bound is "don't reject a legitimate short
  // phrase", but this bound is a UX judgement call — a query in the 31-40
  // range is long enough that it reads as a sentence fragment, not a word
  // lookup, so the CTA should stay hidden even though the backend would still
  // accept it. DICT_LOOKUP_MAX_WORDS (4) is a frontend-only addition with no
  // backend counterpart: it keeps the CTA scoped to "a word or a short set
  // phrase" ("thank you", "all done") rather than a run of short words that
  // technically fits under 30 characters but reads as a clause.
  const DICT_LOOKUP_MAX_LEN = 30;   // characters, trimmed
  const DICT_LOOKUP_MAX_WORDS = 4;  // whitespace-separated words
  const DICT_LOOKUP_WORD_RE = /^[A-Za-z]+(?:[ '-][A-Za-z]+)*$/;
  function looksLikeEnglishLookup(q) {
    if (typeof q !== "string") return false;
    const trimmed = q.trim();
    if (!trimmed) return false;
    if (trimmed.length > DICT_LOOKUP_MAX_LEN) return false;
    if (!DICT_LOOKUP_WORD_RE.test(trimmed)) return false;
    const words = trimmed.split(/\s+/).filter(Boolean);
    if (words.length > DICT_LOOKUP_MAX_WORDS) return false;
    return true;
  }
  // form -> entry index over dictionary-words.js's curated list (shape per its
  // own header comment: each entry has a unique `lemma` and a `forms` array of
  // lowercase surface forms, globally unique across all entries). Takes the
  // word list as a parameter rather than reading window.dictionaryWords
  // implicitly, so it stays a pure, independently testable function; the real
  // caller passes window.dictionaryWords. Tolerates a missing/empty list
  // (returns an empty index) since dictionary-words.js has no consumer that
  // gates app startup on it this increment.
  function buildDictionaryIndex(words) {
    const idx = new Map();
    (words || []).forEach(entry => {
      (entry.forms || []).forEach(form => {
        idx.set(String(form).toLowerCase(), entry);
      });
    });
    return idx;
  }
  // Founder ruling in the Unit B increment B spec: curated entries do NOT
  // carry the AI disclaimer, but ONLY once leo-linguist AND nina-native-editor
  // have formally cleared dictionary-words.js (see that file's own "Review
  // status" header comment). As of Unit B increment C (2026-08-12) it says
  // CLEARED — rev 2, both reviewers returned an overall CLEARED verdict after
  // round 1 found 6 defects that maya fixed and round 2 re-audited clean. This
  // is the ONE place that decision is made; every render call site below
  // reads this constant instead of re-deciding clearance. Any FUTURE edit to
  // an entry in dictionary-words.js invalidates clearance for the edited
  // revision until leo/nina re-audit it — see that file's own header for the
  // same rule stated from the content side; if that happens, flip this back
  // to false until a fresh CLEARED verdict lands.
  const DICT_CURATED_CLEARED = true;
  // Distinct from the AI-disclaimer wording on purpose: these are
  // human-drafted (by maya-curriculum-designer), NOT AI output, so the "AI
  // 释义" wording would misdescribe their provenance. The uncleared state is
  // about missing a second pair of human eyes, not about being machine-
  // generated — calm, factual, no alarm implied.
  // NOTE (devon-frontend-engineer): the WORDING of DICT_UNCLEARED_NOTE itself
  // is Devon's own draft, not nina-cleared prose — it is currently dormant
  // (DICT_CURATED_CLEARED is true, so dictProvenanceNote() never selects this
  // branch today) but the code path is deliberately kept alive for the day an
  // edited/new entry drops clearance back to false. If that day comes, this
  // string should get the same nina pass any other parent-facing Chinese does
  // before it starts actually rendering again.
  const DICT_API_NOTE = "⚠ AI 释义，未经人工审核 — 使用前请先读一读，确认适合宝宝。";
  const DICT_UNCLEARED_NOTE = "📝 人工编写，审核进行中 — 内容出自课程设计师之手，尚未完成最终审校，请先读一读再用。";
  function dictProvenanceNote(provenance) {
    if (provenance === "api") return DICT_API_NOTE;
    if (provenance === "curated-uncleared") return DICT_UNCLEARED_NOTE;
    return null; // "curated-cleared" — no disclaimer once formally reviewed
  }
  // Test-only introspection hook (same idiom as dictionary.mjs's
  // handler.__cacheSizeForTest): top-level `const` bindings in a vm script
  // are NOT reflected as own properties of the context object the way
  // function declarations are, so test/dictionary-lookup.test.mjs cannot read
  // DICT_API_NOTE / DICT_UNCLEARED_NOTE / DICT_CURATED_CLEARED directly. This
  // closure-captures them for the test to assert against. Not used by the
  // running app at all — devon-frontend-engineer, Unit B increment B.
  function __dictProvenanceConstantsForTest() {
    return { DICT_API_NOTE, DICT_UNCLEARED_NOTE, DICT_CURATED_CLEARED };
  }
  // Normalized internal render shape — the ONE shape buildDictResultCard()
  // ever renders, regardless of source:
  //   { lemma: string, provenance: "curated-cleared"|"curated-uncleared"|"api",
  //     phonetic: string (possibly empty),
  //     senses: [{ pos: string, zh: string, example: {en,zh}|null, tip: string|null, key: string }] }
  // Curated entries (dictionary-words.js) carry sense.zh + sense.example +
  // sense.tip. API entries (/api/dictionary) carry only sense.definition, with
  // no example and no tip — normalizeDictSense() maps `definition` onto the
  // same `zh` field and leaves example/tip null, so the render path never
  // branches on where the data came from, only on which fields are present.
  // `sense.key` is added here (Unit B increment C) — see the "C3: word
  // identity" block below for what it is and why every sense needs one.
  function normalizeDictSense(s, senseKey) {
    return {
      pos: typeof s.pos === "string" ? s.pos : "",
      zh: typeof s.zh === "string" ? s.zh : (typeof s.definition === "string" ? s.definition : ""),
      example: (s.example && typeof s.example.en === "string") ? s.example : null,
      tip: typeof s.tip === "string" ? s.tip : null,
      key: senseKey,
    };
  }
  // A lemma is "curated" iff it did not come from the /api/dictionary path —
  // covers both curated-cleared and curated-uncleared. Shared by
  // normalizeDictResult() (gates phonetic passthrough) and
  // playDictResultAudio() (gates mp3 vs. speechSynthesis routing) so the two
  // can never independently drift on what "curated" means.
  function isDictCuratedProvenance(provenance) {
    return provenance === "curated-cleared" || provenance === "curated-uncleared";
  }
  function normalizeDictResult(raw, provenance) {
    const senseKeys = computeSenseKeys(raw.senses);
    return {
      lemma: raw.lemma,
      provenance,
      // Lemma-level IPA (founder ruling, this round): withheld on the API path
      // even if a future Gemini response ever includes one — read only for
      // curated provenance, never trust-but-verify an unreviewed AI value.
      // Absent/non-string source -> "" so buildDictResultCard()'s .trim()
      // check renders nothing rather than a stray falsy value.
      phonetic: (isDictCuratedProvenance(provenance) && typeof raw.phonetic === "string") ? raw.phonetic : "",
      senses: (raw.senses || []).map((s, i) => normalizeDictSense(s, senseKeys[i])),
    };
  }
  // ── C3: word identity = lemma + selected sense (Unit B increment C) ────
  // The founder's saved-shape spec says `id: "w_" + lemma`, which by itself
  // cannot distinguish two senses of one lemma ("watch" n. "手表" vs "watch"
  // v. "看，观看") — saving one would silently overwrite or collide with the
  // other. Every SAVED dictionary card is therefore keyed by lemma + a
  // per-sense "sense key", never by lemma alone:
  //   - Curated senses (dictionary-words.js) already carry a `key` field per
  //     that file's own shape contract ("key unique within the lemma") —
  //     reused as-is, slugified for id-safety.
  //   - API senses (/api/dictionary) carry NO key field, only `pos` — see
  //     that function's own header comment, which already anticipates this
  //     exact problem ("so the CLIENT can build a stable identity of lemma +
  //     selected sense"). There is no ID from the server to anchor to, so the
  //     scheme falls back to a slugified `pos` ("v." -> "v", "n." -> "n"),
  //     which is deterministic for a given response and distinguishes exactly
  //     the watch-n/watch-v case. If one response ever repeats the same pos
  //     twice (two "v." senses), a numeric suffix disambiguates the two
  //     within that one result. This does NOT guarantee the same API sense
  //     gets the same key across two SEPARATE lookups (the API has no stable
  //     per-sense id at all) — a save from one lookup and a save from a later
  //     re-lookup of the same word could theoretically land on different
  //     ids if Gemini reorders/renames senses between calls. Curated entries
  //     have no such risk since `key` is authored and frozen.
  function slugifyForId(s) {
    return String(s || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }
  function computeSenseKeys(senses) {
    const seen = new Map();
    return (senses || []).map((s, i) => {
      let key = (s && typeof s.key === "string" && s.key) ? slugifyForId(s.key) : slugifyForId(s && s.pos);
      if (!key) key = "s" + i;
      if (seen.has(key)) {
        const n = seen.get(key) + 1;
        seen.set(key, n);
        key = key + n;
      } else {
        seen.set(key, 0);
      }
      return key;
    });
  }
  // The id a SAVE of this specific lemma+sense is stored/looked-up under.
  function dictSaveId(lemma, senseKey) {
    return "w_" + slugifyForId(lemma) + "__" + senseKey;
  }
  // ── C2: opt-in save shape (Unit B increment C) ──────────────────────────
  // Founder's literal shape:
  //   { id: "w_"+lemma, en: word, zh: definition, tip: example/usage,
  //     scenario: "__dict__", rv: { s: 0, due: Date.now() } }
  // Two additions beyond that literal shape, both called out here AND in the
  // devon-frontend-engineer handoff report for the founder to veto:
  //   1. `savedAt: Date.now()` — dueReviews()/sortedBySavedAtDesc() sort on
  //      it; saveTranslation() already sets it; an item without it sorts
  //      unpredictably against real saves.
  //   2. `senseLabel` (founder-approved revision, replacing an earlier
  //      "en carries the sense's pos in parentheses" design — see the
  //      devon-frontend-engineer handoff that made this change): `en` is
  //      ALWAYS the bare lemma, full stop — never "watch (n.)". Two reasons,
  //      both hard requirements, not style preference:
  //        a) `en` is the canonical "word being learned"; any UI-only
  //           qualifier leaking into it risks corrupting anything downstream
  //           that reads `item.en` as-is.
  //        b) it was a real, shipped, user-facing bug: playReviewAudio's TTS
  //           fallback (speakText(item.en, ...), ll:review-engine-adjacent —
  //           see the three call sites right after ll:review-engine) reads
  //           `item.en` literally with no special-casing, so a multi-sense
  //           saved card made the browser's speech synthesis literally say
  //           "watch open paren n dot close paren" out loud.
  //      Disambiguation between two saved senses of one lemma (still needed —
  //      C3 already makes them internally distinguishable by `id`, but a
  //      parent reads the headline, not the id) now happens via `senseLabel`:
  //      a short Chinese gloss sourced from `sense.zh`, truncated to
  //      SENSE_LABEL_MAX_CHARS (see truncateSenseLabel below), set ONLY when
  //      `multiSense` is true. Single-sense lemmas never get a `senseLabel`
  //      key at all (not even an empty string) — savedHeadline()
  //      (ll:dictionary-shared) renders bare `en` whenever it's absent, so
  //      every existing single-sense save (the overwhelming majority) renders
  //      byte-identical to before this change.
  // `tip` fallback: curated entries carry a real actionable tip; API results
  // never do (see dictionary.mjs — pos + definition only, no example/tip). If
  // there is no tip but there IS a curated example, that example (en + zh) is
  // used as the "usage" the founder's spec names as the tip-fallback source.
  // If neither exists (a bare API sense), tip is an empty string — no
  // fabricated content invented client-side.
  function dictSaveTip(sense) {
    if (sense.tip) return sense.tip;
    if (sense.example) return sense.example.zh ? `${sense.example.en} — ${sense.example.zh}` : sense.example.en;
    return "";
  }
  // Deterministic char-count bound (not display-width) on the Chinese gloss
  // kept in `senseLabel` — short enough that "en · senseLabel" stays a
  // one-line saved-item headline on a narrow phone screen. Chosen from the
  // curated word list's own gloss lengths (typically 1-4 characters, e.g.
  // "拍手"/"掌声"); 8 gives real headroom above that before truncating, and a
  // truncated gloss gets a trailing "…" so it reads as cut-off, not complete.
  const SENSE_LABEL_MAX_CHARS = 8;
  function truncateSenseLabel(zh) {
    const s = String(zh || "");
    return s.length > SENSE_LABEL_MAX_CHARS ? s.slice(0, SENSE_LABEL_MAX_CHARS) + "…" : s;
  }
  function buildDictSaveEntry(lemma, sense, multiSense) {
    const entry = {
      id: dictSaveId(lemma, sense.key),
      en: lemma,
      zh: sense.zh || "",
      tip: dictSaveTip(sense),
      scenario: "__dict__",
      savedAt: Date.now(),
      rv: { s: 0, due: Date.now() },
    };
    if (multiSense && sense.zh) entry.senseLabel = truncateSenseLabel(sense.zh);
    return entry;
  }
  // ── Dictionary result-card pronunciation ────────────────────────────────
  // `slug` = lemma lowercased, every run of [^a-z0-9]+ collapsed to a single
  // "-". Every current curated lemma is one lowercase word so slug === lemma
  // today, but the rule (not that shortcut) is implemented so a future
  // multi-word lemma ("look after") or an apostrophe ("don't") maps
  // deterministically instead of silently 404ing. theo's generator
  // (audio/dict/<slug>_normal.mp3) uses the identical rule — see the
  // cross-check test in test/dictionary-lookup.test.mjs.
  function dictAudioSlug(lemma) {
    return String(lemma).toLowerCase().replace(/[^a-z0-9]+/g, "-");
  }

  var api = { DICT_LOOKUP_MAX_LEN: DICT_LOOKUP_MAX_LEN, DICT_LOOKUP_MAX_WORDS: DICT_LOOKUP_MAX_WORDS, DICT_LOOKUP_WORD_RE: DICT_LOOKUP_WORD_RE, DICT_CURATED_CLEARED: DICT_CURATED_CLEARED, DICT_API_NOTE: DICT_API_NOTE, DICT_UNCLEARED_NOTE: DICT_UNCLEARED_NOTE, SENSE_LABEL_MAX_CHARS: SENSE_LABEL_MAX_CHARS, looksLikeEnglishLookup: looksLikeEnglishLookup, buildDictionaryIndex: buildDictionaryIndex, dictProvenanceNote: dictProvenanceNote, __dictProvenanceConstantsForTest: __dictProvenanceConstantsForTest, normalizeDictSense: normalizeDictSense, isDictCuratedProvenance: isDictCuratedProvenance, normalizeDictResult: normalizeDictResult, slugifyForId: slugifyForId, computeSenseKeys: computeSenseKeys, dictSaveId: dictSaveId, dictSaveTip: dictSaveTip, truncateSenseLabel: truncateSenseLabel, buildDictSaveEntry: buildDictSaveEntry, dictAudioSlug: dictAudioSlug };
  if (typeof module !== "undefined" && module.exports) module.exports = api;   // Node（测试）
  else root.llDict = api;                                                      // 浏览器
})(typeof globalThis !== "undefined" ? globalThis : this);
