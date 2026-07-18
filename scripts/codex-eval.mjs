#!/usr/bin/env node
// LittleLingos strict-critique judge runner — the evaluation half of
// rules/08-strict-product-critique.md. Deterministic harness around a
// NON-Claude judge: the OpenAI Codex CLI (`codex exec --sandbox read-only`).
//
//   node scripts/codex-eval.mjs --lens function|visual [--threshold 90] [--timeout-ms 600000]
//
// The rubric is NOT written here. It is extracted at run time from the owning
// skill (single source of truth, see rules/08):
//   function -> .claude/skills/codex-functional-critique/SKILL.md
//   visual   -> .claude/skills/codex-visual-critique/SKILL.md
// between the <!-- RUBRIC:start --> / <!-- RUBRIC:end --> markers.
//
// Verdicts land in .claude/state/codex-critique/:
//   latest-<lens>.json            (machine-read by hooks + the crew)
//   <timestamp>-<lens>.json       (append-only history)
// Exit 0 = pass (score >= threshold AND zero Severity-A), 1 = fail, 2 = harness error.
// Style borrowed from bureau/scripts/crew.mjs: small, containment-checked, no LLM in the harness.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname, sep, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(REPO, ".claude", "state", "codex-critique");
const LENSES = {
  function: ".claude/skills/codex-functional-critique/SKILL.md",
  visual: ".claude/skills/codex-visual-critique/SKILL.md",
};
const PENALTY = { A: 15, B: 5, C: 2 };

const die = (m, code = 2) => { console.error("✗ codex-eval: " + m); process.exit(code); };
const contained = (p) => { const r = resolve(p); return r === REPO || r.startsWith(REPO + sep); };
const write = (p, data) => { if (!contained(p)) die("refusing to write outside the repo: " + p); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, data); };

// ── args ─────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf("--" + n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const lens = opt("lens", null);
const threshold = Number(opt("threshold", "90"));
const timeoutMs = Number(opt("timeout-ms", "600000"));
const runs = Math.max(1, Math.min(3, Number(opt("runs", "1")) || 1));
if (!lens || !LENSES[lens]) die("usage: codex-eval.mjs --lens function|visual [--threshold 90] [--runs 1..3]");

// ── rubric extraction (the skill IS the contract; rules/08) ─────────────────
const skillPath = join(REPO, LENSES[lens]);
if (!existsSync(skillPath)) die("missing rubric skill: " + LENSES[lens]);
const skill = readFileSync(skillPath, "utf8");
const m = skill.match(/<!-- RUBRIC:start -->([\s\S]*?)<!-- RUBRIC:end -->/);
if (!m) die("no RUBRIC markers in " + LENSES[lens]);
const rubric = m[1].trim();

// ── prompt ───────────────────────────────────────────────────────────────────
const prompt = `${rubric}

Scoring contract (subtractive, per rules/08-strict-product-critique.md):
start at 100; each Severity A finding is -15, B is -5, C is -2. Do not round
up. Do not merge findings to reduce the count. Uncertain findings are still
findings (mark the doubt in "issue").

fix_route must be exactly one of: maya-curriculum-designer, leo-linguist,
nina-native-editor, theo-tts-audio-engineer, devon-frontend-engineer,
quinn-qa-validator.

Answer with ONLY a JSON object (no markdown fence, no prose before or after):
{"lens":"${lens}","score":<int>,"probed":["..."],"findings":[{"severity":"A|B|C","area":"...","file":"...","issue":"...","fix_route":"..."}]}`;

// ── founder adjudications (rules/08 amendment 2026-07-18) ────────────────────
// Findings the human founder has explicitly ruled debatable or not-a-defect.
// They stay visible in verdicts but carry no penalty. Only the human edits
// the file; the crew and critics may propose entries, never write them.
const ADJ_PATH = join(OUT_DIR, "adjudicated.json");
let adjudications = [];
if (existsSync(ADJ_PATH)) {
  try { adjudications = JSON.parse(readFileSync(ADJ_PATH, "utf8")); }
  catch { die("adjudicated.json is not valid JSON"); }
  adjudications = adjudications.filter(
    (a) => (a.lens === lens || a.lens === "any") && Array.isArray(a.patterns) && a.patterns.length && a.reason,
  );
}

