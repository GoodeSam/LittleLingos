#!/usr/bin/env node
// Generates Azure Neural TTS MP3 files for LittleLingos phrases.
// Usage: node generate-audio.js [--age 0-1] [--voice JennyNeural]
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

// Load phrase data
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
