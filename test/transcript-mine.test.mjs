#!/usr/bin/env node
// 从一段转写文字里，把家长的习惯用语挖出来。
//
// 这条分支的前提是「只有 Victor 和太太两个人用」（分支 two-users）。
// 在这个前提下，成本和隐私两条反对不成立了，但 docs/jtbd.md 第七节里
// 那条最强的反对**没有消失，只是换了形状**：
//
//   家长真说的话里，有相当一部分是他不愿意教给孩子的。
//
// 面向陌生家长时，这意味着产品会教坏别人的孩子；只有自己用时，
// 意味着**他自己就是筛选者**。所以这里做的是「抽出候选让他挑」，
// 不是「全自动转换」。挑这个动作不能省。
//
// 技术死结也绕开了：iOS 上 PWA 后台录音会被挂起，所以不在软件里录——
// 用手机自带的语音备忘录录，任何工具转成文字，把文字粘进来。
//
// 这一层最要紧的一条是排序：
//
//   洗一次澡里说了 8 遍的那句，就是他的习惯用语；
//   说了 1 遍的那句不是。按次数排，习惯用语自己浮上来。
//
// 这正是自我报告拿不到的那一层——你问他「洗澡时你都说什么」，
// 他答的是他以为自己说的（docs/jtbd.md 候选 D）。
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   家长把一段洗澡时的对话文字粘进来。软件把它拆成一句一句，
//   把他反复说过的排在最上面，并且告诉他这句说了几遍。
//   「嗯」「好」这种语气词不占位置。他从里面挑几句，只有挑中的
//   才会被翻译。
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import vm from "node:vm";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");

const START = "/* ll:transcript-mine:start */";
const END = "/* ll:transcript-mine:end */";

