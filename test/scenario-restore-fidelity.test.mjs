#!/usr/bin/env node
// Behavioral tests for a backup restore keeping phrases in the scenario they
// belong to — the two ways the first version quietly failed to.
//
// Zero-dependency: the ll:data-export block is extracted from index.html and
// run in a vm context, per test/backup-scenarios.test.mjs.
//
// TWO FAILURES THIS FILE EXISTS FOR, both found by review rather than by a
// failing test, and both silent:
//
//   1. SAME NAME, DIFFERENT ID. A parent has 「去医院」 on their phone and
//      restores a backup from a tablet that also has 「去医院」, created
//      separately, so a different id. mergeScenarios rightly keeps one tile —
//      but the incoming phrases still carried the tablet's id, found no
//      scenario under it, and were filed into 全部收藏. The phrase and its
//      review progress survived; the grouping the parent made did not.
//
//   2. CSV WAS A LOSSY RESTORE. The CSV carried each phrase's scenario column
//      but had nowhere for the scenario's name, so restoring from CSV always
//      dropped every self-made grouping. The format already has a rowType
//      column with four kinds — it was built to be extended, and a fifth kind
//      costs less than accepting a lossy restore.
//
// ⚠️ 跨 realm：vm 里造的数组原型和宿主不同，deepEqual 会判不等。先搬回来再比。
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   1. 家长在手机和平板上都建过「去医院」。他把平板的备份恢复到手机上——
//      平板那几句话应该进手机的「去医院」，而不是散进全部收藏。
//
//   2. 他导出的表格文件，恢复回来之后场景照样在。
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

function loadModule() {
  const s = html.indexOf(START), e = html.indexOf(END);
  const ctx = { console, structuredClone };
  vm.createContext(ctx);
  vm.runInContext(html.slice(s, e + END.length), ctx);
  return ctx;
}

const SC = (id, name = "去医院") => ({ id, name, icon: "🏥", createdAt: 1 });
const P = (id, scenario) =>
  ({ id, en: id, zh: id, scenario, savedAt: 1, rv: { s: 3, due: 999 } });

// ══ 1. 同名不同 id：句子要归到本机那个 ═══════════════════════════════

test("平板上的「去医院」恢复到手机，句子进手机那个同名场景", async () => {
  // 这一条是本文件存在的第一个理由。归错了不会报错、不会丢句子 ——
  // 只是家长自己整理出来的分组悄悄没了。
  const ctx = loadModule();
  const m = ctx.mergeScenarios([SC("s_a")], [SC("s_b")]);
  assert.equal(m.merged.length, 1, "同名只留一个，别让家长看到两个一样的格子");
  const phrases = [P("t_1", "custom_s_b")];
  ctx.applyScenarioAliases(phrases, m.aliases);
  ctx.healScenarioTags(phrases, m.merged);
  assert.equal(phrases[0].scenario, "custom_s_a",
    "必须归到本机那个同名场景，而不是掉进通用桶");
  assert.equal(phrases[0].rv.s, 3, "复习进度一并保住");
});

test("合并时会给出「这个 id 换成那个 id」的对照表", async () => {
  const ctx = loadModule();
  const m = ctx.mergeScenarios([SC("s_a")], [SC("s_b")]);
  assert.ok(m.aliases, "没有对照表的话，句子那一端无从知道该改成什么");
  assert.equal(m.aliases["custom_s_b"], "custom_s_a");
});

test("id 就相同的，不需要改写", async () => {
  const ctx = loadModule();
  const m = ctx.mergeScenarios([SC("s_a")], [SC("s_a")]);
  const phrases = [P("t_1", "custom_s_a")];
  ctx.applyScenarioAliases(phrases, m.aliases);
  assert.equal(phrases[0].scenario, "custom_s_a");
});

test("名字不同的场景，各归各的，不会被错认成同一个", async () => {
  const ctx = loadModule();
  const m = ctx.mergeScenarios([SC("s_a", "去医院")], [SC("s_b", "外婆家")]);
  assert.equal(m.merged.length, 2, "两个不同的场景都该在");
  const phrases = [P("t_1", "custom_s_b")];
  ctx.applyScenarioAliases(phrases, m.aliases);
  ctx.healScenarioTags(phrases, m.merged);
  assert.equal(phrases[0].scenario, "custom_s_b", "它自己的场景被收进来了，不该改写");
});

test("对照表是空的、或者句子列表是空的，都不出错", async () => {
  const ctx = loadModule();
  for (const [ps, al] of [[null, {}], [[], null], [[P("a", "custom_x")], null]]) {
    assert.doesNotThrow(() => ctx.applyScenarioAliases(ps, al));
  }
  const m = ctx.mergeScenarios([SC("s_a")], [SC("s_b")]);
  const phrases = [P("t_1", "custom_s_b")];
  ctx.applyScenarioAliases(phrases, m.aliases);
  assert.equal(phrases[0].scenario, "custom_s_a", "对照：有对照表时必须真的改写");
});

