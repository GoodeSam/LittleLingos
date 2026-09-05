#!/usr/bin/env node
// Guards the one thing left after deleting voice input: telling the parent
// that dictation still exists.
//
// WHY THE MODULE IS GONE. Measured on a real iPhone, our mic button returned
// something once in five tries, and that once took 7.4 seconds. On the same
// phone, in the same minute, the keyboard's own dictation button worked well.
// The engine, the permission and the language were all fine — Safari's
// webkitSpeechRecognition binding was not, and four rounds of changes here
// did not move it.
//
// So 486 lines went, along with five test files and the diagnostics built to
// chase it. Both fields a parent dictates into are ordinary text inputs, and
// iOS puts a microphone on the keyboard for exactly those.
//
// WHAT REMAINS TO GET WRONG. Deleting a visible button deletes the parent's
// only clue that speaking is possible at all. They will not go looking for a
// key on a keyboard they have not raised. One line of text is the whole cost
// of not silently removing a feature people were using.
//
// 这一组测试对应的用户情境（不含函数名）：
//
//   家长在翻译页想说话而不是打字。原来那个话筒按钮没有了 —— 得有一句话
//   告诉他键盘上有一个，否则对他而言这个功能就是消失了。
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(join(ROOT, "index.html"), "utf8");

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test("翻译框旁边说明了可以用键盘上的话筒说话", () => {
  const at = html.indexOf('id="zhInput"');
  assert.ok(at !== -1, "翻译输入框不见了");
  const near = html.slice(at, at + 700);
  assert.match(near, /键盘/, "不提键盘的话，家长不知道去哪儿找那个话筒");
  assert.match(near, /🎤|话筒|听写/, "得说清是哪一个键");
});

test("搜索框旁边也说明了", () => {
  const at = html.indexOf('id="searchInput"');
  assert.ok(at !== -1, "搜索框不见了");
  const near = html.slice(at, at + 900);
  assert.match(near, /键盘/, "两个框都能听写，只说一个等于漏掉一半");
});

test("那句话没有把它说成本应用的功能", () => {
  // 说成「本 App 的语音输入」，出问题时家长会来找我们 —— 而我们既没写它
  // 也修不了它。
  const at = html.indexOf('id="zhInput"');
  const near = html.slice(at, at + 700);
  assert.match(near, /系统|自带|iPhone|手机/,
    "要点明那是系统自带的，不是这个应用做的");
});

test("我们自己那套语音识别，一点残留都没有", () => {
  // 半删的模块比不删更糟：死代码会被后来的人当成还在用的东西读。
  for (const gone of ["setupVoiceInputs", "webkitSpeechRecognition", "mic-btn",
                      "translateMicBtn", "voiceDebugOn", "voiceTimeline"]) {
    assert.ok(!html.includes(gone), `${gone} 还在 —— 半删的模块会被当成还在用的`);
  }
});

console.log("keyboard dictation hint tests");
let passed = 0, failed = 0;
for (const t of tests) {
  try { t.fn(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.error(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(failed ? `\n✗ ${failed} failed, ${passed} passed` : `\n✓ all ${passed} tests passed`);
process.exit(failed ? 1 : 0);
