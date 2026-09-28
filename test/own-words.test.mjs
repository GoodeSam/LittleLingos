#!/usr/bin/env node
// 家长不知道自己平时对孩子说什么。
//
// 你问他「洗澡的时候你都说什么」，他答出来的是他**以为**自己说的话；
// 他真正反复说的那几句，自己意识不到。这就是为什么 597 条精选句子摆在那儿，
// 真正被说出口的只有三句 `Let's + 动词`（见 docs/jtbd.md 发现 2）。
//
// 这一层做的事很小：在场景页上问他一句，并且告诉他可以对着**键盘上的话筒**
// 说——那是手机自带的听写，音频不出设备，转出来的文字走的是翻译已经在走的
// 那条路。不录环境音、不上传音频、不新增依赖。
//
// 它同时是一个实验：docs/jtbd.md 第七节的候选 D 要回答「家长自己的话，比
// 精选的句子更能让他真的说出口吗」。做了这个入口，数据自己就产生了。
// 区分两者不需要新字段——翻译产物的 id 一律带 t_ 前缀，而 597 条预设句子
// 里没有一条是。
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   家长点开「洗澡时间」，看到一句问他平时怎么说的话，还告诉他可以直接
//   对着话筒讲。他讲了一句，这句话变成英文留在这个场景里。下次再点开
//   洗澡时间，那句问话不再出现——它已经做完它的事了。而他点开「吃饭时间」
//   时，那里的问话照常在。
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import vm from "node:vm";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");

const START = "/* ll:own-words:start */";
const END = "/* ll:own-words:end */";

// 真实的 597 条预设句子，不是编的：「预设 id 不带 t_ 前缀」这条前提
// 一旦不成立，整个区分就塌了，只有拿真数据跑才会发现。
const sctx = { window: {} };
vm.createContext(sctx);
vm.runInContext(readFileSync(join(ROOT, "scenarios.js"), "utf8"), sctx);
const scenarios = sctx.scenarios || sctx.window.scenarios;
const scenarioOrder = sctx.scenarioOrder || sctx.window.scenarioOrder;

