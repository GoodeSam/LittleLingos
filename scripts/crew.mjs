#!/usr/bin/env node
// LittleLingos crew engine — deterministic, no LLM. Adapted from
// bureau/scripts/crew.mjs (GoodeSam): the crew's source of truth is
// .claude/agents/*.md frontmatter; this engine renders the roster and runs the
// integrity checks that keep the DAG of rules/02-role-map.md honest.
//
//   node scripts/crew.mjs list       roster tree (root → leaves) + skills per agent
//   node scripts/crew.mjs check      graph + cross-reference + pillars validators (exit 1 on any issue)
//   node scripts/crew.mjs critique   run BOTH Codex judges (scripts/codex-eval.mjs, rules/08)
//
// Safe: read-only except for what codex-eval.mjs writes under .claude/state/.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const AGENTS = join(REPO, ".claude", "agents");
const ROOT_AGENT = "ada-ceo"; // rules/07-ceo-single-interface.md
const die = (m) => { console.error("✗ crew: " + m); process.exit(1); };

// ── frontmatter model (same parse the python validators use) ─────────────────
const fm = (text) => { const m = text.match(/^---\n([\s\S]*?)\n---/); return m ? m[1] : ""; };
const field = (f, key) => { const m = f.match(new RegExp(`^${key}:\\s*(.+)$`, "m")); return m ? m[1].trim() : ""; };
const delegates = (tools) => [...tools.matchAll(/Agent\(([^)]*)\)/g)].flatMap((m) => m[1].split(",").map((s) => s.trim()).filter(Boolean));
const skills = (f) => { const m = f.match(/^skills:\s*\n((?:\s*-\s*.+\n?)+)/m); return m ? [...m[1].matchAll(/-\s*([a-z0-9-]+)/g)].map((x) => x[1]) : []; };

function members() {
  if (!existsSync(AGENTS)) die("no .claude/agents directory");
  return readdirSync(AGENTS).filter((f) => f.endsWith(".md")).sort().map((f) => {
    const front = fm(readFileSync(join(AGENTS, f), "utf8"));
    return { name: field(front, "name") || f.replace(/\.md$/, ""), model: field(front, "model"),
      delegates: delegates(field(front, "tools")), skills: skills(front),
      role: (field(front, "description").split("—")[0] || "").replace(/^Use when /, "").slice(0, 72) };
  });
}

function list() {
  const crew = members(), byName = new Map(crew.map((m) => [m.name, m]));
  console.log("LittleLingos crew (rules/02-role-map.md · root " + ROOT_AGENT + ")");
  const seen = new Set();
  const show = (name, depth) => {
    const m = byName.get(name);
    if (!m || seen.has(name)) return; seen.add(name);
    const tag = m.skills.length ? `  ⚙ ${m.skills.join(", ")}` : "";
    console.log(`${"  ".repeat(depth)}${depth ? "└ " : "● "}${m.name.padEnd(24)} ${m.model.padEnd(6)}${tag}`);
    for (const c of m.delegates) show(c, depth + 1);
  };
  show(ROOT_AGENT, 0);
  const orphans = crew.filter((m) => !seen.has(m.name));
  if (orphans.length) console.log("  ⚠ unreachable from root: " + orphans.map((m) => m.name).join(", "));
}

const step = (label, cmd, args) => {
  console.log(`\n=== ${label} ===`);
  try { execFileSync(cmd, args, { cwd: REPO, stdio: "inherit", timeout: 600000 }); return true; }
  catch { console.error(`✗ ${label} FAILED`); return false; }
};

function check() {
  let failed = 0;
  if (!step("agent graph (scripts/check_agent_graph.py)", "python3", ["scripts/check_agent_graph.py"])) failed++;
  if (!step("cross-references (scripts/check_cross_references.py)", "python3", ["scripts/check_cross_references.py"])) failed++;
  if (!step("crew integrity suite (pytest)", "python3", ["-m", "pytest", "-q"])) failed++;
  if (failed) die(`${failed} check(s) failed`);
  console.log(`\n✓ crew check: ${members().length} member(s), graph + fabric intact`);
}

function critique() { // rules/08 — both lenses must pass independently
  let failed = 0;
  for (const lens of ["function", "visual"])
    if (!step(`codex judge · ${lens}`, "node", ["scripts/codex-eval.mjs", "--lens", lens])) failed++;
  if (failed) die(`${failed} lens(es) failed the strict critique gate`);
  console.log("\n✓ strict critique gate: both lenses pass");
}

const cmd = process.argv[2];
if (cmd === "list" || !cmd) list();
else if (cmd === "check") check();
else if (cmd === "critique") critique();
else die(`unknown subcommand "${cmd}" (list|check|critique)`);
