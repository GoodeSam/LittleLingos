#!/usr/bin/env node
// Behavioral tests for netlify/functions/tts.mjs — turning one English
// sentence into speech a parent will actually want to imitate.
//
// Zero-dependency, fully offline: globalThis.fetch is always stubbed, never
// real network, never a real Azure charge. House style follows
// test/dictionary-api.test.mjs (same counting, same exit code).
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   1. 家长收藏一句刚翻译出来的话。这句话要变成一段**能听的**声音——
//      不是浏览器那个机器音（tech-constraints C1 已实测判定不可接受），
//      而是和现有 1204 个预设短语同一个来源、同一种质感的录音。
//
//   2. 这是第三个花钱的端点，而且是最贵的一个。没有邀请码的人不能用它，
//      并且**拒绝必须发生在花钱之前**——一个已经调过 Azure 再返回 403 的
//      请求，钱一样花掉了。
//
//   3. Azure 挂了、超时了、或者句子里有奇怪字符——这些都不能让家长
//      "收藏"这个动作彻底失败，也不能把服务商的原始报错整段抛给他看。
//
//   4. 生成出来的东西必须真的有内容。一个 200 但空荡荡的响应会让手机
//      存进去一个永远播不响的文件，而家长要到几天后复习时才会发现——
//      那时他既不知道该怪谁，也没法把它修好。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const { default: handler } = await import("../netlify/functions/tts.mjs");

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

const CODE = "test-access-code-1234";
const SENTENCE = "Time for bed, sweetie.";

// A plausible mp3 payload. Real Azure returns raw bytes; what matters for
// these tests is that the endpoint passes bytes through unchanged rather
// than re-encoding or JSON-wrapping them.
const MP3_BYTES = new Uint8Array([0xff, 0xfb, 0x90, 0x64, 0x00, 0x01, 0x02, 0x03]);

