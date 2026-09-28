#!/usr/bin/env node
// Behavioral tests for the on-device audio store — where a generated clip
// lives once it has been paid for.
//
// Zero-dependency: the module is extracted from index.html between its
// markers and run in a vm context, per test/access-code-client.test.mjs.
//
// ⚠️ WHAT THESE TESTS DO NOT COVER. Node has no IndexedDB, so the one below
// is hand-written. A hand-written fake can be unfaithful in exactly the way
// that leaves tests green while the phone fails — this project has already
// been bitten by a test-environment mismatch (the vm cross-realm prototype
// problem, test/data-export.test.mjs). So the division is deliberate:
//
//   these tests          → the module's own logic
//   the spike on device  → that IndexedDB works at all on iOS
//                          (2026-09-02: 38GB available, Blob stored directly,
//                           played back in airplane mode — see C11)
//
// Neither substitutes for the other. A green run here is not evidence that a
// clip survives on a real iPhone.
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   1. 家长收藏一句话，那句话的声音被生成出来、存在他自己手机上。
//      以后复习多少次都不再花钱，也不需要联网。
//
//   2. 存不下去的时候——隐私模式、存储被禁、空间满了——必须**明确知道
//      失败了**。声音是花钱生成的：假装存好了，等于钱花了、声音没了，
//      而家长要到几天后点播放才发现。
//
//   3. 复习列表要给几十条各自标出"这条有没有声音"。为了显示一个标记
//      就把几十个几十 KB 的音频全读出来，会让列表卡住。
//
//   4. 有些手机上 IndexedDB 根本用不了。那种情况下整个应用仍然要能用，
//      只是没有真人音频——不能因为存不了声音就点不动任何东西。
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
const require = createRequire(import.meta.url);

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");

