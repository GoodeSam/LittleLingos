#!/usr/bin/env node
// Behavioral tests for the CSV backup format in index.html (ll:data-export).
// Same extraction idiom as test/data-export.test.mjs.
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   1. 家长导出一份备份，想用 Excel 或 Numbers 打开看看里面到底有什么。
//      打开后中文不能是乱码，句子不能串行——哪怕句子里本来就有逗号和引号。
//
//   2. 那份表格必须能原样导回来。复习进度、收藏时间一个都不能少，
//      否则"备份"只是一张看着好看、救不了命的清单。
//
//   3. 家长可能用 Excel 打开后随手保存了一下。表格软件会悄悄改动内容
//      （把长数字变成科学计数法、去掉前导零）。这种情况要么能撑住，
//      要么要说清楚"这份文件被改坏了"，不能装作没事把坏数据写进去。
//
//   4. 三种收藏（场景短语、AI 翻译、生词）字段各不相同。
//      表格的列必须是固定的一套，缺的留空——不能这一行 8 列下一行 11 列。
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import assert from "node:assert/strict";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");

const START = "/* ll:data-export:start */";
const END = "/* ll:data-export:end */";

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// See test/data-export.test.mjs for why this exists: vm.createContext() gives
// the module its own prototypes, so deepStrictEqual reports "same structure
// but not reference-equal" for anything the module rebuilt internally.
// Needed here on every CSV parse result — parseCsvBackup() constructs all of
// its output inside the vm.
const sameRealm = v => structuredClone(v);

function loadModule() {
  const s = html.indexOf(START), e = html.indexOf(END);
  assert.ok(s !== -1 && e !== -1, `index.html must contain ${START} … ${END} markers`);
  const ctx = { console };
  vm.createContext(ctx);
  vm.runInContext(html.slice(s, e + END.length), ctx);
  assert.equal(typeof ctx.buildCsvBackup, "function", "module must define buildCsvBackup()");
  assert.equal(typeof ctx.parseCsvBackup, "function", "module must define parseCsvBackup()");
  return ctx;
}

// ── Fixtures: one of each of the three saved shapes ───────────────────
const PHRASE = {
  id: "b21", en: "Can you wash your tummy?", zh: "你能洗肚肚吗？",
  scenario: "bath", age: "2-3", tier: "basic",
  tip: "把宝宝的小手放到肚子上", why: "自主行动强化记忆", next: "Good job!", fallback: "先指自己",
  savedAt: 1725000000000, rv: { s: 2, due: 1725600000000 },
};
const TRANSLATION = {
  id: "t_1725000000000", en: "Don't step on it.", zh: "别踩上去",
  tip: "", scenario: "__translate__", age: "2-3", source: "gemini",
  savedAt: 1725000001000, rv: { s: 0, due: 1725000001000 },
};
const DICT = {
  id: "w_bedtime", en: "bedtime", zh: "就寝时间", tip: "n. 就寝时间",
  scenario: "__dict__", senseLabel: "就寝时间",
  savedAt: 1725000002000, rv: { s: 1, due: 1725900000000 },
};

// ══ 1. 表格软件能正确打开 ═══════════════════════════════════════════════

test("file starts with a BOM — without it Excel renders every Chinese field as mojibake", () => {
  const { buildCsvBackup } = loadModule();
  const csv = buildCsvBackup({ saved: [PHRASE], age: "2-3" });
  assert.equal(csv.charCodeAt(0), 0xFEFF);
});

test("first data line is a header row naming every column", () => {
  const { buildCsvBackup } = loadModule();
  const csv = buildCsvBackup({ saved: [], age: "2-3" });
  const header = csv.replace(/^﻿/, "").split("\r\n")[0];
  for (const col of ["id", "en", "zh", "scenario", "age", "savedAt", "rv_s", "rv_due"]) {
    assert.ok(header.includes(col), `header must name the ${col} column`);
  }
});

