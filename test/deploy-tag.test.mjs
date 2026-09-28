#!/usr/bin/env node
// 每次发生产都在仓库里留一个 tag：deploy-<缓存戳>。
//
// 由来（2026-09-28）：Victor 问「这一版的版本号是多少」，答案只能从三个地方拼：
// 线上 sw.js 的缓存戳、部署脚本的输出、git log。仓库里有三个 07-26 打的 deploy-ll-… tag，
// 之后的发布都没打——约定靠人记就断了。改成发完、**确认线上真的换了**之后，脚本自己打。
//
// 对应的用户情境（不含函数名）：
//   1. 家长报「某某功能不对」，先看她手机上 sw.js 里的戳，再 `git show deploy-<戳>` 就是那一版的代码。
//   2. 部署命令成功、线上却没换的那种情况，不许打 tag——tag 指着一个没上线的提交比没有 tag 更糟。
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(ROOT, "scripts/deploy-prod.mjs"), "utf8");
const code = src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test("发完生产、确认线上换了之后，脚本自己打 tag：deploy-<缓存戳>，并推到远端", () => {
  const confirmed = code.indexOf("线上现在是");
  assert.ok(confirmed !== -1, "找不到「线上现在是」那句确认");
  const tagAt = code.search(/"git",\s*\["tag"/);
  assert.ok(tagAt !== -1, "脚本没有 git tag 这一步——每一版是哪个提交，又要靠人记");
  // 打 tag 的代码住在一个函数里（定义在哪不重要），要看的是**调用**发生在确认之后。
  const fnAt = code.indexOf("function tagDeploy(");
  assert.ok(fnAt !== -1 && tagAt > fnAt, "git tag 不在 tagDeploy() 里");
  const callAt = code.indexOf("tagDeploy(expected)");
  assert.ok(callAt !== -1, "没有在确认之后调用 tagDeploy(expected)");
  assert.ok(callAt > confirmed, "tag 打在确认线上换了之前——部署命令成功但线上没换的话，tag 会指着一个没上线的提交");
  assert.ok(callAt < code.indexOf("process.exit(0)", confirmed), "确认之后先退出了，tag 没机会打");
  assert.match(code, /`deploy-\$\{\w+\}`|"deploy-" \+ \w+/, "tag 名不是 deploy-<缓存戳>——和仓库里 07-26 那三个对不上");
  assert.match(code.slice(tagAt), /["']push["'],\s*["']origin["'],\s*(tag|`deploy-)/, "tag 只打在本机没推到远端——换台机器就没了");
});

test("打 tag 失败不许把「部署成功」说成失败，但也不许闷声不响", () => {
  const tagAt = code.search(/"git",\s*\["tag"/);
  const tail = code.slice(tagAt);
  assert.match(tail, /catch/, "打 tag 那段没有 try/catch——git 一抖，脚本就带着「✗」退出，操作者会以为部署失败了");
  assert.match(tail, /没打成|tag 失败|手动打/, "打 tag 失败时没有一句人话告诉操作者要手动补");
});

test("确认线上没换的那条路仍然是非 0 退出，tag 这一步没把它盖掉", () => {
  const at = code.lastIndexOf("process.exit(1)");
  assert.ok(at !== -1 && code.slice(at - 600, at).includes("线上还是"), "「部署命令成功但线上没换」不再是非 0 退出——静默失败正是这个脚本要防的");
});

console.log("deploy-tag tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message.split("\n")[0]}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
