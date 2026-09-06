#!/usr/bin/env node
// 家长不知道自己平时对孩子说什么。
//
// 你问他「洗澡的时候你都说什么」，他答出来的是他**以为**自己说的话；
// 他真正反复说的那几句，自己意识不到。这就是为什么 597 条精选句子摆在那儿，
// 真正被说出口的只有三句 `Let's + 动词`（见 docs/jtbd.md 发现 2）。
//
// 这一层做的事很小：在场景页上问他一句，并且告诉他可以对着**键盘上的话筒**
// 说——那是手机自带的听写，音频不出设备，转出来的文字走的是翻译已经在走的
// 那条路。不录环境音、不上传音频、不新增依赖。
//
// 它同时是一个实验：docs/jtbd.md 第七节的候选 D 要回答「家长自己的话，比
// 精选的句子更能让他真的说出口吗」。做了这个入口，数据自己就产生了。
// 区分两者不需要新字段——翻译产物的 id 一律带 t_ 前缀，而 597 条预设句子
// 里没有一条是。
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   家长点开「洗澡时间」，看到一句问他平时怎么说的话，还告诉他可以直接
//   对着话筒讲。他讲了一句，这句话变成英文留在这个场景里。下次再点开
//   洗澡时间，那句问话不再出现——它已经做完它的事了。而他点开「吃饭时间」
//   时，那里的问话照常在。
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import vm from "node:vm";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");

const START = "/* ll:own-words:start */";
const END = "/* ll:own-words:end */";

// 真实的 597 条预设句子，不是编的：「预设 id 不带 t_ 前缀」这条前提
// 一旦不成立，整个区分就塌了，只有拿真数据跑才会发现。
const sctx = { window: {} };
vm.createContext(sctx);
vm.runInContext(readFileSync(join(ROOT, "scenarios.js"), "utf8"), sctx);
const scenarios = sctx.scenarios || sctx.window.scenarios;
const scenarioOrder = sctx.scenarioOrder || sctx.window.scenarioOrder;

