#!/usr/bin/env node
// Generates Azure Neural TTS MP3 files for LittleLingos phrases.
// Usage: node generate-audio.js [--age 0-1] [--voice JennyNeural]
//        node generate-audio.js --dict [--voice JennyNeural]
// Requires: AZURE_SPEECH_KEY and AZURE_SPEECH_REGION env vars

const fs   = require('fs');
const path = require('path');
const https = require('https');

const KEY    = process.env.AZURE_SPEECH_KEY;
const REGION = process.env.AZURE_SPEECH_REGION;
const VOICE  = process.argv.includes('--voice')
  ? process.argv[process.argv.indexOf('--voice') + 1]
  : 'en-US-JennyNeural';
const TARGET_AGE = process.argv.includes('--age')
  ? process.argv[process.argv.indexOf('--age') + 1]
  : '0-1';
const DICT_MODE = process.argv.includes('--dict');

if (!KEY || !REGION) {
  console.error('Missing AZURE_SPEECH_KEY or AZURE_SPEECH_REGION');
  process.exit(1);
}

// Normal: -20% rate — clear, warm parent-to-infant pacing
// Slow: word-by-word with 290ms gaps between each word
const SLOW_PAUSE_MS = 290;

function wordByWord(text) {
  return text
    .split(/\s+/)
    .filter(w => w.length > 0)
    .join(` <break time='${SLOW_PAUSE_MS}ms'/> `);
}

function buildSSML(text, mode) {
  const body = mode === 'slow'
    ? `<prosody rate='-5%' pitch='+5%'>${wordByWord(text)}</prosody>`
    : `<prosody rate='-20%' pitch='+5%'>${text}</prosody>`;
  return `<speak version='1.0' xml:lang='en-US'><voice xml:lang='en-US' name='${VOICE}'>${body}</voice></speak>`;
}

function synthesize(ssml, outFile) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(outFile)) {
      process.stdout.write('·');
      return resolve({ skipped: true });
    }
    const opts = {
      hostname: `${REGION}.tts.speech.microsoft.com`,
      path: '/cognitiveservices/v1',
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': KEY,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
        'User-Agent': 'LittleLingos',
        'Content-Length': Buffer.byteLength(ssml),
      },
    };
    const req = https.request(opts, res => {
      if (res.statusCode !== 200) {
        let b = ''; res.on('data', d => b += d);
        res.on('end', () => reject(new Error(`HTTP ${res.statusCode}: ${b.slice(0, 200)}`)));
        return;
      }
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => {
        fs.writeFileSync(outFile, Buffer.concat(chunks));
        process.stdout.write('✓');
        resolve({ skipped: false });
      });
    });
    req.on('error', reject);
    req.write(ssml);
    req.end();
  });
}

// ── Dictionary lemma path (theo-tts-audio-engineer surface) ──────────────
// Generates ONE normal-speed file per curated dictionary lemma into
// audio/dict/<slug>_normal.mp3. No slow_wbw variant: a single lemma has no
// inter-word pauses to insert (see rules/05-audio-pipeline.md ruling in the
// dictionary-audio-generation handoff). Text spoken is the bare lemma only,
// never the example sentence.
function slugify(lemma) {
  return lemma.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function runDict() {
  const window = {};
  eval(fs.readFileSync(path.join(__dirname, 'dictionary-words.js'), 'utf8'));
  const words = window.dictionaryWords;

  // Structural collision check: slug uniqueness across the curated set.
  const seenSlug = new Map();
  const collisions = [];
  for (const w of words) {
    const slug = slugify(w.lemma);
    if (seenSlug.has(slug)) collisions.push([seenSlug.get(slug), w.lemma, slug]);
    seenSlug.set(slug, w.lemma);
  }
  if (collisions.length) {
    console.error('Slug collisions detected — aborting:', JSON.stringify(collisions));
    process.exit(1);
  }

  const OUT_DIR = path.join(__dirname, 'audio', 'dict');
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log(`Generating ${words.length} dictionary lemmas × 1 speed = ${words.length} files`);
  console.log(`Voice: ${VOICE} | Out: audio/dict/ | Region: ${REGION}\n`);

  let generated = 0, skipped = 0, errors = 0;
  for (const w of words) {
    const slug = slugify(w.lemma);
    const outFile = path.join(OUT_DIR, `${slug}_normal.mp3`);
    const safeText = w.lemma.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const ssml = buildSSML(safeText, 'normal');
    try {
      const r = await synthesize(ssml, outFile);
      if (r.skipped) skipped++; else { generated++; await new Promise(res => setTimeout(res, 60)); }
    } catch (err) {
      errors++;
      console.error(`\n✗ ${w.lemma} (${slug}): ${err.message}`);
    }
  }

  console.log(`\n\nDone. Generated: ${generated} | Skipped: ${skipped} | Errors: ${errors}`);

  const missing = words
    .map(w => slugify(w.lemma))
    .filter(slug => !fs.existsSync(path.join(OUT_DIR, `${slug}_normal.mp3`)));
  if (missing.length) {
    console.error(`Coverage gap — missing files for slugs: ${missing.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log(`Coverage complete: ${words.length}/${words.length} lemmas.`);
  }
}

if (DICT_MODE) {
  runDict().catch(err => { console.error(err); process.exit(1); });
} else {
  // ── Scenario phrase path (unchanged) ──────────────────────────────────
  const window = {};
  eval(fs.readFileSync(path.join(__dirname, 'scenarios.js'), 'utf8'));
  const { scenarios, scenarioOrder } = window;

  const phrases = [];
  for (const sid of scenarioOrder) {
    const band = scenarios[sid].phrases[TARGET_AGE] || [];
    band.forEach(p => phrases.push({ id: p.id, en: p.en }));
  }

  const OUT_DIR = path.join(__dirname, 'audio');
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR);

  console.log(`Generating ${phrases.length} phrases × 2 speeds = ${phrases.length * 2} files`);
  console.log(`Voice: ${VOICE} | Age: ${TARGET_AGE} | Slow pause: ${SLOW_PAUSE_MS}ms | Region: ${REGION}\n`);

  async function run() {
    let generated = 0, skipped = 0, errors = 0;

    for (const p of phrases) {
      for (const mode of ['normal', 'slow']) {
        const suffix = mode === 'slow' ? 'slow_wbw' : 'normal';
        const outFile = path.join(OUT_DIR, `${p.id}_${suffix}.mp3`);
        // Escape XML special chars in phrase text
        const safeText = p.en.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        const ssml = buildSSML(safeText, mode);
        try {
          const r = await synthesize(ssml, outFile);
          if (r.skipped) skipped++; else { generated++; await new Promise(r => setTimeout(r, 60)); }
        } catch (err) {
          errors++;
          console.error(`\n✗ ${p.id} ${mode}: ${err.message}`);
        }
      }
    }

    console.log(`\n\nDone. Generated: ${generated} | Skipped: ${skipped} | Errors: ${errors}`);
    const bytes = fs.readdirSync(OUT_DIR)
      .filter(f => f.endsWith('.mp3'))
      .reduce((s, f) => s + fs.statSync(path.join(OUT_DIR, f)).size, 0);
    console.log(`Total audio folder size: ${(bytes / 1024 / 1024).toFixed(1)} MB`);
  }

  run().catch(err => { console.error(err); process.exit(1); });
}
