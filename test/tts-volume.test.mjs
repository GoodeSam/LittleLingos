#!/usr/bin/env node
// 新生成的声音也要大 1.5 倍（2026-10-15 Victor 要：跑步时听不清）。
//
// 随应用下发的那批录音已经整批放大过（见 test/audio-loudness.test.mjs）。家长自己存的
// 句子和连播里的中文提示是保存时向 Azure 现要的，得在要的时候就说「大声一点」，
// 否则同一轮连播里，预设句响、自己存的句子轻，一会儿大一会儿小。
//
// 2026-10-15 拿生产的订阅在 eastus 实打过（同一句话，7 次）：
//   Andrew（默认英文）  不加 -23.4 LUFS → volume='+50%' -18.5，真峰值 -0.8
//   Xiaoxiao（中文提示）不加 -21.4 LUFS → volume='+50%' -17.9，真峰值 -1.4
//   volume='x-loud' 两把都几乎不变（-22.0 / -21.4），不能用
// 放大后的预设录音中位约 -17.5 LUFS，加 '+50%' 之后两边基本一样响。
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   1. 家长存一句自己的话，生成出来的英文和预设句子一样响，跑步时听得清。
//   2. 连播里每句前面那句中文提示，也和英文一样响。
//   3. 放大不改别的：英文仍然放慢 20%、音高略高，中文仍然放慢 10%。
import assert from "node:assert/strict";

const { default: handler, DEFAULT_VOICE, CUE_VOICE, ALLOWED_VOICES } =
  await import("../netlify/functions/tts.mjs");

const CODE = "test-access-code-1234";
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
const req = body => new Request("https://example.test/api/tts", {
  method: "POST", headers: new Headers({ "X-LL-Access": CODE }), body: JSON.stringify(body),
});
// Azure 是外部服务：只把它换成假的，记下发过去的 SSML。
async function ssmlFor(body) {
  let sent = null;
  const prev = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    sent = String(init.body);
    return new Response(MP3, { status: 200, headers: { "Content-Type": "audio/mpeg" } });
  };
  try {
    const res = await withEnv(ENV_OK, () => handler(req(body)));
    assert.equal(res.status, 200, "请求没成功，测试等于没测");
    return sent;
  } finally { globalThis.fetch = prev; }
}
// 包着句子的那个 <prosody ...> 的属性
const prosodyOf = ssml => (ssml.match(/<prosody ([^>]*)>/) || [])[1] || "";

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test("家长存的英文句子：向 Azure 要的时候带着「大声 50%」", async () => {
  const p = prosodyOf(await ssmlFor({ text: "Time for bed, sweetie." }));
  assert.match(p, /volume='\+50%'/, `默认音色没加音量：<prosody ${p}>`);
});

test("每一把可选的英文音色都带着「大声 50%」", async () => {
  const missing = [];
  for (const v of ALLOWED_VOICES.filter(v => v !== CUE_VOICE)) {
    const p = prosodyOf(await ssmlFor({ text: "Wash your hands.", voice: v }));
    if (!/volume='\+50%'/.test(p)) missing.push(v);
  }
  assert.deepEqual(missing, [], `这几把没加音量：${missing.join(", ")}`);
});

test("连播里的中文提示：也带着「大声 50%」", async () => {
  const p = prosodyOf(await ssmlFor({ text: "宝宝，该睡觉了。", voice: CUE_VOICE }));
  assert.match(p, /volume='\+50%'/, `中文提示没加音量：<prosody ${p}>`);
});

test("放大不改别的：英文仍放慢 20%、音高 +5%，中文仍放慢 10%", async () => {
  const en = prosodyOf(await ssmlFor({ text: "Good job!", voice: DEFAULT_VOICE }));
  assert.match(en, /rate='-20%'/); assert.match(en, /pitch='\+5%'/);
  const zh = prosodyOf(await ssmlFor({ text: "真棒！", voice: CUE_VOICE }));
  assert.match(zh, /rate='-10%'/);
  assert.doesNotMatch(zh, /pitch=/, "中文提示的音高被动了");
});

console.log("tts-volume tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