function load() {
  const s = html.indexOf(START), e = html.indexOf(END);
  assert.ok(s !== -1 && e !== -1 && e > s,
    "找不到 ll:transcript-mine 块 —— 还没有实现");
  const ctx = { console };
  vm.createContext(ctx);
  vm.runInContext(html.slice(s + START.length, e), ctx);
  return ctx;
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// 一段真实形状的转写：口语、没有标点分段规律、夹着语气词和重复。
const TRANSCRIPT = `
来，我们洗洗小手。嗯。好。
宝宝，水不烫吧？
来，我们洗洗小手！
啊，你看这个泡泡。
来，我们洗洗小手
好了，该起来啦。
宝宝，水不烫吧
好了，该起来啦！
`;

// ── 拆句 ────────────────────────────────────────────────────────────────

test("粘进来的一段话，被拆成一句一句", () => {
  const { mineTranscript } = load();
  const out = mineTranscript(TRANSCRIPT);
  assert.ok(Array.isArray(out), "没有拆出东西来");
  assert.ok(out.length >= 3, `只拆出 ${out.length} 条`);
  for (const c of out) {
    assert.ok(c && typeof c.zh === "string" && c.zh, `有一条是空的：${JSON.stringify(c)}`);
    assert.ok(!/[。！？\n]/.test(c.zh), `句子里还带着断句符号：「${c.zh}」`);
  }
});

test("「嗯」「好」这种语气词不占位置", () => {
  const { mineTranscript } = load();
  const zh = mineTranscript(TRANSCRIPT).map(c => c.zh);
  assert.ok(!zh.includes("嗯"), "「嗯」被当成了一句要教的话");
  assert.ok(!zh.includes("好"), "「好」被当成了一句要教的话");
  // 控制组：一个「什么都扔掉」的实现也能通过上面两条。
  assert.ok(zh.some(s => s.includes("洗洗小手")), "控制组失败：正经句子也被扔了");
});

// ── 排序：这是整层的重点 ────────────────────────────────────────────────

test("说了三遍的那句排在最前面 —— 那才是他的习惯用语", () => {
  const { mineTranscript } = load();
  const out = mineTranscript(TRANSCRIPT);
  assert.ok(out[0].zh.includes("洗洗小手"),
    `排第一的是「${out[0].zh}」，但说得最多的是「来，我们洗洗小手」`);
});

test("每一条都告诉他这句说了几遍", () => {
  const { mineTranscript } = load();
  const out = mineTranscript(TRANSCRIPT);
  const top = out[0];
  assert.equal(top.count, 3, `「${top.zh}」数出来是 ${top.count} 遍，实际说了 3 遍`);
  // 控制组：一个「count 永远填 1」的实现会让排序失去意义。
  const ones = out.filter(c => c.count === 1);
  assert.ok(ones.length > 0, "控制组失败：没有一条是只说过一次的");
});

test("同一句话的不同标点，算作同一句", () => {
  // 「来，我们洗洗小手。」「来，我们洗洗小手！」「来，我们洗洗小手」
  // 是同一句话说了三遍，不是三句不同的话。
  const { mineTranscript } = load();
  const out = mineTranscript(TRANSCRIPT);
  const washing = out.filter(c => c.zh.includes("洗洗小手"));
  assert.equal(washing.length, 1,
    `「洗洗小手」被拆成了 ${washing.length} 条：${washing.map(c => c.zh).join(" / ")}`);
});

test("说得一样多的两句，先说的排前面", () => {
  // 否则同样次数的条目每次刷新顺序都不一样，他会以为软件在乱跳。
  const { mineTranscript } = load();
  const out = mineTranscript("甲甲甲甲。乙乙乙乙。甲甲甲甲。乙乙乙乙。");
  assert.equal(out.length, 2);
  assert.equal(out[0].zh, "甲甲甲甲", `先说的是「甲甲甲甲」，却排在了「${out[0].zh}」后面`);
});

// ── 挑选这个动作不能省 ──────────────────────────────────────────────────

test("挖出来的候选，一条都没有被自动收藏", () => {
  // 这是这一层唯一没有因为「只有两个人用」而失效的反对：
  // 他真说的话里有他不愿意教给孩子的。挑，是他的活。
  const { mineTranscript } = load();
  const out = mineTranscript(TRANSCRIPT);
  // 控制组：返回空数组的实现会让下面这个循环一次都不跑，于是「一条都没被
  // 勾上」空口成立。
  assert.ok(out.length > 0, "控制组失败：一条候选也没挖出来");
  for (const c of out) {
    assert.notEqual(c.selected, true, `「${c.zh}」被预先勾上了`);
  }
});

// ── 脏输入 ──────────────────────────────────────────────────────────────

test("空的、纯标点的、不是字符串的，都不会让页面崩", () => {
  const { mineTranscript } = load();
  for (const junk of ["", "   ", "。。。！！", null, undefined, 42, {}]) {
    let out;
    assert.doesNotThrow(() => { out = mineTranscript(junk); }, `${JSON.stringify(junk)} 让它崩了`);
    // 比长度不比 deepEqual：vm 里造出来的数组，原型跟这个进程的
    // Array.prototype 不是同一个，assert/strict 会因此判不等。
    assert.equal(out.length, 0, `${JSON.stringify(junk)} 挖出了东西：${JSON.stringify(out)}`);
  }
  // 控制组：一个「永远返回空数组」的实现也能通过上面那圈。
  assert.ok(mineTranscript(TRANSCRIPT).length > 0, "控制组失败：正常文字也挖不出东西");
});

test("很长的一段也只给他看得过来的条数", () => {
  // 三十分钟的转写能拆出几百条。全列出来，挑这个动作就没人做得动了。
  const { mineTranscript } = load();
  const long = Array.from({ length: 300 }, (_, i) => `这是第${i}句话呀`).join("。");
  const out = mineTranscript(long);
  assert.ok(out.length <= 30, `一口气列了 ${out.length} 条，挑不动`);
  assert.ok(out.length > 0, "长文本反而一条都没挖出来");
});

// ── 界面上真的挂上去了 ──────────────────────────────────────────────────

test("有一个地方能让他把文字粘进来", () => {
  const at = html.indexOf('id="transcriptBox"');
  assert.ok(at !== -1, "界面上没有粘贴入口");
  const product = html
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
  assert.match(product, /getElementById\(\s*["']transcriptBox["']\s*\)/,
    "粘贴框摆在那儿，但没有任何代码读它");
  // 上一版到此为止——一个「读了那个框、然后什么也不干」的实现也能绿。
  // 读到的文字得真的走进挖掘逻辑，候选才会出现在他眼前。
  const at2 = product.indexOf('getElementById("transcriptBox")');
  const around = product.slice(Math.max(0, at2 - 600), at2 + 600);
  assert.match(around, /mineTranscript\(/,
    "读了粘贴框，但读到的文字没有被拿去挖候选");
});

let failed = 0;
for (const t of tests) {
  try { t.fn(); console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed}/${tests.length} 条失败` : `\n✓ all ${tests.length} tests passed`);
process.exit(failed ? 1 : 0);
