#!/usr/bin/env node
// 「今日推荐」现在是一个日历轮盘：
//
//     todayId = scenarioOrder[Math.floor(Date.now() / 86400000) % 30]
//
// 它不知道现在几点，也不知道这位家长学过什么。对一个刚装上的家长，那是他
// 屏幕上唯一还亮着的「今天从这开始」——收藏卡是空的、待复习徽章隐藏、
// 「开始复习」按钮隐藏、收藏页只剩一行「还没有收藏」。
//
// 这一层测两件事，合起来是家长第一次打开到第一条收藏之间的那条路：
//   ① 推的场景跟他此刻的处境有关（早上推起床，晚上推睡前）
//   ② 他收下第一句之后，知道这个动作换来了什么
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   晚上八点，家长刚给孩子洗完澡，打开这个 App。它推给他的是睡前或洗澡
//   要说的话，而不是「超市购物」。他学了一句，点了收藏，屏幕告诉他明天
//   这句会回来找他，而不是让他自己猜那颗星星意味着什么。
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import vm from "node:vm";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");

const START = "/* ll:first-value:start */";
const END = "/* ll:first-value:end */";

// 真实的场景数据，不是编的——时段映射如果指向一个不存在的场景 id，
// 只有拿真数据跑才会发现。
const scenarioCtx = { window: {} };
vm.createContext(scenarioCtx);
vm.runInContext(readFileSync(join(ROOT, "scenarios.js"), "utf8"), scenarioCtx);
const scenarios = scenarioCtx.scenarios || scenarioCtx.window.scenarios;
const scenarioOrder = scenarioCtx.scenarioOrder || scenarioCtx.window.scenarioOrder;

function load() {
  const s = html.indexOf(START), e = html.indexOf(END);
  assert.ok(s !== -1 && e !== -1 && e > s,
    "找不到 ll:first-value 块 —— 首次价值路径还没有实现");
  const ctx = { scenarios, scenarioOrder, console };
  vm.createContext(ctx);
  vm.runInContext(html.slice(s + START.length, e), ctx);
  // 顶层 const 进的是 context 的词法环境，不会挂到 ctx 对象上——
  // 函数声明会，const 不会。要读它得回到那个环境里求值。
  ctx.TIME_BANDS = vm.runInContext("TIME_BANDS", ctx);
  return ctx;
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// ── ① 推的场景跟此刻有关 ────────────────────────────────────────────────

test("晚上八点打开，推的是晚上要说的话", () => {
  const { pickTodayScenario } = load();
  const id = pickTodayScenario({ hour: 20, dayIndex: 0, savedScenarioIds: [] });
  assert.ok(scenarios[id], `推了一个不存在的场景：${id}`);
  assert.ok(["bath", "bedtime", "teeth", "reading"].includes(id),
    `晚上八点推了「${scenarios[id].name}」`);
  // 控制组：一个「永远返回同一个」的实现也能通过上面那两条——洗澡恰好排在
  // 场景表第一位。早上必须推出别的，才证明它真的看了钟点。
  const morning = pickTodayScenario({ hour: 7, dayIndex: 0, savedScenarioIds: [] });
  assert.notEqual(morning, id, `早上七点和晚上八点推的是同一个：${id}`);
});

test("早上七点打开，推的是早上要说的话", () => {
  const { pickTodayScenario } = load();
  const id = pickTodayScenario({ hour: 7, dayIndex: 0, savedScenarioIds: [] });
  assert.ok(scenarios[id], `推了一个不存在的场景：${id}`);
  assert.ok(["morning", "dress", "teeth", "meal", "handwash"].includes(id),
    `早上七点推了「${scenarios[id].name}」`);
});

test("凌晨三点也给得出一个场景，不会崩、不会空", () => {
  // 半夜喂奶、哄睡的家长是真实存在的。时段表如果只覆盖 6:00-22:00，
  // 这个人打开看到的是一片空白。
  const { pickTodayScenario } = load();
  const byHour = [];
  for (let hour = 0; hour < 24; hour++) {
    const id = pickTodayScenario({ hour, dayIndex: 0, savedScenarioIds: [] });
    assert.ok(scenarios[id], `${hour} 点推了一个不存在的场景：${id}`);
    byHour.push(id);
  }
  // 控制组：一个「永远返回洗澡时间」的实现也永远不崩、永远不空。
  // 一天之内至少要分出几个不同的时段，这条断言才在测东西。
  assert.ok(new Set(byHour).size >= 3,
    `一整天只推得出 ${new Set(byHour).size} 种场景：${[...new Set(byHour)].join("、")}`);
});

test("每个时段候选里的场景，在真实场景表里都存在", () => {
  // 时段表是手写的 id 列表，改名一个场景就会静默指向 undefined。
  const { TIME_BANDS } = load();
  assert.ok(Array.isArray(TIME_BANDS) && TIME_BANDS.length > 0, "时段表是空的");
  for (const band of TIME_BANDS) {
    assert.ok(Array.isArray(band.ids) && band.ids.length,
      `时段 ${JSON.stringify(band)} 没有候选场景`);
    for (const id of band.ids) {
      assert.ok(scenarios[id], `时段表里的「${id}」不在场景数据里`);
    }
  }
});

// ── 老用户：轮盘真正伤的是他 ────────────────────────────────────────────

test("已经收藏过的场景，让位给还没学过的", () => {
  // 日历轮盘会把一个已经学透的场景当成今天的新内容推给他。
  const { pickTodayScenario } = load();
  const first = pickTodayScenario({ hour: 20, dayIndex: 0, savedScenarioIds: [] });
  const second = pickTodayScenario({ hour: 20, dayIndex: 0, savedScenarioIds: [first] });
  assert.notEqual(second, first, "刚学过的场景又被推了一遍");
  assert.ok(scenarios[second], `推了一个不存在的场景：${second}`);
});

test("三十个场景全收藏过了，仍然推得出一个", () => {
  const { pickTodayScenario } = load();
  // 控制组先跑：只剩一个没学过时，推的必须正是那一个。少了这条，
  // 一个「永远返回洗澡时间」的实现也能通过下面的「不为空」。
  const allButOne = scenarioOrder.filter(id => id !== "bedtime");
  assert.equal(
    pickTodayScenario({ hour: 20, dayIndex: 5, savedScenarioIds: allButOne }),
    "bedtime", "只剩一个没学过的场景时，推的不是它");

  const id = pickTodayScenario({ hour: 20, dayIndex: 5, savedScenarioIds: scenarioOrder });
  assert.ok(scenarios[id], `全学过之后推了：${id}`);
});

test("同一个时段，换一天推的不总是同一个", () => {
  // 否则这位家长每天晚上八点打开，看到的永远是「洗澡时间」。
  const { pickTodayScenario } = load();
  const seen = new Set();
  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    seen.add(pickTodayScenario({ hour: 20, dayIndex, savedScenarioIds: [] }));
  }
  assert.ok(seen.size > 1, `一周七天晚上都推同一个：${[...seen][0]}`);
});

