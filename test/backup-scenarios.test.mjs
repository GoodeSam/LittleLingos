#!/usr/bin/env node
// Behavioral tests for custom scenarios riding along in the backup.
//
// Zero-dependency: the ll:data-export block is extracted from index.html and
// run in a vm context, per test/data-export.test.mjs (which covers the phrase
// half and stays untouched).
//
// WHY THIS IS NOT OPTIONAL. A phrase carries `scenario: "custom_<id>"`. Export
// the phrases without the scenario definitions and a restore produces items
// pointing at a scenario that does not exist — the sentences survive in the
// data and vanish from the screen. Worse than losing them outright, because
// the parent has no way to tell anything is wrong.
//
// THE SCHEMA NUMBER DOES NOT CHANGE. parseImportPayload() refuses a schema it
// does not recognise, on purpose: guessing at an unknown shape writes garbage
// into the only copy of a parent's data. So `scenarios` is added as an
// OPTIONAL field. An old file without it restores fine (no custom scenarios);
// a new file opened by an older build has the field ignored. Bumping the
// number instead would have rejected the backup Victor already has on disk.
//
// ⚠️ 跨 realm：vm 里造的数组原型和宿主不同，deepEqual 会判不等。凡是从 vm
// 拿回来的，先搬回宿主 realm 再比。
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   1. 家长换手机，恢复备份 —— 自己建的场景和里面的句子一起回来。
//
//   2. 他手里那个旧备份文件（做这个功能之前导的）仍然能导入。
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

const PHRASE = (over = {}) => ({
  id: "t_1", en: "Be brave.", zh: "勇敢点", scenario: "custom_s_1",
  savedAt: 1, rv: { s: 2, due: 111 }, ...over,
});
const SCENARIO = (over = {}) => ({ id: "s_1", name: "去医院", icon: "🏥", createdAt: 1, ...over });

function loadModule() {
  const s = html.indexOf(START), e = html.indexOf(END);
  assert.ok(s !== -1 && e !== -1, `index.html must contain ${START} … ${END} markers`);
  const ctx = { console, structuredClone };
  vm.createContext(ctx);
  vm.runInContext(html.slice(s, e + END.length), ctx);
  for (const fn of ["buildExportPayload", "parseImportPayload", "mergeScenarios"]) {
    assert.equal(typeof ctx[fn], "function", `module must define ${fn}()`);
  }
  return ctx;
}

// ══ 1. 导出带上场景 ═══════════════════════════════════════════════════

test("导出的文件里有自己建的场景", async () => {
  const ctx = loadModule();
  const out = ctx.buildExportPayload({ saved: [PHRASE()], age: "1-2", scenarios: [SCENARIO()] });
  assert.ok(Array.isArray(out.scenarios), "没有这个字段的话，恢复出来的句子会指向一个不存在的场景");
  assert.equal(out.scenarios.length, 1);
  assert.equal(out.scenarios[0].name, "去医院");
  assert.equal(out.scenarios[0].id, "s_1", "id 必须原样带走 —— 句子靠它认门");
});

test("没有自建场景时，导出的是空列表而不是缺字段", async () => {
  const ctx = loadModule();
  const out = ctx.buildExportPayload({ saved: [PHRASE()], age: "1-2" });
  assert.ok(Array.isArray(out.scenarios), "缺字段和空列表，导入方要分别处理两次");
  assert.equal(out.scenarios.length, 0);
});

test("schema 号没有变 —— 旧版本导出的文件仍然认得", async () => {
  const ctx = loadModule();
  const out = ctx.buildExportPayload({ saved: [], age: null });
  assert.equal(out.schema, 1, "改号会让家长手里已有的备份文件全部被拒绝导入");
});

// ══ 2. 旧备份仍然能导入 ═══════════════════════════════════════════════