function load() {
  const s = html.indexOf(START), e = html.indexOf(END);
  assert.ok(s !== -1 && e !== -1 && e > s,
    "找不到 ll:own-words 块 —— 这个功能还没有实现");
  const ctx = { console };
  vm.createContext(ctx);
  vm.runInContext(html.slice(s + START.length, e), ctx);
  return ctx;
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

const preset = (scenarioTag, i = 0) => {
  const p = scenarios[scenarioTag].phrases["1-2"][i];
  return { ...p, scenario: scenarioTag };
};
const own = (scenarioTag, n = 1) =>
  ({ id: "t_" + (1700000000000 + n), en: "Own " + n, zh: "我自己的话", scenario: scenarioTag });

// ── 分得清「自己的话」和「精选的句子」 ──────────────────────────────────

test("家长自己讲出来的那句，和现成的句子，分得开", () => {
  const { isOwnWords } = load();
  assert.equal(isOwnWords(own("bath")), true, "自己讲的没被认出来");
  // 控制组：一个「永远说是」的实现也能通过上面那条。
  assert.equal(isOwnWords(preset("bath")), false, "现成的句子被当成了自己的话");
});

test("597 条现成句子，没有一条会被误认成自己的话", () => {
  // 这条前提塌了，整个实验就没法读——两组混在一起了。
  const { isOwnWords } = load();
  const wrong = [];
  for (const tag of scenarioOrder) {
    for (const arr of Object.values(scenarios[tag].phrases || {})) {
      for (const p of arr) if (isOwnWords({ ...p, scenario: tag })) wrong.push(p.id);
    }
  }
  assert.deepEqual(wrong, [], `被误认的现成句子：${wrong.slice(0, 5).join("、")}`);
  // 控制组：一个「永远说不是」的实现，误认数当然是 0。
  assert.equal(isOwnWords(own("bath")), true, "控制组失败：真的自己的话也说不是");
});

test("残缺的条目不会让它崩，也不会被当成自己的话", () => {
  const { isOwnWords } = load();
  for (const junk of [null, undefined, {}, { id: null }, { id: 42 }, "t_1"]) {
    assert.equal(isOwnWords(junk), false, `${JSON.stringify(junk)} 被当成了自己的话`);
  }
  // 控制组：一个「永远说不是」的实现也能通过上面那圈。
  assert.equal(isOwnWords(own("bath")), true, "控制组失败：真的自己的话也说不是");
});

// ── 该问的时候问 ────────────────────────────────────────────────────────

test("第一次点开洗澡时间，页面问他平时怎么说", () => {
  const { ownWordsInvite } = load();
  const inv = ownWordsInvite({ scenarioTag: "bath", scenarioName: "洗澡时间", saved: [] });
  assert.ok(inv, "什么也没问");
  assert.ok(inv.text, "问话是空的");
  assert.ok(inv.buttonLabel, "只有一句话，没有能点的");
});

test("问话里带着这个场景的名字，不是笼统地问「说点什么」", () => {
  const { ownWordsInvite } = load();
  const bath = ownWordsInvite({ scenarioTag: "bath", scenarioName: "洗澡时间", saved: [] });
  const meal = ownWordsInvite({ scenarioTag: "meal", scenarioName: "吃饭时间", saved: [] });
  assert.match(bath.text, /洗澡时间/, `没提场景：「${bath.text}」`);
  // 控制组：一句写死的话在两个场景里会一模一样。
  assert.notEqual(bath.text, meal.text, "两个场景问的是同一句话");
});

test("问话告诉他可以对着键盘上的话筒说", () => {
  // 这是整个功能的重点：能力早就有了（iPhone 键盘自带听写），
  // 缺的是他不知道可以用，也不知道该说什么进去。
  const { ownWordsInvite } = load();
  const inv = ownWordsInvite({ scenarioTag: "bath", scenarioName: "洗澡时间", saved: [] });
  assert.match(inv.text + inv.buttonLabel, /🎤|话筒|听写/,
    `没告诉他可以说：「${inv.text}」`);
});

// ── 做完了就让路 ────────────────────────────────────────────────────────

test("已经在这个场景里讲过一句，就不再问了", () => {
  const { ownWordsInvite } = load();
  // 控制组先跑：一个「永远返回 null」的实现能通过下面那条，却什么也没做。
  assert.ok(ownWordsInvite({ scenarioTag: "bath", scenarioName: "洗澡时间", saved: [] }),
    "控制组失败：一句都没讲过时也不问");
  const inv = ownWordsInvite({
    scenarioTag: "bath", scenarioName: "洗澡时间", saved: [own("bath")],
  });
  assert.equal(inv, null, "他已经讲过了，还在问他");
});

test("在别的场景讲过，这个场景照问不误", () => {
  // 控制组，也是真实情境：他在吃饭时间讲过，不代表洗澡时间也讲过。
  const { ownWordsInvite } = load();
  const inv = ownWordsInvite({
    scenarioTag: "bath", scenarioName: "洗澡时间", saved: [own("meal")],
  });
  assert.ok(inv, "在别的场景讲过，这个场景就不问了——问话被做成了全局开关");
});

test("收藏了一堆现成句子，仍然问他自己怎么说", () => {
  // 这条是实验能不能读的关键：收藏现成句子 ≠ 讲了自己的话。
  // 混淆了这两件事，两组样本就分不开了。
  const { ownWordsInvite } = load();
  const inv = ownWordsInvite({
    scenarioTag: "bath", scenarioName: "洗澡时间",
    saved: [preset("bath", 0), preset("bath", 1), preset("bath", 2)],
  });
  assert.ok(inv, "收藏了现成句子就被当成讲过自己的话了");
});

test("从翻译页存下的话，不算讲过这个场景", () => {
  // 翻译页存的条目 scenario 是 __translate__，不属于任何场景。
  const { ownWordsInvite } = load();
  const inv = ownWordsInvite({
    scenarioTag: "bath", scenarioName: "洗澡时间", saved: [own("__translate__")],
  });
  assert.ok(inv, "翻译页存的话被算成了洗澡场景里的话");
});

test("场景没名字、收藏是脏数据，都不会让页面崩", () => {
  const { ownWordsInvite } = load();
  assert.doesNotThrow(() => ownWordsInvite({ scenarioTag: "bath", scenarioName: "", saved: null }));
  assert.doesNotThrow(() => ownWordsInvite({ scenarioTag: "bath", scenarioName: "洗澡时间", saved: [null, {}, 7] }));
  // 控制组：吞掉一切异常并永远返回 null 的实现也能通过上面两条。
  assert.ok(ownWordsInvite({ scenarioTag: "bath", scenarioName: "洗澡时间", saved: [] }),
    "控制组失败：正常情况下也不问了");
});

// ── 界面上真的挂上去了 ──────────────────────────────────────────────────

test("场景页上真的有这块地方，不是只写了函数", () => {
  // 「造了、也被调用了、但没接到界面上」在本项目已经出过四次。
  const at = html.indexOf('id="scenarioScreen"');
  assert.ok(at !== -1, "找不到场景屏");
  const screen = html.slice(at, html.indexOf('<div class="screen"', at + 10));
  assert.match(screen, /id="ownWordsInvite"/,
    "场景屏上没有放这块问话的位置");
  // 上一版只验了容器在不在——放一个永远空着的 div 也能绿。
  // 还得有人往里面写东西，问话才会真的出现在家长眼前。
  const product = html
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
  assert.match(product, /getElementById\(\s*["']ownWordsInvite["']\s*\)/,
    "容器摆在那儿，但没有任何代码往里面写内容");
});

test("没有邀请码时，问话在他开口之前就说明这里需要码", () => {
  // 真浏览器上抓到的：这是一个通往付费路径的**新入口**，而两次提交前
  // 刚给翻译页和查词页补上的事前提示，这里没有。家长会对着话筒说完一句
  // 中文、点下按钮，才撞上那堵墙——正是那次要消灭的体验。
  //
  // 这条断言量的是接线：问话那一块里，得有代码去问「这道门开着吗」。
  const at = html.indexOf("function paintOwnWordsInvite");
  assert.ok(at !== -1, "找不到画问话的地方");
  const fn = html.slice(at, html.indexOf("\nasync function submitOwnWords", at));
  assert.match(fn, /accessGateNotice\(/,
    "问话没有告诉他这里需要邀请码——他要说完一句话才会撞上");
});

let failed = 0;
for (const t of tests) {
  try { t.fn(); console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed}/${tests.length} 条失败` : `\n✓ all ${tests.length} tests passed`);
process.exit(failed ? 1 : 0);
