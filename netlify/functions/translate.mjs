// 中文 → 儿童英语 translate function.
// Primary: Google Gemini Flash (free tier). The frontend falls back to its
// local pattern-matching when this function errors or is unreachable.
//
// Env vars (set in Netlify UI → Site settings → Environment variables):
//   GEMINI_API_KEY  — required
//   GEMINI_MODEL    — optional, defaults to "gemini-2.5-flash"

const VALID_AGES = new Set(["1-2", "2-3", "3-6"]);
const MAX_INPUT_LEN = 200;

// Real reviewed phrases from scenarios.js, per band — few-shot anchors so the
// model imitates native parent-speak + aligned zh + action tip, not literal
// translation (Pillars 1/2/3/4).
const FEW_SHOT = {
  "1-2": [
    { zh: "宝宝在洗澡，想让他玩水", en: "Let's splash! Kick kick kick!", zh_out: "让我们溅水！踢踢踢！", tip: "带动宝宝双脚踢水，重复的节奏帮助宝宝预测和记住词汇。" },
    { zh: "喂饭的时候想让宝宝张嘴", en: "Open wide! Here comes the airplane! Vroom!", zh_out: "嘴巴张大！飞机来咯！呜——", tip: "把勺子当飞机，配合呜的音效，让吃饭更有趣。" },
    { zh: "宝宝吓到了，想安慰他", en: "Come here. I've got you.", zh_out: "过来。我抱着你。", tip: "张开双臂，同时说这句话，让宝宝知道你随时可以接住他。" },
  ],
  "2-3": [
    { zh: "想让宝宝再多吃几口饭", en: "Almost done! Two more bites!", zh_out: "快吃完了！再吃两口！", tip: "具体数字让宝宝有目标感，比再吃一点更有效。" },
    { zh: "检查宝宝洗干净没有", en: "Are you all clean? Let me check... yes! Squeaky clean!", zh_out: "都洗干净了吗？我来看看……是的！干净溜溜！", tip: "夸张地检查宝宝的手脚，变成游戏。" },
    { zh: "睡前想跟宝宝聊聊今天", en: "What was your favorite thing today?", zh_out: "今天你最喜欢什么？", tip: "睡前回顾一天，帮宝宝建立语言表达和情感处理能力。" },
  ],
  "3-6": [
    { zh: "想让孩子自己脱衣服准备洗澡", en: "Okay, it's bath time! Can you get undressed by yourself?", zh_out: "好了，洗澡时间！你能自己脱衣服吗？", tip: "给予自主权，培养独立能力。" },
    { zh: "夸孩子今天很勇敢", en: "You were so brave today. Remember when you...?", zh_out: "你今天好勇敢。还记得你……那一次吗？", tip: "具体回忆一个勇敢时刻，强化孩子的自我认知。" },
    { zh: "想引导孩子描述食物的味道", en: "How does it taste? Sweet? Sour? Salty?", zh_out: "味道怎么样？甜？酸？咸？", tip: "引导宝宝描述味道，丰富感知词汇。" },
  ],
};

const BAND_RULES = {
  "1-2": "Band 1-2 (first words): naming, simple commands, sound-effect words (pop, splash, vroom), high repetition. 2-6 words. Parent invites imitation; a nod or single word is a full response.",
  "2-3": "Band 2-3 (two-word combos → short sentences): questions, choices, simple cause/effect. 4-10 words. Genuine turn-taking — the child is expected to act or answer.",
  "3-6": "Band 3-6 (conversational): reasoning, sequencing, autonomy, specific praise that names the behaviour (never just the trait). Full sentences. Dialogue and multi-step instructions are fine.",
};

