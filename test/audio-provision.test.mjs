#!/usr/bin/env node
// Behavioral tests for the layer between "a parent saved a phrase" and "that
// phrase has a voice on their phone" — see ADR 0003.
//
// Zero-dependency: the module is extracted from index.html between its markers
// and run in a vm context, per test/audio-store.test.mjs.
//
// The shape of this feature was decided before it was written: the save lands
// FIRST and instantly, and the voice catches up in the background. The phrase
// text is the irreplaceable part; audio is an enhancement. Making a parent
// wait three seconds on every save — or worse, losing the save because the
// network was down — would be paying for audio with the one thing the app is
// actually for. See jtbd.md: the job is 「别让我发起」, and friction at save
// time works directly against it.
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   1. 家长点「收藏」，句子立刻就在列表里了。几秒之后那一条自己长出
//      一个喇叭标记——他不用等，也不用做任何事。
//
//   2. 没网、或者生成失败了：句子照样在，只是那一条标着「暂时没有声音」。
//      收藏这个动作**从不因为声音而失败**。
//
//   3. 同一句话不会被生成两次。这是这整套设计省钱的核心——已经有声音的
//      条目、正在生成中的条目，都不该再花一次钱。
//
//   4. 没有邀请码的时候不去发那个必然被拒的请求。
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

const CODE = "test-access-code-1234";
const ITEM = { id: "t_1725300000000", en: "Time for bed, sweetie.", zh: "该睡觉了" };
const mp3 = () => new Blob([new Uint8Array(64).fill(0xff)], { type: "audio/mpeg" });

// The audio store is this project's own code (tested in audio-store.test.mjs),
// but it lives in a different marker block. A fake stands in here so a failure
// in THIS file always means this layer is wrong — the two are wired together
// for real in the browser, and that wiring is asserted at the bottom.
function fakeStore({ failPut = false, present = [] } = {}) {
  const map = new Map(present.map(id => [id, mp3()]));
  return {
    _map: map,
    putAudio: async (id, blob) => { if (failPut) return false; map.set(id, blob); return true; },
    getAudio: async id => map.get(id) ?? null,
    hasAudio: async id => map.has(id),
    deleteAudio: async id => { map.delete(id); },
    whichHaveAudio: async ids => new Set(ids.filter(i => map.has(i))),
  };
}

function loadModule({
  store = fakeStore(),
  code = CODE,
  onLine = true,
  fetchImpl,
  render,
} = {}) {
  const s = html.indexOf(START), e = html.indexOf(END);
  assert.ok(s !== -1 && e !== -1, `index.html must contain ${START} … ${END} markers`);
  const fetchCalls = [];
  const renders = [];
  const ctx = {
    ...store,
    console,
    queueMicrotask,
    setTimeout,
    Blob,
    navigator: { onLine },
    // accessHeaders() and getAccessCode() live in the ll:access-code block.
    getAccessCode: () => code,
    accessHeaders: () => {
      const h = { "Content-Type": "application/json" };
      if (code) h["X-LL-Access"] = code;
      return h;
    },
    // The list re-renders when a clip lands; without it the ⏳ never changes.
    refreshAudioMarks: () => { renders.push(true); if (render) render(); },
    fetch: async (...args) => {
      fetchCalls.push(args);
      if (fetchImpl) return fetchImpl(...args);
      return new Response(mp3(), { status: 200, headers: { "Content-Type": "audio/mpeg" } });
    },
  };
  vm.createContext(ctx);
  vm.runInContext(html.slice(s, e + END.length), ctx);
  for (const fn of ["requestAudio", "audioMarkFor", "retryAudio"]) {
    assert.equal(typeof ctx[fn], "function", `module must define ${fn}()`);
  }
  return { ctx, store, fetchCalls, renders };
}

// ══ 1. 收藏之后，声音自己补上 ═════════════════════════════════════════

test("收藏一句话之后，它的声音被生成并存在这台手机上", async () => {
  const { ctx, store } = loadModule();
  assert.equal(await ctx.requestAudio(ITEM), true);
  assert.ok(await store.getAudio(ITEM.id), "生成完必须落到本机，否则复习时还得再花一次钱");
});

test("送去生成的是那句英文，中文不出门", async () => {
  // 中文是家长自己打进去的内容。它对生成语音没有任何用处，
  // 而每一个不必要送出去的字段都是一次不必要的暴露。
  const { ctx, fetchCalls } = loadModule();
  await ctx.requestAudio(ITEM);
  const body = String(fetchCalls[0][1].body);
  assert.match(body, /Time for bed, sweetie\./);
  assert.ok(!body.includes("该睡觉了"), "中文不该被送去语音服务");
});

