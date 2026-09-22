#!/usr/bin/env node
// 设置里的「使用说明」。
//
// 说明书最大的毛病不是写得不好，是**过期了没人知道**。界面改了一个按钮名，
// 说明里还写着旧的；复习间隔调了，说明里还是老数字。家长照着说明找一个已经
// 不存在的按钮，只会觉得是自己笨。
//
// 所以这里一半的测试不是在验「说明写了什么」，而是在验「说明写的和界面真用的
// 是不是同一个东西」——标签名、声音图标、复习间隔、按钮上的字。哪天界面改了
// 而说明没跟，这里会红。
//
// 对应的用户情境（不含函数名）：
//   1. 家长点开设置，看得到「使用说明」；它默认是收起来的，不把设置页撑长——
//      被报错送来填邀请码的家长，不该先划过一整篇说明书。
//   2. 家长照着说明去找某个标签、某个按钮、某个图标，界面上真有，字一样。
//   3. 家长想知道「什么东西会离开我的手机」，说明里讲得清，而且讲的是实话。
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");
const { ruleFromEnv } = await import("../netlify/functions/_shared/reminder-rule.mjs");

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// 两个标记之间的那段源码。两个标记都得在、而且顺序得对——
// 少一个的话 indexOf 会回 -1，slice(-1, e) 静静地切出一段错的东西，测试照样跑。
function betweenMarkers(start, end, what) {
  const s = html.indexOf(start), e = html.indexOf(end, s === -1 ? 0 : s);
  assert.ok(s !== -1, `${what}：找不到起始标记 ${start}`);
  assert.ok(e !== -1, `${what}：找不到结束标记 ${end}`);
  assert.ok(s < e, `${what}：结束标记跑到起始标记前面去了`);
  return { s, e, src: html.slice(s, e + end.length) };
}
// 只要标签之间的可见文字：先扔掉注释（注释里常留着旧文案，会被当成界面上有的）。
const text = (src) => src.replace(/<!--[\s\S]*?-->/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

// 取出设置屏里「使用说明」那一块的源码，以及它之外的全部源码（去掉注释）。
function guide() {
  const { s, e } = betweenMarkers('id="guideSection"', "<!-- /guideSection -->", "使用说明");
  const open = html.lastIndexOf("<div", s);
  const rest = (html.slice(0, open) + html.slice(e)).replace(/<!--[\s\S]*?-->/g, " ");
  return { src: html.slice(open, e), rest };
}

test("设置里有「使用说明」，而且排在备份后面——不挡在邀请码前头", () => {
  // 设置屏这一段：从它的 id 到下一屏的 id。每个锚点都得真的找到，
  // 不然 indexOf 的 -1 会让「x 在 y 前面」这种比较全部变成真。
  const screen = betweenMarkers('id="settingsScreen"', 'id="helpScreen"', "设置屏");
  const inScreen = (needle) => {
    const i = html.indexOf(needle);
    assert.ok(i !== -1, `找不到 ${needle}`);
    assert.ok(i > screen.s && i < screen.e, `${needle} 不在设置屏里`);
    return i;
  };
  const code = inScreen('id="accessCodeInput"');
  const backup = inScreen('id="backupStatus"');
  const g = inScreen('id="guideSection"');
  assert.ok(code < g, "「使用说明」跑到邀请码前面去了——被报错送来的家长要先划过它");
  assert.ok(backup < g, "「使用说明」应该在备份后面，设置页的最底下");
});

test("每个主题默认都是收起来的，不把设置页撑长", () => {
  const { src } = guide();
  const topics = src.match(/<details\b[^>]*>/g) || [];
  assert.ok(topics.length >= 6, `只有 ${topics.length} 个主题，不够「详细」`);
  for (const t of topics) assert.ok(!/\bopen\b/.test(t), `有一个主题默认是展开的：${t}`);
});

test("每个主题都有标题，点得到（沿用全站的折叠样式），底下真有内容", () => {
  const { src } = guide();
  const blocks = src.split(/<details\b/).slice(1);
  // 没有这一句，一个主题都没有时下面的循环一次不跑，这条会「通过」——
  // 拿空壳探过，真的会。
  assert.ok(blocks.length >= 6, `只找到 ${blocks.length} 个主题`);
  for (const b of blocks) {
    const sum = b.match(/<summary\b([^>]*)>([\s\S]*?)<\/summary>/);
    assert.ok(sum, "有一个主题没有标题");
    assert.ok(/transcript-summary/.test(sum[1]), "标题没用全站那套折叠样式——会变回一行看不出能点的小字");
    assert.ok(text(sum[2]).trim().length >= 4, `标题太短，看不出讲什么：「${text(sum[2])}」`);
    const body = text(b.slice(b.indexOf("</summary>")));
    assert.ok(body.trim().length >= 40, `「${text(sum[2]).trim()}」底下几乎没写东西`);
  }
});

test("说明里提到的四个标签，和底部导航上真的那四个字一样", () => {
  const { src } = guide();
  const nav = html.slice(html.indexOf('class="bottom-nav"'));
  const labels = [...nav.slice(0, nav.indexOf("</div>\n\n")).matchAll(/<\/span>([^<\s][^<]*?)(?:<|\n)/g)].map(m => m[1].trim()).filter(Boolean);
  assert.equal(labels.length, 4, `底部导航读出了 ${labels.length} 个标签，读法可能坏了：${labels}`);
  const t = text(src);
  for (const l of labels) assert.ok(t.includes(`「${l}」`), `说明里没提到「${l}」这个标签，或者写的字不一样`);
});

test("说明里画的四种声音标记，和收藏列表里真用的图标一样", () => {
  const { src } = guide();
  const S = "/* ll:audio-marks:start */", E = "/* ll:audio-marks:end */";
  const marks = html.slice(html.indexOf(S), html.indexOf(E));
  const icons = [...new Set([...marks.matchAll(/icon:\s*"([^"]+)"/g)].map(m => m[1]))];
  assert.equal(icons.length, 4, `收藏列表的声音标记读出了 ${icons.length} 种，读法可能坏了：${icons}`);
  for (const i of icons) assert.ok(src.includes(i), `说明里没有 ${i} 这个标记——家长在列表里看得到它，却查不到它什么意思`);
});

test("说明里写的复习间隔，和复习真用的间隔是同一组数", () => {
  const { src } = guide();
  const m = html.match(/const REVIEW_INTERVALS = \[([^\]]+)\]/);
  assert.ok(m, "找不到复习间隔的定义");
  const days = m[1].split(",").map(s => s.trim());
  const want = days.join("、");
  assert.ok(text(src).includes(want),
    `说明里的复习间隔和真用的对不上。真用的是「${want}」天——改了间隔，说明要跟着改`);
});

// 界面上真实的控件文字：<button>…</button> 的内容、和脚本里赋给按钮的字。
// 不拿整份源码做子串匹配——那样「保存」会在「保存邀请码」这种词里蒙混过关，
// 注释里留着的旧按钮名也会被当成还在。
function controlLabels() {
  const { rest } = guide();
  const labels = new Set();
  for (const m of rest.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)) labels.add(text(m[1]).trim());
  // 赋值右边可能是三元式（播放中 ? '⏸ 停止' : '连续播放全部'），两个分支都是真会出现的字。
  for (const m of rest.matchAll(/\.textContent = ([^;\n]+)/g)) {
    for (const q of m[1].matchAll(/["'`]([^"'`]+)["'`]/g)) labels.add(q[1].trim());
  }
  for (const m of rest.matchAll(/<div class="s-name"[^>]*>([^<]+)</g)) labels.add(m[1].trim());
  // 年龄档那一排是 role="button" 的 div，不是 <button>——对家长来说一样是按钮。
  for (const m of rest.matchAll(/<(?:div|span)\b[^>]*role="(?:button|radio)"[^>]*>([\s\S]*?)<\/(?:div|span)>/g)) labels.add(text(m[1]).trim());
  return labels;
}

test("说明里叫得出名字的按钮，界面上真有，字一模一样", () => {
  const { src } = guide();
  const named = [...text(src).matchAll(/【([^】]+)】/g)].map(m => m[1]);
  assert.ok(named.length >= 5, `说明里只点了 ${named.length} 个按钮的名——家长照着说明会找不到东西`);
  const labels = controlLabels();
  assert.ok(labels.size >= 10, `只从界面上读出 ${labels.size} 个控件文字，读法可能坏了`);
  for (const n of named) {
    assert.ok(labels.has(n), `说明里说有个【${n}】，界面上没有哪个按钮正好写着这几个字（有的是：${[...labels].filter(l => l.includes(n.slice(0, 2))).join(" / ") || "无相近"}）`);
  }
});

// ── 隐私那一条不许「先写结论、再用测试钉住」 ──
// 第一稿就是这么翻车的：说明写「只有英文出门」，测试拿正则钉住「只……英文」，
// 而连播的中文提示其实也走 /api/tts。测试把假话锁成了真相。
// 所以这里反过来：先从代码里数出到底有哪些文字会被送去生成声音，
// 再要求说明把每一种都讲到。代码多一条外发路径，这条就红。
function ttsCallSites() {
  // 扫整个内联脚本，不只扫某一个模块：设置里的试听就在模块外面，第一版只扫
  // audio-provision，把它漏了——「代码里有几种就得讲几种」这句承诺当时是空的。
  const script = betweenMarkers("<script>", "</script>", "内联脚本").src;
  // 排除 `function ttsFetch(text, voice)` 这行定义本身，只要调用点。
  return [...script.matchAll(/(?<!function )ttsFetch\(([^,]+),/g)].map(m => m[1].trim());
}

test("送去生成声音的文字，代码里有几种，说明就得讲几种——不许说「只有英文」", () => {
  const sites = ttsCallSites();
  assert.ok(sites.length >= 2, `只找到 ${sites.length} 处生成声音的调用，读法可能坏了：${sites}`);
  // 白名单：每一处送去生成声音的参数，都必须是说明里讲过的那几种之一。
  // 出现一个不认识的（比如哪天有人把 tip 也送去了），这里先红，逼着说明跟上。
  // 精确到整个参数表达式，不做子串匹配——`VOICE_SAMPLE + privateText` 不许蒙混过关。
  const KNOWN = new Set(["zh", "item.en", "VOICE_SAMPLE"]);
  const strangers = sites.filter(a => !KNOWN.has(a));
  assert.deepEqual(strangers, [],
    `代码里多了说明没讲过的外发文字：${strangers.join(" · ")}——先补说明，再把它加进白名单`);
  const sendsChinese = sites.includes("zh");
  const sendsEnglish = sites.includes("item.en");
  const sendsSample = sites.includes("VOICE_SAMPLE");
  assert.ok(sendsEnglish, "代码里居然没有把英文送去生成声音的地方");
  assert.ok(sendsSample, "试听那条外发路径没扫到——扫描范围可能又缩回某个模块了");
  const t = text(guide().src);
  assert.ok(/英文.{0,30}(发|送).{0,20}(Azure|生成)/.test(t), "没说英文会被送去生成声音");
  if (sendsSample) {
    assert.ok(/试听.{0,30}(固定|样句)/.test(t), "试听会把一句固定英文样句发出去，说明里没讲");
  }
  if (sendsChinese) {
    assert.ok(/中文.{0,30}(也|同样).{0,12}(发|送)/.test(t),
      "代码会把中文提示送去生成声音（连播），说明里却没讲——这正是第一稿的假话");
    assert.ok(!/中文不出门|只.{0,4}英文.{0,6}出门|只有.{0,4}英文/.test(t),
      "说明还在说「只有英文出门」，可代码会送中文");
  }
});

// 说明里「翻译时」那一条本身，不拿整篇说明去匹配——「中文」两个字满篇都是，
// 隔壁条目里的一个「中文」也能让这里假绿。
function guideItem(startsWith) {
  const { src } = guide();
  const m = src.match(new RegExp(`<li><strong>${startsWith}[\\s\\S]*?<\\/li>`));
  assert.ok(m, `说明里没有以「${startsWith}」开头的那一条`);
  return text(m[0]);
}

test("翻译时发出去的每一样，说明都点到了：中文、档位、邀请码", () => {
  // 客户端真发的东西，从那次 fetch 调用整段里读：body 里的字段，加上 headers 走不走 accessHeaders()。
  const call = html.match(/fetch\("\/api\/translate",\s*\{([\s\S]*?)\}\);/);
  assert.ok(call, "找不到翻译请求的调用");
  const body = call[1].match(/body: JSON\.stringify\(\{([^}]+)\}\)/);
  assert.ok(body, "翻译请求的 body 不是一个对象字面量了——这条测试的读法要跟着改");
  const fields = body[1].split(",").map(f => f.trim().split(":")[0].trim());
  const sendsCode = /headers: accessHeaders\(\)/.test(call[1]);
  const t = guideItem("翻译时：");
  const say = { zh: /中文/, age: /档位|档/, clean: /中文/ };
  for (const f of fields) {
    const re = say[f];
    assert.ok(re, `翻译请求多了一个我不认识的字段「${f}」——说明和这条测试都要跟着改`);
    assert.ok(re.test(t), `翻译会把「${f}」发出去，「翻译时」那一条里没讲`);
  }
  if (sendsCode) assert.ok(/邀请码/.test(t), "翻译请求带邀请码（走 accessHeaders），「翻译时」那一条里没讲");
  else assert.ok(!/邀请码/.test(t), "翻译请求已经不带邀请码了，说明还在说会带");
});

// 「发给谁」不是写死的名单——从服务端函数里真打的上游主机名推出来。
// 哪天换了服务商，这里先红，逼着说明跟上；说明里多写一家已经不用的，也红。
const PROVIDER_BY_HOST = [
  [/generativelanguage\.googleapis\.com/, /Google|谷歌/, "Google"],
  [/api\.openai\.com/, /OpenAI/, "OpenAI"],
  [/tts\.speech\.microsoft\.com/, /微软|Azure/, "微软 Azure"],
];
function upstreamProviders() {
  const dir = join(ROOT, "netlify", "functions");
  const src = readdirSync(dir).filter(f => f.endsWith(".mjs")).map(f => readFileSync(join(dir, f), "utf8")).join("\n");
  return PROVIDER_BY_HOST.filter(([host]) => host.test(src));
}

test("说了发给谁：名单从服务端真打的上游推出来，而且都在境外", () => {
  const used = upstreamProviders();
  assert.ok(used.length >= 2, `服务端只认出 ${used.length} 家上游，读法可能坏了`);
  const t = text(guide().src);
  for (const [, mention, name] of used) assert.ok(mention.test(t), `服务端会把东西发给 ${name}，说明里没讲`);
  for (const [host, mention, name] of PROVIDER_BY_HOST) {
    if (!used.some(([h]) => h === host)) assert.ok(!mention.test(t), `说明里还在讲 ${name}，可服务端已经不用它了`);
  }
  assert.ok(/境外/.test(t), "没说这些服务在境外");
});

test("不录音这一句，只承诺代码能兑现的：不请求麦克风、不录音；键盘听写归手机管", () => {
  const t = text(guide().src);
  assert.ok(/不(会)?(请求|要)麦克风/.test(t) && /不(会)?录音/.test(t), "没说清不请求麦克风、不录音");
  assert.ok(/键盘/.test(t) && /(手机|输入法).{0,12}(处理|管)/.test(t), "没说清键盘听写是手机/输入法在处理");
  assert.ok(!/声音不经过我们|不经过我们/.test(t), "「声音不经过我们」承诺过头了——我们保证不了系统键盘怎么处理");
});

test("提醒关不掉、直接删图标、换手机——这三种情况服务器上会留东西，说明得讲", () => {
  const t = text(guide().src);
  assert.ok(/先.{0,10}关.{0,4}提醒/.test(t), "没教家长「不用之前先关提醒」");
  assert.ok(/删.{0,4}图标|换手机/.test(t) && /留|保留/.test(t), "没说直接删图标/换手机的话记录会留在服务器上");
  assert.ok(/联网/.test(t), "没说关提醒要联网才删得掉");
});

test("说明里的复习「再提醒」间隔，和服务端的规则是同一个数", () => {
  // 用生产默认值（空环境）问规则本身，不去正则读源码里那个常量怎么拼写。
  const r = ruleFromEnv({});
  const hours = String(r.retryMs / 3600000).replace(/\.0$/, "");
  const t = text(guide().src);
  assert.ok(new RegExp(`(没|未)复习.{0,30}${hours} ?小时`).test(t) || new RegExp(`${hours} ?小时.{0,20}(再|又)提醒`).test(t),
    `服务端「没复习时 ${hours} 小时再提醒」这条规则，说明里没写或数字不对`);
});

test("哪一档才有「慢速」，说明写的和代码里的条件一致", () => {
  const m = html.match(/const slowBtn = currentAge === "([^"]+)"/);
  assert.ok(m, "找不到慢速按钮的出现条件");
  const t = text(guide().src);
  assert.ok(t.includes("慢速"), "没提「慢速」这个按钮");
  assert.ok(t.includes(m[1]), `慢速只在 ${m[1]} 档出现，说明里没写清是哪一档`);
});

test("讲到点提醒时，说了服务器上会存东西——不能只挑好听的讲", () => {
  const t = text(guide().src);
  assert.ok(/服务器/.test(t), "到点提醒会在服务器上存几样东西，说明里一个字没提");
  // 窗口从 12 字放宽到 60 字：修订后的文案把「关闭提醒」和「记录已删除」之间
  // 隔了一句操作指引。验的事没变——关提醒会删服务器记录。
  assert.ok(/关.{0,6}提醒.{0,60}(删|清)/.test(t), "没说关掉提醒之后那些东西会删掉");
});

test("讲备份时不说瞎话：能拿来恢复的文件，和恢复按钮真收的文件是同一批", () => {
  // 第一稿写了「.csv 不能用来恢复」。那是错的——恢复按钮收 .csv，往返测试也
  // 证明复习进度和自建场景都回得来。这一条就是为那句错话补的。
  const accept = (html.match(/id="importFile"[^>]*accept="([^"]+)"/) || [])[1] || "";
  assert.ok(accept, "找不到恢复按钮收哪些文件");
  // 恢复按钮收的每一种扩展名，说明都得提；说明里提到的每一种，按钮也得真收——两个方向都查。
  const accepted = [...new Set([...accept.matchAll(/\.[a-z0-9]+/g)].map(m => m[0]))];
  assert.ok(accepted.length >= 1, `从 accept 里读不出扩展名：${accept}`);
  const whole = text(guide().src);
  const described = [...new Set([...whole.matchAll(/\.(?:json|csv|txt|zip|xlsx?)\b/g)].map(m => m[0]))];
  for (const ext of accepted) assert.ok(described.includes(ext), `恢复按钮收 ${ext}，说明里却没提它`);
  for (const ext of described) assert.ok(accepted.includes(ext), `说明里提到 ${ext}，可恢复按钮不收它`);
  for (const ext of accepted) {
    assert.ok(!new RegExp(`\\${ext}[^。]{0,20}不能.{0,6}恢复`, "i").test(whole), `说明里说 ${ext} 不能恢复，可恢复按钮明明收它`);
  }
});

test("教人离开微信时，菜单名和安装指引里可见的那一步写的是同一批", () => {
  // 安装指引里教人离开微信的那一步，可见文字里带着「」括起来的菜单名。
  // 只认可见文字（text() 已剥掉注释）——注释里那句解释也写着这两个名字，
  // 拿它当依据的话，指引改了、注释没改，这里照样绿。
  const stepM = html.match(/<div class="step-text">([^<]*在浏览器打开[^<]*)<\/div>/);
  assert.ok(stepM, "安装指引里找不到「在浏览器打开」那一步的可见文字——指引改了，这条测试要跟着改");
  const labels = [...stepM[1].matchAll(/「([^」]+)」/g)].map(m => m[1]);
  assert.ok(labels.length >= 2, `那一步只读出 ${labels.length} 个菜单名：${labels}`);
  const { src } = guide();
  const t = text(src);
  for (const label of labels) assert.ok(t.includes(label), `说明里没写「${label}」——用那种手机的家长在菜单里找不到说明写的那一项`);
});

test("说明没有引入重复的 id，也没有把内联脚本弄坏", () => {
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
  const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
  assert.deepEqual([...new Set(dup)], [], `重复的 id：${[...new Set(dup)].join(", ")}`);
  const script = html.slice(html.lastIndexOf("<script>") + 8, html.lastIndexOf("</script>"));
  assert.doesNotThrow(() => new vm.Script(script), "内联脚本语法坏了");
});

console.log("settings guide tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message.split("\n")[0]}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
