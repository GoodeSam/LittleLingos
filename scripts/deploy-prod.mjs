#!/usr/bin/env node
// The only supported way to put this site into production.
//
//   node scripts/deploy-prod.mjs
//
// preflight → deploy → poll until production actually serves the new build.
//
// WHY IT IS ONE COMMAND. preflight-deploy.mjs checked everything BEFORE a
// deploy and reported the live stamp for you to compare afterwards — by hand,
// from memory, after the interesting part was over. That is precisely the step
// that got skipped on 2026-09-05, when a commit was reported as 已上线 while
// production sat one version behind. A check that depends on remembering to
// look is the check that fails on the day you are tired.
//
// Running `netlify deploy --prod` directly still works and nothing can stop
// it. That is the honest limit of a local script, and the reason a real CI
// gate belongs above this rather than instead of it.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://littlelingos.netlify.app";
const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { cwd: ROOT, encoding: "utf8", ...opts });

const stampOf = text => (String(text).match(/ll-[0-9a-f]{8}/) || [])[0] || null;
const localStamp = () => stampOf(readFileSync(join(ROOT, "sw.js"), "utf8"));
const liveStamp = () => {
  try {
    return stampOf(run("/usr/bin/curl",
      ["-s", "--max-time", "10", `${SITE}/sw.js?cb=${Date.now()}`]));
  } catch { return null; }
};

// ── 1 · preflight ───────────────────────────────────────────────────────
console.log("── 部署前检查 ──");
try {
  run("node", ["scripts/preflight-deploy.mjs"], { stdio: "inherit" });
} catch {
  console.error("\n✗ 检查没过，没有部署");
  process.exit(1);
}

// The clean-tree check happens again, last. preflight runs the suite after
// checking, so anything the suite writes would slip through the gap between
// them — and a deploy uploads the working directory, not a commit.
const dirty = run("git", ["status", "--porcelain"]).trim();
if (dirty) {
  console.error("\n✗ 检查跑完之后工作区又脏了 —— 部署上传的是工作区，不是提交：");
  console.error(dirty.split("\n").map(l => `    ${l}`).join("\n"));
  process.exit(1);
}

// ── 2 · deploy ──────────────────────────────────────────────────────────
const expected = localStamp();
const before = liveStamp();
console.log(`\n── 部署 ── ${before || "线上戳读不到"} → ${expected}`);

const msg = process.argv.slice(2).join(" ") ||
  run("git", ["log", "-1", "--pretty=%s"]).trim();
try {
  run("netlify", ["deploy", "--prod", "--dir=.", "--message", msg], { stdio: "inherit" });
} catch {
  console.error("\n✗ 部署命令失败 —— 线上仍是旧版");
  process.exit(1);
}

// ── 3 · 确认线上真的换了 ─────────────────────────────────────────────────
// The whole point of this file. "部署命令成功返回" and "线上是新版" are two
// different claims, and only the second one is what anyone cares about.
if (expected === before) {
  console.log(`\n✓ 线上本来就是 ${expected} —— 本次部署没有内容变化`);
  process.exit(0);
}

console.log("\n── 确认线上换了没有 ──");
let got = null;
for (let i = 1; i <= 10; i++) {
  got = liveStamp();
  if (got === expected) {
    console.log(`  ✓ 第 ${i} 次读到 ${got}`);
    console.log(`\n✓ 线上现在是 ${expected}`);
    console.log("  ⚠️ 缓存戳变了：已安装的 PWA 下次联网打开会更新，" +
                "随应用下发的音频会被清掉重新下载（IndexedDB 里生成的片段不受影响）");
    process.exit(0);
  }
  if (i < 10) run("/bin/sleep", ["3"]);
}

// Never exit 0 here. Silence about a failed deploy is the failure mode this
// file exists to prevent.
console.error(`\n✗ 部署命令成功了，但线上还是 ${got || "读不到"}，不是 ${expected}`);
console.error("  可能是 CDN 还没铺开 —— 过一分钟手动核对：");
console.error(`    curl -s ${SITE}/sw.js | grep -oE 'll-[0-9a-f]{8}' | head -1`);
console.error("  仍然不对的话，就是部署没落到生产上，别当它已经上线了");
process.exit(1);
