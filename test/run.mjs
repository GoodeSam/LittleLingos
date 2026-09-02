#!/usr/bin/env node
// LittleLingos test orchestrator — adapted from bureau/test/run.mjs (GoodeSam).
// Runs the DETERMINISTIC pyramid by default (no API, always reproducible):
//   L0 product data gate · L1 crew integrity (pytest) · L1 crew engine check.
// Pass --codex to ALSO run the live judge layer: the strict two-lens product
// critique of rules/08-strict-product-critique.md, executed by the OpenAI
// Codex CLI (never Claude) via scripts/codex-eval.mjs.
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Strict flag parsing: a typo like `--codxe` must not silently produce a
// green deterministic run when the caller asked for the live judge layer.
const KNOWN_FLAGS = new Set(["--codex"]);
const unknown = process.argv.slice(2).filter((a) => !KNOWN_FLAGS.has(a));
if (unknown.length) {
  console.error(`✗ unknown argument(s): ${unknown.join(", ")} — supported: --codex`);
  process.exit(2);
}

// Per-layer timeout backstop: a hung layer fails the layer, never stalls CI.
// Validated strictly — a bad override (Infinity, negative, NaN) would make
// every execFileSync call throw and masquerade as test failures.
const rawTimeout = process.env.LL_LAYER_TIMEOUT_MS;
const LAYER_TIMEOUT_MS = rawTimeout === undefined ? 600000 : Number(rawTimeout);
if (!Number.isInteger(LAYER_TIMEOUT_MS) || LAYER_TIMEOUT_MS <= 0 || LAYER_TIMEOUT_MS > 2 ** 31 - 1) {
  console.error(`✗ invalid LL_LAYER_TIMEOUT_MS: ${JSON.stringify(rawTimeout)} — need a positive integer of milliseconds`);
  process.exit(2);
}
const run = (cmd, args) => execFileSync(cmd, args, { cwd: ROOT, stdio: "inherit", timeout: LAYER_TIMEOUT_MS });
let failed = 0;
const step = (label, fn) => {
  console.log(`\n=== ${label} ===`);
  try { fn(); } catch (e) {
    failed++;
    // Child output already streamed via stdio:inherit; add the harness-level
    // cause (timeout signal, spawn failure) that would otherwise be invisible.
    console.error(`✗ ${label} FAILED${e.signal ? ` (signal ${e.signal})` : ""}${e.code === "ETIMEDOUT" ? " (layer timeout)" : ""}${e.message && !e.status ? ` — ${e.message}` : ""}`);
  }
};

step("L0 · product data gate (validate-scenarios.js)", () => run("node", ["validate-scenarios.js"]));
step("L0 · sw cache stamp is current (scripts/stamp-sw.mjs --check)", () => run("node", ["scripts/stamp-sw.mjs", "--check"]));
step("L0 · voice-input module behavior (test/voice-input.test.mjs)", () => run("node", ["test/voice-input.test.mjs"]));
step("L0 · install-env module behavior (test/install-env.test.mjs)", () => run("node", ["test/install-env.test.mjs"]));
step("L0 · backup export/import round trip (test/data-export.test.mjs)", () => run("node", ["test/data-export.test.mjs"]));
step("L0 · CSV backup format (test/data-export-csv.test.mjs)", () => run("node", ["test/data-export-csv.test.mjs"]));
step("L0 · access control on paid endpoints (test/access-control.test.mjs)", () => run("node", ["test/access-control.test.mjs"]));
step("L0 · service-worker behavior (test/sw.test.mjs)", () => run("node", ["test/sw.test.mjs"]));
step("L0 · dictionary API behavior (test/dictionary-api.test.mjs)", () => run("node", ["test/dictionary-api.test.mjs"]));
step("L0 · dictionary/review client correctness (test/dictionary-review.test.mjs)", () => run("node", ["test/dictionary-review.test.mjs"]));
step("L0 · dictionary-lookup CTA + form index (test/dictionary-lookup.test.mjs)", () => run("node", ["test/dictionary-lookup.test.mjs"]));
step("L0 · dictionary save flows through the existing review engine (test/dictionary-review-engine.test.mjs)", () => run("node", ["test/dictionary-review-engine.test.mjs"]));
// pytest runs INSIDE crew check (scripts/crew.mjs check) — no standalone
// pytest step, or one underlying failure would be reported twice and the
// suite would pay the collection cost twice per run.
step("L1 · crew integrity + engine check (scripts/crew.mjs — includes pytest)", () => run("node", ["scripts/crew.mjs", "check"]));

if (process.argv.includes("--codex")) {
  step("L3 · codex judge · function (felix-function-critic lens)", () => run("node", ["scripts/codex-eval.mjs", "--lens", "function"]));
  step("L3 · codex judge · visual (vera-visual-critic lens)", () => run("node", ["scripts/codex-eval.mjs", "--lens", "visual"]));
}

console.log(failed ? `\n✗ ${failed} layer(s) failed` : "\n✓ all layers green");
process.exit(failed ? 1 : 0);
