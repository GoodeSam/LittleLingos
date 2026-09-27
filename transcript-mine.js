// 「粘一段录音转写，挑出你常说的话」的两个纯函数（ADR 0009 第六块）。
// 从 index.html 的 ll:transcript-mine 块原样搬出来，一个字没改；下面是它原来的说明。
// 纯的：不碰 document / window / 存储 / 网络。普通脚本 + CommonJS 出口（同 storage.js）。
(function (root) {
  "use strict";

  // 从一段转写文字里，把家长的习惯用语挖出来。
  //
  // 这一块只在 two-users 分支上：前提是「只有 Victor 和太太两个人用」。
  // 那个前提让 docs/jtbd.md 第七节里的成本和隐私两条反对不再成立，
  // 但最强的那条**没有消失，只是换了形状**——
  //
  //   家长真说的话里，有相当一部分是他不愿意教给孩子的。
  //
  // 面向陌生家长时，这意味着产品会教坏别人的孩子；自己用时，意味着
  // **他自己就是筛选者**。所以这里挖出来的是「候选」，一条都不自动收藏。
  // 挑，是他的活，这个动作不能省。
  //
  // 技术死结绕开了：iOS 上 PWA 后台录音会被挂起，所以不在软件里录——
  // 用手机自带的语音备忘录录，任何工具转成文字，把文字粘进来。
  //
  // 整块的重点是排序。洗一次澡里说了 8 遍的那句就是他的习惯用语，
  // 说了 1 遍的不是。按次数排，习惯用语自己浮上来——这正是自我报告
  // 拿不到的那一层：你问他「洗澡时你都说什么」，他答的是他以为自己说的。

  // 一次最多让他看这么多条。三十分钟的转写能拆出几百句，
  // 全列出来，挑这个动作就没人做得动了。
  const TRANSCRIPT_MAX_CANDIDATES = 30;
  // 少于这么多字的，是语气词不是句子（嗯、好、来、对）。
  const TRANSCRIPT_MIN_CHARS = 3;

  // 断句：中英文句末标点、逗号、分号、换行。口语转写没有可靠的段落结构，
  // 只能靠这些。
  const TRANSCRIPT_SPLIT = /[。！？!?；;\n\r]+/;

  // 「来，我们洗洗小手。」「来，我们洗洗小手！」「来，我们洗洗小手」
  // 是同一句话说了三遍，不是三句不同的话。比较时把标点和空白抹掉。
  function transcriptKey(zh) {
    return String(zh).replace(/[\s，,。！？!?、：:；;""''「」（）()~—-]/g, "");
  }

  function mineTranscript(text) {
    if (typeof text !== "string") return [];
    const seen = new Map();   // key → { zh, count, order }
    let order = 0;
    for (const raw of text.split(TRANSCRIPT_SPLIT)) {
      // 句首句尾的逗号和空白去掉，句子中间的逗号留着——
      // 「来，我们洗洗小手」里那个逗号是这句话的一部分。
      const zh = raw.trim().replace(/^[，,、\s]+|[，,、\s]+$/g, "");
      if (!zh) continue;
      const key = transcriptKey(zh);
      if (key.length < TRANSCRIPT_MIN_CHARS) continue;
      const hit = seen.get(key);
      if (hit) { hit.count += 1; continue; }
      seen.set(key, { zh, count: 1, order: order++ });
    }
    return [...seen.values()]
      // 说得多的在前；一样多时先说的在前——否则同次数的条目每次刷新
      // 顺序都不一样，他会以为软件在乱跳。
      .sort((a, b) => b.count - a.count || a.order - b.order)
      .slice(0, TRANSCRIPT_MAX_CANDIDATES)
      .map(c => ({ zh: c.zh, count: c.count }));
  }

  var api = { TRANSCRIPT_MAX_CANDIDATES: TRANSCRIPT_MAX_CANDIDATES, TRANSCRIPT_MIN_CHARS: TRANSCRIPT_MIN_CHARS, transcriptKey: transcriptKey, mineTranscript: mineTranscript };
  if (typeof module !== "undefined" && module.exports) module.exports = api;   // Node（测试）
  else root.llTranscript = api;                                                // 浏览器
})(typeof globalThis !== "undefined" ? globalThis : this);
