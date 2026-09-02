// SPIKE ONLY — netlify/functions/tts.mjs
//
// Answers one question: can this be generated server-side at all?
// NOT production code. No auth, no rate limit, no dedupe key. Do not deploy
// with --prod. See spike/README.md for what this deliberately does not do.
//
// The Azure call is lifted from generate-audio.js, which has already produced
// 1204 files with these exact headers and this exact SSML shape — so if this
// fails, the failure is about running it in a serverless function, not about
// whether the request is well-formed.

const MAX_INPUT_LEN = 300;

// Access gate. The seed of the invite-code mechanism in ADR 0003, not
// throwaway scaffolding: Netlify env vars are site-wide, so setting the Azure
// key for a deploy preview also arms /api/tts in production. Without this,
// deploying the preview would put a third unauthenticated paid endpoint on the
// public internet — the exact thing ADR 0001 was written about.
//
// The code lives in an env var, never in the bundle: this is a public static
// site and anything in the JS is readable by anyone.
function isAuthorized(req) {
  const expected = process.env.LL_ACCESS_CODE;
  // Fail closed. An unset variable must deny everyone, not let everyone in —
  // the opposite default is how endpoints end up open by accident.
  if (!expected) return false;
  const got = req.headers.get("x-ll-access") || "";
  return timingSafeEqual(got, expected);
}

// Compare in constant time. A plain === returns as soon as two bytes differ,
// and that timing difference can leak the code one character at a time.
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function buildSSML(text, voice) {
  const safe = String(text).replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
  return `<speak version='1.0' xml:lang='en-US'><voice xml:lang='en-US' name='${voice}'>`
       + `<prosody rate='-20%' pitch='+5%'>${safe}</prosody></voice></speak>`;
}

export default async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "POST only" }, { status: 405 });
  }

  // Checked before anything else, and before any paid call is even considered.
  if (!isAuthorized(req)) {
    return Response.json({ error: "not authorized" }, { status: 403 });
  }

  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
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

  const ssml = buildSSML(text, "en-US-JennyNeural");
  const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-16khz-128kbitrate-mono-mp3",
      "User-Agent": "LittleLingos",
    },
    body: ssml,
  });

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 200);
    return Response.json({ error: `azure ${res.status}`, detail }, { status: 502 });
  }

  // Raw mp3 bytes — the client stores this blob, it never re-requests it.
  return new Response(await res.arrayBuffer(), {
    headers: { "Content-Type": "audio/mpeg" },
  });
};

export const config = { path: "/api/tts" };
