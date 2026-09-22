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
//   6. 场景里的预设句子也一样能点。那个列表换年龄档就整体重画——上一版把面板
//      做成固定占位，挪进卡片后一重画就没了，再点词就没反应。现在面板点时造、
//      收时删，重画多少次都无所谓。
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
    setAttribute(k, v) { node.attrs[k] = String(v); if (k === "class") node.className = String(v); if (k === "id") node.id = String(v); },
    remove() { if (node.parentElement) { node.parentElement.children = node.parentElement.children.filter(x => x !== node); node.parentElement = null; } },
    closest(sel) { let n = node; while (n) { if (n.classList && n.classList.contains(sel.slice(1))) return n; n = n.parentElement; } return null; },
    getAttribute(k) { return k in node.attrs ? node.attrs[k] : null; },
    classList: {
      add: (...cs) => { const s = new Set(node.className.split(/\s+/).filter(Boolean)); cs.forEach(c => s.add(c)); node.className = [...s].join(" "); },
      remove: (...cs) => { node.className = node.className.split(/\s+/).filter(c => c && !cs.includes(c)).join(" "); },
      contains: c => node.className.split(/\s+/).includes(c),
      toggle: (c, f) => { const has = node.classList.contains(c); if (f === undefined ? has : !f) node.classList.remove(c); else node.classList.add(c); },
    },
    addEventListener(t, fn) { if (t === "click") node.onclick = fn; },
    querySelectorAll(sel) {
      // 支持 .a 和 .a.b 这种只按 class 的选择器，够这个模块用
      assert.match(sel, /^(\.[\w-]+)+$/, "fake DOM: only .class[.class] selectors");
      const classes = sel.split(".").filter(Boolean), out = [];
      (function walk(n) { for (const c of n.children) { if (c.classList && classes.every(k => c.classList.contains(k))) out.push(c); walk(c); } })(node);
      return out;
    },
  };
  return node;
}
const textNode = (s) => ({ tagName: "#text", textContent: s, children: [], parentElement: null, classList: null });

function page() {
  const byId = {};
  const mk = (tag, id, parent) => { const n = el(tag, id); if (id) byId[id] = n; if (parent) parent.appendChild(n); return n; };
  const result = mk("div", "translateResult");
  mk("div", "resultEn", result);
  mk("div", "resultZh", result);
  const related = mk("div", "resultRelated", result);
  const relItem = mk("div", "", related); relItem.className = "result-related-item";
  const relEn = mk("div", "relEn0", relItem); relEn.className = "result-related-en";
  // 场景屏：一张句子卡
  const list = mk("div", "phraseList");
  const card = mk("div", "", list); card.className = "phrase-card";
  const phraseEn = mk("div", "", card); phraseEn.className = "phrase-en";
  const roots = [result, list];
  // 动态造出来的面板是用 id 找的，所以 getElementById 得真的遍历树
  const find = (id) => { let hit = null; (function walk(n) { if (hit) return; if (n.id === id) { hit = n; return; } for (const c of n.children) walk(c); })({ children: roots, id: "" }); return hit; };
  const document = { getElementById: find, createElement: t => el(t), createTextNode: textNode,
    querySelectorAll: (sel) => roots.flatMap(r => r.querySelectorAll(sel)) };
  return { byId, result, related, relEn, list, card, phraseEn, document };
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
// 面板是点的时候临时造的：用 id 找，找不到就是没开
const panel = (doc) => doc.getElementById("wordLookupPanel");
const note = (doc) => doc.getElementById("wordLookupPrivacyNote");

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
  const { ctx, byId, lookups, document } = loadModule();
  ctx.renderTappableEnglish(byId.resultEn, "Give me a hug.");
  assert.equal(panel(document), null, "还没点就有面板了");
  const hug = words(byId.resultEn)[3];
  hug.onclick();
  assert.deepEqual(lookups.map(l => ({ ...l })), [{ q: "hug", panelId: "wordLookupBody" }], "没有去查，或者查错了地方");
  const p = panel(document);
  assert.ok(p, "面板没造出来");
  assert.ok(document.getElementById("wordLookupBody"), "面板里没有给释义落脚的 body");
  const kids = byId.translateResult.children;
  assert.equal(kids[kids.indexOf(byId.resultEn) + 1], p, "面板不在主句的正下方");
  assert.equal(byId.resultEn.textContent, "Give me a hug.", "翻译那句话被动了");
  assert.ok(hug.classList.contains("is-active"), "被点的词没有高亮");
});

let loadedDoc;
test("再点另一个词换内容；再点同一个词收起来", () => {
  const { ctx, byId, lookups, document } = loadModule(); loadedDoc = document;
  ctx.renderTappableEnglish(byId.resultEn, "Give me a hug.");
  const [give, , , hug] = words(byId.resultEn);
  hug.onclick(); give.onclick();
  assert.deepEqual(lookups.map(l => l.q), ["hug", "give"]);
  assert.ok(give.classList.contains("is-active") && !hug.classList.contains("is-active"), "高亮没跟着换");
  give.onclick();
  assert.equal(lookups.length, 2, "收起的时候不该再查一次");
  assert.equal(panel(loadedDoc), null, "再点同一个词，面板没收起（应该被删掉）");
  assert.ok(!give.classList.contains("is-active"), "收起后高亮没去掉");
});

