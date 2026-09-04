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

const VOICE = "en-US-JennyNeural";

// The same shape generate-audio.js has used for all 1204 existing clips, so a
// saved phrase sounds like the preset ones rather than noticeably different.
// Escaping is not cosmetic: this is XML, and a translation containing "Mom &
// Dad" or a quoted phrase would otherwise break the document or be read out
// as markup.
function buildSSML(text) {
  const safe = String(text).replace(/[<>&'"]/g, c => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;",
  }[c]));
  return `<speak version='1.0' xml:lang='en-US'><voice xml:lang='en-US' name='${VOICE}'>`
       + `<prosody rate='-20%' pitch='+5%'>${safe}</prosody></voice></speak>`;
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

  let text;
  try { ({ text } = await req.json()); }
  catch { return Response.json({ error: "invalid JSON body" }, { status: 400 }); }

  text = typeof text === "string" ? text.trim() : "";
  if (!text || text.length > MAX_INPUT_LEN) {
    return Response.json({ error: "invalid input" }, { status: 400 });
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
      body: buildSSML(text),
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
