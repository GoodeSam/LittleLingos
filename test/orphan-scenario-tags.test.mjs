#!/usr/bin/env node
// Behavioral tests for phrases that come back pointing at a scenario that
// isn't there.
//
// Zero-dependency: the ll:data-export block is extracted from index.html and
// run in a vm context, per test/backup-scenarios.test.mjs.
//
// HOW THIS HAPPENS, and it is not hypothetical:
//
//   · A CSV backup carries each phrase's `scenario` column — including
//     custom_<id> — but the CSV format has nowhere to put the scenario's name
//     and icon. Restore from CSV and every phrase from a self-made scenario
//     comes back tagged for one that does not exist.
//
//   · A JSON backup whose `scenarios` field was damaged is deliberately read
//     as "no custom scenarios" rather than rejected outright — a backup is the
//     parent's only copy and refusing it over a secondary field gambles their
//     sentences. Same outcome for the phrases.
//
// They are not lost either way: 全部收藏 shows everything. But they carry a
// tag nothing answers to, and a scenario the parent recreates later gets a
// fresh id — so the old phrases never rejoin it. Healing on import is the
// same move deleteCustomScenario() already makes: drop the tag, keep the
// phrase, keep its review progress.
//
// ⚠️ 跨 realm：vm 里造的数组原型和宿主不同，deepEqual 会判不等。先搬回来再比。
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   家长换手机、恢复备份。自建场景要么整个回来，要么那些句子干干净净地
//   躺在「全部收藏」里 —— 不能留下一批指着空气的句子。
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
  assert.equal(typeof ctx.healScenarioTags, "function", "module must define healScenarioTags()");
  return ctx;
}

const P = (id, scenario, over = {}) =>
  ({ id, en: id, zh: id, scenario, savedAt: 1, rv: { s: 3, due: 999 }, ...over });
const SC = id => ({ id, name: "场景" + id, icon: "🏥", createdAt: 1 });

// ══ 1. 指着不存在的场景，就把标签摘掉 ═════════════════════════════════

test("场景没跟着回来的句子，标签被摘掉而不是留着指空气", async () => {
  const ctx = loadModule();
  const r = ctx.healScenarioTags([P("a", "custom_s_1")], []);
  assert.equal(r.phrases[0].scenario, "__translate__", "留着的话，它指向的东西永远不存在");
  assert.equal(r.healed, 1, "调用方要能告诉家长有几条改了归属");
});

test("句子本身一点没变 —— 复习进度、内容都在", async () => {
  // 每一句都花钱生成过语音，还带着几个月的复习进度。摘标签是整理，
  // 不是重置。
  const ctx = loadModule();
  const r = ctx.healScenarioTags([P("a", "custom_s_1", { tip: "蹲下来说" })], []);
  const p = r.phrases[0];
  assert.equal(p.id, "a");
  assert.equal(p.en, "a");
  assert.equal(p.tip, "蹲下来说");
  assert.equal(p.rv.s, 3, "复习进度必须原样保住");
  assert.equal(p.rv.due, 999);
});

test("场景真的回来了的，标签一动不动", async () => {
  const ctx = loadModule();
  const r = ctx.healScenarioTags([P("a", "custom_s_1")], [SC("s_1")]);
  assert.equal(r.phrases[0].scenario, "custom_s_1", "场景在，就不该动它");
  assert.equal(r.healed, 0);
});

test("一批里有的有场景、有的没有，各归各的", async () => {
  const ctx = loadModule();
  const r = ctx.healScenarioTags(
    [P("a", "custom_s_1"), P("b", "custom_s_9"), P("c", "__translate__"), P("d", "bedtime")],
    [SC("s_1")]);
  const by = Object.fromEntries(r.phrases.map(p => [p.id, p.scenario]));
  assert.equal(by.a, "custom_s_1", "场景在的不动");
  assert.equal(by.b, "__translate__", "场景不在的摘掉");
  assert.equal(by.c, "__translate__", "本来就是通用的不动");
  assert.equal(by.d, "bedtime", "预设场景的一律不碰");
  assert.equal(r.healed, 1);
});

test("预设场景的句子永远不碰 —— 它们不归这个机制管", async () => {
  const ctx = loadModule();
  const r = ctx.healScenarioTags([P("a", "bedtime"), P("b", "__dict__")], []);
  assert.equal(r.phrases[0].scenario, "bedtime");
  assert.equal(r.phrases[1].scenario, "__dict__");
  assert.equal(r.healed, 0);
});

// ══ 2. 边界 ═══════════════════════════════════════════════════════════

test("空的、乱七八糟的输入，不崩", async () => {
  const ctx = loadModule();
  for (const bad of [null, undefined, "不是数组"]) {
    const r = ctx.healScenarioTags(bad, []);
    assert.deepEqual([...r.phrases], []);
    assert.equal(r.healed, 0);
  }
  const ok = ctx.healScenarioTags([P("a", "custom_s_1")], null);
  assert.equal(ok.healed, 1, "对照：正常输入必须真的处理");
});

test("列表里混进 null，跳过它而不是整个崩掉", async () => {
  const ctx = loadModule();
  const r = ctx.healScenarioTags([null, P("a", "custom_s_1"), undefined], []);
  assert.equal(r.phrases.filter(Boolean).length, 1);
  assert.equal(r.healed, 1);
});

// ══ 3. 导入时真的调了它 ═══════════════════════════════════════════════

test("恢复备份时会做这一步", async () => {
  const at = html.indexOf("const sc = mergeScenarios(");
  assert.ok(at !== -1, "导入时的场景合并没找到");
  const body = html.slice(at, at + 900);
  assert.match(body, /healScenarioTags\(/,
    "不做这一步的话，CSV 恢复会留下一批指着空气的句子");
});

test("CSV 恢复也要做 —— 它正是最容易出这个问题的那条路", async () => {
  // CSV 每行带 scenario 列，却没有地方放场景的名字。
  const at = html.indexOf("const parsed = isCsv");
  const body = html.slice(at, at + 1600);
  assert.match(body, /healScenarioTags\(/, "两条恢复路径共用同一段收尾");
  assert.ok(!/isCsv\s*\?\s*healScenarioTags/.test(body),
    "不该按格式分叉 —— 分叉就是两条路会走散的地方");
});

console.log("orphan scenario tag tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