function systemPrompt(age) {
  const examples = FEW_SHOT[age]
    .map(e => `家长输入: ${e.zh}\n{"en": ${JSON.stringify(e.en)}, "zh": ${JSON.stringify(e.zh_out)}, "tip": ${JSON.stringify(e.tip)}}`)
    .join("\n\n");
  return `You help a Chinese-speaking parent say something to their ${age}-year-old child in English, in a real daily-life moment. The parent types what they want to say in Chinese; you produce what a NATIVE English-speaking parent would actually say in that exact moment.

Non-negotiable rules:
1. The English must be genuine native parent-speak — contractions, rhythm of real speech ("Let's go!", "Up you come!", "All done!"). NEVER stiff translation-ese ("Please open your mouth for the food", "Now we will wash the hands").
2. Age fit governs everything. ${BAND_RULES[age]}
3. Always include a "tip": one sentence in Chinese telling the parent what to DO while saying it — the physical action that gives the words meaning to the child.
4. The "zh" field is a parent-facing Chinese rendering of your English — same warmth and intent, natural Chinese (叠词 where natural), NOT a literal gloss. It may differ from the parent's input wording.
5. If the parent's input doesn't suit this age band (e.g. an abstract question for a toddler), adapt it to what works at this age rather than translating it as-is.

Examples of the exact style expected (these are real reviewed phrases from the app):

${examples}

Respond with JSON only: {"en": ..., "zh": ..., "tip": ...}. The "tip" must be in Chinese.`;
}

// Per-warm-instance cache: identical queries don't re-hit the free-tier quota.
const cache = new Map();

// Frontend aborts at 12s; the two providers must fit inside that together.
const GEMINI_TIMEOUT_MS = 6500;
const OPENAI_TIMEOUT_MS = 5000;

function validateParsed(parsed, source) {
  if (!parsed?.en || !parsed?.tip) throw new Error(`${source}: incomplete response`);
  return {
    en: String(parsed.en),
    zh: String(parsed.zh || ""),
    tip: String(parsed.tip),
    source,
  };
}

async function callGemini(zh, age, apiKey) {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const body = {
    systemInstruction: { parts: [{ text: systemPrompt(age) }] },
    contents: [{ role: "user", parts: [{ text: `家长输入: ${zh}` }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          en: { type: "STRING" },
          zh: { type: "STRING" },
          tip: { type: "STRING" },
        },
        required: ["en", "zh", "tip"],
      },
      maxOutputTokens: 2048,
      // 2.5-flash thinks by default and thinking tokens eat maxOutputTokens,
      // truncating the JSON. This task doesn't need thinking — turn it off.
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
  });
  // 429 = free-tier quota exhausted → fall through to OpenAI
  if (!res.ok) throw new Error(`gemini ${res.status}`);

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return validateParsed(JSON.parse(text), "gemini");
}

async function callOpenAI(zh, age, apiKey) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt(age) },
        { role: "user", content: `家长输入: ${zh}` },
      ],
      response_format: { type: "json_object" },
      max_tokens: 300,
    }),
    signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`openai ${res.status}`);

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  return validateParsed(JSON.parse(text), "openai");
}

export default async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "POST only" }, { status: 405 });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!geminiKey && !openaiKey) {
    return Response.json({ error: "no API key configured" }, { status: 500 });
  }

  let zh, age;
  try {
    ({ zh, age } = await req.json());
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }
  zh = typeof zh === "string" ? zh.trim() : "";
  if (!zh || zh.length > MAX_INPUT_LEN || !VALID_AGES.has(age)) {
    return Response.json({ error: "invalid input" }, { status: 400 });
  }

  const cacheKey = `${age}\x00${zh}`;
  if (cache.has(cacheKey)) {
    return Response.json(cache.get(cacheKey));
  }

  let lastErr;
  for (const attempt of [
    geminiKey && (() => callGemini(zh, age, geminiKey)),
    openaiKey && (() => callOpenAI(zh, age, openaiKey)),
  ].filter(Boolean)) {
    try {
      const result = await attempt();
      if (cache.size > 500) cache.clear();
      cache.set(cacheKey, result);
      return Response.json(result);
    } catch (err) {
      lastErr = err;
    }
  }
  return Response.json({ error: String(lastErr?.message || lastErr) }, { status: 502 });
};

export const config = { path: "/api/translate" };
