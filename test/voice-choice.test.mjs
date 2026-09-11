#!/usr/bin/env node
// 家长可以挑朗读用哪一把嗓子。
//
// 为什么。这个产品的用途是让家长照着念给孩子听，所以那个声音是他要模仿的
// 对象——有人想听女声，有人觉得男声更像自己。原来 Azure 的音色写死在
// netlify/functions/tts.mjs 里，一个字都改不了。
//
// 一条安全底线：音色名会被拼进 SSML 的 XML 属性里。任意字符串直接拼进去
// 就是一个注入口，所以服务端只认名单里的那几个，名单外的在花钱之前就挡下。
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   家长在设置里挑一把嗓子，点试听，当场听见它念一句。之后他自己存的句子
//   都用这把嗓子念。他手机里存着一个早就下架的音色时，软件自己退回默认，
//   而不是从此不出声。
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import assert from "node:assert/strict";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");
const { default: handler, ALLOWED_VOICES, DEFAULT_VOICE, CUE_VOICE } =
  await import("../netlify/functions/tts.mjs");

const CODE = "test-access-code-1234";
const SENTENCE = "Time for bed, sweetie.";
const MP3 = new Uint8Array([0xff, 0xfb, 0x90, 0x64]);
const ENV_OK = { LL_ACCESS_CODE: CODE, AZURE_SPEECH_KEY: "k", AZURE_SPEECH_REGION: "eastus" };

function withEnv(vars, fn) {
  const prev = {};
  for (const [k, v] of Object.entries(vars)) { prev[k] = process.env[k]; process.env[k] = v; }
  return Promise.resolve().then(fn).finally(() => {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  });
}
function req(body) {
  return new Request("https://example.test/api/tts", {
    method: "POST", headers: new Headers({ "X-LL-Access": CODE }), body: JSON.stringify(body),
  });
}
async function withStub(fn) {
  const calls = [];
  const prev = globalThis.fetch;
  globalThis.fetch = async (...args) => {
    calls.push(args);
    return new Response(MP3, { status: 200, headers: { "Content-Type": "audio/mpeg" } });
  };
  try { return await fn(calls); } finally { globalThis.fetch = prev; }
}
const ssmlOf = calls => String(calls[0][1].body);

