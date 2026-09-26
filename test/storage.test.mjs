#!/usr/bin/env node
// 本机存储从今往后只有一个主人：storage.js。
//
// 为什么（ADR 0009 第二块）：index.html 里有 13 处直接碰 localStorage，
// 四种不同的出错处理；「收藏」这一份数据有 10 处一模一样的写入。
// 同一件事散在各处，改数据格式的时候必然漏掉一处——那是拆模块要解决的问题。
//
// 硬约束（Victor 2026-09-26 批准这一块时的条件）：
//   不改任何键名、不改任何数据格式、不做迁移。改完之后家长手机上的数据一个
//   字节都不变，换回旧版本照常能读。下面第一条测试就是钉这个的。
//
// 这个文件是普通脚本（不是 ES module）：收藏列表在页面一解析就要读，那时
// defer 的 module 还没到。它同时留一个 Node 能 require 的出口，所以能直接测。
// 纯度和播放模块一样：不碰 document / window，localStorage 从外面传进来。
//
// 对应的用户情境（不含函数名）：
//   1. 家长升级之后，收藏、自建场景、邀请码、年龄档……全都还在（键名和格式没变）。
//   2. 手机上存的收藏被弄坏了一条（手工改过、半截 JSON）：软件照常打开，坏的那条丢掉，
//      好的留着——不是一片白。
//   3. 微信里把存储关掉了、或隐私模式一读就抛：软件照常打开，当作什么都没存过。
//   4. 存不进去（存储满了、被禁）：界面上提示一次「无法保存到本机」，之后不再反复弹；
//      当前这一次操作照常完成，不因为存不进去而中断。
//   5. 删掉一个键（比如清邀请码）：删得掉就删，删不掉不炸。
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MODULE_PATH = join(ROOT, "storage.js");
const require = createRequire(import.meta.url);

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// 假的 localStorage：只 mock 不受本项目控制的东西。可以让它「读就抛」或「写就抛」。
function fakeBackend({ readThrows = false, writeThrows = false, seed = {} } = {}) {
  const map = new Map(Object.entries(seed));
  return {
    map,
    getItem(k) { if (readThrows) throw new Error("SecurityError"); return map.has(k) ? map.get(k) : null; },
    setItem(k, v) { if (writeThrows) throw new Error("QuotaExceededError"); map.set(k, String(v)); },
    removeItem(k) { if (writeThrows) throw new Error("SecurityError"); map.delete(k); },
  };
}

function load(opts = {}) {
  assert.ok(existsSync(MODULE_PATH), "storage.js 还不存在——这条测试就是用来逼它出生的");
  const lib = require(MODULE_PATH);
  assert.equal(typeof lib.createStorage, "function", "要导出 createStorage(deps)");
  const backend = fakeBackend(opts);
  const failures = [];
  const st = lib.createStorage({ backend, onWriteFailed: (k) => failures.push(k) });
  return { st, backend, failures, KEYS: lib.KEYS };
}

// ── 1：键名和格式一个都不许变 ───────────────────────────────
test("九个键名一个都没变——家长升级之后所有东西都还在", () => {
  const { KEYS } = load();
  assert.deepEqual({ ...KEYS }, {
    saved: "ll_saved", scenarios: "ll_scenarios", access: "ll_access", age: "ll_age",
    voice: "ll_voice", reminder: "ll_reminder", usedMeta: "ll_used_meta", audio: "ll_audio",
    installDismissed: "ll_install_dismissed", iosInstallDismissed: "ll_ios_install_dismissed",
    wechatInstallDismissed: "ll_wechat_install_dismissed",
  }, "键名表和上线版本对不上——改了键名等于把家长的数据弄丢");
  assert.ok(Object.isFrozen(KEYS), "键名表要冻结，不许运行时被改");
});

test("写进去的格式和原来一模一样：对象走 JSON.stringify，字符串原样", () => {
  const { st, backend } = load();
  const list = [{ id: "p1", en: "Bath time!", zh: "洗澡啦" }];
  st.write("ll_saved", list);
  assert.equal(backend.map.get("ll_saved"), JSON.stringify(list), "收藏的存法变了，旧版本会读不回来");
  st.write("ll_access", "abc ");
  assert.equal(backend.map.get("ll_access"), "abc ", "字符串不许被再包一层引号");
});

