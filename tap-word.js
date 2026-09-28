// 点词查词的纯的那一半（ADR 0009 第十九块；原 ll:tap-word 块）：
// 把一句英文切成能点的词，加几个界面常量。造面板、插面板、高亮——那些碰 DOM 的
// 留在 index.html 的同名块里。零依赖，普通脚本 + CommonJS 出口。
(function (root) {
  "use strict";

  var TAP_WORD_PANEL_ID = "wordLookupPanel";
  var TAP_WORD_BODY_ID = "wordLookupBody";
  var TAP_WORD_NOTE_ID = "wordLookupPrivacyNote";
  var TAP_WORD_NOTE_TEXT = "🔒 点句子里的词也是查词：已收录的词不联网；没收录的词会发送到在线词典服务。";
  // 首尾要剥掉的标点。词内的撇号（don't、let's）和连字符留着。
  var TAP_WORD_TRIM_RE = /^[^A-Za-z0-9']+|[^A-Za-z0-9']+$/g;

  // 把一句英文切成 [{ text, word }]：text 是屏幕上原样显示的（带标点），
  // word 是去掉首尾标点、转小写后拿去查的；纯标点的 token 没有 word。空白也是 token，
  // 这样整句拼回去一个字不差。
  function tokenizeForLookup(text) {
    if (typeof text !== "string" || !text) return [];
    const out = [];
    for (const m of text.matchAll(/\s+|\S+/g)) {
      const t = m[0];
      if (/^\s+$/.test(t)) { out.push({ text: t, word: null }); continue; }
      const core = t.replace(TAP_WORD_TRIM_RE, "").toLowerCase();
      out.push({ text: t, word: /[a-z]/.test(core) ? core : null });
    }
    return out;
  }

  var api = { TAP_WORD_PANEL_ID: TAP_WORD_PANEL_ID, TAP_WORD_BODY_ID: TAP_WORD_BODY_ID, TAP_WORD_NOTE_ID: TAP_WORD_NOTE_ID, TAP_WORD_NOTE_TEXT: TAP_WORD_NOTE_TEXT, TAP_WORD_TRIM_RE: TAP_WORD_TRIM_RE, tokenizeForLookup: tokenizeForLookup };
  if (typeof module !== "undefined" && module.exports) module.exports = api;   // Node（测试）
  else root.llTapWordLib = api;                                                // 浏览器
})(typeof globalThis !== "undefined" ? globalThis : this);