// ── ② 收下第一句之后，他知道换来了什么 ──────────────────────────────────

test("第一次收藏，告诉他这句明天会回来", () => {
  const { firstSaveNotice } = load();
  const msg = firstSaveNotice(1);
  assert.ok(msg, "第一次收藏什么也没说");
  assert.match(msg, /明天/, `没说明天：「${msg}」`);
  assert.match(msg, /复习/, `没说复习：「${msg}」`);
});

test("第二次收藏就不再说了，不变成噪音", () => {
  const { firstSaveNotice } = load();
  // 控制组：一个「永远返回 null」的实现能通过下面两条，却什么也没做。
  assert.ok(firstSaveNotice(1), "控制组失败：第一次收藏也没提示");
  assert.equal(firstSaveNotice(2), null, "每收藏一句都弹一次提示");
  assert.equal(firstSaveNotice(37), null);
});

test("取消收藏收回到零，不当成一次新的第一次", () => {
  // 收藏 → 取消 → 再收藏，他已经看过那句话了。
  const { firstSaveNotice } = load();
  assert.ok(firstSaveNotice(1), "控制组失败：第一次收藏也没提示");
  assert.equal(firstSaveNotice(0), null, "收藏数为零时也弹了提示");
});

// ── 首页：收藏为空时，那句话得有下一步 ──────────────────────────────────

test("一条收藏都没有时，首页给的是一个能点的下一步", () => {
  // 家长看到的那句话是 renderSavedChips() 生成的，静态 HTML 只是初始默认值——
  // 上一版这条测试量的是 HTML，而且 800 字符的窗口把隔壁「开始复习」按钮的
  // onclick 也框了进来，于是「把旧文案删掉、什么也不换」也能绿。
  const { firstValueCard } = load();
  const card = firstValueCard();
  assert.ok(card && card.text, "空状态没有文案");
  assert.ok(card.buttonLabel, "空状态没有可点的下一步，只有一句话");
  assert.doesNotMatch(card.text + card.buttonLabel, /探索/,
    "「探索」不是一个动作——他不知道探索完能得到什么");
});

test("一条收藏都没有时，卡片标题不再写「最近收藏」", () => {
  // 真机上看到的：标题写着「⭐ 最近收藏」，底下却是「挑一句现在就用得上
  // 的」和一个「学第一句」按钮。对一个刚装上的家长，这张卡在说两件互相
  // 矛盾的事——他没有「最近收藏」，那是给已经用了一阵的人看的标题。
  const { firstValueCard } = load();
  const card = firstValueCard();
  assert.ok(card.heading, "空状态没有自己的标题");
  assert.doesNotMatch(card.heading, /最近收藏/,
    `一条都没收藏，标题却是「${card.heading}」`);
  // ⭐ 在这个项目里只表示「已收藏」，空状态的标题不该借用它
  // （test/save-star.test.mjs 守着这条）。
  assert.doesNotMatch(card.heading, /⭐/, "空状态标题借用了表示已收藏的实心彩星");
});

test("「去场景里探索吧」这句话在整个文件里都不剩了", () => {
  // 它出现在两处：静态 HTML 一处、renderSavedChips() 一处。
  // 只改一处，另一处会在别的时机冒出来。
  // 剥注释再数。上一版这条打在了「旧文案是……」这句解释性注释上——
  // 家长看不到注释，这条断言管的是他看得见的字。
  const visible = html
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "")
    .replace(/<!--[\s\S]*?-->/g, "");
  assert.equal((visible.match(/去场景里探索吧/g) || []).length, 0,
    "旧文案还留着");
});

let failed = 0;
for (const t of tests) {
  try { t.fn(); console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed}/${tests.length} 条失败` : `\n✓ all ${tests.length} tests passed`);
process.exit(failed ? 1 : 0);
