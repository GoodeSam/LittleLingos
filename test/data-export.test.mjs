#!/usr/bin/env node
// Behavioral tests for the data export/import module in index.html.
// Zero-dependency: extracts the code between the ll:data-export markers and
// runs it in a vm context, per the extraction idiom of
// test/dictionary-review.test.mjs.
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   1. 家长想把自己攒了几个月的收藏存一份下来，免得换手机或误删图标就全没了。
//      导出的那份东西里必须有：收藏的句子、每条的复习进度、当前年龄段设置。
//      不该有的：只在今天有意义的临时记录、"别再提示我安装"这类开关。
//
//   2. 家长在新手机上把那份东西导回来，收藏和复习进度要跟原来一样——
//      「存下来」不算数，「能还原」才算数。
//
//   3. 家长手滑选错了文件（一张图片、一段别的应用导出的 JSON、一个被截断
//      的半截文件），应用要说"这个不对"，而不是把现有收藏搞坏。
//
//   4. 两台设备各存过一些，导回来时不能把本机已有的覆盖掉——
//      静默丢数据是这次要防的头号问题。
//
//   5. 导入完要告诉家长发生了什么：加进来几条、跳过几条。
//      不要静默操作。
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
const require = createRequire(import.meta.url);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");

const START = "/* ll:data-export:start */";
const END = "/* ll:data-export:end */";

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test("备份/恢复只在 data-export.js 里有一份：index.html 里的块删了，8 处调用点走模块，主脚本前加载，进了离线清单", () => {
  const code = html.replace(/<!--[\s\S]*?-->/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
  assert.ok(!html.includes(START), "index.html 里还有 ll:data-export 块——备份这种事绝不能有两份实现");
  for (const fn of ["buildExportPayload", "parseImportPayload", "mergeSaved", "buildCsvBackup", "parseCsvBackup"]) {
    assert.ok(!code.includes(`function ${fn}(`), `index.html 里还定义着 ${fn}()`);
    assert.ok(new RegExp(`var ${fn} = llExport\\.${fn};`).test(code), `缺别名 var ${fn} = llExport.${fn}（必须 var：沙箱里顶层 const 不挂上下文）`);
  }
  const tagAt = html.indexOf('<script src="./data-export.js"></script>');
  assert.ok(tagAt !== -1 && tagAt < html.indexOf("\n<script>\n"), "data-export.js 要在主脚本之前加载");
  const sw = readFileSync(join(ROOT, "sw.js"), "utf8");
  assert.ok(sw.slice(sw.indexOf("const SHELL = ["), sw.indexOf("];", sw.indexOf("const SHELL = ["))).includes("data-export.js"), "sw.js 的 SHELL 里没有它");
  const stamp = readFileSync(join(ROOT, "scripts/stamp-sw.mjs"), "utf8");
  assert.ok(stamp.slice(stamp.indexOf("const SOURCES = ["), stamp.indexOf("]", stamp.indexOf("const SOURCES = ["))).includes("data-export.js"), "stamp-sw.mjs 的 SOURCES 里没有它");
  const src = readFileSync(join(ROOT, "data-export.js"), "utf8").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
  for (const bad of ["document.", "window.", "localStorage", "fetch("]) assert.ok(!src.includes(bad), `data-export.js 里出现了「${bad}」——它该是纯的`);
});

// Normalize across the vm realm boundary before a deep-equality assert.
//
// vm.createContext() gives the module its own Object.prototype and
// Array.prototype. Anything the module builds — JSON.parse() results, .map()
// and .filter() outputs — carries THOSE prototypes, while a literal written
// in this file carries the main context's. deepStrictEqual compares
// prototypes, so it reports "same structure but not reference-equal" even
// when every field matches. The mismatch is an artifact of testing through
// vm; in the browser JSON and the app share one realm and it cannot occur.
//
// structuredClone() runs in this realm, so the copy comes back with main-realm
// prototypes while keeping undefined, Date, NaN, Infinity, -0 and array
// sparseness intact. JSON.parse(JSON.stringify(v)) would also fix the
// prototypes but silently flatten all of those — hiding a real bug on the day
// the implementation accidentally produces a non-JSON value.
//
// WHEN it is needed, precisely: only where the value crossed a JSON.parse()
// inside the module. buildExportPayload() and mergeSaved() filter/slice/push
// the very records this file hands them — those come back as the same
// main-realm objects, so their asserts pass without help and must NOT be
// wrapped (wrapping them would assert against a copy and quietly stop
// catching a mutation bug). The two that DO need it are the ones whose data
// was rebuilt inside the vm: the round trip, and the parse that drops junk
// records.
//
// It fixes realm identity; it must never be used to soften what an assertion
// requires.
const sameRealm = v => structuredClone(v);

function loadModule() {
  // 2026-09-28（ADR 0009 第九块）：备份/恢复整块搬进 data-export.js，直接 require。
  const p = join(ROOT, "data-export.js");
  assert.ok(existsSync(p), "data-export.js 还不存在——这一块该搬出 index.html 了");
  const ctx = require(p);
  assert.equal(typeof ctx.buildExportPayload, "function", "module must define buildExportPayload()");
  assert.equal(typeof ctx.parseImportPayload, "function", "module must define parseImportPayload()");
  assert.equal(typeof ctx.mergeSaved, "function", "module must define mergeSaved()");
  return ctx;
}

// ── Fixtures ──────────────────────────────────────────────────────────
const SAVED_A = {
  id: "b01", en: "Bath time!", zh: "洗澡时间！", scenario: "bath", age: "0-1",
  savedAt: 1000, rv: { s: 2, due: 5000 },
};
const SAVED_B = {
  id: "t_1725000000000", en: "Don't step on it.", zh: "别踩上去",
  scenario: "__translate__", age: "2-3", savedAt: 2000, rv: { s: 0, due: 2000 },
};
const SAVED_C = {
  id: "w_bedtime", en: "bedtime", zh: "就寝时间", scenario: "__dict__",
  age: "2-3", savedAt: 3000, rv: { s: 1, due: 9000 },
};

// ══ 1. 导出：该带的都带上 ═══════════════════════════════════════════════

test("export carries a schema version — a file without one can't be safely restored later", () => {
  const { buildExportPayload } = loadModule();
  const out = buildExportPayload({ saved: [SAVED_A], age: "0-1" });
  assert.equal(typeof out.schema, "number");
  assert.ok(out.schema >= 1);
});

test("export is stamped with the app name so another app's JSON can be rejected on import", () => {
  const { buildExportPayload } = loadModule();
  const out = buildExportPayload({ saved: [], age: "0-1" });
  assert.equal(out.app, "LittleLingos");
});

test("export records when it was taken (ISO 8601) — a parent with three backups must know which is newest", () => {
  const { buildExportPayload } = loadModule();
  const out = buildExportPayload({ saved: [], age: "0-1" });
  assert.match(out.exportedAt, /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);
});

test("export carries every saved phrase, review progress included", () => {
  const { buildExportPayload } = loadModule();
  const out = buildExportPayload({ saved: [SAVED_A, SAVED_B, SAVED_C], age: "2-3" });
  assert.equal(out.saved.length, 3);
  const a = out.saved.find(x => x.id === "b01");
  assert.deepEqual(a.rv, { s: 2, due: 5000 }, "rv is the review progress — losing it silently resets months of work");
  assert.equal(a.savedAt, 1000);
});

test("export carries the age-band preference", () => {
  const { buildExportPayload } = loadModule();
  const out = buildExportPayload({ saved: [], age: "3-6" });
  assert.equal(out.age, "3-6");
});

test("export leaves out today-only state and dismissal flags — they are not assets", () => {
  const { buildExportPayload } = loadModule();
  const out = buildExportPayload({ saved: [SAVED_A], age: "0-1" });
  const keys = Object.keys(out);
  assert.ok(!keys.includes("usedToday"));
  assert.ok(!keys.some(k => /dismiss/i.test(k)));
});

test("export of an empty library still produces a valid file, not a crash", () => {
  const { buildExportPayload } = loadModule();
  const out = buildExportPayload({ saved: [], age: "0-1" });
  assert.deepEqual(out.saved, []);
  assert.equal(out.app, "LittleLingos");
});

// ══ 2. 往返：存下来的能还原回去 ═════════════════════════════════════════
// 这是整组测试里最重要的一条。P7：备份不算数，恢复成功才算数。

test("round trip: what comes out of an export goes back in unchanged", () => {
  const { buildExportPayload, parseImportPayload, mergeSaved } = loadModule();
  const original = [SAVED_A, SAVED_B, SAVED_C];
  const text = JSON.stringify(buildExportPayload({ saved: original, age: "2-3" }));

  const parsed = parseImportPayload(text);
  assert.equal(parsed.ok, true, parsed.error);

  const { merged } = mergeSaved([], parsed.payload.saved);
  assert.equal(merged.length, 3);
  for (const item of original) {
    const back = merged.find(x => x.id === item.id);
    assert.deepEqual(sameRealm(back), item, `${item.id} must survive the round trip byte-for-byte`);
  }
  assert.equal(parsed.payload.age, "2-3");
});

// ══ 3. 导入：坏文件要被挡住，不能弄坏现有数据 ═══════════════════════════

test("import rejects a file that isn't JSON at all (parent picked a photo)", () => {
  const { parseImportPayload } = loadModule();
  const r = parseImportPayload("\x89PNG\r\n\x1a\n");
  assert.equal(r.ok, false);
  assert.equal(r.error, "not-json");
});

test("import rejects valid JSON that isn't an object (a bare array or number)", () => {
  const { parseImportPayload } = loadModule();
  assert.equal(parseImportPayload("[1,2,3]").ok, false);
  assert.equal(parseImportPayload("42").ok, false);
  assert.equal(parseImportPayload("null").ok, false);
});

test("import rejects another app's export", () => {
  const { parseImportPayload } = loadModule();
  const r = parseImportPayload(JSON.stringify({ schema: 1, app: "SomeOtherApp", saved: [] }));
  assert.equal(r.ok, false);
  assert.equal(r.error, "wrong-app");
});

test("import refuses a schema it doesn't know rather than guessing at the shape", () => {
  const { parseImportPayload } = loadModule();
  const r = parseImportPayload(JSON.stringify({ schema: 999, app: "LittleLingos", saved: [] }));
  assert.equal(r.ok, false);
  assert.equal(r.error, "unknown-schema");
});

test("import rejects a file with no saved list (truncated download)", () => {
  const { parseImportPayload } = loadModule();
  const r = parseImportPayload(JSON.stringify({ schema: 1, app: "LittleLingos" }));
  assert.equal(r.ok, false);
  assert.equal(r.error, "no-saved");
});

test("import drops individual broken records instead of failing the whole restore", () => {
  const { parseImportPayload } = loadModule();
  const r = parseImportPayload(JSON.stringify({
    schema: 1, app: "LittleLingos", age: "0-1",
    saved: [SAVED_A, null, 42, { noId: true }, SAVED_B],
  }));
  assert.equal(r.ok, true);
  assert.equal(r.payload.saved.length, 2, "the two good records survive; the three bad ones are dropped");
  assert.deepEqual(sameRealm(r.payload.saved.map(x => x.id).sort()), ["b01", "t_1725000000000"]);
});

test("import tolerates a missing age band rather than refusing the whole file", () => {
  const { parseImportPayload } = loadModule();
  const r = parseImportPayload(JSON.stringify({ schema: 1, app: "LittleLingos", saved: [SAVED_A] }));
  assert.equal(r.ok, true);
  assert.equal(r.payload.age, null, "absent age must be explicit null, never undefined-by-accident");
});

// ══ 4. 合并：不能把本机已有的覆盖掉 ═════════════════════════════════════

test("restoring onto an empty device brings everything back", () => {
  const { mergeSaved } = loadModule();
  const { merged, added, skipped } = mergeSaved([], [SAVED_A, SAVED_B]);
  assert.equal(merged.length, 2);
  assert.equal(added, 2);
  assert.equal(skipped, 0);
});

test("an id already on this device is kept as-is — the backup never overwrites newer local progress", () => {
  const { mergeSaved } = loadModule();
  const localNewer = { ...SAVED_A, rv: { s: 4, due: 99999 } };
  const { merged, added, skipped } = mergeSaved([localNewer], [SAVED_A]);
  assert.equal(merged.length, 1);
  assert.equal(added, 0);
  assert.equal(skipped, 1);
  assert.deepEqual(merged[0].rv, { s: 4, due: 99999 }, "local review progress must win over the backup's older copy");
});

test("merging two devices keeps both sets, no duplicates", () => {
  const { mergeSaved } = loadModule();
  const { merged, added, skipped } = mergeSaved([SAVED_A], [SAVED_B, SAVED_C]);
  assert.equal(merged.length, 3);
  assert.equal(added, 2);
  assert.equal(skipped, 0);
  assert.deepEqual(merged.map(x => x.id).sort(), ["b01", "t_1725000000000", "w_bedtime"]);
});

test("merge does not mutate the array it was handed", () => {
  const { mergeSaved } = loadModule();
  const existing = [SAVED_A];
  mergeSaved(existing, [SAVED_B]);
  assert.equal(existing.length, 1, "the caller's live savedPhrases must not change under it");
});

test("merge survives a corrupt local array (the app's own defensive parse can yield junk)", () => {
  const { mergeSaved } = loadModule();
  const { merged, added } = mergeSaved([null, 42, SAVED_A], [SAVED_B]);
  assert.equal(added, 1);
  assert.deepEqual(merged.map(x => x.id).sort(), ["b01", "t_1725000000000"]);
});

// ══ 5. 导入后要说清楚发生了什么 ═════════════════════════════════════════

test("merge reports how many were added and how many skipped, so the parent is never left guessing", () => {
  const { mergeSaved } = loadModule();
  const r = mergeSaved([SAVED_A], [SAVED_A, SAVED_B, SAVED_C]);
  assert.equal(r.added, 2);
  assert.equal(r.skipped, 1);
  assert.equal(r.added + r.skipped, 3, "every incoming record is accounted for as either added or skipped");
});

// ── Runner ───────────────────────────────────────────────
console.log("data-export tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