// 客户端那一小段单独抽出来在沙箱里跑
const START = "/* ll:voice:start */", END = "/* ll:voice:end */";
function loadVoice(stored) {
  const s = html.indexOf(START), e = html.indexOf(END);
  assert.ok(s !== -1 && e !== -1 && e > s, "找不到 ll:voice 块");
  const store = new Map();
  if (stored) store.set("ll_voice", stored);
  const ctx = { console, localStorage: {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
  } };
  vm.createContext(ctx);
  vm.runInContext(html.slice(s + START.length, e), ctx);
  ctx.VOICE_OPTIONS = vm.runInContext("VOICE_OPTIONS", ctx);
  return ctx;
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test("没挑过的时候，用的是原来那把嗓子", async () => {
  await withEnv(ENV_OK, () => withStub(async calls => {
    const res = await handler(req({ text: SENTENCE }));
    assert.equal(res.status, 200);
    assert.ok(ssmlOf(calls).includes(DEFAULT_VOICE),
      `默认音色变了：${ssmlOf(calls)}`);
  }));
});

test("挑了名单里的一把，念出来的就是它", async () => {
  const other = ALLOWED_VOICES.find(v => v !== DEFAULT_VOICE);
  assert.ok(other, "名单里只有一个音色，等于没得挑");
  await withEnv(ENV_OK, () => withStub(async calls => {
    const res = await handler(req({ text: SENTENCE, voice: other }));
    assert.equal(res.status, 200);
    assert.ok(ssmlOf(calls).includes(other), "发出去的不是家长挑的那一把");
  }));
});

test("名单以外的音色，一分钱都不花就挡下", async () => {
  await withEnv(ENV_OK, () => withStub(async calls => {
    const res = await handler(req({ text: SENTENCE, voice: "en-US-NotARealVoice" }));
    assert.equal(res.status, 400);
    assert.equal(calls.length, 0, "已经打过去了才说不行，钱一样花掉了");
  }));
});

test("想借音色名往 SSML 里塞标记的，挡在打出去之前", async () => {
  const nasty = ["en-US-JennyNeural'/><prosody rate='+100%'>", "<voice name='x'>", "a&b", "'"];
  await withEnv(ENV_OK, () => withStub(async calls => {
    for (const v of nasty) {
      const res = await handler(req({ text: SENTENCE, voice: v }));
      assert.equal(res.status, 400, `${v} 应该被挡下`);
    }
    assert.equal(calls.length, 0, "坏音色一次都不该花钱");
  }));
});

test("设置里能挑，列出来的和服务端认的是同一批", () => {
  const ctx = loadVoice();
  assert.ok(Array.isArray(ctx.VOICE_OPTIONS) && ctx.VOICE_OPTIONS.length >= 2,
    "设置里至少得有两把嗓子可挑");
  const ids = ctx.VOICE_OPTIONS.map(v => v.id);
  // 2026-09-11 起服务端多认一把中文嗓子（连播里的中文提示用），它是内部用的，
  // 不该出现在选择器里——那是给英文句子挑嗓子的地方。所以这里从「完全相等」
  // 改成「界面列的必须都被服务端认」，并单独守住中文那把不外露。
  // 比长度而不是 deepEqual：ids 是从沙箱里的数组派生出来的，它的原型不是
  // 宿主那个 Array，严格深比较会因为跨 realm 而不相等，报出一个看不懂的空数组。
  const notAllowed = ids.filter(id => !ALLOWED_VOICES.includes(id));
  assert.equal(notAllowed.length, 0,
    `界面上列了服务端不认的音色，挑了会失败：${notAllowed.join(", ")}`);
  assert.ok(!ids.includes(CUE_VOICE),
    "中文提示那把嗓子被摆进了英文音色的选择器");
  for (const v of ctx.VOICE_OPTIONS) {
    assert.ok(v.label && v.label.trim(), `${v.id} 没有给家长看的名字`);
  }
  assert.match(html, /id="voiceOptions"/, "设置屏里没有挑声音的地方");
});

test("手机里存着一个下架的音色，自己退回默认，不是从此不出声", () => {
  const ctx = loadVoice("en-US-LongGoneNeural");
  assert.equal(ctx.getVoice(), DEFAULT_VOICE, "没有退回默认");
  const ok = loadVoice(ALLOWED_VOICES.find(v => v !== DEFAULT_VOICE));
  assert.notEqual(ok.getVoice(), DEFAULT_VOICE, "存着的有效选择被忽略了");
});

test("生成新句子的声音时，把家长挑的那把一起发出去", () => {
  const at = html.indexOf("async function provisionAudio");
  assert.ok(at !== -1, "找不到生成声音的地方");
  const body = html.slice(at, html.indexOf("\nasync function ", at + 10));
  assert.match(body, /ttsFetch\(item\.en,\s*getVoice\(\)\)/,
    "只发了句子没发音色——家长挑完还是原来那把嗓子");
});

test("名字里带冒号的新一代音色，一路走到 Azure 都不能被改坏", async () => {
  // en-US-Ava:DragonHDLatestNeural 这种写法是 Azure 最新一代的命名。
  // 谁要是好心加一道「清洗」把冒号去掉，这批最接近真人的嗓子会全部失效，
  // 而白名单比对会先把它挡成 400——所以这条同时守住两头。
  const colonVoices = ALLOWED_VOICES.filter(v => v.includes(":"));
  assert.ok(colonVoices.length >= 3, "最新一代那批不在名单里了");
  await withEnv(ENV_OK, () => withStub(async calls => {
    for (const v of colonVoices) {
      const res = await handler(req({ text: SENTENCE, voice: v }));
      assert.equal(res.status, 200, `${v} 被自己人挡下了`);
    }
    for (let i = 0; i < colonVoices.length; i++) {
      assert.ok(String(calls[i][1].body).includes(colonVoices[i]),
        `${colonVoices[i]} 发出去时被改写了`);
    }
  }));
});

test("默认那把仍然是预设片段用的那把", () => {
  // 1204 条预设片段是提前用它生成的文件。默认换成别的，家长自己存的句子
  // 就会和场景里的句子听着不是一个人在说话。
  assert.equal(DEFAULT_VOICE, "en-US-JennyNeural");
  const ctx = loadVoice();
  assert.equal(ctx.VOICE_OPTIONS[0].id, DEFAULT_VOICE, "默认那把要排在第一个");
});

test("每一把都归了组，家长才知道哪些更接近真人", () => {
  const ctx = loadVoice();
  for (const v of ctx.VOICE_OPTIONS) {
    assert.ok(v.group && v.group.trim(), `${v.id} 没归组`);
  }
  const groups = [...new Set(ctx.VOICE_OPTIONS.map(v => v.group))];
  assert.ok(groups.length >= 2, "全挤在一组里，等于没分");
});

// ══ 中文提示也走 Azure（2026-09-11）═══════════════════════════════════
// 连播里的中文提示原来是手机自带的语音合成念的，音质差，国产浏览器和微信里
// 尤其糟。改成 Azure 生成之后，服务端得认中文音色，而且 SSML 的语言必须跟着
// 音色走——拿英文的 xml:lang 去念中文，出来的是一串怪音。

test("中文音色在名单里", () => {
  assert.ok(CUE_VOICE, "没有指定中文提示用哪把嗓子");
  assert.ok(ALLOWED_VOICES.includes(CUE_VOICE),
    `${CUE_VOICE} 不在服务端认的名单里——中文提示会一直生成失败`);
});

test("SSML 的语言跟着音色走，不是写死 en-US", async () => {
  await withEnv(ENV_OK, () => withStub(async calls => {
    const zh = await handler(req({ text: "宝宝，该睡觉了。", voice: CUE_VOICE }));
    assert.equal(zh.status, 200);
    const zhBody = String(calls[0][1].body);
    assert.match(zhBody, /xml:lang='zh-CN'/, `中文用的还是别的语言：${zhBody.slice(0, 120)}`);
    assert.ok(zhBody.includes(CUE_VOICE), "发出去的不是中文那把嗓子");

    const en = await handler(req({ text: SENTENCE }));
    assert.equal(en.status, 200);
    const enBody = String(calls[1][1].body);
    assert.match(enBody, /xml:lang='en-US'/, "英文的语言被改坏了");
  }));
});

test("英文那句刻意的放慢没有被中文改掉", () => {
  // rate='-20%' 是给学发音的家长用的。加中文支持时最容易顺手把它抹平。
  const src = readFileSync(join(ROOT, "netlify/functions/tts.mjs"), "utf8");
  assert.match(src, /rate='-20%'/, "英文的放慢没了");
});

console.log("voice choice tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
