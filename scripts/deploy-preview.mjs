#!/usr/bin/env node
// Put the current working tree on a throwaway URL. Free, unlimited.
//
//   node scripts/deploy-preview.mjs
//
// THIS IS THE DEFAULT WAY TO SEE A CHANGE ON A PHONE. A production deploy
// costs 15 credits and the free tier is 300 a month — twenty of them, total.
// In September I spent seventeen, fourteen of those across two days, by
// deploying to production after nearly every commit while a preview would
// have answered the same question for nothing. Production deploys are now
// paused for the rest of the cycle, which is a real consequence of a habit
// nobody was watching.
//
// Deploy previews and branch deploys cost 0 credits. There was never a reason
// to test on production.
//
// Reach for deploy-prod.mjs when a delivery is actually finished — when the
// person using the app should receive it — and not before.
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { cwd: ROOT, encoding: "utf8", ...opts });

// Deliberately lighter than the production path: a preview is disposable, so
// blocking it on a clean tree would defeat the point — testing something not
// yet worth committing is exactly what it is for. The suite still runs,
// because shipping a broken build to a phone wastes the trip.
try {
  run("node", ["test/run.mjs"], { stdio: "pipe" });
  console.log("  ✓ 全量测试绿");
} catch {
  console.error("✗ 测试不是绿的 —— 跑 `node test/run.mjs` 看哪一层挂了");
  process.exit(1);
}

try {
  run("node", ["scripts/stamp-sw.mjs", "--check"], { stdio: "pipe" });
  console.log("  ✓ sw 缓存戳是新的");
} catch {
  console.error("✗ sw 戳过期 —— 先跑 `node scripts/stamp-sw.mjs`，" +
                "否则手机上装着的那个会继续用旧版");
  process.exit(1);
}

const msg = process.argv.slice(2).join(" ") ||
  run("git", ["log", "-1", "--pretty=%s"]).trim();

console.log("\n── 部署到临时地址 ──");
try {
  run("netlify", ["deploy", "--dir=.", "--message", msg], { stdio: "inherit" });
} catch {
  console.error("\n✗ 部署失败");
  process.exit(1);
}

// Said every time rather than assumed: each preview gets its own hostname, so
// localStorage starts empty — the invite code and everything saved live on the
// production origin and do not come along.
console.log("\n⚠️ 这是一个全新的地址 = 全新的存储空间：邀请码要重填一次，");
console.log("   收藏和自建场景也不会跟过来。要验真实数据，等生产部署。");