test("rows end with CRLF — the line ending the CSV spec and Excel both expect", () => {
  const { buildCsvBackup } = loadModule();
  const csv = buildCsvBackup({ saved: [PHRASE], age: "2-3" });
  assert.ok(csv.includes("\r\n"));
});

test("a comma inside a phrase does not split it into two columns", () => {
  const { buildCsvBackup, parseCsvBackup } = loadModule();
  const item = { ...PHRASE, en: "Let's wash your hands first, then snack!" };
  const back = parseCsvBackup(buildCsvBackup({ saved: [item], age: "2-3" }));
  assert.equal(back.ok, true, back.error);
  assert.equal(back.payload.saved[0].en, "Let's wash your hands first, then snack!");
});

test("a double quote inside a phrase survives (doubled per the CSV spec)", () => {
  const { buildCsvBackup, parseCsvBackup } = loadModule();
  const item = { ...PHRASE, zh: '他说"不要"，然后跑开了' };
  const back = parseCsvBackup(buildCsvBackup({ saved: [item], age: "2-3" }));
  assert.equal(back.ok, true, back.error);
  assert.equal(back.payload.saved[0].zh, '他说"不要"，然后跑开了');
});

test("a newline inside a tip does not break the row apart", () => {
  const { buildCsvBackup, parseCsvBackup } = loadModule();
  const item = { ...PHRASE, tip: "第一步：放手\n第二步：等他点头" };
  const back = parseCsvBackup(buildCsvBackup({ saved: [item], age: "2-3" }));
  assert.equal(back.ok, true, back.error);
  assert.equal(back.payload.saved[0].tip, "第一步：放手\n第二步：等他点头");
  assert.equal(back.payload.saved.length, 1, "the embedded newline must not be read as a second record");
});

// ══ 2. 表格能原样导回来 ═════════════════════════════════════════════════
// 这是最重要的一组。备份不算数，恢复成功才算数。

test("round trip: a scenario phrase comes back with every field intact", () => {
  const { buildCsvBackup, parseCsvBackup } = loadModule();
  const back = parseCsvBackup(buildCsvBackup({ saved: [PHRASE], age: "2-3" }));
  assert.equal(back.ok, true, back.error);
  assert.deepEqual(sameRealm(back.payload.saved[0]), PHRASE);
});

test("round trip: an AI translation keeps its source field", () => {
  const { buildCsvBackup, parseCsvBackup } = loadModule();
  const back = parseCsvBackup(buildCsvBackup({ saved: [TRANSLATION], age: "2-3" }));
  assert.equal(back.ok, true, back.error);
  assert.deepEqual(sameRealm(back.payload.saved[0]), TRANSLATION);
});

test("round trip: a dictionary word keeps its senseLabel and stays age-less", () => {
  const { buildCsvBackup, parseCsvBackup } = loadModule();
  const back = parseCsvBackup(buildCsvBackup({ saved: [DICT], age: "2-3" }));
  assert.equal(back.ok, true, back.error);
  assert.deepEqual(sameRealm(back.payload.saved[0]), DICT);
});

test("round trip: all three shapes together, in order", () => {
  const { buildCsvBackup, parseCsvBackup } = loadModule();
  const all = [PHRASE, TRANSLATION, DICT];
  const back = parseCsvBackup(buildCsvBackup({ saved: all, age: "2-3" }));
  assert.equal(back.ok, true, back.error);
  assert.equal(back.payload.saved.length, 3);
  assert.deepEqual(sameRealm(back.payload.saved), all);
});

test("review progress survives as numbers, not as text — text would break the due-date maths", () => {
  const { buildCsvBackup, parseCsvBackup } = loadModule();
  const back = parseCsvBackup(buildCsvBackup({ saved: [PHRASE], age: "2-3" }));
  const r = back.payload.saved[0];
  assert.equal(typeof r.rv.s, "number");
  assert.equal(typeof r.rv.due, "number");
  assert.equal(typeof r.savedAt, "number");
  assert.equal(r.rv.due, 1725600000000);
});

