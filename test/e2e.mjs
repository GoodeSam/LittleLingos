#!/usr/bin/env node
// 真浏览器里跑一遍。不装任何依赖：内置 http 起静态服务，Chrome 开 headless，
// 用 Node 22 起就内置的 WebSocket 直接说 CDP。
//
// 为什么要有这一层。2026-09-10 改信息架构那轮，单元测试 44 层全绿，真浏览器
// 里却当场抓到三个缺陷：
//   1. .help-room 的 display:flex 压过浏览器自带的 [hidden]，两间房收不起来
//   2. 词典房和空闲区各有一份 #dictStarterChips，id 撞了
//   3. .backup-section 的 margin-top:-88px 是为旧位置写的，搬进设置屏后把
//      标题拉到了页头底下
// 三个都是「样式层级 / 真实布局 / 真实事件」的问题，读源码的测试一个都看不见。
// 下面每一条断言都对着这类问题：量的是 computed style 和真实 boundingRect，
// 不是 hidden 属性本身——hidden 是 true 而屏幕上还在，正是当时的样子。
//
// 网络被挡住：/api/* 一律由页面内的假 fetch 回答。除此之外全是真的——真的
// DOM、真的 CSS 级联、真的 onclick。
//
// 用法：node test/e2e.mjs        （Chrome 不在就跳过，并说明原因）
import { createServer } from "node:http";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join, extname, dirname } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CHROME = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
].find(p => existsSync(p));

if (!CHROME) {
  console.log("e2e: 跳过 —— 这台机器上没有 Chrome。装了再跑，或在有 Chrome 的机器上跑。");
  process.exit(0);
}

const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png",
};

async function serve() {
  const srv = createServer(async (req, res) => {
    const path = decodeURIComponent(req.url.split("?")[0]);
    const file = join(ROOT, path === "/" ? "/index.html" : path);
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    try {
      const body = await readFile(file);
      res.writeHead(200, { "Content-Type": MIME[extname(file)] || "application/octet-stream" });
      res.end(body);
    } catch { res.writeHead(404).end("not found"); }
  });
  await new Promise(r => srv.listen(0, "127.0.0.1", r));
  return { srv, port: srv.address().port };
}

async function findPageTarget(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const list = await fetch(`${url}/json/list`).then(r => r.json());
      const page = list.find(t => t.type === "page" && t.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error("连不上 Chrome 的调试端口");
}

function cdpClient(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  let id = 0;
  const ready = new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      const slot = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) slot.reject(new Error(msg.error.message));
      else slot.resolve(msg.result);
    }
  };
  return {
    ready,
    send(method, params = {}) {
      const n = ++id;
      return new Promise((resolve, reject) => {
        pending.set(n, { resolve, reject });
        ws.send(JSON.stringify({ id: n, method, params }));
      });
    },
    close() { try { ws.close(); } catch {} },
  };
}

// 在页面里求值，结果按 JSON 带回来。页面里抛的错原样抛出，测试才看得见真相。
function makeEval(client) {
  return async function evaluate(fn, ...args) {
    const call = `(${fn.toString()})(${args.map(a => JSON.stringify(a)).join(",")})`;
    const expr =
      `(async () => { try { return JSON.stringify({ok:1, v: await ${call}}); }` +
      ` catch(e) { return JSON.stringify({ok:0, e:String((e && e.message) || e)}); } })()`;
    const r = await client.send("Runtime.evaluate", {
      expression: expr, awaitPromise: true, returnByValue: true,
    });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text);
    const out = JSON.parse(r.result.value);
    if (!out.ok) throw new Error("页面里抛错: " + out.e);
    return out.v;
  };
}

