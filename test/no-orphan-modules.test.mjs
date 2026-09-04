#!/usr/bin/env node
// Guards against a capability existing that nothing uses.
//
// This bug class has landed twice in one delivery, both times invisible to
// every other test in the suite:
//
//   primeAudioUrl()   existed, was correct, was covered — and
//                     provisionTranslation() never called it, so a clip that
//                     had been generated and stored was never turned into
//                     something playable. The translate screen fell back to
//                     the browser voice and nothing failed.
//
//   whichHaveAudio()  existed, was correct, was covered — and nothing called
//                     it, so after a restart every saved phrase claimed to
//                     have no sound while its clip sat in storage.
//
// Both are the same shape: a MISSING call. Tests that check the calls a module
// does make cannot see one it fails to make, and a marker block tested alone
// in a vm has all of its collaborators faked, so the seam is never executed.
//
// What this file asserts is blunt and mechanical: every function a marker
// block defines must be called from somewhere. Not that it is called
// correctly — only that it is called at all. That is a low bar, and both bugs
// above were below it.
//
// WHAT IT CANNOT SEE, verified by probing rather than assumed: it counts
// occurrences of the name in the source text, so a call sitting inside
// `if (false && …)` — or any branch that never runs — still counts. It proves
// a call was WRITTEN, not that it executes. Deleting the call outright does
// turn it red; disabling the branch around it does not.
//
// 这条测试对应的用户情境（不含函数名）：
//
//   有人做了一个功能、写了测试、测试全绿，然后忘了把它接到界面上。
//   家长看到的是这个功能不存在——而没有任何东西报错。
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");

// Deliberately unreachable, with the reason. Anything added here is a claim
// that the app is complete without it — make that claim out loud.
const ALLOWED_ORPHANS = {
  releaseAudioUrls:
    "显式清空全部音频地址。日常回收已由 primeAudioUrl 的上限淘汰负责，" +
    "这个留作将来「离开某个界面时一次性释放」的入口。",
  deleteAudio:
    "删掉某条的音频。取消收藏时刻意不删——重新收藏同一句话时能免费复用" +
    "（ADR 0003：省钱是这套设计的目的）。",
};

const stripComments = src =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

const product = stripComments(html);

// Every marker block and the top-level functions it defines.
const blocks = [];
for (const m of html.matchAll(/\/\* (ll:[a-z-]+):start \*\//g)) {
  const name = m[1];
  const end = html.indexOf(`/* ${name}:end */`);
  assert.ok(end !== -1, `${name} has a start marker but no end marker`);
  blocks.push({ name, src: html.slice(m.index, end) });
}
assert.ok(blocks.length >= 10, `only found ${blocks.length} marker blocks — extraction is wrong`);

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test("每个模块导出的函数，产品代码里都真的有人调用", () => {
  const orphans = [];
  for (const { name, src } of blocks) {
    const defined = [...stripComments(src).matchAll(/^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm)]
      .map(m => m[1])
      .filter(fn => !fn.startsWith("__"));          // 测试专用钩子不算
    for (const fn of defined) {
      // 全文件里 fn( 的出现次数减去定义本身。onclick="foo()" 也算，
      // 因为那同样是真实的调用点。
      const uses = (product.match(new RegExp(`\\b${fn}\\s*\\(`, "g")) || []).length - 1;
      if (uses <= 0 && !(fn in ALLOWED_ORPHANS)) orphans.push(`${name} → ${fn}()`);
    }
  }
  assert.deepEqual(orphans, [],
    "这些函数造出来了但没人用。要么把它接上，要么在 ALLOWED_ORPHANS 里写明为什么不接：\n  " +
    orphans.join("\n  "));
});

test("豁免名单里的每一条，都仍然真的是孤儿", () => {
  // 名单会过期。某个函数后来被接上了，却还挂在这里的话，
  // 名单就从「说明」退化成了噪音。
  const stale = [];
  for (const fn of Object.keys(ALLOWED_ORPHANS)) {
    const uses = (product.match(new RegExp(`\\b${fn}\\s*\\(`, "g")) || []).length - 1;
    if (uses > 0) stale.push(`${fn}()（现在有 ${uses} 处调用）`);
  }
  assert.deepEqual(stale, [],
    "这些已经被接上了，从豁免名单里删掉：\n  " + stale.join("\n  "));
});

test("豁免名单里的每一条，都写了为什么", () => {
  for (const [fn, why] of Object.entries(ALLOWED_ORPHANS)) {
    assert.ok(why && why.length > 20,
      `${fn}() 的豁免理由太短——一句「暂时不用」三个月后帮不了任何人`);
  }
});

// ── Runner ───────────────────────────────────────────────
console.log("no-orphan-modules tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