// ── run the judge (best of --runs against the same stamp; rules/08) ──────────
function judgeOnce(run) {
  const fail = (m) => { console.error(`✗ codex-eval run ${run}/${runs}: ${m}`); return null; };
  const lastMsg = join(tmpdir(), `codex-eval-${lens}-${process.pid}-${run}.txt`);
  console.log(`▸ judging lens "${lens}" with codex exec (read-only, threshold ${threshold}, run ${run}/${runs})…`);
  try {
    execFileSync("codex", [
      "exec", "--sandbox", "read-only", "-C", REPO, "--skip-git-repo-check",
      "--color", "never", "--output-last-message", lastMsg, prompt,
    ], { cwd: REPO, stdio: ["ignore", "inherit", "inherit"], timeout: timeoutMs });
  } catch (e) {
    return fail("codex exec failed: " + (e.message || e));
  }
  if (!existsSync(lastMsg)) return fail("codex produced no final message");
  const raw = readFileSync(lastMsg, "utf8").trim();
  rmSync(lastMsg, { force: true });

  // validate the verdict (schema of rules/08)
  const jsonText = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  let verdict;
  try { verdict = JSON.parse(jsonText); } catch { return fail("verdict is not valid JSON:\n" + raw.slice(0, 800)); }
  if (verdict.lens !== lens || !Array.isArray(verdict.findings) || !Array.isArray(verdict.probed))
    return fail("verdict missing lens/probed/findings fields");
  for (const f of verdict.findings)
    if (!PENALTY[f.severity] || !f.issue || !f.fix_route)
      return fail("malformed finding: " + JSON.stringify(f));

  for (const f of verdict.findings) {
    const text = `${f.file || ""} ${f.area || ""} ${f.issue || ""}`.toLowerCase();
    const hit = adjudications.find((a) => a.patterns.every((p) => text.includes(String(p).toLowerCase())));
    if (hit) { f.adjudicated = true; f.adjudicated_reason = hit.reason; }
  }
  const scored = verdict.findings.filter((f) => !f.adjudicated);

  // recompute the subtractive score locally — the judge reports, the harness enforces.
  // the harness's subtractive score is authoritative (rules/08) — the judge's
  // self-reported number is recorded but never trusted, and never negative.
  verdict.judge_reported_score = verdict.score;
  verdict.score = Math.max(0, 100 - scored.reduce((s, f) => s + PENALTY[f.severity], 0));
  verdict.severity_a = scored.filter((f) => f.severity === "A").length;
  const noProbe = verdict.findings.length === 0 && verdict.probed.length === 0; // rubber-stamp guard, rules/08
  verdict.no_probe = noProbe;
  verdict.pass = !noProbe && verdict.score >= threshold && verdict.severity_a === 0;
  verdict.threshold = threshold;
  verdict.run = run;
  verdict.judged_at = new Date().toISOString();
  verdict.judge = "codex exec (read-only)";

  const stamp = verdict.judged_at.replace(/[:.]/g, "-");
  write(join(OUT_DIR, `${stamp}-${lens}.json`), JSON.stringify(verdict, null, 2) + "\n");
  return verdict;
}

const all = [];
for (let r = 1; r <= runs; r++) {
  const v = judgeOnce(r);
  if (v) {
    all.push(v);
    console.log(`  run ${r}: score ${v.score} · ${v.findings.length} finding(s) · ${v.severity_a} Severity-A${v.pass ? " · PASS" : ""}`);
    if (v.pass) break; // a pass cannot be beaten; skip remaining runs
  }
}
if (!all.length) die("no valid verdict from any run");

// best run wins: pass first, then highest score, then fewest Severity-A (rules/08 amendment)
const verdict = [...all].sort(
  (x, y) => (y.pass - x.pass) || (y.score - x.score) || (x.severity_a - y.severity_a),
)[0];
verdict.best_of = runs;
verdict.run_scores = all.map((v) => v.score);

// ── persist + report ─────────────────────────────────────────────────────────
write(join(OUT_DIR, `latest-${lens}.json`), JSON.stringify(verdict, null, 2) + "\n");

console.log(`\n${verdict.pass ? "✓" : "✗"} ${lens}: score ${verdict.score}/${threshold} · ${verdict.findings.length} finding(s) · ${verdict.severity_a} Severity-A · best of ${all.length} run(s)`);
for (const f of verdict.findings)
  console.log(`  [${f.adjudicated ? "adjudicated" : f.severity}] ${f.file || f.area}: ${f.issue}  → ${f.fix_route}`);
if (verdict.no_probe) console.log("  [B] verdict listed no probes — rubber-stamp rejected (rules/08)");
console.log(`  verdict: .claude/state/codex-critique/latest-${lens}.json`);
process.exit(verdict.pass ? 0 : 1);