const START = "/* ll:audio-store:start */";
const END = "/* ll:audio-store:end */";

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test("存音频只在 audio-store.js 里有一份：index.html 里的块删了，9 处调用点走别名，主脚本前加载，进了离线清单", () => {
  const code = html.replace(/<!--[\s\S]*?-->/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
  assert.ok(!html.includes(START), "index.html 里还有 ll:audio-store 块——同一件事两份实现");
  for (const fn of ["putAudio", "getAudio", "hasAudio", "clipKey", "whichHaveAudio"]) {
    assert.ok(!code.includes(`function ${fn}(`), `index.html 里还定义着 ${fn}()`);
    assert.ok(new RegExp(`var ${fn} = llAudioStore\\.${fn};`).test(code), `缺别名 var ${fn} = llAudioStore.${fn}（必须 var）`);
  }
  assert.ok(/llAudioStore\s*=\s*llAudioStoreLib\.create\(/.test(code), "index.html 没有用 create(deps) 建实例");
  const tagAt = html.indexOf('<script src="./audio-store.js"></script>');
  assert.ok(tagAt !== -1 && tagAt < html.indexOf("\n<script>\n"), "audio-store.js 要在主脚本之前加载");
  const sw = readFileSync(join(ROOT, "sw.js"), "utf8");
  assert.ok(sw.slice(sw.indexOf("const SHELL = ["), sw.indexOf("];", sw.indexOf("const SHELL = ["))).includes("audio-store.js"), "sw.js 的 SHELL 里没有它");
  const stamp = readFileSync(join(ROOT, "scripts/stamp-sw.mjs"), "utf8");
  assert.ok(stamp.slice(stamp.indexOf("const SOURCES = ["), stamp.indexOf("]", stamp.indexOf("const SOURCES = ["))).includes("audio-store.js"), "stamp-sw.mjs 的 SOURCES 里没有它");
  const src = readFileSync(join(ROOT, "audio-store.js"), "utf8").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
  for (const bad of ["document.", "window.", "localStorage", "typeof getVoice", "typeof indexedDB"]) {
    assert.ok(!src.includes(bad), `audio-store.js 里出现了「${bad}」——依赖要从 create(deps) 传进来`);
  }
});

test("换了音色之后，同一句话存的是另一把嗓子那一份，不会互相覆盖", async () => {
  // clipKey 用当前音色分键；这一条原来靠块里 typeof getVoice 抓全局，现在靠传进来的函数。
  let voice = "v-a";
  const { ctx } = loadModule({ getVoice: () => voice, defaultVoiceId: "v-default" });
  await ctx.putAudio(ID, clip());
  voice = "v-b";
  assert.equal(await ctx.hasAudio(ID), false, "换了嗓子之后不该读到上一把嗓子那一份");
  await ctx.putAudio(ID, clip());
  voice = "v-a";
  assert.equal(await ctx.hasAudio(ID), true, "换回来应当还在");
});

// ── A fake IndexedDB ────────────────────────────────────────────────────
// Faithful to the parts this module actually depends on: requests settle
// asynchronously via onsuccess/onerror, upgrades run once, and a transaction
// reaches one named store. Everything else a real IndexedDB does — versioning
// beyond first open, indexes, cursors, durability — is out of scope because
// the module does not use it.
function fakeIndexedDB({ failOpen = false, failWrite = false } = {}) {
  const stores = new Map();
  let opens = 0;

  const settle = (req, run) => {
    queueMicrotask(() => {
      try {
        req.result = run();
        req.onsuccess?.({ target: req });
      } catch (e) {
        req.error = e;
        req.onerror?.({ target: req });
      }
    });
    return req;
  };

  const objectStore = name => {
    if (!stores.has(name)) stores.set(name, new Map());
    const map = stores.get(name);
    return {
      put: (v, k) => settle({}, () => {
        if (failWrite) throw new DOMException("QuotaExceededError");
        map.set(k, v);
        return k;
      }),
      get: k => settle({}, () => map.get(k)),
      delete: k => settle({}, () => { map.delete(k); }),
      count: k => settle({}, () => (map.has(k) ? 1 : 0)),
      getAllKeys: () => settle({}, () => [...map.keys()]),
    };
  };

  return {
    _stores: stores,
    get _opens() { return opens; },
    open() {
      opens++;
      const req = {};
      queueMicrotask(() => {
        if (failOpen) {
          req.error = new DOMException("open refused");
          req.onerror?.({ target: req });
          return;
        }
        const db = {
          objectStoreNames: { contains: n => stores.has(n) },
          createObjectStore: n => { stores.set(n, new Map()); return objectStore(n); },
          transaction: n => ({ objectStore: () => objectStore(n) }),
        };
        req.result = db;
        req.onupgradeneeded?.({ target: req });
        req.onsuccess?.({ target: req });
      });
      return req;
    },
  };
}

// 2026-09-28（ADR 0009 第十块）：存音频这一块搬进 audio-store.js。
// 它的两个依赖（IndexedDB、当前音色）改为 create(deps) 传进来。
function loadModule({ idb = fakeIndexedDB(), getVoice = null, defaultVoiceId = null, voiceIds = [], cueVoiceId = null } = {}) {
  const p = join(ROOT, "audio-store.js");
  assert.ok(existsSync(p), "audio-store.js 还不存在——这一块该搬出 index.html 了");
  const ctx = require(p).create({ indexedDB: idb, getVoice, defaultVoiceId, voiceIds, cueVoiceId });
  for (const fn of ["putAudio", "getAudio", "hasAudio", "deleteAudio", "whichHaveAudio"]) {
    assert.equal(typeof ctx[fn], "function", `module must define ${fn}()`);
  }
  return { ctx, idb };
}

const ID = "t_1725300000000";
const clip = (n = 8) => new Blob([new Uint8Array(n).fill(0xff)], { type: "audio/mpeg" });

// ══ 1. 存进去，取回来还是那一条 ═══════════════════════════════════════

test("生成好的声音存下来，之后取回来还是那一段", async () => {
  const { ctx } = loadModule();
  await ctx.putAudio(ID, clip(64));
  const got = await ctx.getAudio(ID);
  assert.ok(got, "存进去的东西必须能取回来，否则那次生成的钱白花了");
  assert.equal(got.size, 64, "取回来的必须是同一段，不是别的什么");
});

test("存的是音频本身，不是转成文字的音频", async () => {
  // spike 的结论：转 base64 会大 33%，而且每次播放都要重新解码。
  // 直接存 Blob 是被实测验证过可行的那条路（C11）。
  const { ctx, idb } = loadModule();
  await ctx.putAudio(ID, clip());
  const stored = [...idb._stores.values()][0].get(ID);
  assert.ok(stored instanceof Blob, "存成字符串意味着每次播放都要多做一遍解码");
});

test("同一条重新生成时，覆盖旧的而不是报错", async () => {
  const { ctx } = loadModule();
  await ctx.putAudio(ID, clip(10));
  await ctx.putAudio(ID, clip(20));
  assert.equal((await ctx.getAudio(ID)).size, 20, "重新生成必须能替换掉旧的那段");
});

// ══ 2. 存不下去必须说出来 ═════════════════════════════════════════════

test("存不下去的时候明确返回失败，存得下去的时候明确返回成功", async () => {
  // 这一条是这组测试里最要紧的。声音是花钱生成的：假装存好了 = 钱花了、
  // 声音没了，而家长要到几天后点播放才发现。
  //
  // 两半必须写在一条里。只测「失败时返回 false」的话，一个永远返回
  // false 的实现也能通过——那样调用方会对每一条都报警。
  const ok = loadModule();
  assert.equal(await ok.ctx.putAudio(ID, clip()), true, "对照：正常情况下必须报告成功");

  const bad = loadModule({ idb: fakeIndexedDB({ failWrite: true }) });
  assert.equal(await bad.ctx.putAudio(ID, clip()), false,
    "调用方要靠这个返回值决定「要不要告诉家长这条暂时没有声音」");
});

test("存不下去也不会把整个应用带崩", async () => {
  const bad = loadModule({ idb: fakeIndexedDB({ failWrite: true }) });
  await assert.doesNotReject(() => bad.ctx.putAudio(ID, clip()));
  assert.equal(await bad.ctx.getAudio(ID), null, "没存进去就该老实说没有");
  // 对照：同一段音频在能写的库里必须取得回来，否则上面那个 null
  // 只是「这个模块什么都取不到」。
  const ok = loadModule();
  await ok.ctx.putAudio(ID, clip());
  assert.ok(await ok.ctx.getAudio(ID), "对照：正常情况下必须取得回来");
});

// ══ 3. 这台手机根本用不了 IndexedDB ═══════════════════════════════════

test("数据库打不开时，一切降级为「没有声音」而不是报错", async () => {
  // 隐私模式、被锁死的 webview、用户关掉了站点数据。这些手机上整个应用
  // 仍然要能用：预设短语、复习、界面全都照常，只是没有真人音频。
  const bad = loadModule({ idb: fakeIndexedDB({ failOpen: true }) });
  assert.equal(await bad.ctx.putAudio(ID, clip()), false);
  assert.equal(await bad.ctx.getAudio(ID), null);
  assert.equal(await bad.ctx.hasAudio(ID), false);
  await assert.doesNotReject(() => bad.ctx.deleteAudio(ID));

  // 对照组，否则这四行对一个什么都不做的实现同样成立。
  const ok = loadModule();
  assert.equal(await ok.ctx.putAudio(ID, clip()), true, "对照：库能打开时必须真的存进去");
  assert.equal(await ok.ctx.hasAudio(ID), true, "对照：库能打开时必须查得到");
});

test("浏览器里压根没有 IndexedDB 这个东西时也不崩", async () => {
  // 2026-09-28：改为不给 create() 传 indexedDB——和「这个浏览器没有它」是同一件事。
  const { ctx } = loadModule({ idb: null });
  assert.equal(await ctx.putAudio(ID, clip()), false);
  assert.equal(await ctx.getAudio(ID), null);
  assert.equal(await ctx.hasAudio(ID), false);

  const ok = loadModule();
  assert.equal(await ok.ctx.hasAudio(ID), false, "对照：这一条在有库时也该是 false（还没存）");
  await ok.ctx.putAudio(ID, clip());
  assert.equal(await ok.ctx.hasAudio(ID), true, "对照：有 IndexedDB 时必须真的能用");
});

// ══ 4. 列表要问「有没有」，不该为此读出全部内容 ═══════════════════════

test("问一条有没有声音，不必把那段音频读出来", async () => {
  const { ctx } = loadModule();
  await ctx.putAudio(ID, clip(52000));
  assert.equal(await ctx.hasAudio(ID), true);
  assert.equal(await ctx.hasAudio("t_nothing_here"), false);
});

test("一次问一批，而不是几十条各查一次", async () => {
  // 复习列表要给每条标出有没有声音。几十条各开一次事务，
  // 会让列表在慢手机上肉眼可见地卡一下。
  const { ctx } = loadModule();
  await ctx.putAudio("a", clip());
  await ctx.putAudio("c", clip());
  const has = await ctx.whichHaveAudio(["a", "b", "c"]);
  assert.deepEqual([...has].sort(), ["a", "c"],
    "返回的是「这些里面哪几条有」，调用方据此打标记");
});

test("问一个空列表，直接得到空结果，不去开数据库", async () => {
  const { ctx, idb } = loadModule();
  assert.deepEqual([...(await ctx.whichHaveAudio([]))], []);
  assert.equal(idb._opens, 0, "空列表不该产生任何数据库动作");
  // 对照：非空列表必须真的去查，否则上面那个 0 只说明它从不查任何东西。
  await ctx.whichHaveAudio(["a"]);
  assert.equal(idb._opens, 1, "对照：有内容要查时必须真的开库");
});

// ══ 5. 取消收藏之后 ═══════════════════════════════════════════════════

test("删掉一条之后它真的不在了，而且没波及别的条目", async () => {
  const { ctx } = loadModule();
  await ctx.putAudio(ID, clip());
  await ctx.putAudio("t_other", clip());
  assert.equal(await ctx.hasAudio(ID), true, "对照：删之前必须确实在");
  await ctx.deleteAudio(ID);
  assert.equal(await ctx.hasAudio(ID), false);
  assert.equal(await ctx.hasAudio("t_other"), true,
    "删一条不能顺手删掉别的——那是家长花钱生成的另一段声音");
});

test("删一条不存在的，安安静静地什么都不做", async () => {
  const { ctx } = loadModule();
  await ctx.putAudio("t_keep", clip());
  await assert.doesNotReject(() => ctx.deleteAudio("t_never_existed"));
  assert.equal(await ctx.hasAudio("t_keep"), true, "对照：这次无效删除不该动到已有的");
});

// ══ 6. 打开数据库这件事只做一次 ═══════════════════════════════════════

test("连着用很多次，数据库只打开一次", async () => {
  // 每次调用都重开一次，会让「给列表里几十条打标记」这件事
  // 变成几十次开库。
  const { ctx, idb } = loadModule();
  await ctx.putAudio("a", clip());
  await ctx.getAudio("a");
  await ctx.hasAudio("a");
  await ctx.whichHaveAudio(["a"]);
  assert.equal(idb._opens, 1, `开了 ${idb._opens} 次`);
});

test("同时发起的多个请求，不会各开各的库", async () => {
  // 保存一条的同时列表正在渲染——两条路径会在同一瞬间要用数据库。
  const { ctx, idb } = loadModule();
  await Promise.all([
    ctx.putAudio("a", clip()),
    ctx.getAudio("b"),
    ctx.hasAudio("c"),
  ]);
  assert.equal(idb._opens, 1, "并发的第一批请求必须共用同一次打开");
});

// ── Runner ───────────────────────────────────────────────
console.log("audio-store tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