// 2026-09-27（ADR 0009 第五块）：这三个纯函数搬进了 own-words.js，直接 require，
// 不再从 index.html 里切块。
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
function load() {
  const p = join(ROOT, "own-words.js");
  assert.ok(existsSync(p), "own-words.js 还不存在——这三个纯函数该搬出 index.html 了");
  return require(p);
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test("这三个函数只在 own-words.js 里有一份：index.html 里的块删了，两个调用点走模块，主脚本前加载，进了离线清单", () => {
  const code = html.replace(/<!--[\s\S]*?-->/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
  assert.ok(!html.includes(START), "index.html 里还有 ll:own-words 块——同一件事两份实现");
  for (const fn of ["isOwnWords", "ownWordsInvite", "ownWordsResult"]) {
    assert.ok(!code.includes(`function ${fn}(`), `index.html 里还定义着 ${fn}()`);
  }
  assert.ok(/llOwnWords\.ownWordsInvite\(/.test(code), "问话那处没走模块");
  assert.ok(/llOwnWords\.ownWordsResult\(/.test(code), "结果卡那处没走模块");
  const tagAt = html.indexOf('<script src="./own-words.js"></script>');
  assert.ok(tagAt !== -1 && tagAt < html.indexOf("\n<script>\n"), "own-words.js 要在主脚本之前加载");
  const sw = readFileSync(join(ROOT, "sw.js"), "utf8");
  assert.ok(sw.slice(sw.indexOf("const SHELL = ["), sw.indexOf("];", sw.indexOf("const SHELL = ["))).includes("own-words.js"), "sw.js 的 SHELL 里没有它——离线会白屏");
  const stamp = readFileSync(join(ROOT, "scripts/stamp-sw.mjs"), "utf8");
  assert.ok(stamp.slice(stamp.indexOf("const SOURCES = ["), stamp.indexOf("]", stamp.indexOf("const SOURCES = ["))).includes("own-words.js"), "stamp-sw.mjs 的 SOURCES 里没有它");
  const src = readFileSync(join(ROOT, "own-words.js"), "utf8").replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
  for (const bad of ["document.", "window.", "localStorage", "fetch("]) assert.ok(!src.includes(bad), `own-words.js 里出现了「${bad}」——它该是纯的`);
});

const preset = (scenarioTag, i = 0) => {
  const p = scenarios[scenarioTag].phrases["1-2"][i];
  return { ...p, scenario: scenarioTag };
};
const own = (scenarioTag, n = 1) =>
  ({ id: "t_" + (1700000000000 + n), en: "Own " + n, zh: "我自己的话", scenario: scenarioTag });

// ── 分得清「自己的话」和「精选的句子」 ──────────────────────────────────

test("家长自己讲出来的那句，和现成的句子，分得开", () => {
  const { isOwnWords } = load();
  assert.equal(isOwnWords(own("bath")), true, "自己讲的没被认出来");
  // 控制组：一个「永远说是」的实现也能通过上面那条。
  assert.equal(isOwnWords(preset("bath")), false, "现成的句子被当成了自己的话");
});

test("597 条现成句子，没有一条会被误认成自己的话", () => {
  // 这条前提塌了，整个实验就没法读——两组混在一起了。
  const { isOwnWords } = load();
  const wrong = [];
  for (const tag of scenarioOrder) {
    for (const arr of Object.values(scenarios[tag].phrases || {})) {
      for (const p of arr) if (isOwnWords({ ...p, scenario: tag })) wrong.push(p.id);
    }
  }
  assert.deepEqual(wrong, [], `被误认的现成句子：${wrong.slice(0, 5).join("、")}`);
  // 控制组：一个「永远说不是」的实现，误认数当然是 0。
  assert.equal(isOwnWords(own("bath")), true, "控制组失败：真的自己的话也说不是");
});

test("残缺的条目不会让它崩，也不会被当成自己的话", () => {
  const { isOwnWords } = load();
  for (const junk of [null, undefined, {}, { id: null }, { id: 42 }, "t_1"]) {
    assert.equal(isOwnWords(junk), false, `${JSON.stringify(junk)} 被当成了自己的话`);
  }
  // 控制组：一个「永远说不是」的实现也能通过上面那圈。
  assert.equal(isOwnWords(own("bath")), true, "控制组失败：真的自己的话也说不是");
});

// ── 该问的时候问 ────────────────────────────────────────────────────────

test("第一次点开洗澡时间，页面问他平时怎么说", () => {
  const { ownWordsInvite } = load();
  const inv = ownWordsInvite({ scenarioTag: "bath", scenarioName: "洗澡时间", saved: [] });
  assert.ok(inv, "什么也没问");
  assert.ok(inv.text, "问话是空的");
  assert.ok(inv.buttonLabel, "只有一句话，没有能点的");
});

test("问话里带着这个场景的名字，不是笼统地问「说点什么」", () => {
  const { ownWordsInvite } = load();
  const bath = ownWordsInvite({ scenarioTag: "bath", scenarioName: "洗澡时间", saved: [] });
  const meal = ownWordsInvite({ scenarioTag: "meal", scenarioName: "吃饭时间", saved: [] });
  assert.match(bath.text, /洗澡时间/, `没提场景：「${bath.text}」`);
  // 控制组：一句写死的话在两个场景里会一模一样。
  assert.notEqual(bath.text, meal.text, "两个场景问的是同一句话");
});

test("问话告诉他可以对着键盘上的话筒说", () => {
  // 这是整个功能的重点：能力早就有了（iPhone 键盘自带听写），
  // 缺的是他不知道可以用，也不知道该说什么进去。
  const { ownWordsInvite } = load();
  const inv = ownWordsInvite({ scenarioTag: "bath", scenarioName: "洗澡时间", saved: [] });
  assert.match(inv.text + inv.buttonLabel, /🎤|话筒|听写/,
    `没告诉他可以说：「${inv.text}」`);
});

// ── 做完了就让路 ────────────────────────────────────────────────────────

test("讲过一句之后，还能接着讲下一句", () => {
  // 【推翻记录】2026-09-07，Victor 在手机上试用后要求改：
  //   「文字只能输入一次翻译，输入一次之后这个文本就会被折叠，再也不能展示出」
  //
  // 上一版这条测试断言的是 ownWordsInvite(...) === null —— 讲过一句之后
  // 整张卡消失。那是我 2026-09-06 的设计：「问话的作用是让他知道『可以说』
  // 和『该说什么』，他一旦讲过，这两件事都不用再讲了。」
  //
  // 推理本身没错，错在把「说明不用再讲」当成了「入口不用再留」。家长要的
  // 是接着往这个场景里加第二句、第三句。真实用法推翻了设计推理。
  const { ownWordsInvite } = load();
  const inv = ownWordsInvite({
    scenarioTag: "bath", scenarioName: "洗澡时间", saved: [own("bath")],
  });
  assert.ok(inv, "讲过一句之后入口就没了 —— 他加不了第二句");
  assert.ok(inv.buttonLabel, "还在，但没有能点的");
});

test("第二次开始，不再重复那段长说明", () => {
  // 入口要留，但那段教「可以对着话筒说」的话讲一次就够了 —— 每次进来
  // 都念一遍，它就从提示变成了噪音。
  const { ownWordsInvite } = load();
  const first = ownWordsInvite({ scenarioTag: "bath", scenarioName: "洗澡时间", saved: [] });
  const again = ownWordsInvite({ scenarioTag: "bath", scenarioName: "洗澡时间", saved: [own("bath")] });
  assert.notEqual(again.text, first.text, "第二次还在念同一段说明");
  assert.ok(again.text.length < first.text.length,
    `第二次的说明没有更短：${again.text.length} vs ${first.text.length}`);
});

test("在别的场景讲过，这个场景仍然从头说明一遍", () => {
  // 他在吃饭时间讲过，不代表洗澡时间也讲过 —— 那段说明是按场景算的。
  const { ownWordsInvite } = load();
  const fresh = ownWordsInvite({ scenarioTag: "bath", scenarioName: "洗澡时间", saved: [] });
  const other = ownWordsInvite({
    scenarioTag: "bath", scenarioName: "洗澡时间", saved: [own("meal")],
  });
  assert.equal(other.text, fresh.text,
    "在别的场景讲过，这个场景就跳过说明了——被做成了全局开关");
});

test("收藏了一堆现成句子，仍然从头问他自己怎么说", () => {
  // 这条是实验能不能读的关键：收藏现成句子 ≠ 讲了自己的话。
  // 混淆了这两件事，两组样本就分不开了。
  const { ownWordsInvite } = load();
  const fresh = ownWordsInvite({ scenarioTag: "bath", scenarioName: "洗澡时间", saved: [] });
  const inv = ownWordsInvite({
    scenarioTag: "bath", scenarioName: "洗澡时间",
    saved: [preset("bath", 0), preset("bath", 1), preset("bath", 2)],
  });
  assert.equal(inv.text, fresh.text, "收藏了现成句子就被当成讲过自己的话了");
});

test("从翻译页存下的话，不算讲过这个场景", () => {
  // 翻译页存的条目 scenario 是 __translate__，不属于任何场景。
  const { ownWordsInvite } = load();
  const fresh = ownWordsInvite({ scenarioTag: "bath", scenarioName: "洗澡时间", saved: [] });
  const inv = ownWordsInvite({
    scenarioTag: "bath", scenarioName: "洗澡时间", saved: [own("__translate__")],
  });
  assert.equal(inv.text, fresh.text, "翻译页存的话被算成了洗澡场景里的话");
});

test("场景没名字、收藏是脏数据，都不会让页面崩", () => {
  const { ownWordsInvite } = load();
  assert.doesNotThrow(() => ownWordsInvite({ scenarioTag: "bath", scenarioName: "", saved: null }));
  assert.doesNotThrow(() => ownWordsInvite({ scenarioTag: "bath", scenarioName: "洗澡时间", saved: [null, {}, 7] }));
  // 控制组：吞掉一切异常并永远返回 null 的实现也能通过上面两条。
  assert.ok(ownWordsInvite({ scenarioTag: "bath", scenarioName: "洗澡时间", saved: [] }),
    "控制组失败：正常情况下也不问了");
});

// ── 翻出来的英文，他得当场看见 ──────────────────────────────────────

test("翻出来的英文当场就能看见，不用去收藏里翻", () => {
  // 【新增缘由】2026-09-07，Victor 在手机上试用后报的第二个问题：
  //   「翻译的内容会直接进入收藏，在当前页面看不了」
  //
  // 之前提交完就 openScenario() 重画整屏，再弹一句「收好了」。他打了一句
  // 中文，等了两秒，然后什么也没看见 —— 这个软件存在的理由就是给他那句
  // 英文，而那句英文从没在他眼前出现过。
  const { ownWordsResult } = load();
  const r = ownWordsResult({ zh: "来，我们洗洗小手", en: "Let's wash our hands." });
  assert.ok(r, "翻完什么也不给看");
  assert.match(r.en, /Let's wash our hands\./, "看不到英文");
  assert.match(r.zh, /来，我们洗洗小手/, "看不到自己刚说的那句");
  assert.ok(r.note, "没说这句去哪儿了");
});

test("残缺的翻译结果不会画出一张空卡", () => {
  const { ownWordsResult } = load();
  for (const junk of [null, undefined, {}, { zh: "甲" }, { en: "" }]) {
    assert.equal(ownWordsResult(junk), null, `${JSON.stringify(junk)} 画出了东西`);
  }
  // 控制组：一个「永远返回 null」的实现也能通过上面那圈。
  assert.ok(ownWordsResult({ zh: "甲", en: "A" }), "控制组失败：正常结果也不给看");
});

// ── 自己说的那句，也要能听 ──────────────────────────────────────────────

test("结果里带着这句话自己的 id —— 少了它就只有浏览器声音", () => {
  // 生成的那段音频是按 id 存的。id 不跟着结果卡走，按钮就找不到那段音频，
  // 只能退回浏览器自带的合成音——而「同一句话在两处音色不同」这个毛病
  // 本会话已经出过一次，是用户自己报的。
  const { ownWordsResult } = load();
  const r = ownWordsResult({ id: "t_1700000001", zh: "来，我们洗洗小手", en: "Let's wash our hands." });
  assert.equal(r.id, "t_1700000001", "结果卡不知道该放哪一段音频");
});

test("结果卡画出来时声音还在生成：生成完了要再备一次地址，家长过几秒再点听到的是真嗓子", () => {
  // 2026-09-28 真机报上来的（preview `7ed1cf2`）：「我说的话」翻完点小喇叭没声音。
  // 病根：第十七块把 audioPending 搬进 audio-provision.js 成了私有变量，这里
  // `typeof audioPending !== "undefined"` 的守卫把 ReferenceError 吞掉——分支静默死了，
  // 不抛错、不红：生成完了没人再备地址，播放键永远拿不到真嗓子，只能退回手机自带
  // 朗读，而 iPhone 主屏幕版的自带朗读常常是哑的。
  const product = html.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
  const at = product.indexOf("function showOwnWordsResult");
  const src = product.slice(at, product.indexOf("\n}\n", at) + 3);
  const el = () => ({ setAttribute() {}, append() {}, appendChild() {}, insertBefore() {}, querySelector: () => null, classList: { add() {}, remove() {} }, dataset: {} });
  const primed = [], timers = [];
  let mark = "pending";
  const ctx = {
    console,
    document: { getElementById: () => el(), createElement: () => el() },
    llOwnWords: load(),
    primeAudioUrl: (id) => { primed.push(id); },
    audioMarkFor: () => mark,                       // 模块的公开接口，不是它的私有 Set
    setTimeout: (fn) => { timers.push(fn); return timers.length; },
    playClipOrSpeak: () => {},
  };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  ctx.showOwnWordsResult({ id: "t_9", zh: "该睡觉了", en: "Time for bed.", source: "ai" });
  assert.deepEqual(primed, ["t_9"], "画卡片时该先试一次备地址");
  // 生成结束了
  mark = "ready";
  for (let i = 0; i < 5 && timers.length; i++) { const fn = timers.shift(); fn(); }
  assert.deepEqual(primed, ["t_9", "t_9"],
    "声音生成完了没有再备一次地址——播放键永远拿不到真嗓子，只能退回手机自带朗读");
});

test("结果卡上有朗读按钮，跟现成句子上的那个一个样子", () => {
  const product = html
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
  const at = product.indexOf("function showOwnWordsResult");
  assert.ok(at !== -1, "找不到画结果卡的地方");
  const fn = product.slice(at, product.indexOf("\nasync function", at));
  assert.match(fn, /▶ 朗读/, "结果卡上没有朗读按钮");
  // 跟现成句子共用同一个按钮样式：两处长得不一样，家长会以为是两种东西。
  assert.match(fn, /play-btn/, "朗读按钮跟现成句子上的不是同一个样子");
});

test("朗读走的是跟翻译页同一条路，不是复制了一份", () => {
  // 本会话已经因为「同一个决定写了两份」出过一次 bug：翻译页和收藏页
  // 各有一套播放逻辑，同一句话放出两种音色。这条断言不许它重演。
  const product = html
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
  const shared = product.match(/function playClipOrSpeak\s*\(/);
  assert.ok(shared, "没有共用的播放函数");
  const uses = (product.match(/playClipOrSpeak\(/g) || []).length - 1;
  assert.ok(uses >= 2,
    `共用函数只被叫了 ${uses} 次：翻译页和「说说看」都该走它`);

  // 只数次数不够：把 playResultAudio 改回自带一套、再在别处添个第三个
  // 调用点，次数照样 ≥2，而翻译页已经偷偷分家了。得点名。
  const at = product.indexOf("function playResultAudio");
  assert.ok(at !== -1, "找不到翻译页那个入口");
  const fn = product.slice(at, product.indexOf("\n}", at));
  assert.match(fn, /playClipOrSpeak\(/, "翻译页没走共用那条路");

  // 共用函数必须是同步的：iOS 上手势之后经过 await 再 play()，可能不再
  // 算作由那次点击发起，浏览器静默拒绝（tech-constraints C12，
  // ll:audio-loop 里已有两处按它设计）。这条约束验不了，只能守住形状。
  assert.doesNotMatch(product.slice(
    product.indexOf("function playClipOrSpeak"),
    product.indexOf("function playResultAudio")
  ), /\bawait\b/, "点击路径里出现了 await —— iOS 上可能点了没反应");
});

test("先放生成好的那段，取不到才退回浏览器声音", () => {
  const product = html
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
  const at = product.indexOf("function playClipOrSpeak");
  const fn = product.slice(at, at + 1600);
  // 2026-09-25（ADR 0009）：兜底搬进了 audio-controller.mjs——有地址就放录音，
  // 没地址才用手机自带的声音念。这里验的意图没变：**生成好的那段要优先**。
  assert.ok(fn.search(/audioUrlFor\(|primeAudioUrl\(/) !== -1, "根本没去找生成好的那段音频");
  assert.match(fn, /llAudio\.toggle\(/, "没交给 audio-controller，等于又写了第二份播放逻辑");
  const mod = readFileSync(join(ROOT, "audio-controller.mjs"), "utf8");
  assert.match(mod, /if \(url\) return startClip\(/, "模块里不是「有录音优先」");
  assert.match(mod, /startSpeech\(owner, text\)/, "模块里没有兜底：音频没生成好时会哑掉");
});

// ── 界面上真的挂上去了 ──────────────────────────────────────────────────

test("场景页上真的有这块地方，不是只写了函数", () => {
  // 「造了、也被调用了、但没接到界面上」在本项目已经出过四次。
  const at = html.indexOf('id="scenarioScreen"');
  assert.ok(at !== -1, "找不到场景屏");
  const screen = html.slice(at, html.indexOf('<div class="screen"', at + 10));
  assert.match(screen, /id="ownWordsInvite"/,
    "场景屏上没有放这块问话的位置");
  // 上一版只验了容器在不在——放一个永远空着的 div 也能绿。
  // 还得有人往里面写东西，问话才会真的出现在家长眼前。
  const product = html
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
  assert.match(product, /getElementById\(\s*["']ownWordsInvite["']\s*\)/,
    "容器摆在那儿，但没有任何代码往里面写内容");
});

test("翻完不再把整屏重画掉，结果留在他眼前", () => {
  // 重画整屏会把刚翻出来的那句英文一起抹掉。
  const product = html
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
  const at = product.indexOf("async function submitOwnWords");
  assert.ok(at !== -1, "找不到提交那段");
  const fn = product.slice(at, product.indexOf("\nfunction ", at + 10));
  assert.doesNotMatch(fn, /openScenario\(/,
    "翻完还在重画整屏，刚出来的英文会被一起抹掉");
  // 找的是渲染那一步（showOwnWordsResult），不是纯逻辑那一步
  // （ownWordsResult）—— 后者被前者包着，提交路径里出现的是前者。
  assert.match(fn, /showOwnWordsResult\(/,
    "翻完没有把结果画出来");
});

test("没有邀请码时，问话在他开口之前就说明这里需要码", () => {
  // 真浏览器上抓到的：这是一个通往付费路径的**新入口**，而两次提交前
  // 刚给翻译页和查词页补上的事前提示，这里没有。家长会对着话筒说完一句
  // 中文、点下按钮，才撞上那堵墙——正是那次要消灭的体验。
  //
  // 这条断言量的是接线：问话那一块里，得有代码去问「这道门开着吗」。
  const at = html.indexOf("function paintOwnWordsInvite");
  assert.ok(at !== -1, "找不到画问话的地方");
  const fn = html.slice(at, html.indexOf("\nasync function submitOwnWords", at));
  assert.match(fn, /accessGateNotice\(/,
    "问话没有告诉他这里需要邀请码——他要说完一句话才会撞上");
});

let failed = 0;
for (const t of tests) {
  try { t.fn(); console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed}/${tests.length} 条失败` : `\n✓ all ${tests.length} tests passed`);
process.exit(failed ? 1 : 0);