test("the age-band setting rides along and comes back", () => {
  const { buildCsvBackup, parseCsvBackup } = loadModule();
  const back = parseCsvBackup(buildCsvBackup({ saved: [], age: "3-6" }));
  assert.equal(back.ok, true, back.error);
  assert.equal(back.payload.age, "3-6");
});

test("an empty library still produces a valid file with a header", () => {
  const { buildCsvBackup, parseCsvBackup } = loadModule();
  const back = parseCsvBackup(buildCsvBackup({ saved: [], age: "0-1" }));
  assert.equal(back.ok, true, back.error);
  assert.deepEqual(sameRealm(back.payload.saved), []);
});

// ══ 3. 被表格软件改坏的文件 ═════════════════════════════════════════════

test("a timestamp Excel mangled into scientific notation is rejected, not silently written in", () => {
  const { buildCsvBackup, parseCsvBackup } = loadModule();
  const csv = buildCsvBackup({ saved: [PHRASE], age: "2-3" });
  const damaged = csv.replace("1725600000000", "1.7256E+12");
  const back = parseCsvBackup(damaged);
  assert.equal(back.ok, true, "the file as a whole is still readable");
  assert.equal(back.payload.saved.length, 0, "but the record with an unusable due date must be dropped");
  assert.equal(back.payload.dropped, 1, "and the parent must be told one was dropped");
});

test("a row with fewer columns than the header is dropped, not silently misaligned", () => {
  const { buildCsvBackup, parseCsvBackup } = loadModule();
  const csv = buildCsvBackup({ saved: [PHRASE, TRANSLATION], age: "2-3" });
  const lines = csv.split("\r\n");
  lines[2] = "b99,oops";                       // truncated data row
  const back = parseCsvBackup(lines.join("\r\n"));
  assert.equal(back.ok, true);
  assert.equal(back.payload.dropped, 1);
  assert.equal(back.payload.saved.length, 1, "the intact record still restores");
});

test("a row with no id is dropped — an unkeyed record would duplicate on every restore", () => {
  const { buildCsvBackup, parseCsvBackup } = loadModule();
  const csv = buildCsvBackup({ saved: [PHRASE], age: "2-3" });
  // Blank the id cell by rebuilding the row, rather than string-replacing a
  // bare `b21,`: every field is quoted, so a raw substitution silently
  // matches nothing and the test would pass without testing anything.
  const lines = csv.split("\r\n");
  const dataIdx = lines.findIndex(l => l.includes('"b21"'));
  assert.ok(dataIdx > 0, "fixture row must be present to damage");
  lines[dataIdx] = lines[dataIdx].replace('"b21"', '""');
  const back = parseCsvBackup(lines.join("\r\n"));
  assert.equal(back.payload.saved.length, 0);
  assert.equal(back.payload.dropped, 1);
});

// ══ 6. 行类型：设置行是合法的一行，不是坏数据 ═══════════════════════════

test("the settings row is not counted as damage — it is a valid row, not a broken record", () => {
  const { buildCsvBackup, parseCsvBackup } = loadModule();
  const back = parseCsvBackup(buildCsvBackup({ saved: [PHRASE], age: "2-3" }));
  assert.equal(back.ok, true, back.error);
  assert.equal(back.payload.dropped, 0, "a clean file must report zero damage");
  assert.equal(back.payload.saved.length, 1, "and the settings row must not become a saved phrase");
});

test("an empty library still carries the age band — a parent who kept only the CSV must get it back", () => {
  const { buildCsvBackup, parseCsvBackup } = loadModule();
  const back = parseCsvBackup(buildCsvBackup({ saved: [], age: "3-6" }));
  assert.equal(back.ok, true, back.error);
  assert.equal(back.payload.age, "3-6");
  assert.deepEqual(sameRealm(back.payload.saved), []);
  assert.equal(back.payload.dropped, 0);
});

