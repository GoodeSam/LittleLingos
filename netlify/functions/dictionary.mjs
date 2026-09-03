// English word/phrase -> Chinese dictionary lookup, for the home-screen
// word-lookup feature. v1 is English -> Chinese ONLY: Chinese input is
// invalid input (400) here; there is no zh->en path in this function.
//
// Modeled directly on netlify/functions/translate.mjs (structure, error
// shape, timeout/cache conventions). Primary difference: dictionary lookups
// are keyed on WORD IDENTITY, not raw lowercased text. One spelling can
// carry multiple senses/parts of speech ("watch" n. vs v.), and inflected
// forms (run/runs/ran) are surface variants of one lemma. The response
// therefore always carries the model-determined `lemma` plus a `senses`
// array (each with at least `pos` + `definition`), so the CLIENT can build a
// stable identity of lemma + selected sense. The server-side cache below is
// keyed on the raw (trimmed, case-preserved) query string purely as a
// request-dedup optimization — it does not collapse or decide word
// identity; that judgement lives entirely in the model's `lemma` answer.
//
// Env vars (set in Netlify UI -> Site settings -> Environment variables):
//   GEMINI_API_KEY  — required
//   GEMINI_MODEL    — optional, defaults to "gemini-2.5-flash"

// LL_ACCESS_CODE is required alongside GEMINI_API_KEY; without it this
// endpoint refuses everyone. See netlify/functions/_shared/access.mjs.
import { isAuthorized, refuse } from "./_shared/access.mjs";

// Generous enough for a phrasal verb ("look after", "give up") but well
// short of anything that isn't a single word/short phrase lookup.
const MAX_INPUT_LEN = 40;

// English letters, spaces, apostrophes and hyphens only. This single check
// rejects Chinese input (v1 has no zh path), digits, emoji, and any other
// script (Korean, etc.) with one rule instead of a growing blocklist.
const WORD_RE = /^[A-Za-z]+(?:[ '-][A-Za-z]+)*$/;

const GEMINI_TIMEOUT_MS = 6500;

// Per-warm-instance cache: identical queries don't re-hit the API quota.
// Keyed on the raw trimmed (case-preserved) input string — see header
// comment for why this is NOT the same thing as word-identity.
const cache = new Map();
const CACHE_CAP = 500;

function systemPrompt() {
  return `You are a bilingual (English/Chinese) dictionary for parents of young children. The parent's app shows an English word or short phrase the child encountered; you identify its dictionary form (lemma) and list its distinct senses for a Chinese-speaking parent.

Rules:
1. "lemma" is the canonical dictionary headword for the input (e.g. "running" -> "run", "children" -> "child", "watch" -> "watch"). Always include it.
2. "senses" is an array of the distinct part-of-speech / meaning combinations for that lemma that a parent would plausibly need, most common first. Each item has "pos" (a short abbreviation like "v.", "n.", "adj.") and "definition" (a natural Chinese gloss of that specific sense — not a full sentence, just the meaning, e.g. "跑，奔跑" not "这个词表示跑步的动作").
3. Include every commonly distinct sense (e.g. "watch" must include both the verb "看，观看" and the noun "手表"), but do not pad with rare/archaic senses.
4. If the input is not a recognizable English word or phrase, still return your best-effort lemma and senses; do not refuse.

Respond with JSON only: {"lemma": "...", "senses": [{"pos": "...", "definition": "..."}, ...]}. "senses" must have at least 1 item.`;
}

function validateParsed(parsed) {
  if (!parsed || typeof parsed.lemma !== "string" || !parsed.lemma.trim()) {
    throw new Error("dictionary: incomplete response (missing lemma)");
  }
  if (!Array.isArray(parsed.senses) || parsed.senses.length === 0) {
    throw new Error("dictionary: incomplete response (missing senses)");
  }
  const senses = parsed.senses.map((s) => {
    if (!s || typeof s.pos !== "string" || !s.pos.trim() || typeof s.definition !== "string" || !s.definition.trim()) {
      throw new Error("dictionary: incomplete response (malformed sense)");
    }
    return { pos: String(s.pos), definition: String(s.definition) };
  });
  return { lemma: String(parsed.lemma), senses, source: "gemini" };
}

async function callGemini(word, apiKey) {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const body = {
    systemInstruction: { parts: [{ text: systemPrompt() }] },
    contents: [{ role: "user", parts: [{ text: `word: ${word}` }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          lemma: { type: "STRING" },
          senses: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: { pos: { type: "STRING" }, definition: { type: "STRING" } },
              required: ["pos", "definition"],
            },
          },
        },
        required: ["lemma", "senses"],
      },
      maxOutputTokens: 1024,
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`gemini ${res.status}`);

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return validateParsed(JSON.parse(text));
}

function cacheSet(key, value) {
  // FIFO eviction: drop the oldest entry before inserting once at cap, so
  // the map never exceeds CACHE_CAP (Map preserves insertion order).
  if (cache.size >= CACHE_CAP) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
  cache.set(key, value);
}

const handler = async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "POST only" }, { status: 405 });
  }

  // Before the key is read and before the cache is consulted: a refusal that
  // has already reached Gemini costs the same as an accepted request.
  if (!isAuthorized(req)) return refuse();

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "no API key configured" }, { status: 500 });
  }

  let word;
  try {
    ({ word } = await req.json());
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }
  word = typeof word === "string" ? word.trim() : "";
  if (!word || word.length > MAX_INPUT_LEN || !WORD_RE.test(word)) {
    return Response.json({ error: "invalid input" }, { status: 400 });
  }

  const cacheKey = word; // raw, trimmed, case-preserved — see header comment
  if (cache.has(cacheKey)) {
    return Response.json(cache.get(cacheKey));
  }

  try {
    const result = await callGemini(word, apiKey);
    cacheSet(cacheKey, result);
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: String(err?.message || err) }, { status: 502 });
  }
};

// Test-only introspection hook: lets the offline test suite assert the
// cache-cap eviction behavior without reaching into module-private state
// via hacks. Not used by Netlify at runtime.
handler.__cacheSizeForTest = () => cache.size;

export default handler;

export const config = { path: "/api/dictionary" };
