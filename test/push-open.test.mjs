#!/usr/bin/env node
// 推送的公共部分（ADR 0008）：公钥解码、能力检测、从通知点开时去哪。
//
// 由来（ADR 0009 第十九块，2026-09-28）：pushKeyBytes() 把 VAPID 公钥从 base64url
// 解成字节，此前一条测试都没有。补位（padding）算错一位，subscribe() 会静默失败——
// 家长点「开启提醒」，看到「没开成」，没有人知道是为什么。
//
// 对应的用户情境（不含函数名）：
//   1. 写在代码里的那把公钥，解出来得是一把真的 P-256 公钥（65 字节、0x04 开头）。
//   2. 四种长度余数的 base64url 都要解对——补位就是在这里算错的。
//   3. 从通知点开：?to=loop 去连播、?to=review 去复习；别的、没有的，都不算。
//   4. 这个环境能不能收推送：四样零件缺一样就不能。
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
const lib = () => require(join(ROOT, "push-open.js"));

test("代码里那把公钥解出来是一把真的 P-256 公钥：65 字节、0x04 开头", () => {
  const { PUSH_PUBLIC_KEY, pushKeyBytes } = lib();
  const bytes = pushKeyBytes(PUSH_PUBLIC_KEY);
  assert.ok(bytes instanceof Uint8Array, "要给 subscribe() 的是 Uint8Array");
  assert.equal(bytes.length, 65, `解出 ${bytes.length} 字节——补位算错了，订阅会静默失败`);
  assert.equal(bytes[0], 0x04, "未压缩的 P-256 公钥第一个字节必须是 0x04");
});

test("四种长度余数的 base64url 都解对——补位就是在这里算错的", () => {
  const { pushKeyBytes } = lib();
  for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 31, 32, 33, 65]) {
    const raw = Uint8Array.from({ length: n }, (_, i) => (i * 37 + 251) & 0xff);
    const b64u = Buffer.from(raw).toString("base64url");
    assert.deepEqual([...pushKeyBytes(b64u)], [...raw], `${n} 字节（余数 ${b64u.length % 4}）解错了`);
  }
});

test("从通知点开：?to=loop 去连播、?to=review 去复习；别的、没有的，都不算", () => {
  const { deepLinkTarget } = lib();
  const targets = ["review", "loop"];
  assert.equal(deepLinkTarget("?to=loop", targets), "loop");
  assert.equal(deepLinkTarget("?x=1&to=review", targets), "review");
  assert.equal(deepLinkTarget("?to=settings", targets), null, "不认识的目标不该跳");
  assert.equal(deepLinkTarget("", targets), null);
  assert.equal(deepLinkTarget(undefined, targets), null);
});

test("这个环境能不能收推送：四样零件缺一样就不能", () => {
  const { pushSupported } = lib();
  const full = { navigator: { serviceWorker: {} }, PushManager: function () {}, Notification: function () {}, caches: {} };
  assert.equal(pushSupported(full), true);
  assert.equal(pushSupported({}), false);
  for (const k of ["PushManager", "Notification", "caches"]) {
    const g = { ...full }; delete g[k];
    assert.equal(pushSupported(g), false, `没有 ${k} 也说能收——家长会开一个永远不来的提醒`);
  }
  assert.equal(pushSupported({ ...full, navigator: {} }), false, "没有 service worker 也说能收");
});

test("这一块住在自己的文件里，进了离线清单和缓存戳；index.html 里不留第二份", () => {
  const html = readFileSync(join(ROOT, "index.html"), "utf8");
  assert.ok(html.includes('<script src="./push-open.js"></script>'), 'index.html 里没有 <script src="./push-open.js"></script>');
  assert.equal(html.includes("function pushKeyBytes("), false, "index.html 里还留着一份 pushKeyBytes");
  const sw = readFileSync(join(ROOT, "sw.js"), "utf8");
  assert.ok(sw.slice(sw.indexOf("const SHELL = ["), sw.indexOf("];", sw.indexOf("const SHELL = ["))).includes("push-open.js"), "sw.js 的 SHELL 里没有它");
  const stamp = readFileSync(join(ROOT, "scripts/stamp-sw.mjs"), "utf8");
  assert.ok(stamp.slice(stamp.indexOf("const SOURCES = ["), stamp.indexOf("]", stamp.indexOf("const SOURCES = ["))).includes("push-open.js"), "stamp-sw.mjs 的 SOURCES 里没有它");
});

console.log("push-open tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message.split("\n")[0]}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
