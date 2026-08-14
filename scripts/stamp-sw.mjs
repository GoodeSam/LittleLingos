#!/usr/bin/env node
// LittleLingos sw.js cache-version stamper.
//
// Fixes the Codex functional-critique Severity-A finding: a hand-bumped
// `CACHE` constant in sw.js is not mechanically verifiable, so a deploy that
// changes index.html or scenarios.js without a matching bump can leave an
// installed client serving a stale shell/data forever (rules/05, sw.js
// header comment). This script makes the cache key a deterministic function
// of the shipped content instead of a human's memory.
//
//   node scripts/stamp-sw.mjs            # stamp sw.js in place, print old -> new
//   node scripts/stamp-sw.mjs --check     # exit 1 if sw.js CACHE is stale, 0 if fresh
//
// Style follows scripts/codex-eval.mjs: small, containment-checked, no deps.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SW_PATH = resolve(REPO, "sw.js");
// Every precached SHELL asset from sw.js participates in the stamp: a change
// to ANY of them (not just index.html/scenarios.js) must install a new cache,
// or cache-first clients keep serving the obsolete asset indefinitely.
const SOURCES = [
  "index.html",
  "scenarios.js",
  "dictionary-words.js",
  "manifest.json",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
].map((f) => resolve(REPO, f));
const AUDIO_DIR = resolve(REPO, "audio");

const die = (m, code = 2) => { console.error("✗ stamp-sw: " + m); process.exit(code); };
const contained = (p) => { const r = resolve(p); return r === REPO || r.startsWith(REPO + sep); };

// Folds the audio/ directory into the hash by CONTENT, not name+length: a
// regenerated mp3 with the same name and coincidentally identical byte count
// (the failure mode of the old size-proxy fold) still changes the stamp.
// Hashing the full ~120MB corpus costs about a second — cheap insurance
// against an installed client serving a stale recording forever. Recursive:
// audio/ now holds subdirectories (e.g. audio/dict/) whose mp3s must
// participate in the stamp exactly like top-level ones, or a regenerated
// file in a subdirectory silently fails to bust the cache (found by
// felix-function-critic 2026-08-13, latent — did not affect any stamp to
// date because index.html always changed alongside audio/dict/ additions).
function foldAudioDir(hash) {
  if (!existsSync(AUDIO_DIR)) die("missing audio/ directory required for hash: " + AUDIO_DIR);
  const names = readdirSync(AUDIO_DIR, { recursive: true })
    .filter((f) => f.endsWith(".mp3"))
    .map((f) => f.split(sep).join("/"))
    .sort();
  if (names.length === 0) die("audio/ directory is empty: " + AUDIO_DIR);
  for (const name of names) {
    hash.update(name + ":");
    hash.update(readFileSync(resolve(AUDIO_DIR, name)));
    hash.update("\n");
  }
}

function computeHash8() {
  const hash = createHash("sha256");
  for (const src of SOURCES) {
    if (!existsSync(src)) die("missing source file required for hash: " + src);
    hash.update(readFileSync(src));
  }
  foldAudioDir(hash);
  return hash.digest("hex").slice(0, 8);
}

const CACHE_LINE_RE = /const CACHE = '([^']*)';/;

function main() {
  const checkOnly = process.argv.includes("--check");

  if (!contained(SW_PATH)) die("refusing to write outside the repo: " + SW_PATH);
  if (!existsSync(SW_PATH)) die("missing sw.js at " + SW_PATH);

  const swSrc = readFileSync(SW_PATH, "utf8");
  const m = swSrc.match(CACHE_LINE_RE);
  if (!m) die("could not find `const CACHE = '...';` line in sw.js");
  const oldCache = m[1];

  const hash8 = computeHash8();
  const newCache = `ll-${hash8}`;

  if (checkOnly) {
    if (oldCache === newCache) {
      console.log(`✓ stamp-sw --check: sw.js CACHE is fresh (${oldCache})`);
      process.exit(0);
    }
    console.error(`✗ stamp-sw --check: sw.js CACHE is stale: '${oldCache}' -> '${newCache}'`);
    process.exit(1);
  }

  if (oldCache === newCache) {
    console.log(`= stamp-sw: sw.js CACHE already up to date (${oldCache}), no write needed`);
    process.exit(0);
  }

  const newSrc = swSrc.replace(CACHE_LINE_RE, `const CACHE = '${newCache}';`);
  writeFileSync(SW_PATH, newSrc);
  console.log(`✓ stamp-sw: '${oldCache}' -> '${newCache}'`);
}

main();