test("生成请求带着邀请码——它是付费端点", async () => {
  const { ctx, fetchCalls } = loadModule();
  await ctx.requestAudio(ITEM);
  const [url, opts] = fetchCalls[0];
  assert.equal(String(url), "/api/tts");
  assert.equal(new Headers(opts.headers).get("X-LL-Access"), CODE);
});

test("声音落地之后，列表被通知刷新", async () => {
  // 没有这一步，那个「生成中」的标记会一直转下去，
  // 而声音其实早就在手机上了。
  const { ctx, renders } = loadModule();
  await ctx.requestAudio(ITEM);
  assert.ok(renders.length > 0, "列表不刷新的话，家长看不到声音已经好了");
});

// ══ 2. 收藏从不因为声音而失败 ═════════════════════════════════════════

test("生成失败时返回失败，但不抛异常——收藏这个动作不受影响", async () => {
  const ok = loadModule();
  assert.equal(await ok.ctx.requestAudio(ITEM), true, "对照：正常情况下必须成功");

  const bad = loadModule({ fetchImpl: async () => new Response("nope", { status: 502 }) });
  assert.equal(await bad.ctx.requestAudio(ITEM), false);
  await assert.doesNotReject(() => bad.ctx.requestAudio(ITEM));
});

test("网络直接断掉时也一样，安静地失败", async () => {
  const bad = loadModule({ fetchImpl: async () => { throw new TypeError("fetch failed"); } });
  assert.equal(await bad.ctx.requestAudio(ITEM), false);
  assert.equal(bad.ctx.audioMarkFor(ITEM.id), "failed", "要标成失败，否则家长看到的是永远转圈");

  const ok = loadModule();
  assert.equal(await ok.ctx.requestAudio(ITEM), true, "对照：网络正常时必须成功");
});

test("存不进本机时算失败，而不是假装好了", async () => {
  // 声音生成出来了、钱花掉了，但没存下去。这跟没生成一样，
  // 而且更坏——因为它看起来是成功的。
  const bad = loadModule({ store: fakeStore({ failPut: true }) });
  assert.equal(await bad.ctx.requestAudio(ITEM), false);

  const ok = loadModule();
  assert.equal(await ok.ctx.requestAudio(ITEM), true, "对照：能存的时候必须报告成功");
});

test("离线的时候根本不发请求", async () => {
  // 明知必然失败还发一次，只是白等一个超时。
  const off = loadModule({ onLine: false });
  assert.equal(await off.ctx.requestAudio(ITEM), false);
  assert.equal(off.fetchCalls.length, 0);

  const on = loadModule();
  await on.ctx.requestAudio(ITEM);
  assert.equal(on.fetchCalls.length, 1, "对照：有网的时候必须真的去请求");
});

test("没有邀请码时不发那个必然被拒的请求", async () => {
  const none = loadModule({ code: "" });
  assert.equal(await none.ctx.requestAudio(ITEM), false);
  assert.equal(none.fetchCalls.length, 0, "没有码的请求一定是 403，发出去只是白跑");

  const has = loadModule();
  await has.ctx.requestAudio(ITEM);
  assert.equal(has.fetchCalls.length, 1, "对照：有码的时候必须真的去请求");
});

// ══ 3. 同一句话绝不生成两次 ═══════════════════════════════════════════

test("已经有声音的条目，不再花钱重新生成", async () => {
  // 这一条是整套设计省钱的核心。恢复备份、重新收藏同一句话、
  // 界面重绘——每一个都可能让同一条被再问一次。
  const { ctx, fetchCalls } = loadModule({ store: fakeStore({ present: [ITEM.id] }) });
  assert.equal(await ctx.requestAudio(ITEM), true, "已经有了，就算成功");
  assert.equal(fetchCalls.length, 0, "一次都不该再花钱");
});

test("连点两下收藏，也只生成一次", async () => {
  const { ctx, fetchCalls } = loadModule();
  await Promise.all([ctx.requestAudio(ITEM), ctx.requestAudio(ITEM)]);
  assert.equal(fetchCalls.length, 1, "同一条同时发起两次，只该有一次真的花钱");
});

test("生成完之后再问一次，还是不重复花钱", async () => {
  const { ctx, fetchCalls } = loadModule();
  await ctx.requestAudio(ITEM);
  await ctx.requestAudio(ITEM);
  assert.equal(fetchCalls.length, 1);
});