test("精选词库里的词不亮隐私提示；不在库里的词一点就亮，而且提示紧跟在面板底下", () => {
  const { ctx, byId, document } = loadModule({ curated: ["hug"] });
  ctx.renderTappableEnglish(byId.resultEn, "Give me a hug.");
  const [give, , , hug] = words(byId.resultEn);
  hug.onclick();
  assert.ok(note(document) === null || note(document).hidden, "精选词不联网，不该亮隐私提示");
  give.onclick();
  const n = note(document);
  assert.ok(n && !n.hidden, "要联网的词，隐私提示没亮");
  assert.match(n.textContent, /不联网/, "提示没说清已收录的词不联网");
  assert.match(n.textContent, /发送/, "提示没说清没收录的词会发送出去");
  assert.equal(n.parentElement, panel(document), "隐私提示不在面板里——离得远了家长看不见");
});

test("点「还可以这样说」里的词，面板在那一行底下，不是跑到主句底下", () => {
  const { ctx, byId, relEn, lookups } = loadModule();
  ctx.renderTappableEnglish(byId.resultEn, "Give me a hug.");
  ctx.renderTappableEnglish(relEn, "Come here, sweetie.");
  words(relEn)[2].onclick();
  assert.deepEqual(lookups.map(l => ({ ...l })), [{ q: "sweetie", panelId: "wordLookupBody" }]);
  const sib = relEn.parentElement.children;
  assert.equal(sib[sib.indexOf(relEn) + 1], panel(loadModuleDoc(relEn)), "面板没挪到那一行底下");
});
// 从任意元素找回它所在页面的 document（假 DOM 没有 ownerDocument，用根节点反查）
function loadModuleDoc(elm) { let n = elm; while (n.parentElement) n = n.parentElement; return { getElementById: (id) => { let hit = null; (function walk(x) { if (hit) return; if (x.id === id) { hit = x; return; } for (const c of x.children) walk(c); })(n); return hit; } }; }

test("新的翻译结果来了：上一次打开的面板收起，高亮清掉", () => {
  const { ctx, byId, document } = loadModule();
  ctx.renderTappableEnglish(byId.resultEn, "Give me a hug.");
  words(byId.resultEn)[3].onclick();
  ctx.collapseWordLookup();
  assert.equal(panel(document), null, "面板还在");
  assert.equal(byId.translateResult.querySelectorAll(".is-active").length, 0, "还有词亮着");
});

test("场景里的句子卡：词能点，面板在那句英文底下、卡片里面", () => {
  const { ctx, phraseEn, card, lookups, document } = loadModule();
  ctx.renderTappableEnglish(phraseEn, "Bath time!");
  const ws = words(phraseEn);
  assert.equal(ws.length, 2);
  ws[0].onclick();
  assert.deepEqual(lookups.map(l => l.q), ["bath"]);
  const p = panel(document);
  assert.equal(p && p.parentElement, card, "面板没落在那张卡片里");
  assert.equal(card.children[card.children.indexOf(phraseEn) + 1], p, "面板不在英文那一行正下方");
});

test("列表整体重画把面板销毁了：下一次点词照样能用", () => {
  const { ctx, phraseEn, card, list, lookups, document } = loadModule();
  ctx.renderTappableEnglish(phraseEn, "Bath time!");
  words(phraseEn)[0].onclick();
  assert.ok(panel(document), "第一次点没出面板");
  // 换年龄档：列表清空重画，面板跟着没了
  list.innerHTML = "";
  assert.equal(panel(document), null);
  const card2 = document.createElement("div"); card2.className = "phrase-card"; list.appendChild(card2);
  const en2 = document.createElement("div"); en2.className = "phrase-en"; card2.appendChild(en2);
  ctx.renderTappableEnglish(en2, "Water is warm.");
  words(en2)[0].onclick();
  assert.deepEqual(lookups.map(l => l.q), ["bath", "water"], "重画之后再点词，没有去查——上一版就是这样坏的");
  assert.equal(panel(document) && panel(document).parentElement, card2, "重画之后面板没出现在新卡片里");
});

test("翻译结果和相关说法的渲染真的接上了这个模块，不是各画各的", () => {
  // 主句与相关说法两处都得经过它——否则一处能点、一处不能点，家长会以为坏了。
  const show = html.slice(html.indexOf("function showTranslateResult("), html.indexOf("function showTranslateResult(") + 900);
  assert.match(show, /renderTappableEnglish\(/, "showTranslateResult 没用它画主句");
  assert.doesNotMatch(show, /resultEn"\)\.textContent = result\.en/, "主句还在用 textContent 直接写，词点不了");
  const rel = html.slice(html.indexOf("function renderRelatedExpressions("), html.indexOf("function renderRelatedExpressions(") + 1500);
  assert.match(rel, /renderTappableEnglish\(/, "相关说法没用它画英文");
  assert.match(show, /collapseWordLookup\(/, "新结果来了没收起旧面板");
  const ph = html.slice(html.indexOf("function renderPhrases("), html.indexOf("function renderPhrases(") + 4000);
  assert.match(ph, /renderTappableEnglish\(/, "场景句子卡没用它画英文——预设句子里的词点不了");
});

test("面板不再是固定占位：页面里不该再有 resultDictPanel，面板的样式得跟词典面板一套", () => {
  assert.ok(!html.includes('id="resultDictPanel"'), "翻译结果里还留着固定占位的 resultDictPanel——重画后会被销毁，那是上一版的坑");
  const { ctx, byId, document } = loadModule();
  ctx.renderTappableEnglish(byId.resultEn, "Give me a hug.");
  words(byId.resultEn)[0].onclick();
  const body = document.getElementById("wordLookupBody");
  assert.ok(body.classList.contains("dict-lookup-panel"), "面板 body 没穿 dict-lookup-panel 样式——释义会画得和别处不一样");
  assert.ok(note(document).classList.contains("privacy-note"), "隐私提示没穿 privacy-note 样式");
});

console.log("tap-word tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message.split("\n")[0]}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