// ══ 2. CSV 也要带上场景 ═══════════════════════════════════════════════

test("导出的表格里有场景那几行", async () => {
  // rowType 这一列本来就是为扩展留的（meta / phrase / translation /
  // dictionary），加第五种比接受一次有损恢复便宜得多。
  const ctx = loadModule();
  const csv = ctx.buildCsvBackup({ saved: [P("t_1", "custom_s_1")], age: "1-2", scenarios: [SC("s_1")] });
  // 匹配的必须是「以 scenario 开头的那一行」。只写 /"scenario"/ 的话，
  // 表头里那个同名的列会让它永远通过 —— 第一版就是这么蒙对的。
  const rows = csv.split("\r\n");
  assert.ok(rows.some(r => r.startsWith('"scenario",')),
    "没有场景行的话，表格恢复必然丢掉自建场景");
  assert.match(csv, /去医院/);
});

test("表格恢复回来，场景和句子都在，句子还在那个场景里", async () => {
  const ctx = loadModule();
  const csv = ctx.buildCsvBackup({ saved: [P("t_1", "custom_s_1")], age: "1-2", scenarios: [SC("s_1")] });
  const r = ctx.parseCsvBackup(csv);
  assert.equal(r.ok, true, r.error);
  assert.equal(r.payload.scenarios.length, 1, "场景要回来");
  assert.equal(r.payload.scenarios[0].name, "去医院");
  assert.equal(r.payload.saved.length, 1);
  assert.equal(r.payload.saved[0].scenario, "custom_s_1", "句子仍然归在那个场景下");
});

test("没有自建场景时，表格照旧，不多出空行", async () => {
  const ctx = loadModule();
  const csv = ctx.buildCsvBackup({ saved: [P("t_1", "__translate__")], age: "1-2" });
  const rows2 = csv.split("\r\n");
  assert.ok(!rows2.some(r => r.startsWith('"scenario",')), "没有场景就不该有场景行");
  const r = ctx.parseCsvBackup(csv);
  assert.equal(r.ok, true, r.error);
  assert.deepEqual([...r.payload.scenarios], []);
});

test("旧的表格文件（没有场景行）仍然能导入", async () => {
  // 家长手里可能有做这个功能之前导出的表格。
  const ctx = loadModule();
  // 真实的旧文件带的是那一版完整的列表头（没有 name / icon 两列）。
  const oldCols = ["rowType","id","en","zh","scenario","age","tier",
    "tip","why","next","fallback","senseLabel","source",
    "savedAt","rv_s","rv_due","currentAge"];
  const cell = v => '"' + String(v).replace(/"/g, '""') + '"';
  const line = obj => oldCols.map(c => cell(obj[c] === undefined ? "" : obj[c])).join(",");
  const old = [
    oldCols.map(cell).join(","),
    line({ rowType: "meta", currentAge: "1-2" }),
    line({ rowType: "translation", id: "t_1", en: "Be brave.", zh: "别怕",
           scenario: "__translate__", age: "1-2", savedAt: 1, rv_s: 0, rv_due: 1 }),
  ].join("\r\n");
  const r = ctx.parseCsvBackup(old);
  assert.equal(r.ok, true, r.error);
  assert.ok(Array.isArray(r.payload.scenarios));
  assert.equal(r.payload.saved.length, 1, "句子照常回来");
});

test("场景行缺字段时跳过它，而不是整份表格作废", async () => {
  const ctx = loadModule();
  const csv = ctx.buildCsvBackup({
    saved: [], age: null,
    scenarios: [SC("s_1"), { id: "s_2" }, { name: "没 id" }],
  });
  const r = ctx.parseCsvBackup(csv);
  assert.equal(r.ok, true, r.error);
  assert.equal(r.payload.scenarios.length, 1);
});

// ══ 3. 恢复那条路真的接上了 ═══════════════════════════════════════════

test("恢复时先按对照表改写，再判断谁是孤儿", async () => {
  // 顺序反了的话，本该归到同名场景的句子会先被判成孤儿摘掉标签。
  const at = html.indexOf("const sc = mergeScenarios(");
  assert.ok(at !== -1, "导入时的场景合并没找到");
  const body = html.slice(at, at + 1200);
  const alias = body.indexOf("applyScenarioAliases(");
  const heal = body.indexOf("healScenarioTags(");
  assert.ok(alias !== -1, "没有改写这一步，同名场景的句子会掉进通用桶");
  assert.ok(heal !== -1);
  assert.ok(alias < heal, "改写必须排在判孤儿之前");
});

test("导出表格时把场景传了进去", async () => {
  const at = html.indexOf("buildCsvBackup({");
  assert.ok(at !== -1, "buildCsvBackup 的调用点没找到");
  const call = html.slice(at, at + 240);
  assert.match(call, /scenarios/, "不传的话，导出的表格里根本没有场景行");
});

console.log("scenario restore fidelity tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