// 只挡网络：/api/* 一律由页面内回答，其余照旧走真实请求。付费路径要有码才
// 走得到，这个假码只活在这张页面里。恶劣环境那一轮每换一张页面都要重新注入。
function STUB_FETCH() {
  const real = window.fetch;
  window.fetch = async (input, init) => {
    const url = String(input && input.url ? input.url : input);
    if (url.indexOf("/api/") === -1) return real(input, init);
    if (url.indexOf("/api/dictionary") !== -1) {
      return new Response(JSON.stringify({ word: "hug", senses: [
        { pos: "n.", zh: "抱抱", example: { en: "Give me a hug!", zh: "抱抱我！" }, tip: "张开双臂。" },
      ] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url.indexOf("/api/translate") !== -1) {
      return new Response(JSON.stringify({ en: "You did great today!", zh: "你今天真棒！",
        tip: "蹲下来看着他说。", related: [{ en: "Nice job!", zh: "做得好！" }] }),
        { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return new Response("", { status: 204 });
  };
  try { localStorage.setItem("ll_access", "e2e"); } catch (e) {}
  if (typeof paintAccessGate === "function") paintAccessGate();
  return true;
}

const checks = [];
function check(name, fn) { checks.push({ name, fn }); }

check("首页平时不摆提示文字，只留一个主按钮", async (ev) => {
  const r = await ev(() => {
    const vis = id => { const e = document.getElementById(id); return !!e && e.getClientRects().length > 0; };
    const cta = document.querySelector(".review-cta.show");
    return { mic: vis("micHint"), dict: vis("dictPrivacyNote"), gate: vis("homeGateNote"),
             cta: cta ? cta.textContent : "" };
  });
  assert.equal(r.mic, false, "麦克风说明常驻在首页");
  assert.equal(r.dict, false, "词典联网说明常驻在首页");
  assert.equal(r.gate, false, "邀请码提示常驻在首页");
  assert.ok(r.cta.includes("学第一句") || r.cta.includes("开始复习"), `首页没有主按钮：「${r.cta}」`);
});

check("点进搜索框，麦克风说明才出现", async (ev) => {
  const r = await ev(() => {
    const before = document.getElementById("micHint").getClientRects().length > 0;
    document.getElementById("searchInput").dispatchEvent(new Event("focus"));
    return { before, after: document.getElementById("micHint").getClientRects().length > 0 };
  });
  assert.equal(r.before, false, "还没点就出现了");
  assert.equal(r.after, true, "点进去了还是不出现——家长不知道键盘上有话筒");
});

check("输进像英文单词的东西，联网说明和 AI 出口才出现", async (ev) => {
  const r = await ev(() => {
    const i = document.getElementById("searchInput");
    i.value = "hug"; onSearchInput();
    const vis = id => document.getElementById(id).getClientRects().length > 0;
    const out = { dict: vis("dictPrivacyNote"), ai: !!document.querySelector(".search-ai-btn") };
    i.value = ""; onSearchInput();
    return out;
  });
  assert.equal(r.dict, true, "要联网了却没说");
  assert.equal(r.ai, true, "没给「让 AI 帮你说」这个出口");
});

// 「场景」页搜索框的一键清空。2026-09-17 Victor 在「帮我说」那一版之后提的：
// 首页这个框也只能一个字一个字删。
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   家长在「场景」页的搜索框里打了几个字找句子，想换个词再找。框右边有个叉，
//   点一下字全没了，搜索结果收起来，首页原来的内容回来，光标还在框里；
//   刚才因为打了英文词才出现的「会联网」那句说明也跟着收起。框空的时候没有叉。
const homeClearShown = () => {
  const b = document.getElementById("searchClear");
  return !!b && b.getClientRects().length > 0 && getComputedStyle(b).visibility !== "hidden";
};

check("「场景」搜索框没字时不出现清空按钮，打了字才出现，且就在框里", async (ev) => {
  const r = await ev(`() => {
    const shown = ${homeClearShown.toString()};
    showTab("home");
    const input = document.getElementById("searchInput");
    const btn = document.getElementById("searchClear");
    if (!btn) return { missing: true };
    input.value = ""; input.dispatchEvent(new Event("input", { bubbles: true }));
    const emptyShown = shown();
    input.value = "刷牙"; input.dispatchEvent(new Event("input", { bubbles: true }));
    const typedShown = shown();
    const b = btn.getBoundingClientRect(), i = input.getBoundingClientRect();
    const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
    const onTop = document.elementFromPoint(cx, cy);
    const out = {
      emptyShown, typedShown, w: b.width, h: b.height,
      inside: cx > i.left && cx < i.right && cy > i.top && cy < i.bottom,
      rightHalf: cx > i.left + i.width / 2,
      hittable: !!onTop && (onTop === btn || btn.contains(onTop)),
      label: btn.getAttribute("aria-label") || "",
    };
    input.value = ""; input.dispatchEvent(new Event("input", { bubbles: true }));
    return out;
  }`);
  assert.ok(!r.missing, "「场景」搜索框没有清空按钮");
  assert.equal(r.emptyShown, false, "框里没字，清空按钮却亮着");
  assert.equal(r.typedShown, true, "打了字，清空按钮没出现");
  assert.ok(r.inside, "清空按钮不在搜索框里");
  assert.ok(r.rightHalf, "清空按钮不在搜索框右边");
  assert.equal(r.hittable, true, "清空按钮被别的东西盖住了，点不着");
  assert.ok(r.w >= 44 && r.h >= 44, `清空按钮太小（${Math.round(r.w)}×${Math.round(r.h)}）`);
  assert.ok(r.label.includes("清"), `读屏软件读不出这个按钮是干什么的（aria-label「${r.label}」）`);
});

check("点「场景」的清空：字没了、结果收起、首页内容回来、光标还在框里", async (ev) => {
  const r = await ev(`() => {
    const shown = ${homeClearShown.toString()};
    showTab("home");
    const input = document.getElementById("searchInput");
    const btn = document.getElementById("searchClear");
    if (!btn) return { missing: true };
    const home = document.getElementById("homeScreen");
    input.value = "刷牙"; input.dispatchEvent(new Event("input", { bubbles: true }));
    // 对照组：点之前确实在搜索状态、确实有结果
    const before = { searching: home.classList.contains("searching"),
                     results: document.getElementById("searchResults").children.length };
    input.blur();
    btn.click();
    return {
      before,
      value: input.value,
      focused: document.activeElement === input,
      searching: home.classList.contains("searching"),
      results: document.getElementById("searchResults").children.length,
      btnShown: shown(),
    };
  }`);
  assert.ok(!r.missing, "「场景」搜索框没有清空按钮");
  assert.equal(r.before.searching, true, "对照失败：清空前本该处在搜索状态");
  assert.ok(r.before.results > 0, "对照失败：清空前本该有搜索结果");
  assert.equal(r.value, "", `点了清空，框里还剩「${r.value}」`);
  assert.equal(r.focused, true, "清空后光标不在框里，家长得再点一下才能打字");
  assert.equal(r.searching, false, "清空后首页还停在搜索状态，原来的内容没回来");
  assert.equal(r.results, 0, "清空后旧的搜索结果还挂着");
  assert.equal(r.btnShown, false, "框已经空了，清空按钮还亮着");
});

check("「场景」里打过英文词再清空，「会联网」那句说明跟着收起", async (ev) => {
  const r = await ev(() => {
    showTab("home");
    const input = document.getElementById("searchInput");
    const btn = document.getElementById("searchClear");
    if (!btn) return { missing: true };
    const vis = id => document.getElementById(id).getClientRects().length > 0;
    input.value = "hug"; input.dispatchEvent(new Event("input", { bubbles: true }));
    const before = vis("dictPrivacyNote");   // 对照组：清空前它确实亮着
    btn.click();
    return { before, after: vis("dictPrivacyNote"), gate: vis("homeGateNote") };
  });
  assert.ok(!r.missing, "「场景」搜索框没有清空按钮");
  assert.equal(r.before, true, "对照失败：打了英文词，联网说明本该出现");
  assert.equal(r.after, false, "清空了，「会联网」的说明还留在首页");
  assert.equal(r.gate, false, "清空了，邀请码提示还留在首页");
});

check("进「帮我说」，两间房是收起来的", async (ev) => {
  const r = await ev(() => {
    showTab("help");
    const box = id => {
      const e = document.getElementById(id);
      return { display: getComputedStyle(e).display, rects: e.getClientRects().length };
    };
    return { dict: box("helpDictRoom"), ai: box("helpAiRoom"),
             idle: document.getElementById("helpIdle").getClientRects().length };
  });
  assert.equal(r.dict.display, "none", `词典房没收起来（display: ${r.dict.display}）`);
  assert.equal(r.ai.display, "none", `AI 房没收起来（display: ${r.ai.display}）`);
  assert.equal(r.dict.rects, 0, "词典房 display 是 none 却还占着位置");
  assert.ok(r.idle > 0, "空闲区的常用词不见了");
});

check("输一个英文词，只开词典那一间", async (ev) => {
  const r = await ev(async () => {
    showTab("help");
    document.getElementById("helpInput").value = "hug";
    helpSubmit();
    await new Promise(res => setTimeout(res, 500));
    const shown = id => getComputedStyle(document.getElementById(id)).display !== "none";
    return { dict: shown("helpDictRoom"), ai: shown("helpAiRoom"),
             privacy: document.getElementById("dictScreenPrivacyNote").getClientRects().length > 0,
             panel: document.getElementById("dictScreenPanel").textContent.trim().length };
  });
  assert.equal(r.dict, true, "词典那一间没开");
  assert.equal(r.ai, false, "查一个词却把 AI 翻译那一间也打开了");
  assert.equal(r.privacy, true, "真要查词了却没说会不会联网");
  assert.ok(r.panel > 0, "词典房开了，里面却是空的");
});

check("输一句中文，只开 AI 那一间，且这时才说隐私", async (ev) => {
  const r = await ev(async () => {
    showTab("help");
    document.getElementById("helpInput").value = "宝宝，今天你很棒";
    onHelpInput(); helpSubmit();
    await new Promise(res => setTimeout(res, 500));
    const shown = id => getComputedStyle(document.getElementById(id)).display !== "none";
    return { dict: shown("helpDictRoom"), ai: shown("helpAiRoom"),
             privacy: document.getElementById("translatePrivacyNote").getClientRects().length > 0 };
  });
  assert.equal(r.ai, true, "AI 那一间没开");
  assert.equal(r.dict, false, "翻一句话却把词典那一间也打开了");
  assert.equal(r.privacy, true, "内容要发出去了却没说");
});

// 「帮我说」的一键清空。2026-09-17 Victor 报：输进去的字只能一个一个删。
// 家长多半是问完一句接着问下一句，长句子退格退到底很烦。
// 这个按钮叠在输入框上，最容易坏的正是这一层看得见的东西：被输入框盖住、
// 点不着、空框里也亮着——所以放在真浏览器里量。
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   家长在「帮我说」里打了一句话，问完想换一句。输入框右边有个叉，点一下，
//   字全没了，光标还在框里，可以直接打下一句；上一句的答案也收起来了，
//   不会挂在新问题底下。框是空的时候，这个叉不出现。
check("「帮我说」框里没字时不出现清空按钮，打了字才出现，且就在框里", async (ev) => {
  const r = await ev(() => {
    showTab("help");
    const input = document.getElementById("helpInput");
    const btn = document.getElementById("helpClear");
    if (!btn) return { missing: true };
    const shown = () => btn.getClientRects().length > 0 && getComputedStyle(btn).visibility !== "hidden";
    input.value = ""; input.dispatchEvent(new Event("input", { bubbles: true }));
    const emptyShown = shown();
    input.value = "宝宝该睡觉了"; input.dispatchEvent(new Event("input", { bubbles: true }));
    const typedShown = shown();
    const b = btn.getBoundingClientRect(), i = input.getBoundingClientRect();
    const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
    const onTop = document.elementFromPoint(cx, cy);
    const out = {
      emptyShown, typedShown,
      w: b.width, h: b.height,
      inside: cx > i.left && cx < i.right && cy > i.top && cy < i.bottom,
      rightHalf: cx > i.left + i.width / 2,
      hittable: !!onTop && (onTop === btn || btn.contains(onTop)),
      label: btn.getAttribute("aria-label") || "",
    };
    input.value = ""; input.dispatchEvent(new Event("input", { bubbles: true }));
    return out;
  });
  assert.ok(!r.missing, "「帮我说」没有清空按钮");
  assert.equal(r.emptyShown, false, "框里没字，清空按钮却亮着");
  assert.equal(r.typedShown, true, "打了字，清空按钮没出现");
  assert.ok(r.inside, "清空按钮不在输入框里");
  assert.ok(r.rightHalf, "清空按钮不在输入框右边");
  assert.equal(r.hittable, true, "清空按钮被别的东西盖住了，点不着");
  assert.ok(r.w >= 44 && r.h >= 44, `清空按钮太小（${Math.round(r.w)}×${Math.round(r.h)}）`);
  assert.ok(r.label.includes("清"), `读屏软件读不出这个按钮是干什么的（aria-label「${r.label}」）`);
});

check("点清空：字全没了、光标还在框里、上一句的答案收起来", async (ev) => {
  const r = await ev(async () => {
    showTab("help");
    const input = document.getElementById("helpInput");
    const btn = document.getElementById("helpClear");
    if (!btn) return { missing: true };
    input.value = "宝宝，今天你很棒";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    helpSubmit();
    await new Promise(res => setTimeout(res, 500));
    const shown = id => getComputedStyle(document.getElementById(id)).display !== "none";
    // 对照组：点之前答案确实是开着的，否则「点完收起来」什么也证明不了
    const before = { ai: shown("helpAiRoom"), idle: shown("helpIdle") };
    input.blur();
    btn.click();
    return {
      before,
      value: input.value,
      focused: document.activeElement === input,
      ai: shown("helpAiRoom"), dict: shown("helpDictRoom"), idle: shown("helpIdle"),
      mirror: document.getElementById("dictInput").value,
      btnShown: btn.getClientRects().length > 0 && getComputedStyle(btn).visibility !== "hidden",
    };
  });
  assert.ok(!r.missing, "「帮我说」没有清空按钮");
  assert.equal(r.before.ai, true, "对照失败：清空前 AI 那一间本该是开着的");
  assert.equal(r.before.idle, false, "对照失败：清空前常用词本该是收起的");
  assert.equal(r.value, "", `点了清空，框里还剩「${r.value}」`);
  assert.equal(r.focused, true, "清空后光标不在框里，家长得再点一下才能打字");
  assert.equal(r.ai, false, "清空后上一句的翻译还挂着");
  assert.equal(r.dict, false, "清空后词典那一间开着");
  assert.equal(r.idle, true, "清空后常用词没回来，这一屏是空的");
  assert.equal(r.mirror, "", "清空后查词那边还留着旧词");
  assert.equal(r.btnShown, false, "框已经空了，清空按钮还亮着");
});

check("从别处把一句话带进「帮我说」，清空按钮也跟着出现", async (ev) => {
  const r = await ev(async () => {
    const btn = document.getElementById("helpClear");
    if (!btn) return { missing: true };
    // 对照组：带话进来之前框是空的、按钮是收起的。没有这一格，一个永远亮着的
    // 按钮也能让这条变绿（空壳探测时就是这样）。
    showTab("help");
    const input = document.getElementById("helpInput");
    input.value = ""; input.dispatchEvent(new Event("input", { bubbles: true }));
    const emptyShown = btn.getClientRects().length > 0 && getComputedStyle(btn).visibility !== "hidden";
    goTranslateWithQuery("出门要穿鞋");
    await new Promise(res => setTimeout(res, 300));
    const out = { emptyShown, value: document.getElementById("helpInput").value,
                  shown: btn.getClientRects().length > 0 && getComputedStyle(btn).visibility !== "hidden" };
    btn.click();
    return out;
  });
  assert.ok(!r.missing, "「帮我说」没有清空按钮");
  assert.equal(r.emptyShown, false, "对照失败：框是空的，清空按钮却亮着");
  assert.equal(r.value, "出门要穿鞋", "对照失败：话没带进来");
  assert.equal(r.shown, true, "框里有字（从首页带进来的），清空按钮却没出现");
});

// 点开推送通知之后（ADR 0008）。推送本身在 headless 里收不到，这里验的是
// 收到之后页面怎么接：从通知新开进来、从通知把后台的 App 叫回来。
// （2026-09-18 删掉了试验卡片那一条和试验日志的断言：试验代码已移除，
// Victor 同意。）
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   1. 家长点了通知，App 被打开 —— 直接落在复习页；地址栏里那段「去哪」的
//      参数被清掉，刷新不会又跳一次。乱写的目标不跳。
//   2. App 本来开在后台，家长点通知把它叫回来 —— 跳到连播所在的收藏页；
//      别的消息不理会。
check("从通知打开 App：落在复习页，地址里的参数被清掉；乱写的目标不跳", async (ev) => {
  const r = await ev(async () => {
    if (typeof handlePushDeepLink !== "function") return { missing: true };
    showTab("home");
    history.replaceState(null, "", "?to=evil");
    const ignored = handlePushDeepLink(location.search);
    const stillHome = getComputedStyle(document.getElementById("homeScreen")).display !== "none";
    history.replaceState(null, "", "?to=review");
    const handled = handlePushDeepLink(location.search);
    return {
      ignored, stillHome, handled,
      reviewOpen: document.getElementById("reviewScreen").classList.contains("open"),
      search: location.search,
    };
  });
  assert.ok(!r.missing, "页面没有处理「从通知进来」的入口");
  assert.equal(r.ignored, false, "乱写的目标也被当真了");
  assert.equal(r.stillHome, true, "对照失败：乱写的目标不该离开首页");
  assert.equal(r.handled, true, "带着 ?to=review 进来却没处理");
  assert.equal(r.reviewOpen, true, "从通知进来没落在复习页");
  assert.equal(r.search, "", `地址里还留着「${r.search}」，刷新会再跳一次`);
});

check("App 在后台被通知叫回来：去连播所在的收藏页；无关消息不理", async (ev) => {
  const r = await ev(async () => {
    if (!navigator.serviceWorker) return { skip: "没有 service worker" };
    showTab("home");
    const send = data => navigator.serviceWorker.dispatchEvent(new MessageEvent("message", { data }));
    send({ type: "something-else", to: "loop" });
    send({ type: "ll-push-open", to: "https://evil.example" });
    const savedOpenBefore = document.getElementById("savedScreen").classList.contains("open");
    send({ type: "ll-push-open", to: "loop" });
    const savedOpen = document.getElementById("savedScreen").classList.contains("open");
    await new Promise(res => setTimeout(res, 2800));   // 等连播那一段试完，免得它的计时器落进下一条检查
    return { savedOpenBefore, savedOpen };
  });
  assert.ok(!r.skip, r.skip);
  assert.equal(r.savedOpenBefore, false, "无关消息或乱写的目标也让页面跳了");
  assert.equal(r.savedOpen, true, "收到「去连播」却没打开收藏页");
});

// ── 到点提醒（ADR 0008，2026-09-18）─────────────────────────────────────
// 推送订阅、通知权限、网络请求都是浏览器或外部提供的，在页面里换成替身；
// 提醒本身的逻辑——什么时候登记、复习后怎么同步、断网时攒着、服务器说没有
// 记录了怎么办——全是真代码。
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   1. 家长打开设置里的「到点提醒」—— 一眼看懂规则（复习后约 23.5 小时、
//      夜里不打扰），默认点开去复习，没开时不显示「下一次」。
//   2. 家长点「开启提醒」—— 要通知权限、订阅、在服务器登记；手机上记下口令
//      和目标页，目标页不发给服务器；按钮变成「关闭提醒」，显示下一次时间。
//   3. 没给通知权限 —— 不开，说清为什么。
//   4. 家长复习了一轮 —— 过一会儿告诉服务器；断网时先攒着，联网后补上。
//   5. 服务器说这台手机的记录没了 —— 手机上也显示为已关闭，不假装还开着。
//   6. 家长点「关闭提醒」—— 告诉服务器删记录、退订、清掉手机上的口令。
//   7. 这台手机的推送地址在服务器上被别的口令占着 —— 换一个新地址重来一次。
function REMINDER_FAKES() {
  const rem = window.__rem = { posts: [], unsub: 0, subCount: 0, sub: null, reply: {} };
  const makeSub = i => ({
    endpoint: "https://web.push.apple.com/e2e-" + i,
    toJSON() { return { endpoint: this.endpoint }; },
    unsubscribe: async () => { rem.unsub++; rem.sub = null; return true; },
  });
  const reg = { pushManager: {
    getSubscription: async () => rem.sub,
    subscribe: async () => { rem.sub = makeSub(++rem.subCount); return rem.sub; },
  } };
  if (!window.__remSaved) {
    window.__remSaved = { perm: Notification.requestPermission, fetch: window.fetch };
  }
  Object.defineProperty(navigator.serviceWorker, "ready", { value: Promise.resolve(reg), configurable: true });
  Notification.requestPermission = async () => "granted";
  const prev = window.__remSaved.fetch;
  window.fetch = async (input, init) => {
    const url = String(input && input.url ? input.url : input);
    if (url.indexOf("/api/reminder") === -1) return prev(input, init);
    const body = JSON.parse(init.body);
    rem.posts.push(body);
    const r = rem.reply[body.action];
    const got = typeof r === "function" ? r(body) : r;
    if (got === "offline") throw new TypeError("Failed to fetch");
    const next = Date.now() + 23.5 * 3600 * 1000;
    const [status, json] = got || [200, body.action === "enable"
      ? { ok: true, nextAt: next, confirm: { sent: true } } : { ok: true, nextAt: next }];
    return new Response(JSON.stringify(json), { status, headers: { "Content-Type": "application/json" } });
  };
  try { localStorage.removeItem("ll_reminder"); localStorage.setItem("ll_access", "e2e"); } catch (e) {}
  return true;
}
function REMINDER_UNFAKE() {
  delete navigator.serviceWorker.ready;
  if (window.__remSaved) {
    Notification.requestPermission = window.__remSaved.perm;
    window.fetch = window.__remSaved.fetch;
    delete window.__remSaved;
  }
  try { localStorage.removeItem("ll_reminder"); } catch (e) {}
  return true;
}
const readReminder = () => { try { return JSON.parse(localStorage.getItem("ll_reminder") || "{}"); } catch (e) { return {}; } };

check("到点提醒卡片：说清规则，默认去复习，没开时不显示下一次", async (ev) => {
  await ev(REMINDER_FAKES);
  const r = await ev(() => {
    showTab("settings");
    const card = document.getElementById("reminderSection");
    if (!card) return { missing: true };
    const shown = id => { const e = document.getElementById(id); return !!e && !e.hidden && e.getClientRects().length > 0; };
    const review = card.querySelector('[data-rtarget="review"]');
    return {
      text: card.textContent,
      reviewOn: !!review && review.getAttribute("aria-checked") === "true",
      loopExists: !!card.querySelector('[data-rtarget="loop"]'),
      toggle: document.getElementById("reminderToggle").textContent,
      next: shown("reminderNext"),
      platform: shown("reminderPlatformNote"),
    };
  });
  await ev(REMINDER_UNFAKE);
  assert.ok(!r.missing, "设置里没有到点提醒");
  assert.match(r.text, /23\.5/, "没说复习后多久提醒");
  assert.match(r.text, /22:00/, "没说夜里不打扰");
  assert.equal(r.reviewOn, true, "默认不是去复习");
  assert.equal(r.loopExists, true, "没有「去连播」可选");
  assert.match(r.toggle, /开启/);
  assert.equal(r.next, false, "还没开就显示了下一次时间");
  assert.equal(r.platform, true, "不是主屏幕版打开时，没提醒家长 iPhone 要从主屏幕打开");
});

check("开启提醒：要权限、订阅、登记；口令和目标页记在手机上，目标页不发给服务器", async (ev) => {
  await ev(REMINDER_FAKES);
  const r = await ev(`(async () => {
    const readReminder = ${readReminder.toString()};
    showTab("settings");
    document.querySelector('[data-rtarget="loop"]').click();
    document.getElementById("reminderToggle").click();
    await new Promise(res => setTimeout(res, 500));
    const c = await caches.open("push-spike");
    const target = await c.match("./__push-target");
    const confirm = await c.match("./__push-confirm");
    return {
      posts: window.__rem.posts,
      state: readReminder(),
      target: target ? await target.text() : null,
      confirm: !!confirm,
      toggle: document.getElementById("reminderToggle").textContent,
      next: !document.getElementById("reminderNext").hidden,
      loopOn: document.querySelector('[data-rtarget="loop"]').getAttribute("aria-checked"),
    };
  })`.replace(/^\(|\)$/g, ""));
  await ev(REMINDER_UNFAKE);
  assert.equal(r.posts.length, 1, `登记请求发了 ${r.posts.length} 次`);
  const p = r.posts[0];
  assert.equal(p.action, "enable");
  assert.equal(p.endpoint, "https://web.push.apple.com/e2e-1");
  assert.match(p.secret || "", /^[A-Za-z0-9_-]{43}$/, "设备口令不是 32 字节随机数的样子");
  assert.ok(p.tz && p.tz.length > 0, "没告诉服务器时区");
  assert.ok(!("target" in p), "目标页发给了服务器——同意的五样里没有它");
  assert.equal(r.state.on, true, "手机上没记下「已开启」");
  assert.equal(r.state.secret, p.secret, "手机上记的口令和发给服务器的不一样");
  assert.equal(r.state.target, "loop");
  assert.equal(r.target, "loop", "Service Worker 读不到目标页");
  assert.equal(r.confirm, true, "没留确认记号——确认通知会说成「到点了」");
  assert.match(r.toggle, /关闭/);
  assert.equal(r.next, true, "开了却没显示下一次时间");
  assert.equal(r.loopOn, "true");
});

check("没给通知权限：不开，说清为什么", async (ev) => {
  await ev(REMINDER_FAKES);
  const r = await ev(`(async () => {
    const readReminder = ${readReminder.toString()};
    Notification.requestPermission = async () => "denied";
    showTab("settings");
    document.getElementById("reminderToggle").click();
    await new Promise(res => setTimeout(res, 300));
    const s = document.getElementById("reminderStatus");
    return { posts: window.__rem.posts.length, state: readReminder(),
             status: !s.hidden ? s.textContent : "", toggle: document.getElementById("reminderToggle").textContent };
  })`.replace(/^\(|\)$/g, ""));
  await ev(REMINDER_UNFAKE);
  assert.equal(r.posts, 0, "没有权限还去服务器登记了");
  assert.notEqual(r.state.on, true);
  assert.match(r.status, /权限/, `没说清为什么：「${r.status}」`);
  assert.match(r.toggle, /开启/);
});

check("复习一轮后同步给服务器；断网时攒着，联网后补上", async (ev) => {
  await ev(REMINDER_FAKES);
  const r = await ev(`(async () => {
    const readReminder = ${readReminder.toString()};
    showTab("settings");
    document.getElementById("reminderToggle").click();
    await new Promise(res => setTimeout(res, 400));
    // 真走一遍复习卡的「记住了」
    const item = { id: "e2e_rem_1", en: "Time for bed.", zh: "该睡觉了", rv: { s: 0, due: Date.now() - 1000 } };
    savedPhrases.push(item);
    window.__rem.reply.review = "offline";
    __primeReviewQueueForTest([item]);
    const before = Date.now();
    reviewAnswer(true);
    await new Promise(res => setTimeout(res, 2200));
    const offline = { tried: window.__rem.posts.filter(p => p.action === "review").length, state: readReminder() };
    delete window.__rem.reply.review;
    await flushReminderReview();
    const after = { review: window.__rem.posts.filter(p => p.action === "review").pop(), state: readReminder() };
    const i = savedPhrases.indexOf(item); if (i >= 0) savedPhrases.splice(i, 1);
    safeSetItem("ll_saved", JSON.stringify(savedPhrases));
    return { before, offline, after };
  })`.replace(/^\(|\)$/g, ""));
  await ev(REMINDER_UNFAKE);
  assert.ok(r.offline.tried >= 1, "复习之后没去同步");
  assert.ok(r.offline.state.pendingAt >= r.before, "断网时没把这次复习攒下来");
  assert.equal(r.after.review.at, r.offline.state.pendingAt, "联网后补发的不是攒下的那个时间");
  assert.equal(r.after.review.secret, r.after.state.secret);
  assert.equal(r.after.state.pendingAt, null, "补发成功了还攒着");
});

check("服务器说这台手机没记录了：手机上显示已关闭", async (ev) => {
  await ev(REMINDER_FAKES);
  const r = await ev(`(async () => {
    const readReminder = ${readReminder.toString()};
    showTab("settings");
    document.getElementById("reminderToggle").click();
    await new Promise(res => setTimeout(res, 400));
    // 对照组：先确认真的开起来了，否则「变成关闭」什么也证明不了
    const wasOn = readReminder().on === true;
    window.__rem.reply.review = [404, { error: "no reminder for this device" }];
    reminderNoteReview();
    await flushReminderReview();
    showTab("settings");
    return { wasOn, state: readReminder(), toggle: document.getElementById("reminderToggle").textContent };
  })`.replace(/^\(|\)$/g, ""));
  await ev(REMINDER_UNFAKE);
  assert.equal(r.wasOn, true, "对照失败：提醒本该先开起来");
  assert.notEqual(r.state.on, true, "服务器已经没有记录，手机还当它开着");
  assert.match(r.toggle, /开启/);
});

check("关闭提醒：服务器删记录、退订、清掉手机上的口令", async (ev) => {
  await ev(REMINDER_FAKES);
  const r = await ev(`(async () => {
    const readReminder = ${readReminder.toString()};
    showTab("settings");
    document.getElementById("reminderToggle").click();
    await new Promise(res => setTimeout(res, 400));
    const secret = readReminder().secret;
    document.getElementById("reminderToggle").click();
    await new Promise(res => setTimeout(res, 400));
    return { secret, last: window.__rem.posts[window.__rem.posts.length - 1], unsub: window.__rem.unsub,
             state: readReminder(), toggle: document.getElementById("reminderToggle").textContent,
             next: !document.getElementById("reminderNext").hidden };
  })`.replace(/^\(|\)$/g, ""));
  await ev(REMINDER_UNFAKE);
  assert.equal(r.last.action, "disable", "关闭时没告诉服务器");
  assert.equal(r.last.secret, r.secret);
  assert.equal(r.unsub, 1, "没退订");
  assert.notEqual(r.state.on, true);
  assert.ok(!r.state.secret, "关了还留着口令");
  assert.match(r.toggle, /开启/);
  assert.equal(r.next, false, "关了还显示下一次时间");
});

check("推送地址被别的口令占着：换一个新地址重来一次", async (ev) => {
  await ev(REMINDER_FAKES);
  const r = await ev(`(async () => {
    const readReminder = ${readReminder.toString()};
    let n = 0;
    window.__rem.reply.enable = () => (++n === 1 ? [409, { error: "different secret" }] : undefined);
    showTab("settings");
    document.getElementById("reminderToggle").click();
    await new Promise(res => setTimeout(res, 600));
    return { posts: window.__rem.posts.map(p => p.endpoint), unsub: window.__rem.unsub, state: readReminder() };
  })`.replace(/^\(|\)$/g, ""));
  await ev(REMINDER_UNFAKE);
  assert.deepEqual(r.posts, ["https://web.push.apple.com/e2e-1", "https://web.push.apple.com/e2e-2"],
    `登记用的地址：${r.posts.join(", ")}`);
  assert.equal(r.unsub, 1, "没先退掉被占的那个");
  assert.equal(r.state.on, true);
  assert.equal(r.state.endpoint, "https://web.push.apple.com/e2e-2");
});

check("说给谁听选「成人」，按钮和免责声明跟着改口", async (ev) => {
  const r = await ev(() => {
    showTab("help");
    const before = document.getElementById("translateBtn").textContent;
    selectTranslateAge(document.querySelector('[data-tage="adult"]'), "adult");
    const after = { btn: document.getElementById("translateBtn").textContent,
                    label: document.getElementById("translateResultLabel").textContent,
                    note: document.getElementById("aiDisclaimer").textContent };
    selectTranslateAge(document.querySelector('[data-tage="1-2"]'), "1-2");
    return { before, after };
  });
  assert.ok(r.before.includes("儿童"), "对照失败：默认档的按钮本该写着儿童英语");
  assert.ok(!r.after.btn.includes("儿童"), `成人档下按钮还写着「${r.after.btn}」`);
  assert.ok(!r.after.label.includes("宝宝"), `成人档下结果标题还写着「${r.after.label}」`);
  assert.ok(!r.after.note.includes("宝宝"), "成人档下免责声明还在提宝宝");
});

check("四个标签各开各的屏，导航在每一屏都够得着", async (ev) => {
  const r = await ev(() => {
    const out = {};
    const pairs = [["home", "homeScreen"], ["help", "helpScreen"],
                   ["review", "reviewScreen"], ["saved", "savedScreen"]];
    for (const pair of pairs) {
      const tab = pair[0], id = pair[1];
      showTab(tab);
      const nav = document.querySelector(".bottom-nav").getBoundingClientRect();
      const el = document.getElementById(id);
      const act = document.querySelector(".nav-item.active");
      out[tab] = {
        open: tab === "home" ? getComputedStyle(el).display !== "none" : el.classList.contains("open"),
        navVisible: nav.height > 0 && nav.bottom > 0,
        active: act ? act.dataset.tab : null,
      };
    }
    return out;
  });
  for (const tab of Object.keys(r)) {
    const v = r[tab];
    assert.equal(v.open, true, `点「${tab}」没打开对应的屏`);
    assert.equal(v.navVisible, true, `在「${tab}」这一屏上导航不见了`);
    assert.equal(v.active, tab, `在「${tab}」这一屏上高亮的是「${v.active}」`);
  }
});

check("齿轮进设置，每一块的标题都没被页头压住", async (ev) => {
  const r = await ev(() => {
    showTab("settings");
    const head = document.querySelector("#settingsScreen .screen-header").getBoundingClientRect();
    const titles = Array.from(document.querySelectorAll("#settingsScreen .backup-title"));
    return {
      count: titles.length,
      headBottom: head.bottom,
      tops: titles.map(t => t.getBoundingClientRect().top),
      texts: titles.map(t => t.textContent.trim()),
      voiceRows: document.querySelectorAll("#settingsScreen .voice-row").length,
    };
  });
  assert.ok(r.count >= 3, `设置里只有 ${r.count} 块，邀请码/朗读声音/备份应该都在`);
  r.tops.forEach((top, i) => {
    assert.ok(top >= r.headBottom - 1,
      `「${r.texts[i]}」被页头压住了（top ${Math.round(top)} < 页头底边 ${Math.round(r.headBottom)}）`);
  });
  assert.ok(r.voiceRows >= 10, `朗读声音只列出了 ${r.voiceRows} 把`);
});

check("设置最底下的使用说明：平时全收着，点开一条才看得到字，最后一条不被底部导航挡住", async (ev) => {
  const r = await ev(async () => {
    showTab("settings");
    const sec = document.getElementById("guideSection");
    if (!sec) return { missing: true };
    const topics = Array.from(sec.querySelectorAll("details"));
    // 不能靠量尺寸判断「看不看得见」。新版 Chrome 藏 <details> 里的内容用的是
    // content-visibility:hidden——盒子还在、量得出宽高，只是不画。第一次写这条
    // 就栽在这里：九条正文「全露着」，而整块其实只有 641px 高。问浏览器自己。
    // 没有 checkVisibility 的旧浏览器：先看它是不是躲在一个收起的 <details> 里——
    // 那正是「量得出尺寸却没画」的情况，量尺寸的兜底不能重蹈这个坑。
    const vis = el => (typeof el.checkVisibility === "function")
      ? el.checkVisibility({ contentVisibilityAuto: true, visibilityProperty: true })
      : !el.closest("details:not([open])") && el.getClientRects().length > 0;
    const out = {
      topics: topics.length,
      openAtStart: topics.filter(d => d.open).length,
      bodiesVisibleAtStart: topics.filter(d => vis(d.querySelector(".guide-body"))).length,
      // 能点的那一行够不够得着
      minSummaryH: Math.min(...topics.map(d => d.querySelector("summary").getBoundingClientRect().height)),
      // 收着的时候这一整块有多高——撑太长就违背了「不挡路」
      collapsedH: Math.round(sec.getBoundingClientRect().height),
      screenH: window.innerHeight,
    };
    // 等布局真正过一帧，而不是猜一个毫秒数
    const settled = () => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
    const scroller = document.getElementById("settingsScreen");
    const before = { scrollTop: scroller.scrollTop };
    try {
    // 真的点一下第一条的标题
    topics[0].querySelector("summary").click();
    await settled();
    const body0 = topics[0].querySelector(".guide-body");
    out.openedAfterTap = topics[0].open;
    out.body0Visible = vis(body0);
    out.body0Chars = body0.innerText.trim().length;
    out.othersStillClosed = topics.slice(1).every(d => !d.open);
    // 横向不许溢出：长句子、图标两列，都可能把卡片撑破
    const w = document.documentElement.clientWidth;
    out.overflow = Array.from(sec.querySelectorAll("*")).filter(el => {
      const b = el.getBoundingClientRect();
      return b.width > 0 && (b.right > w + 1 || b.left < -1);
    }).length;
    // 点开最后一条，滚到底：它的最后一行既不能躲在底部导航后面，也不能滚出屏幕上方
    const last = topics[topics.length - 1];
    last.querySelector("summary").click();
    await settled();
    // #settingsScreen 是 position:fixed 的滚动容器，滚它；滚 window 只会动它背后那张页
    scroller.scrollTop = scroller.scrollHeight;
    await settled();
    const tail = last.querySelector(".guide-body").lastElementChild.getBoundingClientRect();
    const nav = document.querySelector(".bottom-nav").getBoundingClientRect();
    const head = document.querySelector("#settingsScreen .screen-header").getBoundingClientRect();
    out.tailTop = Math.round(tail.top);
    out.tailBottom = Math.round(tail.bottom);
    out.headBottom = Math.round(head.bottom);
    out.navTop = Math.round(nav.top);
    return out;
    } finally {
      // 不管上面哪一步抛了，都把页面还回去：主题收起、滚动位置复原、回首页
      topics.forEach(d => { d.open = false; });
      scroller.scrollTop = before.scrollTop;
      showTab("home");
    }
  });
  assert.ok(!r.missing, "设置里没有使用说明");
  assert.ok(r.topics >= 6, `只有 ${r.topics} 条`);
  assert.equal(r.openAtStart, 0, `一进设置就有 ${r.openAtStart} 条是展开的`);
  assert.equal(r.bodiesVisibleAtStart, 0, `收着的时候还有 ${r.bodiesVisibleAtStart} 条的正文露在外面`);
  assert.ok(r.minSummaryH >= 44, `有一条的标题只有 ${Math.round(r.minSummaryH)}px 高，手指点不准`);
  assert.ok(r.collapsedH < r.screenH, `收着的时候就占了 ${r.collapsedH}px，比一屏（${r.screenH}px）还长`);
  assert.equal(r.openedAfterTap, true, "点了标题没展开");
  assert.equal(r.body0Visible, true, "展开了，正文却看不见");
  assert.ok(r.body0Chars >= 40, `展开后只有 ${r.body0Chars} 个字`);
  assert.equal(r.othersStillClosed, true, "点开一条，别的也跟着开了");
  assert.equal(r.overflow, 0, `有 ${r.overflow} 个元素横向超出了屏幕`);
  assert.ok(r.tailBottom <= r.navTop + 1,
    `滚到底之后，最后一条的末行（底边 ${r.tailBottom}）还压在底部导航（顶边 ${r.navTop}）后面，读不到`);
  assert.ok(r.tailTop >= r.headBottom - 1,
    `滚到底之后，最后一条的末行（顶边 ${r.tailTop}）跑到页头（底边 ${r.headBottom}）上面去了——也读不到`);
});

// ── 翻译里点词就查 ────────────────────────────────────────
// 这两条不走 STUB_FETCH 里那份词典假响应（它的形状早就和真函数对不上了，
// 页面会判成「格式不对」），自己在页面里装一层：记下每次去查什么，回一份
// 真函数会回的形状。精选词库里的词根本不该到这一层。
function WORD_TAP_FETCH() {
  const prev = window.fetch;
  window.__dictCalls = [];
  window.fetch = async (input, init) => {
    const url = String(input && input.url ? input.url : input);
    if (url.indexOf("/api/dictionary") === -1) return prev(input, init);
    let body = {}; try { body = JSON.parse(init && init.body || "{}"); } catch (e) {}
    window.__dictCalls.push({ word: body.word, hasCode: !!(init && init.headers && init.headers["X-LL-Access"]) });
    return new Response(JSON.stringify({ lemma: body.word, senses: [{ pos: "n.", definition: "（测试释义）" }] }),
      { status: 200, headers: { "Content-Type": "application/json" } });
  };
  return true;
}

check("翻译里点一个精选词：释义在这句话底下展开，翻译还在，一次网都没联", async (ev) => {
  // 先装计数器：不装的话 __dictCalls 根本不存在，「零次联网」那条断言就是空的——变异探测抓出来的。
  await ev(WORD_TAP_FETCH);
  const r = await ev(async () => {
    showTab("help");
    // 真用户是打一句中文让 helpSubmit 开的翻译房；这里直接摆结果，得自己把房间打开
    document.getElementById("helpIdle").hidden = true;
    document.getElementById("helpAiRoom").hidden = false;
    // 直接摆一份翻译结果，句子里有精选词库的 hug；和真翻译到达时走的是同一个渲染函数
    showTranslateResult({ en: "Give me a hug, sweetie!", zh: "抱抱我，宝贝！", tip: "张开双臂。",
      related: [{ en: "Come here, sweetie.", zh: "过来，宝贝。" }] }, "");
    await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
    const en = document.getElementById("resultEn");
    const ws = Array.from(en.querySelectorAll(".tap-word"));
    const hug = ws.find(w => w.dataset.word === "hug");
    const out = { words: ws.map(w => w.dataset.word), hasHug: !!hug };
    if (!hug) return out;
    // 每个词的命中区要够手指点：视觉上它是一行里的一个词，命中区靠 padding 撑到 44
    out.hitH = (() => { const b = hug.getBoundingClientRect(); return b.height; })();
    out.lineH = parseFloat(getComputedStyle(en).lineHeight);
    hug.click();
    await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
    const panel = document.getElementById("wordLookupPanel");
    if (!panel) return Object.assign(out, { panelVisible: false, panelText: "", panelBelowEn: false, panelAboveZh: false, enStillThere: true, active: hug.classList.contains("is-active"), dictCalls: window.__dictCalls.length, privacyShown: false, collapsed: false });
    out.panelVisible = panel.checkVisibility ? panel.checkVisibility() : panel.getClientRects().length > 0;
    out.panelText = panel.innerText.trim().slice(0, 40);
    out.panelBelowEn = panel.getBoundingClientRect().top >= en.getBoundingClientRect().bottom - 1;
    out.panelAboveZh = panel.getBoundingClientRect().bottom <= document.getElementById("resultZh").getBoundingClientRect().top + 1;
    out.enStillThere = en.innerText.trim() === "Give me a hug, sweetie!";
    out.active = hug.classList.contains("is-active");
    out.dictCalls = window.__dictCalls.length;   // 计数器必须在；不在就让它抛，别默默当 0
    const note0 = document.getElementById("wordLookupPrivacyNote");
    out.privacyShown = !!note0 && !note0.hidden;
    // 再点同一个词：收起（面板是临时造的，收起就是删掉）
    hug.click();
    await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
    out.collapsed = !document.getElementById("wordLookupPanel");
    showTab("home");
    return out;
  });
  assert.ok(r.hasHug, `句子里没切出 hug 这个词：${JSON.stringify(r.words)}`);
  assert.ok(r.hitH >= 44, `词的命中区只有 ${Math.round(r.hitH)}px 高，手指点不准`);
  assert.equal(r.panelVisible, true, "点了词，释义面板没出现");
  assert.ok(r.panelText.length > 0, "面板是空的");
  assert.equal(r.panelBelowEn, true, "面板不在主句底下");
  assert.equal(r.panelAboveZh, true, "面板跑到中文底下去了——应该在英文和中文之间");
  assert.equal(r.enStillThere, true, "翻译那句话不见了或变了");
  assert.equal(r.active, true, "被点的词没有高亮");
  assert.equal(r.dictCalls, 0, `精选词库里的词也去联网了（${r.dictCalls} 次）`);
  assert.equal(r.privacyShown, false, "精选词不联网，隐私提示不该亮");
  assert.equal(r.collapsed, true, "再点同一个词，面板没收起");
});

check("翻译里点一个没收录的词：只联一次网、带邀请码、亮一次隐私提示；点相关说法里的词，面板跟到那一行底下", async (ev) => {
  await ev(WORD_TAP_FETCH);
  const r = await ev(async () => {
    showTab("help");
    document.getElementById("helpIdle").hidden = true;
    document.getElementById("helpAiRoom").hidden = false;
    showTranslateResult({ en: "Give me a hug, sweetie!", zh: "抱抱我，宝贝！", tip: "张开双臂。",
      related: [{ en: "Come here, darling.", zh: "过来，亲爱的。" }] }, "");
    const tick = () => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
    await tick();
    const en = document.getElementById("resultEn");
    const sweetie = Array.from(en.querySelectorAll(".tap-word")).find(w => w.dataset.word === "sweetie");
    sweetie.click();
    await new Promise(res => setTimeout(res, 150));   // 等假 fetch 的 promise 落定
    const panelOf = () => document.getElementById("wordLookupPanel");
    const noteOf = () => document.getElementById("wordLookupPrivacyNote");
    const out = {
      calls: window.__dictCalls.slice(),
      panelHasSense: !!panelOf() && panelOf().innerText.includes("（测试释义）"),
      privacyShown: !!noteOf() && !noteOf().hidden,
    };
    // 连点两次同一个词（收起再打开）：服务端有缓存，但这里数的是页面发了几次
    sweetie.click(); await tick(); sweetie.click(); await new Promise(res => setTimeout(res, 150));
    out.callsAfterReopen = window.__dictCalls.length;
    // 相关说法里的词
    const rel = document.querySelector("#resultRelated .result-related-en");
    const darling = Array.from(rel.querySelectorAll(".tap-word")).find(w => w.dataset.word === "darling");
    out.relHasWords = !!darling;
    if (darling) {
      darling.click();
      await new Promise(res => setTimeout(res, 150));
      const panel = panelOf();
      const pb = panel ? panel.getBoundingClientRect() : { top: -1, height: 0 }, rb = rel.getBoundingClientRect();
      out.panelUnderRel = pb.top >= rb.bottom - 1 && pb.top < document.getElementById("aiDisclaimer").getBoundingClientRect().top;
      out.diag = { panelTop: Math.round(pb.top), relBottom: Math.round(rb.bottom), panelParent: panel && panel.parentElement && panel.parentElement.className, panelH: Math.round(pb.height) };
      out.mainWordStillActive = Array.from(en.querySelectorAll(".tap-word")).some(w => w.classList.contains("is-active"));
    }
    showTab("home");
    return out;
  });
  assert.equal(r.calls.length, 1, `点一个没收录的词应联网恰好一次，实际 ${r.calls.length} 次`);
  assert.equal(r.calls[0].word, "sweetie", `发出去的词不对：${JSON.stringify(r.calls[0])}`);
  assert.equal(r.calls[0].hasCode, true, "查词请求没带邀请码");
  assert.equal(r.panelHasSense, true, "服务器回了释义，面板里没显示出来");
  assert.equal(r.privacyShown, true, "联网查了，隐私提示没亮");
  assert.ok(r.callsAfterReopen <= 2, `收起再打开同一个词，页面又发了 ${r.callsAfterReopen - 1} 次`);
  assert.equal(r.relHasWords, true, "「还可以这样说」里的词点不了");
  assert.equal(r.panelUnderRel, true, `点相关说法里的词，面板没跟到那一行底下：${JSON.stringify(r.diag)}`);
  assert.equal(r.mainWordStillActive, false, "点了相关说法里的词，主句里的词还亮着");
});

check("场景里的预设句子：点一个词，释义在那句英文底下、卡片里面；换了年龄档重画之后照样能点", async (ev) => {
  await ev(WORD_TAP_FETCH);
  const r = await ev(async () => {
    const tick = () => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
    openScenario("bath");
    switchAge("0-1");          // 0-1 档第一句是 "Bath time!"，bath 在精选词库里
    await tick();
    const firstEn = () => document.querySelector("#phraseList .phrase-card .phrase-en");
    const en = firstEn();
    const out = { firstLine: en ? en.innerText.trim() : "", words: en ? Array.from(en.querySelectorAll(".tap-word")).map(w => w.dataset.word) : [] };
    const bath = en && Array.from(en.querySelectorAll(".tap-word")).find(w => w.dataset.word === "bath");
    if (!bath) return out;
    bath.click();
    await tick();
    const panel = document.getElementById("wordLookupPanel");
    const card = en.closest(".phrase-card");
    out.panelInCard = !!panel && panel.parentElement === card;
    out.panelBelowEn = !!panel && panel.getBoundingClientRect().top >= en.getBoundingClientRect().bottom - 1;
    out.panelAboveActions = !!panel && panel.getBoundingClientRect().bottom <= card.querySelector(".phrase-actions").getBoundingClientRect().top + 1;
    out.panelText = panel ? panel.innerText.trim().slice(0, 30) : "";
    out.calls = window.__dictCalls.length;
    // 卡片上原有的按钮不受影响：朗读、收藏、今天用了 都还在、还够高
    out.actionsOk = ["play-btn", "save-btn", "used-btn"].every(c => { const b = card.querySelector("." + c); return b && b.getBoundingClientRect().height >= 44; });
    // 换档：列表整体重画，面板随之销毁；再点一次必须还能用（上一版会在这里失效）
    switchAge("3-6");          // 3-6 档第一句 "Okay, it's bath time! …"
    await tick();
    out.panelGoneAfterRerender = !document.getElementById("wordLookupPanel");
    const en2 = firstEn();
    const bath2 = en2 && Array.from(en2.querySelectorAll(".tap-word")).find(w => w.dataset.word === "bath");
    out.secondLine = en2 ? en2.innerText.trim() : "";
    if (bath2) {
      bath2.click(); await tick();
      const p2 = document.getElementById("wordLookupPanel");
      out.worksAfterRerender = !!p2 && p2.parentElement === en2.closest(".phrase-card") && p2.innerText.trim().length > 0;
    }
    out.callsAfter = window.__dictCalls.length;
    if (typeof collapseWordLookup === "function") collapseWordLookup();
    switchAge("1-2"); showTab("home");
    return out;
  });
  assert.ok(r.words.includes("bath"), `第一句「${r.firstLine}」里没切出 bath：${JSON.stringify(r.words)}`);
  assert.equal(r.panelInCard, true, "面板没落在那张卡片里");
  assert.equal(r.panelBelowEn, true, "面板不在英文那一行底下");
  assert.equal(r.panelAboveActions, true, "面板跑到朗读/收藏按钮下面去了——应该在英文和按钮之间");
  assert.ok(r.panelText.length > 0, "面板是空的");
  assert.equal(r.calls, 0, `bath 在精选词库里，却联了 ${r.calls} 次网`);
  assert.equal(r.actionsOk, true, "卡片上原有的按钮被挤坏或变矮了");
  assert.equal(r.panelGoneAfterRerender, true, "换档重画后旧面板居然还在");
  assert.equal(r.worksAfterRerender, true, `换档重画后再点词不出面板（第一句：「${r.secondLine}」）——上一版就是这样坏的`);
  assert.equal(r.callsAfter, 0, "重画后点精选词也联网了");
});

check("进一个场景：从最上面开始，两排筛选标签整条都在，不是被切了一半的弧线", async (ev) => {
  const r = await ev(async () => {
    const tick = () => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
    const screen = document.getElementById("scenarioScreen");
    // 先照着家长的路径走一遍：进一个场景、往下滚着看句子、退回去、再进另一个
    openScenario("bath");
    await tick();
    screen.scrollTop = 300;
    await tick();
    const scrolledAway = screen.scrollTop > 0;   // 确认这一屏真的能滚，否则下面白测
    closeScenario();
    openScenario("meal");
    await tick();
    const header = document.querySelector("#scenarioScreen .screen-header");
    const firstAge = document.querySelector("#ageTabs .age-tab");
    const firstTier = document.querySelector("#tierTabs .tier-tab");
    const below = el => el && el.getBoundingClientRect().top >= header.getBoundingClientRect().bottom - 1;
    const whole = el => {
      if (!el) return false;
      const r = el.getBoundingClientRect(), h = header.getBoundingClientRect();
      return r.top >= h.bottom - 1 && r.height >= 40;   // 整条都在标题栏下面，没被切
    };
    return { scrolledAway, top: screen.scrollTop,
             ageWhole: whole(firstAge), tierBelow: below(firstTier),
             ageH: firstAge ? Math.round(firstAge.getBoundingClientRect().height) : 0 };
  });
  assert.equal(r.scrolledAway, true, "这一屏根本没滚动，这条检查等于没测——换个滚动量");
  assert.equal(r.top, 0, `再进一个场景时还停在上一个场景滚到的位置（scrollTop=${r.top}）——两排标签被卷到标题栏底下，只露出底边`);
  assert.equal(r.ageWhole, true, `年龄那一排没整条露出来（高 ${r.ageH}px）`);
  assert.equal(r.tierBelow, true, "难度那一排被标题栏盖住了");
});

check("「安装到主屏幕」的横幅亮着时进场景：标题栏和筛选标签仍看得见、点得到，横幅不压在上面", async (ev) => {
  const r = await ev(async () => {
    const tick = () => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
    const banner = document.getElementById("installBanner");
    banner.classList.add("show");          // 还没装到主屏幕的家长看到的就是这个状态
    await tick();
    const onHome = banner.getClientRects().length > 0;   // 首页上它该在
    openScenario("bath");
    await tick();
    const hit = el => {                    // 这个点上，最上面的东西是不是它自己
      if (!el) return false;
      const r = el.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!top && (top === el || el.contains(top) || top.contains(el));
    };
    const header = document.querySelector("#scenarioScreen .screen-header");
    const firstAge = document.querySelector("#ageTabs .age-tab");
    const out = { onHome, titleHit: hit(document.getElementById("scenarioTitle")),
                  ageHit: hit(firstAge), headerTop: Math.round(header.getBoundingClientRect().top),
                  ageTop: Math.round(firstAge.getBoundingClientRect().top) };
    closeScenario();
    await tick();
    out.backOnHome = banner.getClientRects().length > 0;  // 退回首页，邀请还得回来
    banner.classList.remove("show");
    return out;
  });
  assert.equal(r.onHome, true, "首页上安装横幅没出现，这条检查白测了");
  assert.equal(r.titleHit, true, `场景标题被横幅压住了（标题栏 top=${r.headerTop}）`);
  assert.equal(r.ageHit, true, `年龄那一排被横幅压住了（top=${r.ageTop}）——家长看不清也点不到`);
  assert.ok(r.ageTop >= 0, `年龄那一排跑到屏幕外面去了（top=${r.ageTop}）`);
  assert.equal(r.backOnHome, true, "退回首页后安装邀请没回来——不该把它永久藏掉");
});

check("复习卡：翻开英文后点一个词，释义在英文那一行底下；没翻开之前那些词是看不见的", async (ev) => {
  await ev(WORD_TAP_FETCH);
  const r = await ev(async () => {
    const tick = () => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
    // 收藏一句带精选词的预设句（0-1 档「Bath time!」），它一收就到期，复习卡会出它
    openScenario("bath"); switchAge("0-1"); await tick();
    const p = scenarios.bath.phrases["0-1"][0];
    if (!savedPhrases.some(x => x.id === p.id)) toggleSave(p.id);
    const mine = savedPhrases.find(x => x.id === p.id); mine.rv = { s: 0, due: Date.now() - 1000 };
    __primeReviewQueueForTest([mine]);
    showTab("review"); await tick();
    // 队列可能被 renderReviewArea 重算；把我们这句放到队首再画一次
    __primeReviewQueueForTest([mine]); renderReviewCard(); await tick();
    const card = document.querySelector("#reviewArea .review-card");
    const en = card && card.querySelector(".review-en");
    const out = { hasCard: !!card, enText: en ? en.innerText.trim() : "" };
    if (!en) return out;
    const vis = el => el.checkVisibility ? el.checkVisibility() : el.getClientRects().length > 0;
    const bath = Array.from(en.querySelectorAll(".tap-word")).find(w => w.dataset.word === "bath");
    out.wordsBeforeReveal = en.querySelectorAll(".tap-word").length;
    out.hiddenBeforeReveal = !!bath && !vis(bath);
    card.querySelector(".review-btn-reveal").click(); await tick();
    out.visibleAfterReveal = !!bath && vis(bath);
    if (typeof stopAllAudio === "function") stopAllAudio();   // 翻开会自动朗读，先停掉
    if (bath) { bath.click(); await tick(); }
    const panel = document.getElementById("wordLookupPanel");
    out.panelInCard = !!panel && card.contains(panel);
    out.panelBelowEn = !!panel && panel.getBoundingClientRect().top >= en.getBoundingClientRect().bottom - 1;
    out.panelAboveActions = !!panel && panel.getBoundingClientRect().bottom <= card.querySelector(".review-actions").getBoundingClientRect().top + 1;
    out.panelText = panel ? panel.innerText.trim().slice(0, 30) : "";
    out.calls = window.__dictCalls.length;
    // 评分按钮还够得着、没被面板挤矮
    out.buttonsOk = [".review-btn-again", ".review-btn-good"].every(sel => card.querySelector(sel).getBoundingClientRect().height >= 44);
    if (typeof collapseWordLookup === "function") collapseWordLookup();
    toggleSave(p.id); showTab("home");
    return out;
  });
  assert.ok(r.hasCard, "复习卡没画出来");
  assert.ok(r.wordsBeforeReveal >= 2, `英文行里没切出词：「${r.enText}」`);
  assert.equal(r.hiddenBeforeReveal, true, "还没点「显示英文」，词就露出来了——答案泄露");
  assert.equal(r.visibleAfterReveal, true, "翻开之后词还是看不见");
  assert.equal(r.panelInCard, true, "面板没落在复习卡里");
  assert.equal(r.panelBelowEn, true, "面板不在英文那一行底下");
  assert.equal(r.panelAboveActions, true, "面板跑到评分按钮下面去了");
  assert.ok(r.panelText.length > 0, "面板是空的");
  assert.equal(r.calls, 0, `bath 在精选词库里，却联了 ${r.calls} 次网`);
  assert.equal(r.buttonsOk, true, "评分按钮被面板挤矮了");
});

check("收藏列表：点「显示英文」之后，英文里的词能点，释义在那一行底下；别的行不受影响", async (ev) => {
  await ev(WORD_TAP_FETCH);
  const r = await ev(async () => {
    const tick = () => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
    openScenario("bath"); switchAge("0-1"); await tick();
    const p = scenarios.bath.phrases["0-1"][0];
    if (!savedPhrases.some(x => x.id === p.id)) toggleSave(p.id);
    showTab("saved"); await tick();
    const rows = Array.from(document.querySelectorAll("#savedScreen .saved-item"));
    const row = rows.find(rw => rw.querySelector(".saved-item-zh") && rw.querySelector(".saved-item-zh").innerText.includes(p.zh));
    const out = { rows: rows.length, hasRow: !!row };
    if (!row) return out;
    out.wordsBeforeReveal = row.querySelectorAll(".tap-word").length;
    row.querySelector(".saved-item-reveal").click(); await tick();
    const en = row.querySelector(".saved-item-en");
    out.enText = en ? en.innerText.trim() : "";
    const bath = en && Array.from(en.querySelectorAll(".tap-word")).find(w => w.dataset.word === "bath");
    if (bath) { bath.click(); await tick(); }
    const panel = document.getElementById("wordLookupPanel");
    out.panelInRow = !!panel && row.contains(panel);
    out.panelBelowEn = !!panel && en && panel.getBoundingClientRect().top >= en.getBoundingClientRect().bottom - 1;
    out.panelText = panel ? panel.innerText.trim().slice(0, 30) : "";
    out.calls = window.__dictCalls.length;
    // 别的行还遮着
    out.othersStillMasked = rows.filter(rw => rw !== row).every(rw => !rw.querySelector(".saved-item-en"));
    if (typeof collapseWordLookup === "function") collapseWordLookup();
    toggleSave(p.id); showTab("home");
    return out;
  });
  assert.ok(r.hasRow, `收藏列表里找不到那一行（共 ${r.rows} 行）`);
  assert.equal(r.wordsBeforeReveal, 0, "还没点「显示英文」，词就在 DOM 里了——答案泄露");
  assert.ok(r.enText.length > 0, "点了「显示英文」，英文没出来");
  assert.equal(r.panelInRow, true, "面板没落在那一行里");
  assert.equal(r.panelBelowEn, true, "面板不在英文底下");
  assert.ok(r.panelText.length > 0, "面板是空的");
  assert.equal(r.calls, 0, `bath 在精选词库里，却联了 ${r.calls} 次网`);
  assert.equal(r.othersStillMasked, true, "点了一行，别的行的英文也露出来了");
});

check("整页没有重复的 id", async (ev) => {
  const dupes = await ev(() => {
    const seen = new Map();
    for (const el of document.querySelectorAll("[id]")) {
      seen.set(el.id, (seen.get(el.id) || 0) + 1);
    }
    return Array.from(seen).filter(pair => pair[1] > 1).map(pair => pair[0] + "×" + pair[1]);
  });
  assert.deepEqual(dupes, [], `重复的 id：${dupes.join(", ")}`);
});

check("能点的东西都够得着（≥44px）", async (ev) => {
  const small = await ev(() => {
    const sel = ".nav-item, .voice-row, .voice-try, .age-opt, .age-badge, .gear-btn," +
                " .translate-btn, .review-cta, .back-btn, .play-btn, .save-btn, .used-btn, .backup-btn";
    const bad = [];
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;   // 收起来的不算
      if (r.height < 44) bad.push(String(el.className).split(" ")[0] + ":" + Math.round(r.height) + "px");
    }
    return Array.from(new Set(bad));
  });
  assert.deepEqual(small, [], `这些点起来太小：${small.join(", ")}`);
});

check("换了嗓子，同一句话重新生成；换回去时旧的那份还在", async (ev) => {
  // 这是「时而这把、时而那把」的主因：片段原来只按句子 id 存，换了音色
  // hasAudio 直接短路，旧声音永远发下去。这一条走真实的 IndexedDB，
  // 只把打给 /api/tts 的请求截下来，看它到底用哪把嗓子问、问了几次。
  const r = await ev(async () => {
    const calls = [];
    const real = window.fetch;
    window.fetch = async (input, init) => {
      const url = String(input && input.url ? input.url : input);
      if (url.indexOf("/api/tts") !== -1) {
        try { calls.push(JSON.parse(init.body).voice); } catch (e) { calls.push("?"); }
        return new Response(new Blob([new Uint8Array([1, 2, 3])], { type: "audio/mpeg" }),
          { status: 200, headers: { "Content-Type": "audio/mpeg" } });
      }
      return real(input, init);
    };
    // 从当前清单里取两把，不写死——音色列表改过一次，写死的那个已经不在了，
    // setVoice 会正确地拒绝它，而测试会误以为是产品坏了。
    const JENNY = DEFAULT_VOICE_ID;
    const OTHER = (VOICE_OPTIONS.find(o => o.id !== JENNY) || {}).id;
    if (!OTHER) return { skip: "清单里只有一把嗓子" };
    const item = { id: "e2e_voice_probe", en: "Time for bed, sweetie." };
    await deleteAudio(item.id);

    setVoice(JENNY);
    await provisionAudio(item, item.id);
    const underJenny = await hasAudio(item.id);

    if (!setVoice(OTHER)) return { skip: "换不过去：" + OTHER };
    const rightAfterSwitch = await hasAudio(item.id);
    await provisionAudio(item, item.id);
    const underOther = await hasAudio(item.id);

    setVoice(JENNY);
    const backToJenny = await hasAudio(item.id);

    await deleteAudio(item.id);
    setVoice(OTHER);
    const goneAfterDelete = await hasAudio(item.id);
    setVoice(JENNY);
    window.fetch = real;
    return { calls, want: [JENNY, OTHER], underJenny, rightAfterSwitch, underOther, backToJenny, goneAfterDelete };
  });
  assert.ok(!r.skip, `这一条没跑起来：${r.skip}`);
  assert.equal(r.underJenny, true, "第一把嗓子的片段没存下来");
  assert.equal(r.rightAfterSwitch, false,
    "换了嗓子之后还认为已经有片段了——这正是旧声音一直发下去的原因");
  assert.equal(r.underOther, true, "换了嗓子之后没能重新生成");
  assert.equal(r.backToJenny, true, "换回去时旧片段没了，等于要再花一次钱");
  assert.deepEqual(r.calls, r.want, `打出去的音色不对：${r.calls.join(", ")}`);
  assert.equal(r.goneAfterDelete, false, "删掉之后，别的音色那份还赖在手机里");
});

check("中文提示用中文那把嗓子生成，换英文音色不会把它作废", async (ev) => {
  // 连播里每句英文之前那句中文，原来是手机自带的合成念的，音质差。改成
  // Azure 之后要守住两件事：用的是中文那把嘴；它自成一路，家长换英文音色
  // 不会把所有中文提示一起作废重生成——那是白花钱，中文听起来还一点没变。
  const r = await ev(async () => {
    const calls = [];
    const real = window.fetch;
    window.fetch = async (input, init) => {
      const url = String(input && input.url ? input.url : input);
      if (url.indexOf("/api/tts") !== -1) {
        try { calls.push(JSON.parse(init.body).voice); } catch (e) { calls.push("?"); }
        return new Response(new Blob([new Uint8Array([1, 2, 3])], { type: "audio/mpeg" }),
          { status: 200, headers: { "Content-Type": "audio/mpeg" } });
      }
      return real(input, init);
    };
    const item = { id: "e2e_cue_probe", en: "Time for bed.", zh: "该睡觉了" };
    await deleteAudio(item.id);
    setVoice(DEFAULT_VOICE_ID);
    await provisionCue(item);
    const madeCue = await hasAudio("zh:" + item.id);
    const hasUrl = !!audioUrlFor("zh:" + item.id);

    const other = (VOICE_OPTIONS.find(o => o.id !== DEFAULT_VOICE_ID) || {}).id;
    if (other) setVoice(other);
    const survivesVoiceChange = await hasAudio("zh:" + item.id);

    setVoice(DEFAULT_VOICE_ID);
    await deleteAudio(item.id);
    const goneAfterDelete = await hasAudio("zh:" + item.id);
    window.fetch = real;
    return { calls, madeCue, hasUrl, survivesVoiceChange, goneAfterDelete, cue: CUE_VOICE_ID };
  });
  assert.deepEqual(r.calls, [r.cue], `中文提示不是用中文那把嘴生成的：${r.calls.join(", ")}`);
  assert.equal(r.madeCue, true, "中文提示没存下来");
  assert.equal(r.hasUrl, true,
    "存下来了但地址没备好——连播时还是会退回手机自带的合成");
  assert.equal(r.survivesVoiceChange, true,
    "换了英文音色，中文提示被作废了：白花一次钱，而中文听起来一点没变");
  assert.equal(r.goneAfterDelete, false, "删掉这句话，它的中文提示还赖在手机里");
});

check("复习卡上「还要练」和「记住了」一样大", async (ev) => {
  const r = await ev(async () => {
    showTab("home");
    const band = scenarios.bath.phrases[currentAge] ? currentAge : "1-2";
    const p = scenarios.bath.phrases[band][0];
    if (!savedPhrases.some(x => x.id === p.id)) toggleSave(p.id);
    showTab("review");
    await new Promise(res => setTimeout(res, 300));
    const reveal = document.querySelector(".review-btn-reveal");
    if (reveal) reveal.click();
    await new Promise(res => setTimeout(res, 300));
    const a = document.querySelector(".review-btn-again");
    const g = document.querySelector(".review-btn-good");
    if (!a || !g) return null;
    const ra = a.getBoundingClientRect(), rg = g.getBoundingClientRect();
    const cs = e => {
      const s = getComputedStyle(e);
      return { weight: s.fontWeight, radius: s.borderRadius, size: s.fontSize };
    };
    return { w: [Math.round(ra.width), Math.round(rg.width)],
             h: [Math.round(ra.height), Math.round(rg.height)],
             a: cs(a), g: cs(g) };
  });
  assert.ok(r, "复习卡上没找到那两个按钮");
  assert.ok(Math.abs(r.w[0] - r.w[1]) <= 1, `两个按钮不一样宽：${r.w.join(" vs ")}`);
  assert.ok(Math.abs(r.h[0] - r.h[1]) <= 1, `两个按钮不一样高：${r.h.join(" vs ")}`);
  assert.deepEqual(r.a, r.g, "两个按钮的字重/圆角/字号不一致——自评会被样式推着走");
});

// ── 恶劣环境 ────────────────────────────────────────────
// 目标用户手机上不一定有 Safari / Chrome / Edge，入口常常是微信内置浏览器
// 或国产 OEM 浏览器。那里可能没有 service worker、没有 IndexedDB，存储也
// 可能被关掉。下面每一条都在页面脚本跑起来**之前**把对应的东西弄坏，然后
// 只问一件事：家长还看得见界面吗。
//
// 这些不是「功能还在不在」，是「页面还在不在」——一个没保护的存储读取，
// 家长看到的不是收藏丢了，是一片白。
const hostiles = [];
// viewport：这条要在多大的屏上跑。挂在定义上，而不是在跑道里按名字对——改个名就悄悄回到默认宽度，那是假绿。
function hostile(name, sabotage, fn, { viewport = null } = {}) { hostiles.push({ name, sabotage, fn, viewport }); }

const ALIVE = () => {
  const home = document.getElementById("homeScreen");
  const nav = document.querySelector(".bottom-nav");
  return {
    booted: typeof showTab === "function",
    homeVisible: !!home && home.getClientRects().length > 0,
    navItems: nav ? nav.querySelectorAll(".nav-item").length : 0,
    scenarioCards: document.querySelectorAll("#scenarioGrid .scenario-card").length,
    text: document.body.innerText.trim().length,
  };
};

hostile("存储被关掉（微信里可以关，隐私模式下会直接抛）", `
  const boom = () => { throw new DOMException("denied", "SecurityError"); };
  try {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() { return { getItem: boom, setItem: boom, removeItem: boom, clear: boom, key: boom, length: 0 }; },
    });
  } catch (e) {}
`, async (ev) => {
  const r = await ev(ALIVE);
  assert.equal(r.booted, true, "存储一抛异常，脚本就没跑完");
  assert.equal(r.homeVisible, true, "首页没画出来——家长看到的是一片白");
  assert.equal(r.navItems, 4, `底部只剩 ${r.navItems} 个标签`);
  assert.ok(r.scenarioCards > 0, "场景一个都没渲染出来");
});

// 两种形状都要试。第二种是 http:// 这类非安全来源上的真实样子：属性还在，
// 值却是 undefined——`'serviceWorker' in navigator` 会是 true。
hostile("没有 service worker（属性整个不在）", `
  try { Object.defineProperty(navigator, "serviceWorker", { configurable: true, get() { return undefined; } }); } catch (e) {}
  try { delete Navigator.prototype.serviceWorker; } catch (e) {}
`, async (ev) => {
  const r = await ev(ALIVE);
  assert.equal(r.booted, true, "没有 service worker 就起不来了");
  assert.equal(r.homeVisible, true, "首页没画出来");
  assert.ok(r.scenarioCards > 0, "场景一个都没渲染出来");
});

hostile("service worker 属性在、值却是 undefined（非安全来源的样子）", `
  try {
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true, enumerable: true, get() { return undefined; },
    });
  } catch (e) {}
`, async (ev) => {
  const r = await ev(ALIVE);
  assert.equal(r.booted, true, "这种形状下脚本半路就断了");
  assert.equal(r.homeVisible, true, "首页没画出来——家长看到的是一片白");
  assert.ok(r.scenarioCards > 0, "场景一个都没渲染出来");
  assert.ok(r.text > 50, "页面上几乎没有字");
});

hostile("没有 IndexedDB（存声音的地方）", `
  try { Object.defineProperty(window, "indexedDB", { configurable: true, get() { return undefined; } }); } catch (e) {}
`, async (ev) => {
  const r = await ev(async () => {
    const base = (() => {
      const home = document.getElementById("homeScreen");
      return { booted: typeof showTab === "function",
               homeVisible: !!home && home.getClientRects().length > 0 };
    })();
    // 收藏仍然要能收——声音存不了是另一回事，不该拖垮收藏本身
    const band = scenarios.bath.phrases[currentAge] ? currentAge : "1-2";
    const p = scenarios.bath.phrases[band][0];
    // toggleSave 是切换：先确保这句还没被收藏，不然这一步等于取消收藏
    if (savedPhrases.some(x => x.id === p.id)) toggleSave(p.id);
    const before = savedPhrases.length;
    let threw = "";
    try { toggleSave(p.id); } catch (e) { threw = String(e && e.message || e); }
    await new Promise(res => setTimeout(res, 200));
    return Object.assign(base, { threw, before, after: savedPhrases.length });
  });
  assert.equal(r.booted, true, "没有 IndexedDB 就起不来了");
  assert.equal(r.homeVisible, true, "首页没画出来");
  assert.equal(r.threw, "", `收藏时抛了错：${r.threw}`);
  assert.equal(r.after, r.before + 1, "声音存不了，连收藏本身也做不成了");
});

hostile("没有语音合成（有些内置浏览器没有）", `
  try { Object.defineProperty(window, "speechSynthesis", { configurable: true, get() { return undefined; } }); } catch (e) {}
`, async (ev) => {
  const r = await ev(async () => {
    const home = document.getElementById("homeScreen");
    const base = { booted: typeof showTab === "function",
                   homeVisible: !!home && home.getClientRects().length > 0 };
    openScenario("bath");
    await new Promise(res => setTimeout(res, 200));
    const btn = document.querySelector("#phraseList .play-btn") || document.querySelector(".play-btn");
    let threw = "";
    if (btn) { try { btn.click(); } catch (e) { threw = String(e && e.message || e); } }
    await new Promise(res => setTimeout(res, 400));
    return Object.assign(base, { threw, hasBtn: !!btn,
      label: btn ? btn.textContent.trim() : "" });
  });
  assert.equal(r.booted, true, "没有语音合成就起不来了");
  assert.equal(r.hasBtn, true, "场景里没有朗读按钮");
  assert.equal(r.threw, "", `点朗读抛了错：${r.threw}`);
  assert.ok(r.label.length > 0, "朗读按钮上的字没了——家长不知道发生了什么");
});

// 付费端点全挂。2026-08 `/api/translate` 真的挂过 15 天，没人发现，当时也没人
// 知道免费那一半有没有被拖下水。这一条守的是：**花钱的功能坏了，不花钱的
// 功能一个都不许跟着坏**（文档仓库 docs/requirements.md 的 R04）。
//
// 两种挂法都要试，它们走的是不同的代码路径：网络直接断（fetch 抛 TypeError）
// 和服务端在、但一律回 500。
//
// 每一步都自带对照组：先证明「真的挂了」，再验免费路径。否则 runner 装的那份
// 有求必应的假 fetch 还在答话，下面所有断言都会是假绿。
function paidEndpointsDown(mode) {
  return async (ev) => {
    const r = await ev(async (mode) => {
      const out = { paidCalls: [], freeCalls: [] };
      let bucket = out.paidCalls;
      const prev = window.fetch;
      window.fetch = async (input, init) => {
        const url = String(input && input.url ? input.url : input);
        if (url.indexOf("/api/") === -1) return prev(input, init);
        bucket.push(url.replace(/^.*(\/api\/[a-z-]+).*$/, "$1"));
        if (mode === "network") throw new TypeError("Failed to fetch");
        return new Response("upstream down", { status: 500 });
      };
      const tick = (ms) => new Promise(res => setTimeout(res, ms));

      // ── 对照组：此刻付费端点必须真的不通 ──
      out.control = [];
      for (const ep of ["/api/translate", "/api/dictionary", "/api/tts"]) {
        let dead = false;
        try { const p = await fetch(ep, { method: "POST", body: "{}" }); dead = !p.ok; }
        catch (e) { dead = true; }
        out.control.push(ep + ":" + (dead ? "dead" : "ALIVE"));
      }

      // ── 家长真去用一次付费功能：可以失败，但不许抛、不许把按钮卡死 ──
      showTab("help");
      document.getElementById("zhInput").value = "我们去洗澡吧";
      out.translateThrew = "";
      try { await doTranslate(); } catch (e) { out.translateThrew = String(e && e.message || e); }
      const tbtn = document.querySelector(".translate-btn");
      out.translateBtnStuck = !!tbtn && tbtn.disabled;
      out.translateShown = document.getElementById("translateResult").classList.contains("show");
      out.translateNote = (document.getElementById("aiDisclaimer").textContent || "").trim();

      // 「帮我说」出结果后会在后台给那句话补声音（/api/tts），那是付费功能自己
      // 的尾巴。等它落定再换桶，不然它会晚到、被记到免费路径头上。
      // 不按固定时长等：等到连续 600ms 没有新的付费请求为止，最多 6 秒。
      for (let quiet = 0, seen = out.paidCalls.length, waited = 0; quiet < 600 && waited < 6000; waited += 100) {
        await tick(100);
        if (out.paidCalls.length !== seen) { seen = out.paidCalls.length; quiet = 0; } else quiet += 100;
      }

      // 从这里往下全是免费路径，一次 /api/ 都不该碰
      bucket = out.freeCalls;

      // ── 免费路径 1：首页和场景还在 ──
      showTab("home");
      const home = document.getElementById("homeScreen");
      out.homeVisible = !!home && home.getClientRects().length > 0;
      out.scenarioCards = document.querySelectorAll("#scenarioGrid .scenario-card").length;

      // ── 免费路径 2：进场景，短句在，预录音频拿得到 ──
      openScenario("bath");
      await tick(200);
      const band = scenarios.bath.phrases[currentAge] ? currentAge : "1-2";
      const p = scenarios.bath.phrases[band][0];
      out.phraseRows = document.querySelectorAll("#phraseList .play-btn").length;
      out.audioUrl = playableUrlFor(Object.assign({}, p, { scenario: "bath" }));
      out.audioOk = false;
      try { const a = await fetch(out.audioUrl); out.audioOk = a.ok; } catch (e) {}
      const pbtn = document.querySelector("#phraseList .play-btn");
      out.playThrew = "";
      if (pbtn) { try { pbtn.click(); } catch (e) { out.playThrew = String(e && e.message || e); } }
      await tick(200);

      // ── 免费路径 3：收藏 ──
      if (savedPhrases.some(x => x.id === p.id)) toggleSave(p.id);
      const before = savedPhrases.length;
      out.saveThrew = "";
      try { toggleSave(p.id); } catch (e) { out.saveThrew = String(e && e.message || e); }
      await tick(200);
      out.saved = savedPhrases.length - before;
      out.persisted = (JSON.parse(localStorage.getItem("ll_saved") || "[]")).some(x => x.id === p.id);

      // ── 免费路径 4：收藏页画得出这一句 ──
      showTab("saved");
      await tick(200);
      out.savedRowShown = document.getElementById("savedScreen").innerText.indexOf(p.zh) !== -1;

      // ── 免费路径 5：复习卡出得来，答一次排期真的往后挪 ──
      showTab("review");
      await tick(200);
      out.reviewCard = document.querySelectorAll("#reviewArea .review-card").length;
      const head = reviewQueue[0];
      // 先把数抄下来：队列里的条目和收藏里的是同一个对象，答完再读就成了自己比自己
      const headId = head ? head.id : null;
      const stageBefore = head ? (head.rv.s || 0) : -1;
      out.reviewThrew = "";
      try { if (head) reviewAnswer(true); } catch (e) { out.reviewThrew = String(e && e.message || e); }
      const after = headId ? savedPhrases.find(x => x.id === headId) : null;
      out.rescheduled = !!after && after.rv.s === stageBefore + 1 && after.rv.due > Date.now() + 3600000;

      // 收拾：别把这一句留给后面的环境
      if (savedPhrases.some(x => x.id === p.id)) { currentScenario = "bath"; toggleSave(p.id); }
      showTab("home");
      return out;
    }, mode);

    // 对照组先过，后面的断言才有意义
    assert.deepEqual(r.control, ["/api/translate:dead", "/api/dictionary:dead", "/api/tts:dead"],
      `对照组没立住——付费端点其实还通着，下面全是假绿：${r.control.join(" ")}`);
    assert.ok(r.paidCalls.includes("/api/translate"),
      "「帮我说」这一步根本没去碰 /api/translate——这条测试没测到它以为在测的东西");

    assert.equal(r.translateThrew, "", `付费功能挂了，错一路抛到了页面上：${r.translateThrew}`);
    assert.equal(r.translateBtnStuck, false, "翻译失败之后按钮还卡在「正在生成…」，家长再也点不了");
    assert.equal(r.translateShown, true, "翻译失败之后什么都没显示——家长不知道发生了什么");
    assert.ok(r.translateNote.length > 0, "翻译失败了，却一个字的说明都没有");

    assert.equal(r.homeVisible, true, "付费端点一挂，首页没了");
    assert.ok(r.scenarioCards > 0, "付费端点一挂，场景一个都没渲染出来");
    assert.ok(r.phraseRows > 0, "付费端点一挂，场景里的短句没了");
    assert.ok(/^\.\/audio\/.+_normal\.mp3$/.test(String(r.audioUrl)),
      `预设短语的声音不该绕道服务端：${r.audioUrl}`);
    assert.equal(r.audioOk, true, "预录音频拿不到了");
    assert.equal(r.playThrew, "", `点朗读抛了错：${r.playThrew}`);
    assert.equal(r.saveThrew, "", `收藏时抛了错：${r.saveThrew}`);
    assert.equal(r.saved, 1, "付费端点一挂，连收藏都做不成了");
    assert.equal(r.persisted, true, "收藏只活在内存里，没写进手机");
    assert.equal(r.savedRowShown, true, "收藏页画不出刚收的这一句");
    assert.equal(r.reviewCard, 1, "付费端点一挂，复习卡出不来了");
    assert.equal(r.reviewThrew, "", `答复习题抛了错：${r.reviewThrew}`);
    assert.equal(r.rescheduled, true, "答了「记住了」，排期却没往后挪");
    assert.deepEqual(r.freeCalls, [],
      `免费路径不该碰任何付费端点，却碰了：${r.freeCalls.join(" ")}`);
  };
}

hostile("付费端点全挂 · 网络直接断：免费的功能一个都不许跟着坏", "", paidEndpointsDown("network"));
hostile("付费端点全挂 · 服务端一律回 500：免费的功能一个都不许跟着坏", "", paidEndpointsDown("http500"));

hostile("手机屏高不够时进场景：两排筛选标签没有被挤扁，按钮整个在自己那一行里", "", async (ev) => {
  const r = await ev(async () => {
    const tick = () => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
    openScenario("bath");
    await tick(); await tick();
    const box = sel => { const e = document.querySelector(sel); if (!e) return null;
      const b = e.getBoundingClientRect();
      return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height) }; };
    return { age: box("#ageTabs"), age1: box("#ageTabs .age-tab"),
             tier: box("#tierTabs"), tier1: box("#tierTabs .tier-tab"),
             own: box("#ownWordsInvite"), list: box("#phraseList") };
  });
  // 整屏内容比屏幕高，.screen 又是纵向 flex —— 默认每一块都会被压缩，
  // 里面 44px 的按钮溢出到盒子外面，被下面那张卡盖住半截（2026-09-23 真机）。
  assert.ok(r.age.h >= r.age1.h, `年龄那一排被挤扁了：容器 ${r.age.h}px，里面的按钮 ${r.age1.h}px`);
  assert.ok(r.tier.h >= r.tier1.h, `难度那一排被挤扁了：容器 ${r.tier.h}px，里面的按钮 ${r.tier1.h}px`);
  assert.ok(r.age1.bottom <= r.age.bottom + 1, "年龄按钮溢出到它那一行外面了");
  assert.ok(r.tier1.bottom <= r.tier.bottom + 1, "难度按钮溢出到它那一行外面了");
  assert.ok(r.own.top >= r.tier1.bottom - 1,
    `下面那张卡压在难度标签上（卡 top=${r.own.top}，按钮 bottom=${r.tier1.bottom}）`);
  assert.ok(r.list.top >= r.own.bottom - 1, "句子列表压在上面那张卡上");
}, { viewport: { width: 390, height: 844 } });

hostile("窄屏 320px（老安卓机最常见的宽度）", "", async (ev) => {
  const r = await ev(() => {
    const out = { over: [] };
    const w = document.documentElement.clientWidth;
    out.width = w;
    out.scrollW = document.documentElement.scrollWidth;
    for (const el of document.querySelectorAll("#homeScreen *, .bottom-nav *")) {
      const b = el.getBoundingClientRect();
      if (b.width === 0 && b.height === 0) continue;
      if (b.right > w + 1 || b.left < -1) {
        out.over.push(String(el.className || el.tagName).split(" ")[0] +
          ":" + Math.round(b.left) + "→" + Math.round(b.right));
      }
    }
    out.over = Array.from(new Set(out.over)).slice(0, 6);
    return out;
  });
  assert.ok(r.scrollW <= r.width + 1,
    `整页可以横向滚动（${r.scrollW} > ${r.width}）——在小屏上会左右晃`);
  assert.deepEqual(r.over, [], `这些元素超出了屏幕：${r.over.join(", ")}`);
}, { viewport: { width: 320, height: 640 } });

hostile("窄屏 320px 下把使用说明一条条全点开，没有一处横向撑破", "", async (ev) => {
  const r = await ev(async () => {
    showTab("settings");
    const sec = document.getElementById("guideSection");
    const scroller = document.getElementById("settingsScreen");
    const topics = Array.from(sec.querySelectorAll("details"));
    topics.forEach(d => { d.open = true; });
    await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
    const w = document.documentElement.clientWidth;
    const over = [];
    for (const el of sec.querySelectorAll("*")) {
      const b = el.getBoundingClientRect();
      if (b.width === 0 && b.height === 0) continue;
      if (b.right > w + 1 || b.left < -1) over.push(el.tagName + ":" + Math.round(b.left) + "→" + Math.round(b.right));
    }
    // #settingsScreen 自己是滚动容器（overflow-y:auto 顺带也能横向滚）：
    // 内容把它撑宽了，根元素的 scrollWidth 一动不动——所以量它，不量 document。
    const out = { width: scroller.clientWidth, scrollW: scroller.scrollWidth, opened: topics.filter(d => d.open).length,
                  over: Array.from(new Set(over)).slice(0, 6) };
    topics.forEach(d => { d.open = false; });
    showTab("home");
    return out;
  });
  assert.ok(r.opened >= 6, `只点开了 ${r.opened} 条`);
  assert.ok(r.scrollW <= r.width + 1, `设置页可以横向滚动（${r.scrollW} > ${r.width}）`);
  assert.deepEqual(r.over, [], `这些元素超出了屏幕：${r.over.join(", ")}`);
}, { viewport: { width: 320, height: 640 } });

hostile("一句很长的话，不该把卡片撑破", "", async (ev) => {
  const r = await ev(async () => {
    const w = document.documentElement.clientWidth;
    showTab("help");
    document.getElementById("helpInput").value =
      "这是一句故意写得很长很长的中文，用来看看结果卡会不会被撑破，因为家长真的会一口气打很多字进去而不换行";
    onHelpInput(); helpSubmit();
    await new Promise(res => setTimeout(res, 500));
    const over = [];
    for (const el of document.querySelectorAll("#helpScreen *")) {
      const b = el.getBoundingClientRect();
      if (b.width === 0 && b.height === 0) continue;
      if (b.right > w + 1) over.push(String(el.className || el.tagName).split(" ")[0]);
    }
    return { width: w, scrollW: document.documentElement.scrollWidth,
             over: Array.from(new Set(over)).slice(0, 6) };
  });
  assert.ok(r.scrollW <= r.width + 1, `长句子把页面撑得能横向滚（${r.scrollW} > ${r.width}）`);
  assert.deepEqual(r.over, [], `这些元素被长句子撑出了屏幕：${r.over.join(", ")}`);
}, { viewport: { width: 320, height: 640 } });

let srv, chrome, profile, client;
let passed = 0, failed = 0;
try {
  const s = await serve(); srv = s.srv;
  profile = await mkdtemp(join(tmpdir(), "ll-e2e-"));
  const dbg = 9222 + Math.floor(Math.random() * 500);
  chrome = spawn(CHROME, [
    "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    "--disable-extensions", "--mute-audio", "--window-size=390,844",
    `--user-data-dir=${profile}`, `--remote-debugging-port=${dbg}`, "--remote-allow-origins=*",
    `http://127.0.0.1:${s.port}/index.html`,
  ], { stdio: "ignore" });

  const wsUrl = await findPageTarget(`http://127.0.0.1:${dbg}`);
  client = cdpClient(wsUrl);
  await client.ready;
  await client.send("Runtime.enable");
  await client.send("Page.enable");
  const ev = makeEval(client);

  const waitForApp = async () => {
    for (let i = 0; i < 80; i++) {
      try {
        const up = await ev(() => document.readyState === "complete"
          && typeof showTab === "function" && typeof scenarios === "object");
        if (up) return true;
      } catch { /* 刷新途中求值会失败，再试 */ }
      await new Promise(r => setTimeout(r, 250));
    }
    return false;
  };

  if (!await waitForApp()) throw new Error("页面没起来");

  // service worker 一接管，index.html 里的 controllerchange 就会 location.reload()。
  // 那对家长是对的（新版本立刻生效），但会在跑到一半时把页面换掉。所以先把它
  // 注销、缓存清掉，再自己重新加载一次，拿到一个确定的、没有 SW 的页面。
  // 这里测的是布局、样式级联和事件接线，SW 只会带来不确定性。
  // 这一步本身可能正好撞上 controllerchange 触发的自动刷新，页面被换掉，
  // 求值当场失败。重试几次就好——注销是幂等的。
  for (let i = 0; i < 5; i++) {
    try {
      await ev(async () => {
        if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
          const regs = await navigator.serviceWorker.getRegistrations();
          for (const r of regs) await r.unregister();
        }
        if (window.caches) {
          const keys = await caches.keys();
          for (const k of keys) await caches.delete(k);
        }
        return true;
      });
      break;
    } catch {
      await new Promise(r => setTimeout(r, 400));
      await waitForApp();
    }
  }
  await client.send("Page.navigate", { url: `http://127.0.0.1:${s.port}/index.html` });
  await new Promise(r => setTimeout(r, 400));
  if (!await waitForApp()) throw new Error("清掉 service worker 之后页面没起来");

  // 只挡网络。付费路径要有码才走得到，这个假码只活在这个页面里。
  await ev(STUB_FETCH);

  console.log("e2e（真浏览器）");
  for (const c of checks) {
    try { await c.fn(ev); passed++; console.log(`  ✓ ${c.name}`); }
    catch (e) { failed++; console.error(`  ✗ ${c.name}\n    ${e.message}`); }
  }

  // ── 恶劣环境：每一条都换一张干净的页面重来 ──────────────
  console.log("\ne2e · 手机上没有主流浏览器时");
  for (const h of hostiles) {
    let handle = null;
    try {
      if (h.sabotage) {
        const r = await client.send("Page.addScriptToEvaluateOnNewDocument", { source: h.sabotage });
        handle = r.identifier;
      }
      if (h.viewport) {
        await client.send("Emulation.setDeviceMetricsOverride",
          { width: h.viewport.width, height: h.viewport.height, deviceScaleFactor: 2, mobile: true });
      }
      await client.send("Page.navigate", { url: `http://127.0.0.1:${s.port}/index.html` });
      await new Promise(r => setTimeout(r, 400));
      if (!await waitForApp()) throw new Error("这个环境下页面没起来");
      // 网络照旧挡住；这一轮验的是环境，不是网络
      await ev(STUB_FETCH);
      await h.fn(ev);
      passed++; console.log(`  ✓ ${h.name}`);
    } catch (e) {
      failed++; console.error(`  ✗ ${h.name}\n    ${e.message}`);
    } finally {
      if (handle) {
        try { await client.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: handle }); } catch {}
      }
      if (h.viewport) {
        try { await client.send("Emulation.clearDeviceMetricsOverride"); } catch {}
      }
    }
  }
} catch (e) {
  failed++;
  console.error("e2e 起不来:", e.message);
} finally {
  try { client && client.close(); } catch {}
  try { chrome && chrome.kill(); } catch {}
  try { srv && srv.close(); } catch {}
  if (profile) await rm(profile, { recursive: true, force: true }).catch(() => {});
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} checks passed`);
process.exit(failed ? 1 : 0);
