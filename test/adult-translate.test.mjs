#!/usr/bin/env node
// 家长有时候要翻的不是对孩子说的话。
//
// 现在的毛病不是「翻不了」，是提示词第 5 条：输入不合当前年龄段时，它会把
// 内容改写成适合那个年龄的话。所以家长想翻「孩子今天有点发烧，想请一天假」，
// 拿回来的是一句幼儿话——看起来成功了，其实答非所问。服务端的 VALID_AGES
// 也只认三个儿童档，没有别的出口。
//
// 加一档「成人」：这一档的提示词换成照实翻译，不许迁就年龄，也不许把对方
// 当成小孩；提示语从「边说边做什么动作」换成「什么场合、什么语气用它」。
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   家长要给老师发一句请假的话。他在翻译那一栏选「成人」，输入中文，
//   拿回来的是一句真正的成年人英语，而不是被改写成哄孩子的句子。
//   他给孩子翻话时，那三档一个字都没变。
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");
const mod = await import("../netlify/functions/translate.mjs");
const { VALID_AGES, systemPrompt, FEW_SHOT, ADULT_AGE } = mod;

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test("服务端认「成人」这一档", () => {
  assert.ok(ADULT_AGE, "没有给成人档一个名字");
  assert.ok(VALID_AGES.has(ADULT_AGE), `${ADULT_AGE} 不在服务端认的名单里`);
  for (const a of ["1-2", "2-3", "3-6"]) {
    assert.ok(VALID_AGES.has(a), `${a} 被弄丢了`);
  }
});

test("成人档照实翻译，不再迁就年龄", () => {
  const p = systemPrompt(ADULT_AGE);
  assert.doesNotMatch(p, /adapt it to what works at this age/,
    "还留着那条改写规则——成人内容会继续被改成幼儿话");
  assert.match(p, /faithful|as-is|without simplif/i,
    "没有明确要求照实翻译");
});

test("成人档不把对方当小孩", () => {
  const p = systemPrompt(ADULT_AGE);
  assert.doesNotMatch(p, /year-old child/,
    "还在说「对你 N 岁的孩子说」");
  assert.doesNotMatch(p, /toddler/i, "还在提幼儿");
});

test("成人档有自己的例子，不是拿哄孩子的句子凑数", () => {
  assert.ok(Array.isArray(FEW_SHOT[ADULT_AGE]) && FEW_SHOT[ADULT_AGE].length >= 3,
    "成人档至少要有三个例子");
  const childEn = new Set(["1-2", "2-3", "3-6"].flatMap(a => FEW_SHOT[a].map(e => e.en)));
  for (const e of FEW_SHOT[ADULT_AGE]) {
    assert.ok(!childEn.has(e.en), `「${e.en}」是从儿童档搬过来的`);
    assert.ok(e.tip && e.tip.trim(), "成人档的例子没有给用法说明");
  }
});

test("三个儿童档一个字都没变", () => {
  for (const a of ["1-2", "2-3", "3-6"]) {
    const p = systemPrompt(a);
    assert.match(p, /adapt it to what works at this age/,
      `${a} 档的改写规则被顺手删了——那条对孩子是对的`);
    assert.match(p, new RegExp(`${a}-year-old child`),
      `${a} 档不再说明是对多大的孩子说`);
  }
});

test("帮我说里能选到「成人」，而且和服务端认的是同一批", () => {
  const m = html.match(/const TRANSLATE_AGE_KEYS = \[([^\]]*)\]/);
  assert.ok(m, "找不到客户端那份档位清单");
  const keys = [...m[1].matchAll(/"([^"]+)"/g)].map(x => x[1]);
  assert.deepEqual([...keys].sort(), [...VALID_AGES].sort(),
    "界面上能选的和服务端认的对不上——选了会失败，而且没人会红");
  assert.match(html, new RegExp(`data-tage="${ADULT_AGE}"`), "翻译那一栏没有成人这个选项");
  assert.match(html, /成人/, "成人这一档没有给家长看的中文名字");
});

test("挑给孩子看的场景时，选不到「成人」", () => {
  // currentAge 决定场景里显示哪一档的预设短句。那里没有成人内容，
  // 让它可选等于承诺一个不存在的东西。
  const at = html.indexOf('id="agePicker"');
  const picker = html.slice(at, html.indexOf("</div>\n</div>", at));
  assert.ok(!picker.includes(`data-age="${ADULT_AGE}"`),
    "宝宝年龄那个选择器里冒出了成人档");
});

test("选了成人之后，按钮和免责声明不再说「儿童」「宝宝」", () => {
  // 一个写着「翻译成儿童英语」的按钮，在成人档下说的是它不会做的事。
  assert.match(html, /function syncTranslateCopy/, "没有地方让这些文案跟着档位走");
  const at = html.indexOf("function syncTranslateCopy");
  const body = html.slice(at, html.indexOf("\nfunction ", at + 10));
  assert.match(body, /translateAge === "adult"/, "没有按档位分岔");
  assert.match(body, /翻译成英语/, "成人档下按钮还写着儿童英语");
  assert.match(html, /function translateDisclaimer/, "免责声明没有跟着档位走");
  const at2 = html.indexOf("function translateDisclaimer");
  const body2 = html.slice(at2, html.indexOf("\n}", at2));
  assert.ok(!/确认适合宝宝[\s\S]*adult|adult[\s\S]*确认适合宝宝/.test(body2.split("?")[1] || ""),
    "成人档的免责声明还在提宝宝");
  assert.match(html, /selectTranslateAge[\s\S]{0,200}syncTranslateCopy\(\)/,
    "换了档位不重刷这些文案");
});

console.log("adult translate tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