test("做这个功能之前导出的旧文件，照样能导入", async () => {
  // Victor 手里就有一个（2026-09-02）。让它导不进去，等于把一次功能新增
  // 变成一次数据丢失。
  const ctx = loadModule();
  const old = JSON.stringify({
    schema: 1, app: "LittleLingos", exportedAt: "2026-09-02T00:00:00.000Z",
    age: "1-2", saved: [PHRASE({ scenario: "__translate__" })],
    // 注意：没有 scenarios 字段
  });
  const r = ctx.parseImportPayload(old);
  assert.equal(r.ok, true, r.error);
  assert.ok(Array.isArray(r.payload.scenarios), "缺字段要补成空列表，调用方才不用各自判空");
  assert.equal(r.payload.scenarios.length, 0);
  assert.equal(r.payload.saved.length, 1, "句子照常回来");
});

test("新文件导入时，场景跟着回来", async () => {
  const ctx = loadModule();
  const text = JSON.stringify(ctx.buildExportPayload({
    saved: [PHRASE()], age: "1-2", scenarios: [SCENARIO()],
  }));
  const r = ctx.parseImportPayload(text);
  assert.equal(r.ok, true, r.error);
  assert.equal(r.payload.scenarios.length, 1);
  assert.equal(r.payload.scenarios[0].name, "去医院");
});

test("scenarios 字段是个乱七八糟的东西时，当作没有，而不是整份备份作废", async () => {
  // 备份是家长唯一的一份副本。因为一个附加字段坏了就拒绝整份文件，
  // 是拿他的句子去赌一个次要字段。
  const ctx = loadModule();
  for (const junk of ['"字符串"', "123", "null", '{"a":1}']) {
    const text = `{"schema":1,"app":"LittleLingos","age":null,"saved":[],"scenarios":${junk}}`;
    const r = ctx.parseImportPayload(text);
    assert.equal(r.ok, true, `${junk}: ${r.error}`);
    assert.deepEqual([...r.payload.scenarios], []);
  }
});

test("场景列表里混进缺字段的条目，跳过它而不是拒绝整份备份", async () => {
  const ctx = loadModule();
  const text = JSON.stringify({
    schema: 1, app: "LittleLingos", age: null, saved: [],
    scenarios: [SCENARIO(), { id: "s_2" }, { name: "没 id" }, null],
  });
  const r = ctx.parseImportPayload(text);
  assert.equal(r.ok, true, r.error);
  assert.equal(r.payload.scenarios.length, 1);
});

// ══ 3. 合并：恢复不能覆盖掉这台设备上已有的 ═══════════════════════════

test("恢复时，这台设备上已有的场景不被覆盖", async () => {
  // 和句子的合并同一个立场：导入是「补上缺的」，不是「换成文件里的」。
  const ctx = loadModule();
  const existing = [SCENARIO({ id: "s_1", name: "本机改过的名字" })];
  const incoming = [SCENARIO({ id: "s_1", name: "文件里的旧名字" }), SCENARIO({ id: "s_2", name: "外婆家" })];
  const r = ctx.mergeScenarios(existing, incoming);
  assert.equal(r.merged.length, 2);
  assert.equal(r.merged.find(x => x.id === "s_1").name, "本机改过的名字", "已有的不动");
  assert.ok(r.merged.some(x => x.id === "s_2"), "缺的补上");
  assert.equal(r.added, 1);
  assert.equal(r.skipped, 1, "调用方要能告诉家长「加入 1 个、跳过 1 个」");
});

test("重名但 id 不同的两个场景，也算已经有了", async () => {
  // 同一个场景在两台设备上各建了一次，id 不同名字相同。都收进来的话，
  // 家长会看到两个一模一样的格子。
  const ctx = loadModule();
  const r = ctx.mergeScenarios([SCENARIO({ id: "s_a", name: "去医院" })],
                               [SCENARIO({ id: "s_b", name: "去医院" })]);
  assert.equal(r.merged.length, 1);
  assert.equal(r.skipped, 1);
});

test("合并的两边有一边是空的，也不出错", async () => {
  const ctx = loadModule();
  assert.equal(ctx.mergeScenarios([], [SCENARIO()]).merged.length, 1);
  assert.equal(ctx.mergeScenarios([SCENARIO()], []).merged.length, 1);
  assert.equal(ctx.mergeScenarios(null, null).merged.length, 0);
});

// ── Runner ───────────────────────────────────────────────
console.log("backup-scenarios tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
