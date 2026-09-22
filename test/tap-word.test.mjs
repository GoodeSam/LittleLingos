#!/usr/bin/env node
// 翻译结果里的英文，一个词一个词都能点，点了就查——不用再去输入框打一遍。
//
// 对应的用户情境（不含函数名）：
//   1. 家长翻译出一句英文，里面有个词不认识。点那个词，释义就在这句话底下
//      展开；那句翻译还在原地，不会被顶掉、不会跳到别的屏。
//   2. 句子里的标点不碍事：点「sweetie!」查的是 sweetie；「don't」是一个整体；
//      单独的破折号、省略号不是词，点不了。
//   3. 再点另一个词，面板换内容；再点同一个词，面板收起。
//   4. 点的词在精选词库里：不联网。不在：会联网，并且第一次要把隐私提示亮出来
//      ——这条路和打字查词是同一条，规则一模一样。
//   5. 点「还可以这样说」里的词，释义在那一行底下展开，不是跑到主句底下。
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");
const START = "/* ll:tap-word:start */", END = "/* ll:tap-word:end */";

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// ── 一个够用的假 DOM ──────────────────────────────────────
// 只做这个模块碰得到的那几样：建元素、挂子节点、class、dataset、把面板挪到某行底下。
function el(tag, id = "") {
  const node = {
    tagName: tag.toUpperCase(), id, className: "", hidden: false, parentElement: null,
    children: [], attrs: {}, dataset: {}, _text: "",
    get textContent() { return node._text + node.children.map(c => c.textContent).join(""); },
    set textContent(v) { node.children = []; node._text = String(v); },
    set innerHTML(v) { if (v === "") { node.children = []; node._text = ""; } else throw new Error("fake DOM: innerHTML only clears"); },
    get innerHTML() { return ""; },
    appendChild(c) { if (c.parentElement) c.parentElement.children = c.parentElement.children.filter(x => x !== c); c.parentElement = node; node.children.push(c); return c; },
    append(...xs) { for (const x of xs) node.appendChild(typeof x === "string" ? textNode(x) : x); },
    insertAdjacentElement(pos, c) {
      assert.equal(pos, "afterend", "fake DOM: only afterend");
      const p = node.parentElement; assert.ok(p, "afterend 需要有父节点");
      if (c.parentElement) c.parentElement.children = c.parentElement.children.filter(x => x !== c);
      const i = p.children.indexOf(node); p.children.splice(i + 1, 0, c); c.parentElement = p;
    },
    setAttribute(k, v) { node.attrs[k] = String(v); if (k === "class") node.className = String(v); },
    getAttribute(k) { return k in node.attrs ? node.attrs[k] : null; },
    classList: {
      add: (...cs) => { const s = new Set(node.className.split(/\s+/).filter(Boolean)); cs.forEach(c => s.add(c)); node.className = [...s].join(" "); },
      remove: (...cs) => { node.className = node.className.split(/\s+/).filter(c => c && !cs.includes(c)).join(" "); },
      contains: c => node.className.split(/\s+/).includes(c),
      toggle: (c, f) => { const has = node.classList.contains(c); if (f === undefined ? has : !f) node.classList.remove(c); else node.classList.add(c); },
    },
    addEventListener(t, fn) { if (t === "click") node.onclick = fn; },
    querySelectorAll(sel) {
      assert.match(sel, /^\.[\w-]+$/, "fake DOM: only .class selectors");
      const cls = sel.slice(1), out = [];
      (function walk(n) { for (const c of n.children) { if (c.classList && c.classList.contains(cls)) out.push(c); walk(c); } })(node);
      return out;
    },
  };
  return node;
}
const textNode = (s) => ({ tagName: "#text", textContent: s, children: [], parentElement: null, classList: null });

function page() {
  const byId = {};
  const mk = (tag, id, parent) => { const n = el(tag, id); byId[id] = n; if (parent) parent.appendChild(n); return n; };
  const result = mk("div", "translateResult");
  mk("div", "resultEn", result);
  mk("div", "resultDictPanel", result).hidden = true;
  mk("div", "resultDictPrivacyNote", result).hidden = true;
  mk("div", "resultZh", result);
  const related = mk("div", "resultRelated", result);
  const relItem = mk("div", "", related); relItem.className = "result-related-item";
  const relEn = mk("div", "relEn0", relItem); relEn.className = "result-related-en";
  return { byId, result, related, relEn, document: { getElementById: id => byId[id] || null, createElement: t => el(t), createTextNode: textNode } };
}

