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
  await ev(async () => {
    if (navigator.serviceWorker) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) await r.unregister();
    }
    if (window.caches) {
      const keys = await caches.keys();
      for (const k of keys) await caches.delete(k);
    }
    return true;
  });
  await client.send("Page.navigate", { url: `http://127.0.0.1:${s.port}/index.html` });
  await new Promise(r => setTimeout(r, 400));
  if (!await waitForApp()) throw new Error("清掉 service worker 之后页面没起来");

  // 只挡网络。付费路径要有码才走得到，这个假码只活在这个页面里。
  await ev(() => {
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
    try { localStorage.setItem("ll_access", "e2e"); } catch {}
    if (typeof paintAccessGate === "function") paintAccessGate();
    return true;
  });

  console.log("e2e（真浏览器）");
  for (const c of checks) {
    try { await c.fn(ev); passed++; console.log(`  ✓ ${c.name}`); }
    catch (e) { failed++; console.error(`  ✗ ${c.name}\n    ${e.message}`); }
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