// ── 2：坏数据 ──────────────────────────────────────────────
test("收藏里有一条坏的：坏的丢掉、好的留着，不是一片白", () => {
  const { st } = load({ seed: { ll_saved: JSON.stringify([{ id: "a" }, null, 3, "x", { id: "b" }]) } });
  assert.deepEqual(st.readArray("ll_saved"), [{ id: "a" }, { id: "b" }]);
});

test("存的是半截 JSON、或者根本不是数组：当作空列表", () => {
  const a = load({ seed: { ll_saved: '[{"id":"a"' } });
  assert.deepEqual(a.st.readArray("ll_saved"), []);
  const b = load({ seed: { ll_saved: '{"not":"array"}' } });
  assert.deepEqual(b.st.readArray("ll_saved"), []);
  const c = load();
  assert.deepEqual(c.st.readArray("ll_saved"), [], "从没存过也该是空列表");
});

test("读一个对象（提醒设置、今日打卡）：坏了或没有就给默认值", () => {
  const { st } = load({ seed: { ll_reminder: '{"on":true', ll_used_meta: '{"date":"x","ids":[1]}' } });
  assert.deepEqual(st.readJSON("ll_reminder", null), null, "半截 JSON 该退回默认值");
  assert.deepEqual(st.readJSON("ll_used_meta", {}), { date: "x", ids: [1] });
  assert.deepEqual(st.readJSON("ll_never", { d: 1 }), { d: 1 }, "没存过该退回默认值");
});

test("读一个字符串（年龄档、音色、邀请码）：没有就给默认值，有就原样", () => {
  const { st } = load({ seed: { ll_age: "2-3", ll_access: "" } });
  assert.equal(st.readString("ll_age", "1-2"), "2-3");
  assert.equal(st.readString("ll_voice", "default"), "default");
  assert.equal(st.readString("ll_access", ""), "", "存的是空串就是空串");
});

// ── 3：存储被关掉 / 一读就抛 ───────────────────────────────
test("存储一读就抛（微信关了存储、隐私模式）：软件照常开，当作什么都没存过", () => {
  const { st } = load({ readThrows: true });
  assert.deepEqual(st.readArray("ll_saved"), []);
  assert.equal(st.readString("ll_age", "1-2"), "1-2");
  assert.deepEqual(st.readJSON("ll_reminder", {}), {});
  assert.equal(st.has("ll_install_dismissed"), false);
});

// ── 4：存不进去 ────────────────────────────────────────────
test("存不进去：只提示一次，之后不再反复弹；每次写都如实返回没成功", () => {
  const { st, failures } = load({ writeThrows: true });
  assert.equal(st.write("ll_saved", []), false);
  assert.equal(st.write("ll_age", "1-2"), false);
  assert.equal(st.write("ll_used_meta", { ids: [] }), false);
  assert.deepEqual(failures, ["ll_saved"], "应当只在第一次失败时通知界面一次");
});

test("存得进去：返回成功，不通知任何人", () => {
  const { st, failures, backend } = load();
  assert.equal(st.write("ll_age", "2-3"), true);
  assert.equal(backend.map.get("ll_age"), "2-3");
  assert.deepEqual(failures, []);
});

// ── 5：删 ──────────────────────────────────────────────────
test("删一个键：删得掉就删，删不掉不炸", () => {
  const ok = load({ seed: { ll_access: "code" } });
  assert.equal(ok.st.remove("ll_access"), true);
  assert.equal(ok.st.has("ll_access"), false);
  const bad = load({ writeThrows: true, seed: { ll_access: "code" } });
  assert.equal(bad.st.remove("ll_access"), false);
});

test("has()：存了非空值才算有——安装横幅「别再提醒」靠它记", () => {
  const { st } = load({ seed: { a: "1", b: "" } });
  assert.equal(st.has("a"), true);
  assert.equal(st.has("b"), false, "空串不算有（和原来 !!getItem 的判断一致）");
  assert.equal(st.has("c"), false);
});