function loadModule({ curated = ["hug", "bath"] } = {}) {
  const s = html.indexOf(START), e = html.indexOf(END);
  assert.ok(s !== -1 && e !== -1, `index.html 里没有 ${START} … ${END} 这一块`);
  const p = page();
  const lookups = [];
  const ctx = {
    console, document: p.document,
    performDictLookup: (q, panelId) => lookups.push({ q, panelId }),
    getDictLookupIndex: () => new Map(curated.map(w => [w, { lemma: w }])),
  };
  vm.createContext(ctx);
  vm.runInContext(html.slice(s, e + END.length), ctx);
  for (const fn of ["tokenizeForLookup", "renderTappableEnglish", "onTapWord", "collapseWordLookup"]) {
    assert.equal(typeof ctx[fn], "function", `模块里没有 ${fn}()`);
  }
  return { ctx, ...p, lookups };
}
const words = (container) => container.querySelectorAll(".tap-word");

test("句子被切成一个个能点的词，词上带着去掉标点的查询词", () => {
  const { ctx, byId } = loadModule();
  ctx.renderTappableEnglish(byId.resultEn, "Bath time, sweetie! Let's get you clean.");
  const ws = words(byId.resultEn);
  assert.deepEqual(ws.map(w => w.dataset.word), ["bath", "time", "sweetie", "let's", "get", "you", "clean"]);
  assert.deepEqual(ws.map(w => w.textContent), ["Bath", "time,", "sweetie!", "Let's", "get", "you", "clean."],
    "屏幕上看到的字要原样带标点，只是查的时候去掉");
  assert.equal(byId.resultEn.textContent, "Bath time, sweetie! Let's get you clean.", "整句话一个字不能少、不能多");
});

