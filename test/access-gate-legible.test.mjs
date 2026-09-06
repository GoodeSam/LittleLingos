#!/usr/bin/env node
// 面向更多用户时，邀请码是排在导航之前的一道门。
//
// 现在这道门是暗的：家长打开 App、写下一句中文、点「翻译」，然后才被告知
// 「这个功能需要邀请码 — 请到「收藏 · 复习」页底部填写」。他在动手之前
// 没有任何提示，而失败的归因很可能是「这软件坏了」。
//
// 另外那句提示把邀请码输入框的位置写死在文案里。设置项一旦挪出收藏页，
// 这句话就开始骗人，而且没有任何测试会红。
//
// 这一层不改「要不要设这道门」（那涉及 API 成本，是作者的决定），
// 只让门可读：撞上之前就看得见，看见时知道去哪、找谁。
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   一位刚听朋友推荐、第一次打开这个软件的家长，在他写完一句中文之前
//   就已经知道翻译需要一个邀请码、码去哪儿填、找谁要；他不会先花力气
//   打一段字，再撞上一堵没有出口的墙。
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import vm from "node:vm";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");

const START = "/* ll:access-code:start */";
const END = "/* ll:access-code:end */";

function load(code = "") {
  const s = html.indexOf(START), e = html.indexOf(END);
  assert.ok(s !== -1 && e !== -1 && e > s, "找不到 ll:access-code 块");
  const store = new Map();
  if (code) store.set("ll_access", code);
  const ctx = {
    console,
    localStorage: {
      getItem: k => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: k => store.delete(k),
    },
  };
  vm.createContext(ctx);
  vm.runInContext(html.slice(s + START.length, e), ctx);
  // 顶层 const 进的是 context 的词法环境，不会挂到 ctx 对象上——
  // 函数声明会，const 不会。要读它得回到那个环境里求值。
  ctx.ACCESS_CODE_WHERE = vm.runInContext("ACCESS_CODE_WHERE", ctx);
  ctx.ACCESS_CODE_SOURCE = vm.runInContext("ACCESS_CODE_SOURCE", ctx);
  return ctx;
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// ── 撞上之前就看得见 ────────────────────────────────────────────────────

test("没有邀请码时，翻译这件事在他动手之前就说明需要码", () => {
  const { accessGateNotice } = load("");
  const n = accessGateNotice("translate");
  assert.ok(n, "没有码的时候，翻译入口什么也没说");
  assert.match(n, /邀请码/, `提示里没提邀请码：「${n}」`);
});

test("已经填了码的人，不再被这条提示挡在眼前", () => {
  // 控制组。少了这条，一条「永远显示」的写死提示也能通过上面那条，
  // 而那会让每天都在用的家长每次翻译都看见一句与他无关的话。
  // 控制组先跑：一个「永远返回 null」的空壳也能通过下面那条断言。
  assert.ok(load("").accessGateNotice("translate"),
    "控制组失败：没有码的时候也什么都不提示");
  const { accessGateNotice } = load("SOME-CODE");
  assert.equal(accessGateNotice("translate"), null,
    "已经填过码，还在提示他需要码");
});

test("查词的提示说的是「新词」，不把已收录的词也说成要码", () => {
  // 已收录的词不联网、不需要码。把查词整体说成「需要邀请码」是过度声明：
  // 家长会以为没有码就一个词也查不了，而事实上他能查。
  const { accessGateNotice } = load("");
  const n = accessGateNotice("dict");
  assert.ok(n, "没有码的时候，查词入口什么也没说");
  assert.match(n, /新词|新单词/, `查词提示没区分新词：「${n}」`);
});

test("翻译和查词说的不是同一句话", () => {
  // 控制组：一个「不管问什么都返回同一句」的实现能通过前面三条。
  const { accessGateNotice } = load("");
  assert.notEqual(accessGateNotice("translate"), accessGateNotice("dict"),
    "翻译和查词的条件不同，提示却是同一句");
});

// ── 看见时知道去哪、找谁 ────────────────────────────────────────────────

test("提示告诉他码去哪儿填", () => {
  const { accessGateNotice, ACCESS_CODE_WHERE } = load("");
  assert.ok(ACCESS_CODE_WHERE, "没有说明邀请码填在哪里");
  assert.ok(accessGateNotice("translate").includes(ACCESS_CODE_WHERE),
    "提示里没说去哪儿填");
});

test("提示告诉他找谁要码", () => {
  // 现在的文案只说「需要邀请码」，没说从哪儿来——这是一堵没有出口的墙。
  const { accessGateNotice, ACCESS_CODE_SOURCE } = load("");
  assert.ok(ACCESS_CODE_SOURCE, "没有说明邀请码从哪儿来");
  assert.ok(accessGateNotice("translate").includes(ACCESS_CODE_SOURCE),
    "提示里没说找谁要");
});

// ── 位置只有一个来源 ────────────────────────────────────────────────────

test("填码的位置，文案里说的和界面上实际所在的是同一处", () => {
  // 现在 accessErrorMessage 把「收藏 · 复习」页底部写死在字符串里。
  // 设置项一挪，这句话就骗人，而且不会有任何测试变红。
  const { ACCESS_CODE_WHERE } = load("");
  const at = html.indexOf('id="accessCodeInput"');
  assert.ok(at !== -1, "找不到邀请码输入框");
  // 输入框往前找它所在的那个屏，屏的标签必须就是文案里说的那个地方。
  const before = html.slice(0, at);
  const screenAt = before.lastIndexOf('class="screen"');
  assert.ok(screenAt !== -1, "邀请码输入框不在任何一个屏里");
  const screen = html.slice(screenAt, at);
  assert.ok(screen.includes(ACCESS_CODE_WHERE),
    `文案说码填在「${ACCESS_CODE_WHERE}」，但输入框不在那个屏里`);
});

test("撞墙之后的那句话，和撞墙之前的说的是同一个地方", () => {
  const { accessErrorMessage, ACCESS_CODE_WHERE } = load("");
  const msg = accessErrorMessage(403);
  assert.ok(msg, "403 没有给出任何说明");
  assert.ok(msg.includes(ACCESS_CODE_WHERE),
    `事后提示说的地方和事前提示不一致：「${msg}」`);
});

test("不是邀请码的问题，就不要把他支去改邀请码", () => {
  // 控制组，也是原有行为：500 是服务端配置、502 是上游，
  // 让家长去检查自己的码是把他支去修一个没坏的东西。
  const { accessErrorMessage } = load("");
  assert.equal(accessErrorMessage(500), null);
  assert.equal(accessErrorMessage(502), null);
  assert.equal(accessErrorMessage(200), null);
});

let failed = 0;
for (const t of tests) {
  try { t.fn(); console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed}/${tests.length} 条失败` : `\n✓ all ${tests.length} tests passed`);
process.exit(failed ? 1 : 0);
