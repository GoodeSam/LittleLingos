#!/usr/bin/env node
// 连播「英语放一次/两次」+ 放英文时只看英文 + 收藏不弹提示：真浏览器这一层。
// 脚手架（起静态服务、Chrome、CDP、假网络）照抄 test/e2e.mjs，没动那个文件。
//
// 为什么不全放单元测试里：设置记不记得住要真的重载页面才知道；字号、有没有撑破
// 屏幕要真的排版才知道；弹没弹提示要真的走一遍收藏按钮才知道。
//
// 约定的界面（实现照这个接，改了请同步改这里）：
//   收藏页 #savedScreenList 里有 .loop-repeat，里面两个按钮
//   button[data-repeat="1"]「一次」、button[data-repeat="2"]「两次」，
//   当前选中的那个 aria-pressed="true"。默认选中「一次」。
//
// 这一组对应的用户情境（不含函数名）：
//   1. 家长第一次打开收藏页，英语播放次数是「一次」；点「两次」，关掉 App 再打开，还是「两次」。
//   2. 点「连续播放全部」，英文开始放：提示框里只有英文，字比原来大，手机窄屏下也没撑破；
//      这时按暂停，中文回来。
//   3. 在场景页第一次收藏一句：屏幕上不弹「收好了…」那一行；星星照样变实心。
//   4. 在「帮我说」里翻译一句再点收藏：不弹「已收藏！…」的对话框；按钮照样变成「已收藏」。
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
  ".mp3": "audio/mpeg",   // 没有这一行，预录音频会以错误类型送出，播放当场失败
};

