#!/usr/bin/env node
// Behavioral tests for the audio marks surviving a restart.
//
// Zero-dependency: the ll:audio-provision block is extracted from index.html
// and run in a vm context, per test/audio-provision.test.mjs.
//
// THE BUG THIS EXISTS FOR. audioMarkFor() answers from three in-memory Sets
// that only this session's requestAudio() ever fills. Close the app and open
// it again and all three are empty, so every saved translation shows 🔈 — no
// sound — while its clip sits on the device. Playback still worked, because
// the list primes addresses straight from storage, so the parent saw a row
// claiming to be silent that spoke when tapped.
//
// whichHaveAudio() was built for exactly this and then never called from
// anywhere. Found by asking which capabilities exist that nothing uses — the
// same shape as the primeAudioUrl gap one commit earlier, and invisible to
// tests that check only the calls that ARE there.
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   1. 家长昨天收藏了几句，今天重新打开 App。那几行上仍然是 🔊 ——
//      声音本来就在手机里，界面不该说没有。
//
//   2. 昨天没生成出来的那几条，今天仍然显示没有声音，可以点着补。
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import assert from "node:assert/strict";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");

const START = "/* ll:audio-provision:start */";
const END = "/* ll:audio-provision:end */";

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

const mp3 = () => new Blob([new Uint8Array(8).fill(0xff)], { type: "audio/mpeg" });

function loadModule({ present = [] } = {}) {
  const s = html.indexOf(START), e = html.indexOf(END);
  assert.ok(s !== -1 && e !== -1, `index.html must contain ${START} … ${END} markers`);
  const map = new Map(present.map(id => [id, mp3()]));
  const asked = [];
  const ctx = {
    console, queueMicrotask, setTimeout, Blob,
    navigator: { onLine: true },
    getAccessCode: () => "code",
    accessHeaders: () => ({ "Content-Type": "application/json" }),
    refreshAudioMarks: () => {},
    primeAudioUrl: () => Promise.resolve("blob:fake"),
    putAudio: async () => true,
    getAudio: async id => map.get(id) ?? null,
    hasAudio: async id => map.has(id),
    deleteAudio: async id => { map.delete(id); },
    whichHaveAudio: async ids => { asked.push(ids); return new Set(ids.filter(i => map.has(i))); },
    fetch: async () => new Response(mp3(), { status: 200, headers: { "Content-Type": "audio/mpeg" } }),
  };
  vm.createContext(ctx);
  vm.runInContext(html.slice(s, e + END.length), ctx);
  assert.equal(typeof ctx.syncAudioMarks, "function", "module must define syncAudioMarks()");
  return { ctx, asked };
}

// ══ 1. 重新打开之后，声音还在的那几条仍然标着有声音 ═══════════════════

test("重新打开 App，本机存过的那几条仍然显示为有声音", async () => {
  // 这一条是本文件存在的理由。内存里的记录随进程消失，手机上的音频不会。
  const { ctx } = loadModule({ present: ["a", "c"] });
  assert.equal(ctx.audioMarkFor("a"), "none", "对照：同步之前它确实是「没有」");
  await ctx.syncAudioMarks(["a", "b", "c"]);
  assert.equal(ctx.audioMarkFor("a"), "ready");
  assert.equal(ctx.audioMarkFor("c"), "ready");
  assert.equal(ctx.audioMarkFor("b"), "none", "本机没有的那条，标记仍然是没有");
});

test("一次问一批，而不是几十条各问一次", async () => {
  const { ctx, asked } = loadModule({ present: ["a"] });
  await ctx.syncAudioMarks(["a", "b", "c"]);
  assert.equal(asked.length, 1, "列表渲染时几十次单查会让界面卡一下");
  assert.deepEqual(asked[0], ["a", "b", "c"]);
});

test("空列表不去查存储", async () => {
  const { ctx, asked } = loadModule({ present: ["a"] });
  await ctx.syncAudioMarks([]);
  assert.equal(asked.length, 0);
  await ctx.syncAudioMarks(["a"]);
  assert.equal(asked.length, 1, "对照：有内容要查时必须真的去查");
});

// ══ 2. 不覆盖本次会话已经知道的状态 ═══════════════════════════════════

test("正在生成的那一条，不会被同步改成别的状态", async () => {
  // 同步发生在列表渲染时，而那一刻可能有一条正在生成。把它改掉的话，
  // 家长会看到 ⏳ 无缘无故变成 🔈。
  const { ctx } = loadModule({ present: [] });
  const inFlight = ctx.requestAudio({ id: "x", en: "Hello." });
  assert.equal(ctx.audioMarkFor("x"), "pending");
  await ctx.syncAudioMarks(["x"]);
  assert.equal(ctx.audioMarkFor("x"), "pending", "同步不该打断正在进行的那一条");
  await inFlight;
});

test("刚刚失败过的那一条，同步之后仍然是失败", async () => {
  // 失败是唯一「你可以做点什么」的状态。被同步抹成「还没生成」的话，
  // 家长就不知道那是试过没成的。
  const { ctx } = loadModule({ present: [] });
  const bad = loadModule({ present: [] });
  bad.ctx.fetch = async () => new Response("x", { status: 502 });
  await bad.ctx.requestAudio({ id: "y", en: "Hello." });
  assert.equal(bad.ctx.audioMarkFor("y"), "failed");
  await bad.ctx.syncAudioMarks(["y"]);
  assert.equal(bad.ctx.audioMarkFor("y"), "failed");
  void ctx;
});

// ══ 3. 列表真的调了它 ═════════════════════════════════════════════════

test("收藏列表渲染时会去同步一次", async () => {
  const at = html.indexOf("function renderSavedScreen");
  assert.ok(at !== -1, "renderSavedScreen not found");
  const body = html.slice(at, html.indexOf("\nfunction ", at + 10));
  assert.match(body, /syncAudioMarks\(/,
    "不同步的话，重开 App 后每一行都会谎称自己没有声音");
});

// ── Runner ───────────────────────────────────────────────
console.log("marks-after-reload tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