test("every row is tagged with its kind, so the reader never has to guess from shape", () => {
  const { buildCsvBackup } = loadModule();
  const csv = buildCsvBackup({ saved: [PHRASE, TRANSLATION, DICT], age: "2-3" });
  const rows = csv.replace(/^﻿/, "").split("\r\n").filter(Boolean);
  assert.ok(rows[0].startsWith('"rowType"'), "rowType must be the first column");
  const kinds = rows.slice(1).map(r => r.slice(0, r.indexOf(",")));
  assert.deepEqual(kinds, ['"meta"', '"phrase"', '"translation"', '"dictionary"']);
});

// ══ 4. 拒绝不是备份的文件 ═══════════════════════════════════════════════

test("a CSV from some other app is refused by its header, not half-imported", () => {
  const { parseCsvBackup } = loadModule();
  const r = parseCsvBackup("﻿name,email\r\nBob,bob@example.com\r\n");
  assert.equal(r.ok, false);
  assert.equal(r.error, "wrong-columns");
});

test("an empty file is refused", () => {
  const { parseCsvBackup } = loadModule();
  assert.equal(parseCsvBackup("").ok, false);
  assert.equal(parseCsvBackup("﻿").ok, false);
});

test("a JSON backup fed to the CSV reader is refused rather than parsed as one long row", () => {
  const { parseCsvBackup } = loadModule();
  const r = parseCsvBackup('{"schema":1,"app":"LittleLingos","saved":[]}');
  assert.equal(r.ok, false);
  assert.equal(r.error, "wrong-columns");
});

test("a file with a valid header but no data rows restores nothing and says so", () => {
  const { buildCsvBackup, parseCsvBackup } = loadModule();
  const header = buildCsvBackup({ saved: [], age: "2-3" });
  const r = parseCsvBackup(header);
  assert.equal(r.ok, true);
  assert.deepEqual(sameRealm(r.payload.saved), []);
  assert.equal(r.payload.dropped, 0);
});

// ══ 5. 列必须固定 ═══════════════════════════════════════════════════════

test("every row has the same column count as the header, whatever the record shape", () => {
  const { buildCsvBackup } = loadModule();
  const csv = buildCsvBackup({ saved: [PHRASE, TRANSLATION, DICT], age: "2-3" });
  const rows = csv.replace(/^﻿/, "").split("\r\n").filter(Boolean);
  // Count top-level commas — none of these fixtures contain a comma or quote,
  // so a plain split is a fair column count here.
  const widths = new Set(rows.map(r => r.split(",").length));
  assert.equal(widths.size, 1, `all rows must have equal width, saw ${[...widths].join("/")}`);
});

test("a field absent from a record exports as empty and returns absent, not as the string 'undefined'", () => {
  const { buildCsvBackup, parseCsvBackup } = loadModule();
  const csv = buildCsvBackup({ saved: [DICT], age: "2-3" });
  assert.ok(!csv.includes("undefined"), "the literal text 'undefined' must never reach the file");
  const back = parseCsvBackup(csv);
  assert.ok(!("age" in back.payload.saved[0]), "a dictionary word has no age band; it must not come back with an empty one");
  assert.ok(!("why" in back.payload.saved[0]));
});

test("an empty string that IS the stored value survives — 'absent' and 'present but empty' are different states", () => {
  const { buildCsvBackup, parseCsvBackup } = loadModule();
  // A saved AI translation carries tip:"" whenever the API returned no tip
  // (saveTranslation writes `tip: r.tip || ""`). Reading that back as "field
  // absent" would make the round trip lossy — and which state applies is
  // decided by the row's kind, not by guessing from the empty cell.
  const back = parseCsvBackup(buildCsvBackup({ saved: [TRANSLATION], age: "2-3" }));
  assert.ok("tip" in back.payload.saved[0], "a translation's tip column is part of its shape even when empty");
  assert.equal(back.payload.saved[0].tip, "");
});

// ── Runner ───────────────────────────────────────────────
console.log("data-export CSV tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
