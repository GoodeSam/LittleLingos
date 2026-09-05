#!/usr/bin/env node
// LittleLingos test orchestrator — adapted from bureau/test/run.mjs (GoodeSam).
// Runs the DETERMINISTIC pyramid by default (no API, always reproducible):
//   L0 product data gate · L1 crew integrity (pytest) · L1 crew engine check.
// Pass --codex to ALSO run the live judge layer: the strict two-lens product
// critique of rules/08-strict-product-critique.md, executed by the OpenAI
// Codex CLI (never Claude) via scripts/codex-eval.mjs.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
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
let failed = 0, ran = 0;
const skipped = [];

// A layer that cannot run is not a layer that passed. Skipping requires a
// reason, and the reason is printed here and counted in the summary — a green
// line that quietly covers a layer nobody ran is worse than a red one.
const skip = (label, why) => {
  skipped.push({ label, why });
  console.log(`\n=== ${label} ===`);
  console.log(`⊘ 跳过：${why}`);
};

const step = (label, fn) => {
  ran++;
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
step("L0 · install-env module behavior (test/install-env.test.mjs)", () => run("node", ["test/install-env.test.mjs"]));
step("L0 · keyboard dictation hint (test/keyboard-dictation-hint.test.mjs)", () => run("node", ["test/keyboard-dictation-hint.test.mjs"]));
step("L0 · backup export/import round trip (test/data-export.test.mjs)", () => run("node", ["test/data-export.test.mjs"]));
step("L0 · CSV backup format (test/data-export-csv.test.mjs)", () => run("node", ["test/data-export-csv.test.mjs"]));
step("L0 · custom scenarios (test/custom-scenarios.test.mjs)", () => run("node", ["test/custom-scenarios.test.mjs"]));
step("L0 · scenarios ride along in the backup (test/backup-scenarios.test.mjs)", () => run("node", ["test/backup-scenarios.test.mjs"]));
step("L0 · orphaned scenario tags on restore (test/orphan-scenario-tags.test.mjs)", () => run("node", ["test/orphan-scenario-tags.test.mjs"]));
step("L0 · restore keeps phrases in their scenario (test/scenario-restore-fidelity.test.mjs)", () => run("node", ["test/scenario-restore-fidelity.test.mjs"]));
step("L0 · reaching a self-made scenario (test/scenario-ui.test.mjs)", () => run("node", ["test/scenario-ui.test.mjs"]));
step("L0 · scenario grid order (test/scenario-order.test.mjs)", () => run("node", ["test/scenario-order.test.mjs"]));
step("L0 · the saved-state star (test/save-star.test.mjs)", () => run("node", ["test/save-star.test.mjs"]));
step("L0 · adding a phrase to a scenario (test/scenario-add-phrase.test.mjs)", () => run("node", ["test/scenario-add-phrase.test.mjs"]));
step("L0 · access code on the client (test/access-code-client.test.mjs)", () => run("node", ["test/access-code-client.test.mjs"]));
step("L0 · access control on paid endpoints (test/access-control.test.mjs)", () => run("node", ["test/access-control.test.mjs"]));
step("L0 · TTS endpoint behavior (test/tts-api.test.mjs)", () => run("node", ["test/tts-api.test.mjs"]));
step("L0 · on-device audio store (test/audio-store.test.mjs)", () => run("node", ["test/audio-store.test.mjs"]));
step("L0 · audio provisioning on save (test/audio-provision.test.mjs)", () => run("node", ["test/audio-provision.test.mjs"]));
step("L0 · stored-clip playback (test/audio-playback.test.mjs)", () => run("node", ["test/audio-playback.test.mjs"]));
step("L0 · audio mark on a saved row (test/audio-marks.test.mjs)", () => run("node", ["test/audio-marks.test.mjs"]));
step("L0 · play from a saved row (test/saved-row-play.test.mjs)", () => run("node", ["test/saved-row-play.test.mjs"]));
step("L0 · judge a phrase by id, from any row (test/answer-by-id.test.mjs)", () => run("node", ["test/answer-by-id.test.mjs"]));
step("L0 · voicing a translation on arrival (test/translate-audio.test.mjs)", () => run("node", ["test/translate-audio.test.mjs"]));
step("L0 · marks survive a restart (test/marks-after-reload.test.mjs)", () => run("node", ["test/marks-after-reload.test.mjs"]));
step("L0 · one-tap looping playback (test/audio-loop.test.mjs)", () => run("node", ["test/audio-loop.test.mjs"]));
step("L0 · bottom tab labels (test/nav-labels.test.mjs)", () => run("node", ["test/nav-labels.test.mjs"]));
step("L0 · no capability built and left unwired (test/no-orphan-modules.test.mjs)", () => run("node", ["test/no-orphan-modules.test.mjs"]));
step("L0 · service-worker behavior (test/sw.test.mjs)", () => run("node", ["test/sw.test.mjs"]));
step("L0 · dictionary API behavior (test/dictionary-api.test.mjs)", () => run("node", ["test/dictionary-api.test.mjs"]));
step("L0 · dictionary/review client correctness (test/dictionary-review.test.mjs)", () => run("node", ["test/dictionary-review.test.mjs"]));
step("L0 · dictionary-lookup CTA + form index (test/dictionary-lookup.test.mjs)", () => run("node", ["test/dictionary-lookup.test.mjs"]));
step("L0 · dictionary save flows through the existing review engine (test/dictionary-review-engine.test.mjs)", () => run("node", ["test/dictionary-review-engine.test.mjs"]));
// pytest runs INSIDE crew check (scripts/crew.mjs check) — no standalone
// pytest step, or one underlying failure would be reported twice and the
// suite would pay the collection cost twice per run.
// The crew layer checks .claude/agents/*.md, which .gitignore excludes: those
// files exist on the author's laptop and in no clone of this repository. So it
// verifies the local authoring environment, not the product — and a fresh
// checkout (CI included) has nothing for it to look at.
//
// Skipped rather than failed, because a red build on a clean clone would say
// "this commit is broken" about a commit that is fine. Skipped LOUDLY rather
// than silently, because the alternative is a green run that quietly covers a
// layer nobody executed.
if (existsSync(join(ROOT, ".claude/agents"))) {
  step("L1 · crew integrity + engine check (scripts/crew.mjs — includes pytest)", () => run("node", ["scripts/crew.mjs", "check"]));
} else {
  skip("L1 · crew integrity + engine check (scripts/crew.mjs — includes pytest)",
       ".claude/agents 不在这个检出里（.gitignore 排除了它）—— 这一层验的是本机的编写环境，不是产品");
}

if (process.argv.includes("--codex")) {
  step("L3 · codex judge · function (felix-function-critic lens)", () => run("node", ["scripts/codex-eval.mjs", "--lens", "function"]));
  step("L3 · codex judge · visual (vera-visual-critic lens)", () => run("node", ["scripts/codex-eval.mjs", "--lens", "visual"]));
}

// The count comes from here, not from eyeballing the output. Counting the
// "✓ all N tests passed" lines undercounts: the product-data gate, the sw
// stamp check and the crew layer do not print one. That mistake reached a
// commit message more than once.
// The project's own test discipline requires reporting passed / failed /
// SKIPPED and what was not run. "all N green" with a silent skip is the shape
// of report this line exists to make impossible.
const tail = skipped.length
  ? `，${skipped.length} 层跳过：${skipped.map(s => s.label.split(" (")[0]).join("、")}`
  : "";
console.log(failed
  ? `\n✗ ${failed} of ${ran} layer(s) failed${tail}`
  : `\n✓ all ${ran} layers green${tail}`);
process.exit(failed ? 1 : 0);