// ── 模块本身的规矩 ─────────────────────────────────────────
test("这个文件是纯的：不碰 document、window，也不自己去抓 localStorage", () => {
  const src = readFileSync(MODULE_PATH, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
  for (const bad of ["document.", "window.", "localStorage"]) {
    assert.ok(!src.includes(bad), `storage.js 里出现了「${bad}」——存储后端要从 createStorage(deps) 传进来`);
  }
});

test("index.html 在主脚本之前加载它（收藏在页面一解析就要读），且进了离线缓存清单", () => {
  const html = readFileSync(join(ROOT, "index.html"), "utf8");
  const tagAt = html.indexOf('<script src="./storage.js"></script>');
  assert.ok(tagAt !== -1, 'index.html 里没有 <script src="./storage.js"></script>——注意不能带 defer，主脚本一解析就要用它');
  const mainAt = html.indexOf("\n<script>\n");
  assert.ok(mainAt !== -1 && tagAt < mainAt, "storage.js 必须排在主脚本前面，否则启动时读收藏会找不到它");
  const sw = readFileSync(join(ROOT, "sw.js"), "utf8");
  const shell = sw.slice(sw.indexOf("const SHELL = ["), sw.indexOf("];", sw.indexOf("const SHELL = [")));
  assert.ok(shell.includes("storage.js"), "sw.js 的 SHELL 里没有 storage.js——离线打开会白屏");
  const stamp = readFileSync(join(ROOT, "scripts/stamp-sw.mjs"), "utf8");
  const sources = stamp.slice(stamp.indexOf("const SOURCES = ["), stamp.indexOf("]", stamp.indexOf("const SOURCES = [")));
  assert.ok(sources.includes("storage.js"), "stamp-sw.mjs 的 SOURCES 里没有它——改了它缓存戳不变");
});

test("收藏这一份数据只有一处写入：谁改了收藏都叫 persistSaved()，不许各写各的", () => {
  const html = readFileSync(join(ROOT, "index.html"), "utf8");
  const code = html.replace(/<!--[\s\S]*?-->/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const writes = code.match(/safeSetItem\(\s*"ll_saved"/g) || [];
  assert.equal(writes.length, 1,
    `收藏有 ${writes.length} 处直接写入——改数据格式时必然漏掉一处（09-22 那类 bug 的根）。只允许 persistSaved() 里那一处`);
  const at = code.indexOf("function persistSaved(");
  assert.ok(at !== -1, "没有 persistSaved()");
  const body = code.slice(at, code.indexOf("\n}", at));
  assert.match(body, /safeSetItem\(\s*"ll_saved",\s*JSON\.stringify\(savedPhrases\)\)/,
    "persistSaved() 的存法必须和原来一模一样：JSON.stringify(savedPhrases)——不然旧版本读不回来");
  const calls = (code.match(/\bpersistSaved\(\)/g) || []).length - 1;   // 减掉定义本身
  assert.ok(calls >= 9, `只有 ${calls} 处叫 persistSaved()——原来 10 处写入，收完应当至少 9 处调用`);
});

test("index.html 里不再有人直接碰 localStorage——只剩把它交给模块的那三行", () => {
  const html = readFileSync(join(ROOT, "index.html"), "utf8");
  const code = html.replace(/<!--[\s\S]*?-->/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const hits = code.match(/localStorage\./g) || [];
  assert.equal(hits.length, 3,
    `index.html 里有 ${hits.length} 处直接碰 localStorage，只允许 createStorage() 那 3 行适配器——别处一律走 llStorage`);
});

let pass = 0, fail = 0;
for (const t of tests) {
  try { await t.fn(); console.log(`  ✓ ${t.name}`); pass++; }
  catch (e) { console.log(`  ✗ ${t.name}\n    ${e.message.split("\n")[0]}`); fail++; }
}
console.log(fail ? `✗ ${fail} failed, ${pass} passed` : `✓ all ${pass} tests passed`);
process.exit(fail ? 1 : 0);