test("标点和缩写：括号剥掉、词内撇号保留、纯符号不是词", () => {
  const { ctx } = loadModule();
  // 沙箱里造的数组原型和外面的不同，严格 deepEqual 会因此判不等——先 Array.from 拉到外面再比。
  const t = Array.from(ctx.tokenizeForLookup("(really) don't — wait... ok? ..."));
  assert.deepEqual(t.filter(x => x.word).map(x => x.word), ["really", "don't", "wait", "ok"]);
  // 「wait...」是一个整体，省略号是它的尾巴，查的是 wait；单独站着的「—」「...」不是词。
  assert.equal(t.find(x => x.text === "wait...").word, "wait");
  for (const sym of ["—", "..."]) assert.equal(t.find(x => x.text === sym).word, null, `「${sym}」变成可点的词了`);
  assert.ok(t.every(x => !x.word || /^[a-z0-9']+$/.test(x.word)), "有查询词带着标点出门了");
  assert.equal(ctx.tokenizeForLookup("").length, 0);
  assert.equal(ctx.tokenizeForLookup(null).length, 0);
});

test("每个词是一个真的按钮：有角色、能用键盘到达", () => {
  const { ctx, byId } = loadModule();
  ctx.renderTappableEnglish(byId.resultEn, "Give me a hug.");
  const ws = words(byId.resultEn);
  assert.equal(ws.length, 4, `该有 4 个词，切出来 ${ws.length} 个——零个的话下面的循环一次都不跑，会假绿`);
  for (const w of ws) {
    assert.equal(w.getAttribute("role"), "button", `「${w.textContent}」没标成按钮`);
    assert.equal(w.getAttribute("tabindex"), "0");
    assert.equal(typeof w.onclick, "function", `「${w.textContent}」点不动`);
  }
});

test("点一个词：查它，面板在这句话底下打开，这句话还在", () => {
  const { ctx, byId, lookups } = loadModule();
  ctx.renderTappableEnglish(byId.resultEn, "Give me a hug.");
  const hug = words(byId.resultEn)[3];
  hug.onclick();
  assert.deepEqual(lookups, [{ q: "hug", panelId: "resultDictPanel" }], "没有去查，或者查错了地方");
  assert.equal(byId.resultDictPanel.hidden, false, "面板没打开");
  const kids = byId.translateResult.children;
  assert.equal(kids[kids.indexOf(byId.resultEn) + 1], byId.resultDictPanel, "面板不在主句的正下方");
  assert.equal(byId.resultEn.textContent, "Give me a hug.", "翻译那句话被动了");
  assert.ok(hug.classList.contains("is-active"), "被点的词没有高亮");
});

test("再点另一个词换内容；再点同一个词收起来", () => {
  const { ctx, byId, lookups } = loadModule();
  ctx.renderTappableEnglish(byId.resultEn, "Give me a hug.");
  const [give, , , hug] = words(byId.resultEn);
  hug.onclick(); give.onclick();
  assert.deepEqual(lookups.map(l => l.q), ["hug", "give"]);
  assert.ok(give.classList.contains("is-active") && !hug.classList.contains("is-active"), "高亮没跟着换");
  give.onclick();
  assert.equal(lookups.length, 2, "收起的时候不该再查一次");
  assert.equal(byId.resultDictPanel.hidden, true, "再点同一个词，面板没收起");
  assert.ok(!give.classList.contains("is-active"), "收起后高亮没去掉");
});

test("精选词库里的词不亮隐私提示；不在库里的词第一次点就亮", () => {
  const { ctx, byId } = loadModule({ curated: ["hug"] });
  ctx.renderTappableEnglish(byId.resultEn, "Give me a hug.");
  const [give, , , hug] = words(byId.resultEn);
  hug.onclick();
  assert.equal(byId.resultDictPrivacyNote.hidden, true, "精选词不联网，不该亮隐私提示");
  give.onclick();
  assert.equal(byId.resultDictPrivacyNote.hidden, false, "要联网的词，隐私提示没亮");
});

test("点「还可以这样说」里的词，面板在那一行底下，不是跑到主句底下", () => {
  const { ctx, byId, relEn, lookups } = loadModule();
  ctx.renderTappableEnglish(byId.resultEn, "Give me a hug.");
  ctx.renderTappableEnglish(relEn, "Come here, sweetie.");
  words(relEn)[2].onclick();
  assert.deepEqual(lookups, [{ q: "sweetie", panelId: "resultDictPanel" }]);
  const sib = relEn.parentElement.children;
  assert.equal(sib[sib.indexOf(relEn) + 1], byId.resultDictPanel, "面板没挪到那一行底下");
  assert.equal(byId.resultDictPanel.hidden, false);
});

test("新的翻译结果来了：上一次打开的面板收起，高亮清掉", () => {
  const { ctx, byId } = loadModule();
  ctx.renderTappableEnglish(byId.resultEn, "Give me a hug.");
  words(byId.resultEn)[3].onclick();
  ctx.collapseWordLookup();
  assert.equal(byId.resultDictPanel.hidden, true);
  assert.equal(byId.translateResult.querySelectorAll("is-active".replace(/^/, ".")).length, 0, "还有词亮着");
});

test("翻译结果和相关说法的渲染真的接上了这个模块，不是各画各的", () => {
  // 主句与相关说法两处都得经过它——否则一处能点、一处不能点，家长会以为坏了。
  const show = html.slice(html.indexOf("function showTranslateResult("), html.indexOf("function showTranslateResult(") + 900);
  assert.match(show, /renderTappableEnglish\(/, "showTranslateResult 没用它画主句");
  assert.doesNotMatch(show, /resultEn"\)\.textContent = result\.en/, "主句还在用 textContent 直接写，词点不了");
  const rel = html.slice(html.indexOf("function renderRelatedExpressions("), html.indexOf("function renderRelatedExpressions(") + 1500);
  assert.match(rel, /renderTappableEnglish\(/, "相关说法没用它画英文");
  assert.match(show, /collapseWordLookup\(/, "新结果来了没收起旧面板");
});

test("面板和隐私提示在翻译结果里真有落脚的地方", () => {
  assert.ok(html.includes('id="resultDictPanel"'), "翻译结果里没有 resultDictPanel");
  assert.ok(html.includes('id="resultDictPrivacyNote"'), "翻译结果里没有 resultDictPrivacyNote");
  const tr = html.slice(html.indexOf('id="translateResult"'), html.indexOf('id="aiDisclaimer"'));
  assert.ok(tr.includes('id="resultDictPanel"'), "resultDictPanel 不在 translateResult 里面");
  // 光有 id 不够：面板得穿词典面板那套样式，提示得是隐私提示那一类——不然是个裸 div 占位
  assert.match(tr, /class="[^"]*dict-lookup-panel[^"]*"[^>]*id="resultDictPanel"|id="resultDictPanel"[^>]*class="[^"]*dict-lookup-panel/, "resultDictPanel 没穿 dict-lookup-panel 样式");
  assert.match(tr, /class="[^"]*privacy-note[^"]*"[^>]*id="resultDictPrivacyNote"|id="resultDictPrivacyNote"[^>]*class="[^"]*privacy-note/, "resultDictPrivacyNote 不是隐私提示样式");
  assert.match(tr, /id="resultDictPrivacyNote"[^>]*>[^<]*不联网[^<]*发送/, "隐私提示没写清「已收录的不联网、新词会发送」");
});

console.log("tap-word tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message.split("\n")[0]}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
