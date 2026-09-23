#!/usr/bin/env node
// 开启「到点提醒」失败时，界面上那句话要让家长看得懂。
//
// 报上来的情形（2026-09-22，Victor 在 preview 地址上）：点「开启提醒」，
// 界面显示「没开成：500 reminder not configured」。这是把服务器的英文原话
// 照抄给用户看。家长读不懂，也不知道下一步该干什么——而这个情况其实无解，
// preview 地址上根本没配提醒用的密钥，只有正式版有。
//
// 对应的用户情境（不含函数名）：
//   1. 在预览版上开提醒：告诉家长这个网址上没有提醒功能，去正式版，
//      不要甩一句英文。
//   2. 服务器一时出错（500/502/503/504）：告诉家长过一会儿再试，
//      而不是让他以为是自己弄错了。
//   3. 其他没见过的失败：如实说没开成，并且**把原始状态码留在括号里**——
//      家长看不懂也没关系，他会把这句话转给我，我需要它来查。
//   4. 无论哪种情况，这句话里都不许出现英文报错原文当主语；
//      也不许假装开成了。
//   5. 关闭提醒失败时同样是人话，而且说的是「没关成」不是「没开成」——
//      说反了会让家长以为提醒已经关掉，其实还开着。
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

function load() {
  const at = html.indexOf("function reminderFailureText(");
  assert.ok(at !== -1, "找不到 reminderFailureText —— 失败提示还没被抽成一个函数");
  const src = html.slice(at, html.indexOf("\n}", at) + 2);
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return ctx.reminderFailureText;
}

const hasChinese = s => /[一-龥]/.test(s);

test("预览版上开提醒：说清楚是这个网址没有提醒功能，要去正式版", () => {
  const say = load()(500, { error: "reminder not configured" });
  assert.ok(hasChinese(say), `应当是中文：${say}`);
  assert.doesNotMatch(say, /reminder not configured/, `不许照抄英文原文：${say}`);
  assert.match(say, /预览|正式版/, `要告诉家长去哪儿用：${say}`);
});

test("服务器一时出错：让家长过会儿再试，四个状态码都一样对待", () => {
  const f = load();
  for (const code of [500, 502, 503, 504]) {
    const say = f(code, { error: "boom" });
    assert.ok(hasChinese(say), `${code} 应当是中文：${say}`);
    assert.match(say, /再试|稍后|过一会/, `${code} 要给下一步：${say}`);
    assert.doesNotMatch(say, /boom/, `${code} 不许把服务器原话抄出来：${say}`);
  }
});

test("没见过的失败：如实说没开成，状态码留在括号里备查", () => {
  const say = load()(418, null);
  assert.ok(hasChinese(say), `应当是中文：${say}`);
  assert.match(say, /没开成/, `要如实说没成：${say}`);
  assert.match(say, /418/, `状态码要留着，我查问题要用：${say}`);
});

test("任何一种失败都不会说成已开启", () => {
  const f = load();
  for (const [code, out] of [[500, { error: "reminder not configured" }], [503, {}], [400, { error: "invalid body" }], [418, null]]) {
    const say = f(code, out);
    assert.doesNotMatch(say, /已开启|开好了|成功/, `${code} 不许假装开成了：${say}`);
    assert.ok(say.trim().length > 0, `${code} 不许给一句空话`);
  }
});

test("关闭提醒失败：说的是没关成，不是没开成", () => {
  const f = load();
  const say = f(500, { error: "boom" }, "关");
  assert.match(say, /再试|稍后|过一会/, `要给下一步：${say}`);
  const odd = f(418, null, "关");
  assert.match(odd, /没关成/, `要说没关成：${odd}`);
  assert.doesNotMatch(odd, /没开成/, `不许说反：${odd}`);
  assert.match(odd, /418/, `状态码要留着：${odd}`);
});

let pass = 0, fail = 0;
for (const t of tests) {
  try { t.fn(); console.log(`  ✓ ${t.name}`); pass++; }
  catch (e) { console.log(`  ✗ ${t.name}\n    ${e.message}`); fail++; }
}
console.log(fail ? `✗ ${fail} failed, ${pass} passed` : `✓ all ${pass} tests passed`);
process.exit(fail ? 1 : 0);
