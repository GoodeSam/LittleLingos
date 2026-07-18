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
// Per-layer timeout backstop: a hung layer fails the layer, never stalls CI.
const LAYER_TIMEOUT_MS = Number(process.env.LL_LAYER_TIMEOUT_MS) || 600000;
const run = (cmd, args) => execFileSync(cmd, args, { cwd: ROOT, stdio: "inherit", timeout: LAYER_TIMEOUT_MS });
let failed = 0;
const step = (label, fn) => { console.log(`\n=== ${label} ===`); try { fn(); } catch { failed++; console.error(`✗ ${label} FAILED`); } };

step("L0 · product data gate (validate-scenarios.js)", () => run("node", ["validate-scenarios.js"]));
step("L0 · sw cache stamp is current (scripts/stamp-sw.mjs --check)", () => run("node", ["scripts/stamp-sw.mjs", "--check"]));
step("L1 · crew integrity suite (pytest: graph, cross-refs, pillars, schema)", () => run("python3", ["-m", "pytest", "-q"]));
step("L1 · crew engine check (scripts/crew.mjs)", () => run("node", ["scripts/crew.mjs", "check"]));

if (process.argv.includes("--codex")) {
  step("L3 · codex judge · function (felix-function-critic lens)", () => run("node", ["scripts/codex-eval.mjs", "--lens", "function"]));
  step("L3 · codex judge · visual (vera-visual-critic lens)", () => run("node", ["scripts/codex-eval.mjs", "--lens", "visual"]));
}

console.log(failed ? `\n✗ ${failed} layer(s) failed` : "\n✓ all layers green");
process.exit(failed ? 1 : 0);
