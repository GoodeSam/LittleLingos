#!/usr/bin/env node
// Behavioral tests for scenarios a parent makes themselves.
//
// Zero-dependency: the module is extracted from index.html between its markers
// and run in a vm context, per test/audio-store.test.mjs.
//
// WHY. The prepared scenarios cover bedtime, meals, going out. They do not
// cover this parent's Tuesday — the paediatrician, the grandparents' place,
// swimming. Those are the moments they actually need words for, and until now
// the only home for such a phrase was one flat 收藏 list.
//
// THE PHRASES THEMSELVES ARE ORDINARY SAVED ITEMS, tagged with the scenario.
// That is the whole design: they inherit review scheduling, audio generation,
// the 🔊 marks, row playback, loop playback and backup — all of which already
// work and none of which should be built a second time (tech-constraints C13).
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   1. 家长自己建一个「去医院」，以后哄孩子打针的话就有地方放。
//
//   2. 他换了手机，恢复备份——**场景和句子一起回来**。只回来句子的话，
//      那些句子会指向一个不存在的场景，等于凭空消失。
//
//   3. 他删掉一个场景。**里面的句子不能跟着没**——每一句都花钱生成过语音，
//      还带着几个月的复习进度。
// ⚠️ 跨 realm 陷阱：vm 里造出来的数组，原型和宿主的 Array.prototype 不是
// 同一个，assert.deepEqual 会判它们不等——即使内容一模一样。这个项目在
// test/data-export.test.mjs 已经踩过一次。所以凡是从 vm 拿回来的数组，
// 先用扩展语法搬回宿主 realm 再比。
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import assert from "node:assert/strict";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");

const START = "/* ll:custom-scenarios:start */";
const END = "/* ll:custom-scenarios:end */";

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

function loadModule({ stored = null, saved = [] } = {}) {
  const s = html.indexOf(START), e = html.indexOf(END);
  assert.ok(s !== -1 && e !== -1, `index.html must contain ${START} … ${END} markers`);
  const map = new Map();
  if (stored !== null) map.set("ll_scenarios", JSON.stringify(stored));
  const ctx = {
    console,
    savedPhrases: saved,
    localStorage: {
      getItem: k => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => map.set(k, String(v)),
      removeItem: k => map.delete(k),
    },
    safeSetItem: (k, v) => map.set(k, String(v)),
    _map: map,
  };
  vm.createContext(ctx);
  vm.runInContext(html.slice(s, e + END.length), ctx);
  for (const fn of ["loadCustomScenarios", "createCustomScenario", "deleteCustomScenario",
                    "renameCustomScenario", "isCustomScenario", "customScenarioTag"]) {
    assert.equal(typeof ctx[fn], "function", `module must define ${fn}()`);
  }
  return { ctx, map };
}

// ══ 1. 建一个自己的场景 ═══════════════════════════════════════════════

test("建一个场景，它就在列表里了", async () => {
  const { ctx } = loadModule();
  const sc = ctx.createCustomScenario("去医院", "🏥");
  assert.ok(sc && sc.id, "要有 id —— 句子靠它归属");
  assert.equal(sc.name, "去医院");
  assert.equal(sc.icon, "🏥");
  assert.deepEqual([...ctx.loadCustomScenarios()].map(x => x.name), ["去医院"]);
});

test("关掉再打开，自己建的场景还在", async () => {
  const { ctx, map } = loadModule();
  ctx.createCustomScenario("去医院", "🏥");
  // 第二次加载 = 新的一次会话，只能从存储里读
  const again = loadModule({ stored: JSON.parse(map.get("ll_scenarios")) });
  assert.deepEqual([...again.ctx.loadCustomScenarios()].map(x => x.name), ["去医院"]);
});

test("名字是空的，建不出来", async () => {
  const { ctx } = loadModule();
  for (const bad of [null, undefined, "", "   "]) {
    assert.equal(ctx.createCustomScenario(bad, "🏥"), null);
  }
  assert.equal(ctx.loadCustomScenarios().length, 0);
  assert.ok(ctx.createCustomScenario("去医院", "🏥"), "对照：有名字的必须能建");
});

test("没给图标也能建 —— 图标不该是拦路的必填项", async () => {
  const { ctx } = loadModule();
  const sc = ctx.createCustomScenario("去医院");
  assert.ok(sc && sc.icon, "得有个默认图标，否则界面上是个空洞");
});

test("两个场景重名，第二个建不出来", async () => {
  // 两个都叫「去医院」的话，家长自己也分不清句子该往哪个里放。
  const { ctx } = loadModule();
  assert.ok(ctx.createCustomScenario("去医院"));
  assert.equal(ctx.createCustomScenario("去医院"), null);
  assert.equal(ctx.createCustomScenario("  去医院  "), null, "首尾空格不算另一个名字");
  assert.equal(ctx.loadCustomScenarios().length, 1);
});

test("每个场景的 id 各不相同", async () => {
  const { ctx } = loadModule();
  const ids = ["去医院", "外婆家", "游泳"].map(n => ctx.createCustomScenario(n).id);
  assert.equal(new Set(ids).size, 3, `id 撞了：${ids.join(" ")}`);
});