function withEnv(vars, fn) {
  const prev = {};
  for (const [k, v] of Object.entries(vars)) {
    prev[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return Promise.resolve().then(fn).finally(() => {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });
}

const ENV_OK = { LL_ACCESS_CODE: CODE, AZURE_SPEECH_KEY: "k", AZURE_SPEECH_REGION: "eastus" };

function req(body, { method = "POST", code = CODE } = {}) {
  return new Request("https://example.test/api/tts", {
    method,
    headers: new Headers(code === null ? {} : { "X-LL-Access": code }),
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });
}

// Every handler call runs inside this. `calls` is the evidence for the tests
// that matter most: a request that returns an error but has already called
// Azure has failed, because the money is spent either way.
async function withStub(impl, fn) {
  const calls = [];
  const prev = globalThis.fetch;
  globalThis.fetch = async (...args) => {
    calls.push(args);
    return impl ? impl(...args) : new Response(MP3_BYTES, {
      status: 200, headers: { "Content-Type": "audio/mpeg" },
    });
  };
  try { return await fn(calls); }
  finally { globalThis.fetch = prev; }
}

// ══ 1. 拿到的是一段真的能播的音频 ═════════════════════════════════════

test("一句英文换回一段音频，而不是一段 JSON", async () => {
  await withEnv(ENV_OK, () => withStub(null, async calls => {
    const res = await handler(req({ text: SENTENCE }));
    assert.equal(res.status, 200);
    assert.equal(calls.length, 1, "必须真的去生成，不能凭空返回");
    assert.match(res.headers.get("Content-Type") || "", /^audio\/mpeg/,
      "手机拿到这个响应会直接当音频存起来；类型不对就是存进去一个播不响的文件");
  }));
});

test("音频字节原样传回，没有被重新编码或包一层", async () => {
  await withEnv(ENV_OK, () => withStub(null, async () => {
    const res = await handler(req({ text: SENTENCE }));
    const got = new Uint8Array(await res.arrayBuffer());
    assert.deepEqual([...got], [...MP3_BYTES],
      "多包一层或转 base64 都会让存进手机的文件播不出来，而家长要到复习时才发现");
  }));
});

test("送去生成的确实是家长那句话，带着凭据，要的是 mp3", async () => {
  // 不断言凭据的话，一个根本没带密钥、注定被语音服务拒绝的实现能通过
  // 全部测试 —— 因为 stub 不在乎有没有凭据。
  await withEnv({ ...ENV_OK, AZURE_SPEECH_REGION: "westus2" }, () => withStub(null, async calls => {
    await handler(req({ text: SENTENCE }));
    const [url, opts] = calls[0];
    // 用 Headers 读，不假定实现把它写成普通对象 —— 用标准 Headers 也
    // 完全正确，测试不该反过来约束实现怎么写。
    const h = new Headers(opts.headers);
    assert.match(String(url), /westus2\.tts\.speech\.microsoft\.com/,
      "区域必须来自配置；硬编码一个区域会在换区域时静默发去错的地方");
    assert.ok(h.get("Ocp-Apim-Subscription-Key"), "没带凭据的请求一定会被拒，而这在 stub 下看不出来");
    assert.match(h.get("Content-Type") || "", /ssml\+xml/, "语音服务只认这个类型");
    assert.match(h.get("X-Microsoft-OutputFormat") || "", /mp3/,
      "必须和现有 1204 个预设短语同格式，否则同一个播放器放不了两种文件");
    assert.match(String(opts.body), /Time for bed, sweetie\./, "生成的必须是这句话本身");
  }));
});

// ══ 2. 花钱之前先看门 ═════════════════════════════════════════════════

test("没有邀请码的人拿不到音频，而且一分钱没花", async () => {
  await withEnv(ENV_OK, () => withStub(null, async calls => {
    const res = await handler(req({ text: SENTENCE }, { code: null }));
    assert.equal(res.status, 403);
    assert.equal(calls.length, 0,
      "先调用再拒绝，钱一样花掉了——这是本项目最贵的一个端点");
  }));
});

test("邀请码错了也一样，拒绝发生在花钱之前", async () => {
  await withEnv(ENV_OK, () => withStub(null, async calls => {
    const res = await handler(req({ text: SENTENCE }, { code: CODE + "x" }));
    assert.equal(res.status, 403);
    assert.equal(calls.length, 0);
  }));
});

test("服务器没配邀请码时，谁都不放行", async () => {
  // Fail closed：变量丢了必须谁都拒绝，而不是谁都放行。
  await withEnv({ ...ENV_OK, LL_ACCESS_CODE: undefined }, () => withStub(null, async calls => {
    const res = await handler(req({ text: SENTENCE }));
    assert.equal(res.status, 403);
    assert.equal(calls.length, 0);
  }));
});

// ══ 3. 坏输入不花钱 ═══════════════════════════════════════════════════

test("请求体不是合法 JSON 时，给明确的 400 而不是崩掉", async () => {
  // 同类端点已有这个先例（dictionary-api.test.mjs）。没有它，一个不捕获
  // 解析异常的实现会通过其余全部测试，然后在生产上返回 500 加一段栈信息。
  await withEnv(ENV_OK, () => withStub(null, async calls => {
    const bad = new Request("https://example.test/api/tts", {
      method: "POST",
      headers: new Headers({ "X-LL-Access": CODE }),
      body: "{not json",
    });
    const res = await handler(bad);
    assert.equal(res.status, 400);
    assert.equal(calls.length, 0);
  }));
});

test("空句子不送去生成", async () => {
  await withEnv(ENV_OK, () => withStub(null, async calls => {
    for (const text of ["", "   ", null, 12345]) {
      const res = await handler(req({ text }));
      assert.equal(res.status, 400, `${JSON.stringify(text)} 应该被挡下`);
    }
    assert.equal(calls.length, 0, "坏输入一次都不该花钱");
  }));
});

test("上限就是 300 个字符——刚好 300 放行，301 挡下", async () => {
  // 只测"5000 被拒"证明不了上限是多少：一个上限 1000 的实现照样全绿。
  // 而这是按字符计费的端点，这个上限就是单次成本的封顶值。
  await withEnv(ENV_OK, () => withStub(null, async calls => {
    const ok = await handler(req({ text: "a".repeat(300) }));
    assert.equal(ok.status, 200, "刚好到上限的句子必须能生成");
    assert.equal(calls.length, 1);
    const no = await handler(req({ text: "a".repeat(301) }));
    assert.equal(no.status, 400, "超一个字符就该挡下");
    assert.equal(calls.length, 1, "被挡下的请求不该产生第二次调用");
  }));
});

test("句子里的尖括号和 & 不会破坏送出去的请求", async () => {
  // 语音服务读的是一段 XML。句子里出现 < > & 而不转义，轻则报错，
  // 重则把标记本身念出来。翻译结果里出现引号和 & 是很正常的事。
  await withEnv(ENV_OK, () => withStub(null, async calls => {
    const res = await handler(req({ text: `Mom & Dad say <hi>` }));
    assert.equal(res.status, 200, "带这些字符的正常句子不该失败");
    const body = String(calls[0][1].body);
    assert.ok(!/<hi>/.test(body), "句子里的尖括号必须被转义，不能原样进 XML");
    assert.match(body, /&amp;/, "& 必须被转义");
  }));
});

test("语音服务返回 200 但什么都没给时，不当成成功", async () => {
  // 网络截断、上游异常都可能产生一个 0 字节的 200。照单全收的话，
  // 手机上会多一个永远播不响的文件，而且它看起来一切正常。
  await withEnv(ENV_OK, () => withStub(
    async () => new Response(new Uint8Array(0), { status: 200, headers: { "Content-Type": "audio/mpeg" } }),
    async () => {
      const res = await handler(req({ text: SENTENCE }));
      // 说死 502，不是"只要不是 200 就行"——后者连一个什么都没实现的
      // 空壳都能满足（实测：一个只返回 501 的占位实现通过了这条断言）。
      assert.equal(res.status, 502, "空音频必须被当成上游失败，否则错误会一路存进家长的手机");
    }));
});

test("语音服务返回 200 但给的不是音频时，也不当成成功", async () => {
  // 代理、门户页、上游异常都可能返回 200 + HTML/JSON。直通的实现会把它
  // 当音频存进手机，而它看起来一切正常，直到某天点播放没反应。
  await withEnv(ENV_OK, () => withStub(
    async () => new Response(JSON.stringify({ error: "quota exceeded" }),
      { status: 200, headers: { "Content-Type": "application/json" } }),
    async () => {
      const res = await handler(req({ text: SENTENCE }));
      assert.equal(res.status, 502, "不是音频就不是成功，哪怕上游说 200");
    }));
});

test("非 POST 请求直接拒绝，而且带不带邀请码都一样", async () => {
  // 与另外两个端点保持同一个顺序：先看方法，再看邀请码。不一致的话，
  // 同一个错误在三个端点上会给出三种状态码。
  await withEnv(ENV_OK, () => withStub(null, async calls => {
    assert.equal((await handler(req(null, { method: "GET" }))).status, 405);
    assert.equal((await handler(req(null, { method: "GET", code: null }))).status, 405,
      "没有邀请码的 GET 也该是 405，和 translate/dictionary 一致");
    assert.equal(calls.length, 0);
  }));
});

// ══ 4. 出事的时候说人话，且不泄漏 ═════════════════════════════════════

test("服务器没配语音密钥时，说清是配置问题而不是家长的错", async () => {
  // 密钥和区域少任何一个都调不通。只检查其中一个，另一个漏配时
  // 会变成一个来自 Azure 的、看不懂的失败。
  for (const missing of ["AZURE_SPEECH_KEY", "AZURE_SPEECH_REGION"]) {
    await withEnv({ ...ENV_OK, [missing]: undefined }, () => withStub(null, async calls => {
      const res = await handler(req({ text: SENTENCE }));
      assert.equal(res.status, 500, `缺 ${missing} 时，500 是「我这边没配好」；403/400 会让人以为是自己的问题`);
      assert.equal(calls.length, 0);
    }));
  }
});

test("语音服务返回错误时，不把它的原始报错整段抛出去", async () => {
  const leaky = "Ocp-Apim-Subscription-Key was rejected: sk-live-SECRETVALUE12345";
  await withEnv(ENV_OK, () => withStub(
    async () => new Response(leaky, { status: 401 }),
    async () => {
      const res = await handler(req({ text: SENTENCE }));
      assert.equal(res.status, 502, "上游的问题不是家长请求的问题");
      const body = JSON.stringify(await res.json());
      assert.ok(!body.includes("SECRETVALUE12345"),
        "服务商的报错可能带着密钥片段——这是公开站点，响应任何人都能看到");
    }));
});

test("请求真的带了超时上限，不是只在超时发生后才处理", async () => {
  // 这一条和下一条必须分开。下一条只证明"超时被当成失败处理"——
  // 一个从不设置超时的实现也能通过它，因为那里的超时是 stub 假装的。
  // 只有这一条能证明上限真的存在：spike 实测一次生成约 3 秒，没有上限
  // 的话，服务商变慢会让家长盯着转圈，而 serverless 那侧的计时照走。
  await withEnv(ENV_OK, () => withStub(null, async calls => {
    await handler(req({ text: SENTENCE }));
    const opts = calls[0][1];
    assert.ok(opts.signal, "请求必须带一个可以中止它的信号，否则没有任何东西会叫停它");
    assert.equal(opts.signal.aborted, false, "发出去的时候不该已经是中止状态");
  }));
});

test("超时发生时返回明确的失败，而不是崩掉", async () => {
  await withEnv(ENV_OK, () => withStub(
    async () => { const e = new Error("aborted"); e.name = "AbortError"; throw e; },
    async () => {
      const res = await handler(req({ text: SENTENCE }));
      assert.equal(res.status, 502);
    }));
});

test("网络直接断了也返回明确的失败，不抛异常", async () => {
  await withEnv(ENV_OK, () => withStub(
    async () => { throw new TypeError("fetch failed"); },
    async () => {
      const res = await handler(req({ text: SENTENCE }));
      assert.equal(res.status, 502, "未捕获的异常会变成一个 500 和一段栈信息");
    }));
});

// ══ 5. 闸门用的是共用那一套，不是自己手写的 ═══════════════════════════

test("这个端点用的是共用的鉴权模块，没有自己手写一份", async () => {
  // spike 版本里有一个手写的常量时间比较。那种实现已经被证明会给出
  // 假的安全感：一个朴素的 === 也能通过它的全部断言。三个端点必须
  // 共用同一份、且走 node:crypto 的实现——否则修好一处不等于修好三处。
  //
  // 这是一条源码形状检查，能挡住的只有一件事：把 spike 那份手写实现
  // 复制过来。改成箭头函数、或只 import 不使用，它都看不出来。真正的
  // 鉴权行为由 test/access-control.test.mjs 对全部端点统一验证。
  // 留着它，是因为"复制 spike 代码"正是这个文件最可能的写法。
  const src = readFileSync(join(ROOT, "netlify/functions/tts.mjs"), "utf8");
  assert.match(src, /from\s+["']\.\/_shared\/access\.mjs["']/,
    "必须 import _shared/access.mjs");
  assert.ok(!/function\s+timingSafeEqual/.test(src),
    "不许在这个文件里自己再写一份比较函数");
});

test("这个端点挂在 /api/tts 上", async () => {
  // 本地全绿、线上 404 —— 因为路由声明漏了或写错了。断言的是导出的值
  // 而不是源码文本：注释掉的一行、拼错的键名都骗不过它。这个项目刚
  // 吃过一次"以为按了按钮其实没按"的亏（见 acceptance/access-control.md）。
  const mod = await import("../netlify/functions/tts.mjs");
  assert.equal(mod.config?.path, "/api/tts", "缺这一行的话，函数写得再对也没人调得到");
});

console.log("tts.mjs API behavior tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { await t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