async function serve() {
  const srv = createServer(async (req, res) => {
    const path = decodeURIComponent(req.url.split("?")[0]);
    const file = join(ROOT, path === "/" ? "/index.html" : path);
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    try {
      const body = await readFile(file);
      const type = MIME[extname(file)] || "application/octet-stream";
      // Content-Length + 分段请求：真服务器都有，缺了浏览器就不知道音频多长
      // （duration 变成 Infinity/NaN），进度条永远是 0%。
      const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
      if (range) {
        const start = range[1] ? parseInt(range[1], 10) : 0;
        const end = range[2] ? parseInt(range[2], 10) : body.length - 1;
        const slice = body.subarray(start, end + 1);
        res.writeHead(206, {
          "Content-Type": type, "Accept-Ranges": "bytes",
          "Content-Range": `bytes ${start}-${end}/${body.length}`,
          "Content-Length": slice.length,
        });
        res.end(slice);
        return;
      }
      res.writeHead(200, { "Content-Type": type, "Accept-Ranges": "bytes", "Content-Length": body.length });
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

// ── 收藏不弹提示 ─────────────────────────────────────────────────────────
check("场景页第一次点星星收藏：不弹「收好了」那一行，星星变实心（对照：提示框本身没坏）", async (ev) => {
  const r = await ev(async () => {
    const tick = () => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
    const toast = document.getElementById("offlineToast");
    toast.classList.remove("show"); toast.textContent = "";
    openScenario("bath"); switchAge("1-2"); await tick();
    const before = savedPhrases.length;
    const p = scenarios.bath.phrases["1-2"][0];
    toggleSave(p.id); await tick();
    const out = { before, after: savedPhrases.length,
                  toastShown: toast.classList.contains("show"), toastText: toast.textContent,
                  star: (document.getElementById("save-" + p.id) || {}).textContent };
    // 对照组：提示框这条通道本身没坏，换一句别的话它照样能弹
    toast.classList.remove("show");
    showOfflineToast("对照");
    out.controlShown = toast.classList.contains("show");
    toast.classList.remove("show");
    return out;
  });
  assert.equal(r.before, 0, "前提不成立：测试开始时已经有收藏");
  assert.equal(r.after, 1, "没收上");
  assert.equal(r.star, "★", "星星没变实心");
  assert.equal(r.controlShown, true, "对照组失败：提示框本身就弹不出来");
  assert.equal(r.toastShown, false, `收藏后弹出了一行字：「${r.toastText}」`);
});

check("「帮我说」翻译一句再点收藏：不弹对话框；按钮变成「已收藏」", async (ev) => {
  const r = await ev(async () => {
    const alerts = [];
    window.alert = m => alerts.push(String(m));
    showTab("help");
    document.getElementById("helpInput").value = "你今天真棒";
    onHelpInput(); helpSubmit();
    await new Promise(res => setTimeout(res, 700));
    const btn = document.getElementById("resultSaveBtn");
    if (!btn) return { missing: true };
    const before = savedPhrases.length;
    btn.click();
    await new Promise(res => setTimeout(res, 100));
    return { before, after: savedPhrases.length, alerts, label: btn.textContent };
  });
  assert.ok(!r.missing, "前提不成立：翻译结果页没有收藏按钮");
  assert.equal(r.after, r.before + 1, "没收上");
  assert.ok(r.label.includes("已收藏"), `按钮没变成「已收藏」：${r.label}`);
  assert.deepEqual(r.alerts, [], `收藏后弹出了对话框：${JSON.stringify(r.alerts)}`);
});

// ── 设置：默认一次，记得住 ───────────────────────────────────────────────
const openSaved = async (ev) => ev(async () => {
  const tick = () => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
  stopAudioLoop(); stopAllAudio();
  openScenario("bath"); switchAge("1-2"); await tick();
  for (const p of scenarios.bath.phrases["1-2"].slice(0, 3)) if (!savedPhrases.some(x => x.id === p.id)) toggleSave(p.id);
  showTab("saved"); await tick();
  return true;
});
// 2026-11-06：「每句英文放几遍」从收藏页搬到设置页（Victor 要）。下面所有找按钮的地方
// 跟着换到 #settingsScreen；断言本身没有动。
const openSettings = async (ev) => ev(async () => {
  const tick = () => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
  stopAudioLoop(); stopAllAudio();
  showTab("settings"); await tick();
  return true;
});
const repeatState = () => {
  const box = document.querySelector("#settingsScreen .loop-repeat");
  if (!box) return { missing: true };
  const pressed = Array.from(box.querySelectorAll("button[data-repeat]"))
    .filter(b => b.getAttribute("aria-pressed") === "true").map(b => b.dataset.repeat);
  return { pressed, count: box.querySelectorAll("button[data-repeat]").length,
           minH: Math.min(...Array.from(box.querySelectorAll("button")).map(b => b.getBoundingClientRect().height)) };
};

check("英语播放次数：默认「一次」；点「两次」，重新打开页面还是「两次」；再点回「一次」也记得住", async (ev) => {
  await openSettings(ev);
  const first = await ev(repeatState);
  assert.ok(!first.missing, "设置页里没有「每句英文放几遍」的选项");
  assert.equal(first.count, 2, "选项不是两个");
  assert.deepEqual(first.pressed, ["1"], `默认选中的不是「一次」：${first.pressed}`);
  assert.ok(first.minH >= 44, `选项按钮只有 ${first.minH}px 高，抱着孩子点不准`);
  await ev(() => { document.querySelector('#settingsScreen .loop-repeat button[data-repeat="2"]').click(); return true; });
  assert.deepEqual((await ev(repeatState)).pressed, ["2"], "点了「两次」，界面没跟上");
  await reload(ev);
  await openSettings(ev);
  assert.deepEqual((await ev(repeatState)).pressed, ["2"], "重新打开页面后，「两次」没记住");
  await ev(() => { document.querySelector('#settingsScreen .loop-repeat button[data-repeat="1"]').click(); return true; });
  await reload(ev);
  await openSettings(ev);
  assert.deepEqual((await ev(repeatState)).pressed, ["1"], "改回「一次」后，重新打开页面没记住");
});

// ── 放英文时只看英文、字大一些 ───────────────────────────────────────────
check("连播放英文时：提示框里只有英文，字比原来（18px）大，窄屏没撑破；暂停后中文回来", async (ev) => {
  await openSaved(ev);
  const r = await ev(async () => {
    const tick = () => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
    const box = () => document.querySelector("#savedScreenList .loop-cue");
    const vis = sel => { const e = box().querySelector(sel); return !!e && e.getClientRects().length > 0 && e.innerText.trim() !== ""; };
    document.querySelector("#savedScreenList .loop-btn").click(); await tick();
    const en = box().querySelector(".loop-cue-en");
    const out = { playing: audioLoopPlaying(), enShown: vis(".loop-cue-en"), zhShown: vis(".loop-cue-zh"),
                  enText: en ? en.innerText.trim() : "",
                  fontPx: en ? parseFloat(getComputedStyle(en).fontSize) : 0,
                  boxRight: box().getBoundingClientRect().right, vw: document.documentElement.clientWidth,
                  scrollW: document.documentElement.scrollWidth };
    document.querySelector("#savedScreenList .loop-btn").click(); await tick();   // 暂停
    out.pausedZhShown = vis(".loop-cue-zh");
    out.pausedEnShown = vis(".loop-cue-en");
    document.querySelector("#savedScreenList .loop-btn").click(); await tick();   // 继续
    out.resumedPlaying = audioLoopPlaying();
    out.resumedZhShown = vis(".loop-cue-zh");
    out.resumedEnShown = vis(".loop-cue-en");
    renderSavedScreen(); await tick();                          // 声音标记一变整页会重画，新提示框不能是空的
    out.redrawBoxShown = !!box() && box().getClientRects().length > 0;
    out.redrawEnShown = vis(".loop-cue-en");
    out.redrawZhShown = vis(".loop-cue-zh");
    stopAudioLoop(); stopAllAudio(); showTab("home");
    return out;
  });
  assert.equal(r.playing, true, "前提不成立：连播没起来");
  assert.equal(r.enShown, true, "放英文时屏幕上没有英文");
  assert.ok(r.enText.length > 0, "英文那一行是空的");
  assert.equal(r.zhShown, false, "放英文时屏幕上还有中文");
  assert.ok(r.fontPx > 18, `英文字号还是 ${r.fontPx}px，没有放大`);
  assert.ok(r.boxRight <= r.vw + 1 && r.scrollW <= r.vw + 1, `提示框把页面撑出了屏幕（右边 ${Math.round(r.boxRight)} / 屏宽 ${r.vw} / 页宽 ${r.scrollW}）`);
  assert.equal(r.pausedZhShown, true, "暂停之后，中文没有回来");
  assert.equal(r.pausedEnShown, true, "暂停之后，英文反而不见了");
  assert.equal(r.resumedPlaying, true, "前提不成立：继续没起来");
  assert.equal(r.resumedEnShown, true, "继续之后英文不见了");
  assert.equal(r.resumedZhShown, false, "继续之后中文没有再收起");
  assert.equal(r.redrawBoxShown, true, "整页重画之后，提示框是空的");
  assert.equal(r.redrawEnShown, true, "整页重画之后，放着的英文没补回来");
  assert.equal(r.redrawZhShown, false, "整页重画之后，放英文时中文又冒出来了");
});

// ── 存储写失败：按钮不能看起来坏了 ──────────────────────────────────────
check("存储写不进去：点「两次」按钮仍变成选中，实际遍数也是两遍，且只提示一次「无法保存到本机」", async (ev) => {
  await openSettings(ev);
  const r = await ev(async () => {
    const tick = () => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
    const realSet = Storage.prototype.setItem, realToast = window.showOfflineToast;
    const toasts = [];
    window.showOfflineToast = m => { toasts.push(String(m)); };
    Storage.prototype.setItem = function () { throw new Error("QuotaExceededError"); };
    try {
      const click = n => document.querySelector(`#settingsScreen .loop-repeat button[data-repeat="${n}"]`).click();
      const pressed = () => Array.from(document.querySelectorAll("#settingsScreen .loop-repeat button"))
        .filter(b => b.getAttribute("aria-pressed") === "true").map(b => b.dataset.repeat);
      click("2"); await tick();
      const out = { pressed2: pressed(), actual2: readLoopRepeat() };
      click("1"); click("2"); await tick();
      out.pressedAgain = pressed(); out.actualAgain = readLoopRepeat();
      out.warn = toasts.filter(m => m.includes("无法保存")).length;
      return out;
    } finally {
      Storage.prototype.setItem = realSet; window.showOfflineToast = realToast;
      loopRepeatMem = null;
    }
  });
  assert.deepEqual(r.pressed2, ["2"], "存储写失败后，点了「两次」按钮没变成选中");
  assert.equal(r.actual2, 2, "按钮显示两次，实际连播却不是两遍");
  assert.deepEqual(r.pressedAgain, ["2"]);
  assert.equal(r.actualAgain, 2);
  assert.equal(r.warn, 1, `「无法保存到本机」提示了 ${r.warn} 次，应该只一次`);
});


// ── 2026-11-06：入口搬家 ─────────────────────────────────────────────────
check("收藏页里不再有「每句英文放一次/两次」；设置页里有，且设置里的选择管着连播的实际遍数", async (ev) => {
  await openSaved(ev);
  const onSaved = await ev(() => ({ group: !!document.querySelector("#savedScreenList .loop-repeat"),
                                    btns: document.querySelectorAll("#savedScreenList .loop-repeat-btn").length,
                                    loopBtn: !!document.querySelector("#savedScreenList .loop-btn") }));
  assert.equal(onSaved.loopBtn, true, "前提不成立：收藏页连续播放按钮都没了");
  assert.equal(onSaved.group, false, "收藏页里还留着「每句英文放几遍」");
  assert.equal(onSaved.btns, 0, "收藏页里还留着一/两次的按钮");
  await openSettings(ev);
  const st = await ev(repeatState);
  assert.ok(!st.missing, "设置页里没有这个选项");
  await ev(() => { document.querySelector('#settingsScreen .loop-repeat button[data-repeat="2"]').click(); return true; });
  assert.equal(await ev(() => readLoopRepeat()), 2, "设置里选了两次，连播实际读到的不是两遍");
  await ev(() => { document.querySelector('#settingsScreen .loop-repeat button[data-repeat="1"]').click(); return true; });
  assert.equal(await ev(() => readLoopRepeat()), 1, "设置里改回一次，连播实际读到的不是一遍");
});

// ── 2026-11-06：连播时取消收藏掌握了的句子 ──────────────────────────────
check("连播提示框右上角有个 ×（够大、贴着右上角、有名字）；没在连播时提示框收着，× 也看不见", async (ev) => {
  await openSaved(ev);
  const r = await ev(async () => {
    const tick = () => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
    const box = () => document.querySelector("#savedScreenList .loop-cue");
    const x = () => box() && box().querySelector(".loop-cue-remove");
    const out = { idleHasX: !!x(), idleVisible: !!x() && x().getClientRects().length > 0 };
    document.querySelector("#savedScreenList .loop-btn").click(); await tick();
    const b = box().getBoundingClientRect(), xr = x() ? x().getBoundingClientRect() : null;
    out.playing = audioLoopPlaying();
    out.visible = !!xr && xr.width > 0;
    if (xr) Object.assign(out, { w: xr.width, h: xr.height, dRight: b.right - xr.right, dTop: xr.top - b.top,
                                 label: x().getAttribute("aria-label"), type: x().type });
    stopAudioLoop(); stopAllAudio(); showTab("home");
    return out;
  });
  assert.equal(r.playing, true, "前提不成立：连播没起来");
  assert.equal(r.idleVisible, false, "没在连播，× 却看得见");
  assert.equal(r.visible, true, "放着时提示框里没有 ×");
  assert.ok(r.w >= 44 && r.h >= 44, `× 只有 ${r.w}×${r.h}px，抱着孩子点不准`);
  assert.ok(r.dRight >= 0 && r.dRight <= 16, `× 不在右边（离提示框右边 ${Math.round(r.dRight)}px）`);
  assert.ok(r.dTop >= 0 && r.dTop <= 16, `× 不在上边（离提示框上边 ${Math.round(r.dTop)}px）`);
  assert.ok(/取消收藏/.test(r.label || ""), `× 的名字是「${r.label}」，读屏和人都看不出它是取消收藏`);
  assert.equal(r.type, "button");
});

check("连播放着时点 ×：这一句从收藏里没了、列表少一行，连播不停，屏幕换成下一句；其余收藏原封不动", async (ev) => {
  await openSaved(ev);
  const r = await ev(async () => {
    const tick = () => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
    document.querySelector("#savedScreenList .loop-btn").click(); await tick();
    const cur = loopCueItem && loopCueItem.id;
    const before = savedPhrases.map(s => s.id);
    document.querySelector("#savedScreenList .loop-cue-remove").click(); await tick();
    const after = savedPhrases.map(s => s.id);
    const box = document.querySelector("#savedScreenList .loop-cue");
    const out = { cur, before, after, playing: audioLoopPlaying(), paused: audioLoopPaused(),
                  nowId: loopCueItem && loopCueItem.id,
                  rows: document.querySelectorAll("#savedScreenList .saved-item").length,
                  boxShown: !!box && box.getClientRects().length > 0,
                  persisted: JSON.parse(localStorage.getItem(llStorage.KEYS.saved) || "[]").map(s => s.id) };
    stopAudioLoop(); stopAllAudio(); showTab("home");
    return out;
  });
  assert.ok(r.cur && r.before.includes(r.cur), "前提不成立：没拿到正在放的那句");
  assert.ok(!r.after.includes(r.cur), "× 点了，这一句还在收藏里");
  assert.deepEqual(r.after, r.before.filter(id => id !== r.cur), "× 把别的收藏也动了");
  assert.deepEqual(r.persisted, r.after, "这一句只在界面上没了，没写进本机存储（重开又回来）");
  assert.equal(r.rows, r.after.length, "列表没有跟着少一行");
  assert.equal(r.playing, true, "点 × 之后连播停了");
  assert.ok(r.nowId && r.nowId !== r.cur && r.after.includes(r.nowId), `屏幕上不是下一句（${r.nowId}）`);
  assert.equal(r.boxShown, true, "点 × 之后提示框收起了");
});

check("连播暂停着点 ×：这一句取消收藏，仍是暂停、没出声；按继续，放的是下一句", async (ev) => {
  await openSaved(ev);
  const r = await ev(async () => {
    const tick = () => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
    const loopBtn = () => document.querySelector("#savedScreenList .loop-btn");
    loopBtn().click(); await tick();
    loopBtn().click(); await tick();                              // 暂停
    const cur = loopCueItem && loopCueItem.id;
    document.querySelector("#savedScreenList .loop-cue-remove").click(); await tick();
    const out = { cur, gone: !savedPhrases.some(s => s.id === cur), paused: audioLoopPaused(), playing: audioLoopPlaying(),
                  audible: loopAudible(), nowId: loopCueItem && loopCueItem.id };
    loopBtn().click(); await tick();                              // 继续
    out.resumed = audioLoopPlaying(); out.resumedId = loopCueItem && loopCueItem.id;
    stopAudioLoop(); stopAllAudio(); showTab("home");
    return out;
  });
  assert.equal(r.gone, true, "暂停着点 ×，这一句还在收藏里");
  assert.equal(r.paused, true, "点 × 把暂停弄没了");
  assert.equal(r.audible, false, "暂停着点 ×，却出声了");
  assert.ok(r.nowId && r.nowId !== r.cur, "屏幕上没换成下一句");
  assert.equal(r.resumed, true, "继续不起来");
  assert.equal(r.resumedId, r.nowId, "继续之后放的不是屏幕上那一句");
});

check("收藏只剩正放着的这一句时点 ×：收藏清空、连播停、提示框收起，页面是「去场景里收藏」的空状态，不报错", async (ev) => {
  await openSaved(ev);
  const r = await ev(async () => {
    const tick = () => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
    savedPhrases = savedPhrases.slice(0, 1); persistSaved(); renderSavedScreen(); await tick();
    const errors = []; const onErr = e => errors.push(String(e.message || e));
    window.addEventListener("error", onErr);
    document.querySelector("#savedScreenList .loop-btn").click(); await tick();
    const started = audioLoopPlaying();
    document.querySelector("#savedScreenList .loop-cue-remove").click(); await tick();
    window.removeEventListener("error", onErr);
    const out = { started, left: savedPhrases.length, playing: audioLoopPlaying(), paused: audioLoopPaused(),
                  empty: !!document.querySelector("#savedScreenList .empty-state"), errors };
    stopAudioLoop(); stopAllAudio(); showTab("home");
    return out;
  });
  assert.equal(r.started, true, "前提不成立：连播没起来");
  assert.equal(r.left, 0, "最后一句没取消收藏");
  assert.equal(r.playing, false, "收藏空了连播还开着");
  assert.equal(r.paused, false, "收藏空了停在暂停上");
  assert.equal(r.empty, true, "收藏空了，页面没有显示空状态");
  assert.deepEqual(r.errors, [], `页面报错：${JSON.stringify(r.errors)}`);
});

check("连播时点收藏列表里正放着那一行的 ×（不是提示框的）：连播同样马上换到下一句，不会继续放这句", async (ev) => {
  await openSaved(ev);
  const r = await ev(async () => {
    const tick = () => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
    document.querySelector("#savedScreenList .loop-btn").click(); await tick();
    const cur = loopCueItem && loopCueItem.id;
    const rowIdx = sortedBySavedAtDesc(phrasesInScenario(savedFilterScenario)).findIndex(p => p.id === cur);
    const rowX = document.querySelectorAll("#savedScreenList .saved-item .unsave-btn")[rowIdx];
    if (!rowX) return { noRowX: true, cur, rowIdx };
    rowX.click(); await tick();
    const out = { cur, gone: !savedPhrases.some(s => s.id === cur), playing: audioLoopPlaying(),
                  nowId: loopCueItem && loopCueItem.id };
    stopAudioLoop(); stopAllAudio(); showTab("home");
    return out;
  });
  assert.ok(!r.noRowX, `前提不成立：列表里找不到正放着那一行的 ×（第 ${r.rowIdx} 行）`);
  assert.equal(r.gone, true, "行里的 × 没把这一句取消收藏");
  assert.equal(r.playing, true, "删掉正放着的那句，连播停了");
  assert.ok(r.nowId && r.nowId !== r.cur, `连播还停在被删的这一句上（${r.nowId}）`);
});

let srv, chrome, profile, client;
let reload = null;
let passed = 0, failed = 0;
try {
  const s = await serve(); srv = s.srv;
  profile = await mkdtemp(join(tmpdir(), "ll-e2e-repeat-"));
  const dbg = 9222 + Math.floor(Math.random() * 500);
  chrome = spawn(CHROME, [
    "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    "--disable-extensions", "--mute-audio", "--window-size=390,844",
    // 无头浏览器里 btn.click() 不算「真人手势」，不给这个开关的话 audio.play()
    // 会被拒，测到的就不是产品行为而是浏览器策略。真机上必须在手势里起播这条
    // 约束（C12）headless 本来也验不了，见 tech-constraints C12。
    "--autoplay-policy=no-user-gesture-required",
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
  reload = async (ev2) => {
    await client.send("Page.navigate", { url: `http://127.0.0.1:${s.port}/index.html` });
    await new Promise(r => setTimeout(r, 400));
    if (!await waitForApp()) throw new Error("重新载入之后页面没起来");
    await ev2(STUB_FETCH);
  };

  console.log("loop-repeat e2e（真浏览器）");
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
