// netlify/functions/tts.mjs — one English sentence in, one mp3 out.
//
// Why this exists: a parent saves a translated phrase, and it has to come back
// in a voice they will actually want to imitate. The browser's own speech is
// not that (tech-constraints C1, measured), so the sentence is spoken once,
// here, by the same Azure voice that produced the 1204 preset clips — and the
// phone keeps the bytes. See ADR 0003.
//
// This is the THIRD paid endpoint and the most expensive one: Azure bills per
// character, and unlike translate/dictionary it is hit on every save rather
// than on every new phrase. So the order below is deliberate — method, then
// the gate, then credentials, then input — and nothing reaches Azure until all
// four pass. A request that is refused after the call costs exactly as much as
// one that was allowed.
//
// Rewritten from the spike (branch spike/tts-indexeddb), not copied: that
// version carried its own hand-written constant-time compare, which is the
// kind of thing that passes its own tests while a plain === would too. The
// gate is imported, never re-implemented.
//
//   POST { text: "<english sentence>" }  ->  audio/mpeg bytes
//
// Requires: AZURE_SPEECH_KEY, AZURE_SPEECH_REGION, LL_ACCESS_CODE
import { isAuthorized, refuse } from "./_shared/access.mjs";

// A phrase a parent says to a toddler. 300 characters is far past any real
// one, and short enough that a single call can never cost much — this number
// IS the per-request spending cap, which is why the tests pin it exactly
// rather than checking that something absurd gets rejected.
const MAX_INPUT_LEN = 300;

// The spike measured a real call at ~3.0s. Ten seconds leaves generous room
// for a slow day without letting a stalled upstream hold the function (and a
// parent's spinner) open indefinitely.
const AZURE_TIMEOUT_MS = 10000;

// 家长挑哪一把嗓子念给孩子听，是他要模仿的对象，所以这件事该由他定。
// 名单是白名单而不是黑名单：这个值会被拼进 SSML 的 XML 属性里，任意字符串
// 直接拼进去就是一个注入口。名单外的一律在打给 Azure 之前挡下——请求发出去
// 之后才拒绝，钱一样花掉了。
export const DEFAULT_VOICE = "en-US-JennyNeural";
// 中文提示固定用这一把：新一代，吐字清楚，念短句稳。它不跟着家长挑的英文
// 音色走——那是两种语言，各用各的嘴。
export const CUE_VOICE = "zh-CN-XiaoxiaoMultilingualNeural";
// 名单是 2026-09-10 拿这个订阅在 eastus 实测过的：每一个都用本文件这套 SSML
// （含 <prosody rate='-20%'>）真打过一次，都回了可播的 mp3，且放慢确实生效
// ——带 prosody 的音频一致比不带的长。名字里带冒号是 Azure 新一代音色的写法，
// 这里是精确字符串比对，冒号不需要特别处理。
export const ALLOWED_VOICES = [
  DEFAULT_VOICE,                          // Jenny 原版：1204 条预设片段用的就是它
  // 最新一代（Dragon HD）：目前最接近真人的一批
  "en-US-Jenny:DragonHDLatestNeural",
  "en-US-Ava:DragonHDLatestNeural",
  "en-US-Emma:DragonHDLatestNeural",
  "en-US-Andrew:DragonHDLatestNeural",
  "en-US-Brian:DragonHDLatestNeural",
  "en-US-Steffan:DragonHDLatestNeural",
  // 新一代（Multilingual）：比原版自然，Christopher 只有这一代有
  "en-US-ChristopherMultilingualNeural",
  "en-US-SerenaMultilingualNeural",
  "en-US-DavisMultilingualNeural",
  // 原版：2019 年那一代。Victor 点名要，和上面的新版并列着让他自己用耳朵挑。
  "en-US-ChristopherNeural",
  // 中文提示（2026-09-11）。连播里每句英文之前先念一遍中文，让家长自己先
  // 想一次。原来那句中文是手机自带的语音合成念的——国产浏览器和微信里音质
  // 很差，有的干脆没有中文嗓子。2026-09-11 拿这个订阅在 eastus 实打过，
  // 用本文件这套 SSML 返回可播的 mp3。
  CUE_VOICE,
];

