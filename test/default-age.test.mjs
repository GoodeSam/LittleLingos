#!/usr/bin/env node
// 第一次打开、没选过年龄的家长，看到的是哪一档。
//
// 2026-09-28 Victor 定：默认 3–6 岁（原来是 1–2 岁）。
// 存过的选择照旧生效；存的是坏值或早已不存在的档位，也退回这个默认。
//
// 对应的用户情境（不含函数名）：
//   1. 新手机第一次打开：场景页、翻译页、年龄选择框三处都停在 3–6 岁。
//   2. 上次选过 1–2 岁：仍然是 1–2 岁，默认值不覆盖选择。
//   3. 存储里是个乱值：退回 3–6 岁，不是打不开。
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import assert from "node:assert/strict";
import { injectStorage } from "./_storage-helper.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

function loadAge(stored) {
  const store = new Map();
  if (stored !== undefined) store.set("ll_age", stored);
  const ctx = { console, localStorage: {
    getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k),
  } };
  injectStorage(ctx);
  vm.createContext(ctx);
  // 只切两段：档位表那一行，和 loadStoredAge 本身——中间隔着别的模块实例化，切整段会撞库。
  const a = html.indexOf("const AGE_KEYS = [");
  const keys = html.slice(a, html.indexOf("\n", a)).replace(/^const /, "var ");
  const b = html.indexOf("function loadStoredAge(");
  const fn = html.slice(b, html.indexOf("\n}", b) + 2);
  vm.runInContext(keys + "\n" + fn, ctx);
  return ctx.loadStoredAge();
}

test("第一次打开、没选过年龄：默认 3–6 岁", () => {
  assert.equal(loadAge(undefined), "3-6", "没选过的家长看到的不是 3–6 岁");
});

test("上次选过 1–2 岁：仍然是 1–2 岁，默认值不覆盖选择", () => {
  assert.equal(loadAge("1-2"), "1-2");
  assert.equal(loadAge("0-1"), "0-1");
});

test("存储里是个乱值：退回 3–6 岁，不是打不开", () => {
  assert.equal(loadAge("7-9"), "3-6");
  assert.equal(loadAge(""), "3-6");
});

test("三处静态的选中态（场景页标签、翻译页档位、年龄选择框）都停在 3–6 岁——首屏还没同步前不闪一下别的档", () => {
  const tab = html.match(/<div class="age-tab active"[^>]*data-age="([^"]+)"/);
  const tage = html.match(/<div class="age-opt active"[^>]*data-tage="([^"]+)"/);
  const opt = html.match(/<div class="age-opt active"[^>]*data-age="([^"]+)"/);
  assert.ok(tab && tage && opt, "三处选中态少了一处");
  assert.deepEqual([tab[1], tage[1], opt[1]], ["3-6", "3-6", "3-6"], "静态选中态和默认值不一致，首屏会先闪一下别的档");
});

console.log("default-age tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message.split("\n")[0]}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
