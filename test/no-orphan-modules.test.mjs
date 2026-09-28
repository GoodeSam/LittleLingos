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
import { APP_SOURCE } from "./_app-source.mjs";   // index.html + 它加载的每个模块

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

// 2026-09-28（ADR 0009 第十五块）：查的范围从 index.html 扩到整个应用。
// 原来只扫 index.html 里的 marker 块——每搬走一块，这道闸门就悄悄少看一块，
// 而且不会红（第十五块搬完只剩 9 块，是那条 >= 10 的哨兵拦住的）。
// 现在两边都扫：index.html 里剩下的 marker 块，加上每一个模块文件。
const product = stripComments(APP_SOURCE);

const blocks = [];
for (const m of html.matchAll(/\/\* (ll:[a-z-]+):start \*\//g)) {
  const name = m[1];
  const end = html.indexOf(`/* ${name}:end */`);
  assert.ok(end !== -1, `${name} has a start marker but no end marker`);
  blocks.push({ name, src: html.slice(m.index, end) });
}
// 模块文件清单从 stamp-sw.mjs 的 SOURCES 现取，不另抄一份。
const stampSrc = readFileSync(join(ROOT, "scripts/stamp-sw.mjs"), "utf8");
const sourcesAt = stampSrc.indexOf("const SOURCES = [");
for (const m of stampSrc.slice(sourcesAt, stampSrc.indexOf("]", sourcesAt)).matchAll(/"([^"]+\.js)"/g)) {
  const f = m[1];
  if (f === "sw.js") continue;
  try { blocks.push({ name: f, src: readFileSync(join(ROOT, f), "utf8") }); }
  catch (e) { assert.fail(`stamp-sw.mjs 的 SOURCES 里列了 ${f}，文件却不存在`); }
}
assert.ok(blocks.length >= 20, `only found ${blocks.length} blocks/modules — extraction is wrong`);

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

test("index.html 里 typeof 守着的每个名字都有主人：本文件定义的、浏览器的、或 defer 脚本名单里的", () => {
  // 2026-09-28 真机报上来的一类问题：`typeof audioPending !== "undefined"` 守着一个
  // 已经搬进模块、成了私有变量的名字。守卫把 ReferenceError 吞掉——分支静默死掉，
  // 不抛错、不红。孤儿检查看的是「造了没人用」，看不见「用了却没人造」；这条补上。
  const guarded = [...new Set([...html.matchAll(/typeof\s+([A-Za-z_$][\w$]*)\s*(?:!==|===)\s*["'](?:undefined|function|object)["']/g)].map(m => m[1]))];
  assert.ok(guarded.length >= 20, `只找到 ${guarded.length} 个 typeof 守卫，读法可能坏了`);
  const defined = new Set([...html.matchAll(/^(?:var|let|const|function|async function)\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1]));
  // 2026-09-28（ADR 0009 app-state）：可变状态不再是顶层 let，而是 app-state 清单装到 window 上的访问器——
  // 清单里的名字有主人，算「本文件定义」。清单从主脚本里现取，不另抄一份。
  const stateList = html.match(/llAppStateLib\.create\(\[([^\]]+)\]\)/);
  for (const m of (stateList ? stateList[1] : "").matchAll(/"([A-Za-z_$][\w$]*)"/g)) defined.add(m[1]);
  const browser = new Set(["window", "document", "navigator", "localStorage", "indexedDB", "speechSynthesis", "SpeechSynthesisUtterance",
    "Audio", "caches", "Notification", "PushManager", "crypto", "URL", "Blob", "fetch", "AbortController", "Intl", "history", "location",
    "structuredClone", "requestIdleCallback", "queueMicrotask", "MediaRecorder", "setTimeout", "clearTimeout", "performance", "Response",
    "TextEncoder", "TextDecoder", "FileReader", "globalThis", "IntersectionObserver", "ResizeObserver", "visualViewport", "CSS", "DOMParser"]);
  // defer 加载的外部脚本、或本文件里局部变量恰好用 typeof 看类型的：写明为什么
  const KNOWN = {
    llIcon: "icons.js（defer）挂在 window 上，主脚本跑到时可能还没到",
    scenarios: "scenarios.js（defer）的全局，同上",
    scenarioOrder: "scenarios.js（defer）的全局，同上",
    meta: "loadUsedToday() 里的局部变量，typeof 看的是类型不是存在",
  };
  const orphans = guarded.filter(n => !defined.has(n) && !browser.has(n) && !(n in KNOWN));
  assert.deepEqual(orphans, [],
    "这些名字被 typeof 守着，但 index.html 里没人定义它——多半是搬进模块成了私有变量，守卫让分支静默死掉了：\n  " + orphans.join("\n  "));
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
