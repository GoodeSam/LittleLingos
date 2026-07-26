#!/usr/bin/env node
// Prints the verified score history of every persisted Codex critique verdict.
// Exists so reports cite scores read from artifacts, never recalled from
// conversation (the "77" lesson, 2026-07-26): one command, chronological,
// with adjudication effects visible.
//
//   node scripts/critique-history.mjs           # full table
//   node scripts/critique-history.mjs function  # one lens
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", ".claude", "state", "codex-critique");
const lensFilter = process.argv[2];

const rows = [];
for (const f of readdirSync(DIR).sort()) {
  const m = f.match(/^(\d{4}-\d{2}-\d{2}T[\d-]+Z)-(function|visual)\.json$/);
  if (!m) continue;
  if (lensFilter && m[2] !== lensFilter) continue;
  let v;
  try { v = JSON.parse(readFileSync(join(DIR, f), "utf8")); }
  catch { rows.push({ ts: m[1], lens: m[2], error: "unparseable" }); continue; }
  const findings = v.findings || [];
  const adj = findings.filter((x) => x.adjudicated).length;
  const sev = { A: 0, B: 0, C: 0 };
  for (const x of findings) if (!x.adjudicated && sev[x.severity] !== undefined) sev[x.severity]++;
  // Recompute subtractively (A=-15 B=-5 C=-2, adjudicated=0) so the printed
  // score never depends on the judge's self-report.
  const recomputed = 100 - sev.A * 15 - sev.B * 5 - sev.C * 2;
  rows.push({
    ts: m[1], lens: m[2], stored: v.score, recomputed,
    A: sev.A, B: sev.B, C: sev.C, adjudicated: adj,
    pass: recomputed >= 90 && sev.A === 0,
  });
}

if (!rows.length) { console.log("no persisted verdicts" + (lensFilter ? ` for lens '${lensFilter}'` : "")); process.exit(0); }
console.log("timestamp                 lens      stored  recomputed  A  B  C  adj  verdict");
for (const r of rows) {
  if (r.error) { console.log(`${r.ts}  ${r.lens.padEnd(8)}  ${r.error}`); continue; }
  console.log(
    `${r.ts}  ${r.lens.padEnd(8)}  ${String(r.stored).padStart(6)}  ${String(r.recomputed).padStart(10)}  ` +
    `${r.A}  ${r.B}  ${r.C}  ${String(r.adjudicated).padStart(3)}  ${r.pass ? "PASS" : "fail"}`
  );
}
// Divergence between stored and recomputed indicates the file was written by
// an older harness or hand-edited — either way, trust recomputed.
const drift = rows.filter((r) => !r.error && r.stored !== r.recomputed);
if (drift.length) console.log(`\nnote: ${drift.length} verdict(s) have stored ≠ recomputed — cite the recomputed column.`);
