#!/usr/bin/env node
// Checks that must pass before `netlify deploy --prod`, because on this site
// deploying is a separate act from pushing and nothing enforces the link.
//
// WHY THIS FILE EXISTS. The Netlify dashboard says "Deploys from GitHub", but
// the GitHub App was never installed: 11 of the last 12 deploys were uploaded
// from a laptop by the CLI. So `git push` does not deploy, and `netlify deploy`
// ships whatever is in the working directory — pushed or not, committed or
// not, current or not.
//
// That gap has already produced two mistakes worth preventing:
//   · 2026-09-03  a push was followed by six minutes of waiting for a deploy
//                 that was never going to happen
//   · 2026-09-05  a commit was reported as 已上线 while production was still
//                 one version behind
//
// Neither was caught by a test, because neither is about the code.
//
// Usage:  node scripts/preflight-deploy.mjs     (exit 0 = safe to deploy)
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const sh = (cmd, args) =>
  execFileSync(cmd, args, { cwd: ROOT, encoding: "utf8" }).trim();

const problems = [];
const notes = [];

// 1 · Nothing uncommitted. A deploy uploads the working directory, so an
//     unstaged edit ships without ever existing in a commit — invisible to
//     `git log` and unrecoverable if the file is later reverted.
try {
  const dirty = sh("git", ["status", "--porcelain"]);
  if (dirty) {
    problems.push(
      `工作区有 ${dirty.split("\n").length} 处未提交改动。\n` +
      `     部署上传的是工作区，不是某个提交 —— 这些改动会上线，却不在任何一次提交里。\n` +
      dirty.split("\n").slice(0, 5).map(l => `       ${l}`).join("\n"));
  } else {
    notes.push("工作区干净");
  }
} catch {
  problems.push("git status 跑不通 —— 无法确认工作区是否干净");
}

// 2 · Local == origin. Deploying something nobody else can see means the only
//     copy of what is live sits on one laptop.
try {
  const branch = sh("git", ["rev-parse", "--abbrev-ref", "HEAD"]);
  const head = sh("git", ["rev-parse", "HEAD"]);
  let remote = "";
  try { remote = sh("git", ["rev-parse", `origin/${branch}`]); } catch {}
  if (!remote) {
    problems.push(`origin/${branch} 不存在 —— 这个分支还没推送过`);
  } else if (head !== remote) {
    const ahead = sh("git", ["rev-list", "--count", `origin/${branch}..HEAD`]);
    const behind = sh("git", ["rev-list", "--count", `HEAD..origin/${branch}`]);
    problems.push(
      `本地与 origin/${branch} 不一致（领先 ${ahead}、落后 ${behind}）。\n` +
      `     即将上线的东西 GitHub 上没有 —— 线上版本的唯一副本会只存在于这台电脑`);
  } else {
    notes.push(`本地与 origin/${branch} 一致`);
  }
} catch {
  problems.push("git 比对跑不通 —— 无法确认本地与远端是否一致");
}

// 3 · The service-worker stamp matches what is about to ship. A stale stamp
//     means installed clients keep serving the old bundle: deployed, and
//     nobody receives it. That is exactly the 15-day outage in ADR 0001.
try {
  execFileSync("node", ["scripts/stamp-sw.mjs", "--check"], { cwd: ROOT, stdio: "pipe" });
  notes.push("sw 缓存戳是新的");
} catch {
  problems.push(
    "sw 缓存戳过期 —— 先跑 `node scripts/stamp-sw.mjs`。\n" +
    "     戳不更新的话，已安装的 PWA 会继续用旧版：部署了，但没人收到");
}

// 4 · The suite. Not a substitute for the acceptance checklist, but a deploy
//     with a red suite is a decision nobody made on purpose.
try {
  execFileSync("node", ["test/run.mjs"], { cwd: ROOT, stdio: "pipe" });
  notes.push("全量测试绿");
} catch {
  problems.push("全量测试不是绿的 —— 跑 `node test/run.mjs` 看哪一层挂了");
}

// 5 · What is live right now, for comparison after the deploy. Reported, never
//     enforced: this script must work offline, and being unable to reach the
//     site is not a reason to block a deploy.
try {
  const localStamp = (readFileSync(join(ROOT, "sw.js"), "utf8")
    .match(/ll-[0-9a-f]{8}/) || [])[0];
  const live = execFileSync("/usr/bin/curl",
    ["-s", "--max-time", "8", "https://littlelingos.netlify.app/sw.js"],
    { encoding: "utf8" });
  const liveStamp = (live.match(/ll-[0-9a-f]{8}/) || [])[0];
  notes.push(liveStamp === localStamp
    ? `线上已经是 ${liveStamp} —— 本次部署没有变化`
    : `线上 ${liveStamp || "读不到"} → 部署后应变成 ${localStamp}`);
} catch {
  notes.push("线上戳读不到（离线？）—— 不阻止部署，但部署后请手动核对");
}

for (const n of notes) console.log(`  ✓ ${n}`);
if (!problems.length) {
  console.log("\n✓ 可以部署：node scripts/preflight-deploy.mjs && netlify deploy --prod --dir=.");
  process.exit(0);
}
console.error("");
for (const p of problems) console.error(`  ✗ ${p}`);
console.error(`\n✗ ${problems.length} 项没过 —— 先处理掉再部署`);
process.exit(1);