// The same shape generate-audio.js has used for all 1204 existing clips, so a
// saved phrase sounds like the preset ones rather than noticeably different.
// Escaping is not cosmetic: this is XML, and a translation containing "Mom &
// Dad" or a quoted phrase would otherwise break the document or be read out
// as markup.
// 语言必须跟着音色走。拿 en-US 的 xml:lang 去念中文，出来的是一串怪音。
// 从音色名的前两段取，zh-CN-XiaoxiaoMultilingualNeural → zh-CN。
function localeOf(voice) {
  const m = String(voice || "").match(/^([a-z]{2}-[A-Z]{2})-/);
  return m ? m[1] : "en-US";
}

function buildSSML(text, voice) {
  const safe = String(text).replace(/[<>&'"]/g, c => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;",
  }[c]));
  const lang = localeOf(voice);
  // 英文那句刻意放慢 20%、略微提高音高：家长要照着念给孩子听。中文只是一句
  // 提示，不是要模仿的对象，放慢一点点就够，音高不动。
  const prosody = lang === "en-US" ? `rate='-20%' pitch='+5%'` : `rate='-10%'`;
  return `<speak version='1.0' xml:lang='${lang}'><voice xml:lang='${lang}' name='${voice}'>`
       + `<prosody ${prosody}>${safe}</prosody></voice></speak>`;
}

export default async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "POST only" }, { status: 405 });
  }

  // Before the key is read and long before Azure is called.
  if (!isAuthorized(req)) return refuse();

  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  // Both, not just the key: a missing region produces a request to a hostname
  // that does not exist, and the parent sees an unexplainable failure instead
  // of "this side is misconfigured".
  if (!key || !region) {
    return Response.json({ error: "no Azure credentials configured" }, { status: 500 });
  }

  let text, voice;
  try { ({ text, voice } = await req.json()); }
  catch { return Response.json({ error: "invalid JSON body" }, { status: 400 }); }

  text = typeof text === "string" ? text.trim() : "";
  if (!text || text.length > MAX_INPUT_LEN) {
    return Response.json({ error: "invalid input" }, { status: 400 });
  }

  // 没给就用默认那把；给了就必须在名单里。名单外的在这里就返回，
  // Azure 一次都不会被打到——注入尝试和拼错一样，都在花钱之前结束。
  if (voice === undefined || voice === null || voice === "") {
    voice = DEFAULT_VOICE;
  } else if (typeof voice !== "string" || !ALLOWED_VOICES.includes(voice)) {
    return Response.json({ error: "unknown voice" }, { status: 400 });
  }

  let res;
  try {
    res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-16khz-128kbitrate-mono-mp3",
        "User-Agent": "LittleLingos",
      },
      body: buildSSML(text, voice),
      signal: AbortSignal.timeout(AZURE_TIMEOUT_MS),
    });
  } catch {
    // Timeout, DNS failure, connection reset. All the same to the caller: the
    // sentence has no audio yet and it is not their fault. An uncaught throw
    // here would surface as a 500 with a stack trace on a public site.
    return Response.json({ error: "speech service unreachable" }, { status: 502 });
  }

  if (!res.ok) {
    // Deliberately NOT forwarding the upstream body. Azure's error text can
    // quote the rejected subscription key back at you, and everything this
    // function returns is readable by whoever made the request.
    return Response.json({ error: `azure ${res.status}` }, { status: 502 });
  }

  // A 200 is not proof of audio. A proxy or captive portal can return 200 with
  // an HTML page, and a truncated connection can return 200 with nothing. Both
  // would otherwise be stored on the phone as a clip that never plays — and
  // the parent would not find out until a review days later, with no way to
  // tell what went wrong or to fix it.
  const type = res.headers.get("Content-Type") || "";
  if (!/^audio\//i.test(type)) {
    return Response.json({ error: "speech service returned non-audio" }, { status: 502 });
  }

  const bytes = await res.arrayBuffer();
  if (bytes.byteLength === 0) {
    return Response.json({ error: "speech service returned empty audio" }, { status: 502 });
  }

  // Raw bytes through, unchanged. The client stores this blob and replays it
  // from the device forever after; re-encoding or JSON-wrapping it here would
  // produce a file that cannot be played back.
  return new Response(bytes, { headers: { "Content-Type": "audio/mpeg" } });
};

export const config = { path: "/api/tts" };