// ══ 4. 那一条现在长什么样 ═════════════════════════════════════════════

test("生成中、已就绪、没有声音——三种状态各不相同", async () => {
  // 界面靠这个决定画 ⏳、🔊 还是 ⚠。三者混在一起的话，
  // 家长分不清「还在生成」和「生成失败了」，也就不知道要不要重试。
  const { ctx } = loadModule();
  assert.equal(ctx.audioMarkFor(ITEM.id), "none", "还没开始时是「没有声音」");
  const inFlight = ctx.requestAudio(ITEM);
  assert.equal(ctx.audioMarkFor(ITEM.id), "pending", "请求发出去之后是「生成中」");
  await inFlight;
  assert.equal(ctx.audioMarkFor(ITEM.id), "ready", "落地之后是「有声音」");
});

test("失败过的条目标成失败，而不是永远转圈", async () => {
  const { ctx } = loadModule({ fetchImpl: async () => new Response("x", { status: 502 }) });
  await ctx.requestAudio(ITEM);
  assert.equal(ctx.audioMarkFor(ITEM.id), "failed",
    "一直显示「生成中」会让家长以为还在跑，其实早就没了下文");
});

test("重试一条失败过的，会真的再试一次", async () => {
  let fail = true;
  const { ctx, fetchCalls, store } = loadModule({
    fetchImpl: async () => fail
      ? new Response("x", { status: 502 })
      : new Response(mp3(), { status: 200, headers: { "Content-Type": "audio/mpeg" } }),
  });
  await ctx.requestAudio(ITEM);
  assert.equal(ctx.audioMarkFor(ITEM.id), "failed");
  fail = false;
  assert.equal(await ctx.retryAudio(ITEM), true);
  assert.equal(fetchCalls.length, 2, "重试必须真的再发一次");
  assert.ok(await store.getAudio(ITEM.id));
  assert.equal(ctx.audioMarkFor(ITEM.id), "ready");
});

test("界面刷新那一步出错时，收藏这条路径仍然不会炸", async () => {
  // requestAudio() 在两个保存入口都是「发出去就不管」的 —— 没有人 await 它。
  // 所以它内部任何一个抛出的异常都没人接，会变成一个 unhandled rejection。
  // 渲染层出问题不该让保存这条路径出问题。
  const { ctx } = loadModule({ render: () => { throw new Error("渲染炸了"); } });
  await assert.doesNotReject(() => ctx.requestAudio(ITEM));
  assert.notEqual(ctx.audioMarkFor(ITEM.id), "pending",
    "刷新出错也必须把「生成中」这个状态收掉，否则那一条永远在转圈");
});

// ══ 5. 两个保存入口都接上了 ═══════════════════════════════════════════

test("翻译和查词两个收藏动作，都会去补声音", async () => {
  // 断言的是源码，因为这两个函数要 DOM 才能跑。要紧的是没有一条
  // 保存路径被漏掉——漏掉的那条会安静地永远没有声音。
  // 翻译那条现在经由共用的 saveTranslatedPhrase()，所以验的是整条链：
  // 入口 → 共用实现 → 补声音。只验入口有 requestAudio( 的话，重构一次就
  // 会误报；只验共用实现有的话，入口不调它也发现不了。
  const reaches = (fnName, hop) => {
    const at = html.indexOf(fnName);
    assert.ok(at !== -1, `${fnName} 没找到`);
    const body = html.slice(at, html.indexOf("\n}", at));
    return new RegExp(hop.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\(").test(body);
  };
  assert.ok(reaches("function saveTranslation", "saveTranslatedPhrase"),
    "翻译收藏必须走共用的保存实现");
  assert.ok(reaches("function saveTranslatedPhrase", "requestAudio"),
    "共用的保存实现必须去补声音，否则两个入口一起哑掉");
  assert.ok(reaches("function saveDictSense", "requestAudio"),
    "查词这条保存路径没有去补声音，那些条目会永远是哑的");
});

test("真正的存储模块和这一层是接在一起的，不是各写各的", async () => {
  // 这一层在测试里用的是假的存储。生产代码里它必须调用真的那个
  // （ll:audio-store），否则两边可以各自绿着而拼不到一起。
  const s = html.indexOf(START), e = html.indexOf(END);
  const src = html.slice(s, e);
  assert.match(src, /putAudio\(/, "必须把生成结果交给真正的存储模块");
  assert.match(src, /hasAudio\(|whichHaveAudio\(/, "必须先问过存储模块再决定要不要花钱");
});

// ── Runner ───────────────────────────────────────────────
console.log("audio-provision tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
