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
function hostile(name, sabotage, fn) { hostiles.push({ name, sabotage, fn }); }

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
});

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
});

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
  const NARROW = ["窄屏 320px（老安卓机最常见的宽度）", "一句很长的话，不该把卡片撑破"];
  for (const h of hostiles) {
    let handle = null;
    try {
      if (h.sabotage) {
        const r = await client.send("Page.addScriptToEvaluateOnNewDocument", { source: h.sabotage });
        handle = r.identifier;
      }
      if (NARROW.includes(h.name)) {
        await client.send("Emulation.setDeviceMetricsOverride",
          { width: 320, height: 640, deviceScaleFactor: 2, mobile: true });
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
      if (NARROW.includes(h.name)) {
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
