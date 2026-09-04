#!/usr/bin/env node
// Behavioral tests for reaching a self-made scenario from the screen.
//
// Zero-dependency: the ll:custom-scenarios block is extracted from index.html
// and run in a vm context, per test/custom-scenarios.test.mjs.
//
// A self-made scenario is not a new kind of screen — it is the 收藏 list with
// one filter on it. Everything a parent can already do to a saved phrase
// (play, mark 记住了, hear it in the loop) has to work inside a scenario too,
// and building a second list to do the same things is how the same decision
// ends up written twice (tech-constraints C13).
//
// ⚠️ 跨 realm：vm 里造的数组原型和宿主不同，deepEqual 会判不等。先搬回来再比。
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   1. 家长在场景页看到自己建的「去医院」，点进去只看到那个场景的句子。
//
//   2. 他要能看出自己正在一个场景里，也要能一键回到全部收藏 ——
//      否则他会以为别的句子都不见了。
//
//   3. 自建场景里的句子**不能**被当成随应用下发的预设短语，
//      否则会去播一个不存在的 mp3 文件（C13）。
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

function loadModule({ saved = [] } = {}) {
  const s = html.indexOf(START), e = html.indexOf(END);
  const map = new Map();
  const ctx = {
    console, savedPhrases: saved,
    localStorage: {
      getItem: k => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => map.set(k, String(v)),
      removeItem: k => map.delete(k),
    },
    safeSetItem: (k, v) => map.set(k, String(v)),
  };
  vm.createContext(ctx);
  vm.runInContext(html.slice(s, e + END.length), ctx);
  assert.equal(typeof ctx.phrasesInScenario, "function", "module must define phrasesInScenario()");
  return { ctx };
}

const P = (id, scenario) => ({ id, en: id, zh: id, scenario, savedAt: 1, rv: { s: 0, due: 1 } });

// ══ 1. 只看到这个场景的句子 ═══════════════════════════════════════════

test("点进一个自建场景，只看到属于它的句子", async () => {
  const { ctx } = loadModule({ saved: [
    P("a", "custom_s_1"), P("b", "__translate__"), P("c", "custom_s_1"), P("d", "custom_s_2"),
  ]});
  assert.deepEqual([...ctx.phrasesInScenario("custom_s_1")].map(p => p.id), ["a", "c"]);
});

test("不传场景时，给的是全部收藏 —— 那就是「全部收藏」这个视图", async () => {
  const { ctx } = loadModule({ saved: [P("a", "custom_s_1"), P("b", "__translate__")] });
  assert.equal([...ctx.phrasesInScenario(null)].length, 2);
  assert.equal([...ctx.phrasesInScenario("")].length, 2);
});

test("一个空场景，给的是空列表而不是全部", async () => {
  // 弄错的话，家长点进一个刚建好的空场景，会看到全部收藏 —— 而且
  // 他在里面加的句子会显得莫名其妙。
  const { ctx } = loadModule({ saved: [P("a", "__translate__")] });
  assert.deepEqual([...ctx.phrasesInScenario("custom_s_9")], []);
});

// ══ 2. 不能被当成预设短语 ═════════════════════════════════════════════

test("自建场景的标签，没有混进预设场景那套里", async () => {
  // 混进去的话，这些句子会被判定成「有随应用下发的 mp3」，
  // 去播一个不存在的文件，然后静默退回浏览器朗读（C13）。
  const at = html.indexOf("function classifyItem");
  assert.ok(at !== -1, "classifyItem not found");
  const body = html.slice(at, html.indexOf("\n}", at));
  assert.match(body, /isCustomScenario\(/,
    "分类时必须先把自建场景摘出去，否则它们会被当成有下发文件的预设短语");
});

test("自建场景的句子，走的是本机生成那条路", async () => {
  const at = html.indexOf("function classifyItem");
  const body = html.slice(at, html.indexOf("\n}", at));
  const custom = body.indexOf("isCustomScenario(");
  const preset = body.indexOf("scenarios[item.scenario]");
  assert.ok(custom !== -1 && preset !== -1 && custom < preset,
    "自建场景的判断必须排在预设场景之前，否则先被后者认领走");
});

// ══ 3. 界面接上了 ═════════════════════════════════════════════════════

test("场景页上有一个新建场景的入口", async () => {
  const at = html.indexOf("function renderScenarioGrid");
  assert.ok(at !== -1, "renderScenarioGrid not found");
  const body = html.slice(at, html.indexOf("\n}", at));
  assert.match(body, /createCustomScenario\(|newCustomScenario\(/,
    "建不了场景的话，这一整套家长碰不到");
  assert.match(body, /loadCustomScenarios\(/, "自己建的场景要显示在网格里");
});

test("点自建场景，进的是按它过滤的收藏页", async () => {
  const at = html.indexOf("function openScenario");
  assert.ok(at !== -1, "openScenario not found");
  const body = html.slice(at, html.indexOf("\n}", at));
  assert.match(body, /isCustomScenario\(/,
    "不分流的话，自建场景会去读 scenarios[id].phrases —— 那个对象里没有它，直接崩");
});

test("收藏页知道自己正被过滤，并且能回到全部", async () => {
  const at = html.indexOf("function renderSavedScreen");
  const body = html.slice(at, html.indexOf("\nfunction ", at + 10));
  assert.match(body, /phrasesInScenario\(/, "过滤要用共用那个实现");
  assert.match(body, /全部收藏|返回全部|←/,
    "看不出在过滤的话，家长会以为别的句子都不见了");
});

test("删场景这件事家长做得到", async () => {
  assert.match(html, /deleteCustomScenario\(/, "建得了删不了，等于只能往上堆");
});

test("改名这件事家长也做得到", async () => {
  assert.match(html, /renameCustomScenario\(/, "打错一个字就只能删了重建，里面的句子跟着搬家");
});

console.log("scenario-ui tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
