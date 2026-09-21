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
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

// 取出设置屏里「使用说明」那一块的源码，以及它之外的全部源码。
function guide() {
  const s = html.indexOf('id="guideSection"');
  assert.ok(s !== -1, "设置里没有「使用说明」这一块（找不到 id=\"guideSection\"）");
  const open = html.lastIndexOf("<div", s);
  const e = html.indexOf("<!-- /guideSection -->", s);
  assert.ok(e !== -1, "「使用说明」这一块没有收尾标记 <!-- /guideSection -->");
  return { src: html.slice(open, e), rest: html.slice(0, open) + html.slice(e) };
}
const text = (src) => src.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

test("设置里有「使用说明」，而且排在备份后面——不挡在邀请码前头", () => {
  const settings = html.indexOf('id="settingsScreen"');
  const code = html.indexOf('id="accessCodeInput"');
  const backup = html.indexOf('id="backupStatus"');
  const g = html.indexOf('id="guideSection"');
  assert.ok(g !== -1, "设置里没有「使用说明」");
  assert.ok(settings < code && code < g, "「使用说明」跑到邀请码前面去了——被报错送来的家长要先划过它");
  assert.ok(backup < g, "「使用说明」应该在备份后面，设置页的最底下");
  assert.ok(g < html.indexOf('id="helpScreen"'), "「使用说明」不在设置屏里");
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

test("说明里叫得出名字的按钮，界面上真有，字一模一样", () => {
  const { src, rest } = guide();
  const named = [...text(src).matchAll(/【([^】]+)】/g)].map(m => m[1]);
  assert.ok(named.length >= 5, `说明里只点了 ${named.length} 个按钮的名——家长照着说明会找不到东西`);
  for (const n of named) {
    assert.ok(rest.includes(n), `说明里说有个【${n}】，界面上找不到这几个字`);
  }
});

test("讲清什么会离开手机：翻译发的是你打的字，配声音只发英文，从不录音", () => {
  const t = text(guide().src);
  assert.ok(/不录音|从不录音|不会录音/.test(t), "没说清这个软件不录音");
  assert.ok(/键盘/.test(t) && /麦克风|听写/.test(t), "没说清语音输入用的是手机键盘自带的，不是这个软件");
  assert.ok(/只.{0,8}英文/.test(t), "没说清生成声音时只有英文出门");
  assert.ok(/孩子.{0,6}(名字|姓名)/.test(t), "没提醒别把孩子的名字打进去");
  assert.ok(/收藏.{0,20}(只|都).{0,10}(这台|本机|手机)/.test(t), "没说清收藏和复习进度留在手机上");
});

test("讲到点提醒时，说了服务器上会存东西——不能只挑好听的讲", () => {
  const t = text(guide().src);
  assert.ok(/服务器/.test(t), "到点提醒会在服务器上存几样东西，说明里一个字没提");
  assert.ok(/关.{0,6}提醒.{0,12}(删|清)/.test(t), "没说关掉提醒之后那些东西会删掉");
});

test("讲备份时不说瞎话：能拿来恢复的文件，和恢复按钮真收的文件是同一批", () => {
  // 第一稿写了「.csv 不能用来恢复」。那是错的——恢复按钮收 .csv，往返测试也
  // 证明复习进度和自建场景都回得来。这一条就是为那句错话补的。
  const accept = (html.match(/id="importFile"[^>]*accept="([^"]+)"/) || [])[1] || "";
  assert.ok(accept, "找不到恢复按钮收哪些文件");
  const t = text(guide().src);
  for (const ext of [".json", ".csv"]) {
    if (accept.includes(ext)) assert.ok(t.includes(ext), `恢复按钮收 ${ext}，说明里却没提它`);
  }
  if (accept.includes(".csv")) {
    assert.ok(!/csv[^。]{0,20}不能.{0,6}恢复/i.test(t), "说明里说 .csv 不能恢复，可恢复按钮明明收它");
  }
});

test("教人离开微信时，两种手机上的菜单名都写了，而且和安装指引里的是同一批字", () => {
  const { src, rest } = guide();
  for (const label of ["在浏览器打开", "在Safari中打开"]) {
    assert.ok(rest.includes(label), `安装指引里已经没有「${label}」了——这条测试该跟着改`);
    assert.ok(src.includes(label), `说明里没写「${label}」——用那种手机的家长在菜单里找不到说明写的那一项`);
  }
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