// ══ 2. 和预设场景分得清 ═══════════════════════════════════════════════

test("自建场景的标签，和预设场景的写法分得开", async () => {
  // 混进预设场景那套的话，它的句子会被当成「有随应用下发的 mp3」，
  // 去播一个不存在的文件，然后静默退回浏览器朗读（tech-constraints C13）。
  const { ctx } = loadModule();
  const sc = ctx.createCustomScenario("去医院");
  const tag = ctx.customScenarioTag(sc.id);
  assert.match(tag, /^custom_/, "要一眼看得出这不是预设场景");
  assert.equal(ctx.isCustomScenario(tag), true);
  for (const preset of ["bedtime", "meal", "__translate__", "__dict__", "", null]) {
    assert.equal(ctx.isCustomScenario(preset), false, `${preset} 不是自建场景`);
  }
});

// ══ 3. 改名 ═══════════════════════════════════════════════════════════

test("改个名字，句子还挂在原来那个场景上", async () => {
  // 改名要是换了 id，那些句子就全成了孤儿。
  const { ctx } = loadModule();
  const sc = ctx.createCustomScenario("去医院");
  assert.equal(ctx.renameCustomScenario(sc.id, "看医生"), true);
  const after = ctx.loadCustomScenarios()[0];
  assert.equal(after.name, "看医生");
  assert.equal(after.id, sc.id, "id 不能变");
});

test("改成一个已经存在的名字，不许", async () => {
  const { ctx } = loadModule();
  const a = ctx.createCustomScenario("去医院");
  ctx.createCustomScenario("外婆家");
  assert.equal(ctx.renameCustomScenario(a.id, "外婆家"), false);
  assert.equal(ctx.loadCustomScenarios().find(x => x.id === a.id).name, "去医院");
});

test("改一个不存在的场景，什么都不做", async () => {
  const { ctx } = loadModule();
  ctx.createCustomScenario("去医院");
  assert.equal(ctx.renameCustomScenario("没这个", "随便"), false);
  assert.equal(ctx.loadCustomScenarios().length, 1);
});

// ══ 4. 删场景，不能连句子一起删 ═══════════════════════════════════════

test("删掉一个场景，里面的句子还在，只是不再属于它", async () => {
  // 每一句都花钱生成过语音，还带着复习进度。删场景是整理，不是销毁。
  const { ctx } = loadModule();
  const sc = ctx.createCustomScenario("去医院");
  const tag = ctx.customScenarioTag(sc.id);
  ctx.savedPhrases.push(
    { id: "t_1", en: "Be brave.", zh: "勇敢点", scenario: tag, rv: { s: 2, due: 1 } },
    { id: "t_2", en: "Hello.", zh: "你好", scenario: "__translate__", rv: { s: 0, due: 1 } },
  );
  assert.equal(ctx.deleteCustomScenario(sc.id), true);
  assert.equal(ctx.loadCustomScenarios().length, 0, "场景没了");
  assert.equal(ctx.savedPhrases.length, 2, "句子一句都不能少");
  const moved = ctx.savedPhrases.find(p => p.id === "t_1");
  assert.notEqual(moved.scenario, tag, "不能还指着一个已经不存在的场景");
  assert.equal(moved.rv.s, 2, "复习进度必须原样保住");
  assert.equal(ctx.savedPhrases.find(p => p.id === "t_2").scenario, "__translate__",
    "别的场景的句子不受影响");
});

test("删一个不存在的场景，什么都不做", async () => {
  const { ctx } = loadModule();
  ctx.createCustomScenario("去医院");
  assert.equal(ctx.deleteCustomScenario("没这个"), false);
  assert.equal(ctx.loadCustomScenarios().length, 1);
});

// ══ 5. 存储坏了也不能崩 ═══════════════════════════════════════════════

test("存储里是一堆乱码时，当作没有场景，而不是整个应用打不开", async () => {
  const { ctx, map } = loadModule();
  map.set("ll_scenarios", "{不是合法的 JSON");
  assert.deepEqual([...ctx.loadCustomScenarios()], []);
  assert.ok(ctx.createCustomScenario("去医院"), "还能继续建新的");
});

test("存储里存的是个数字或数组套错了，也当作没有", async () => {
  for (const junk of ['123', '"字符串"', '{"a":1}', 'null']) {
    const { ctx, map } = loadModule();
    map.set("ll_scenarios", junk);
    assert.deepEqual([...ctx.loadCustomScenarios()], [], `${junk} 应该被当作没有`);
  }
});

test("列表里混进了缺字段的条目，跳过它而不是显示一个没名字的场景", async () => {
  const { ctx } = loadModule({ stored: [
    { id: "s_1", name: "去医院", icon: "🏥" },
    { id: "s_2" },                       // 没名字
    { name: "没有 id" },
    null,
  ]});
  assert.deepEqual([...ctx.loadCustomScenarios()].map(x => x.name), ["去医院"]);
});

// ── Runner ───────────────────────────────────────────────
console.log("custom-scenarios tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
