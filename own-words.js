// 「说说看」——问家长一句「你平时在这个场景里对孩子说什么」——的三个纯函数（ADR 0009 第五块）。
// 从 index.html 的 ll:own-words 块原样搬出来，一个字没改；下面那段是它原来的说明。
// 纯的：不碰 document / window / 存储 / 网络。普通脚本 + CommonJS 出口（同 storage.js）。
(function (root) {
  "use strict";

  // 问家长一句：你平时在这个场景里，对孩子说的是什么？
  //
  // 597 条精选句子摆在那儿，真正被说出口的只有三句 `Let's + 动词`
  // （docs/jtbd.md 发现 2）。原因不是句子不好，是那些句子不是他的话。
  //
  // 而他不知道自己习惯说什么 —— 你问他「洗澡时你都说什么」，他答出来的是
  // 他**以为**自己说的。这是 docs/jtbd.md 第七节候选 D 的核心。
  //
  // 能力其实早就有了：iPhone 键盘自带听写，音频不出设备，转出来的文字走的
  // 是翻译已经在走的那条路。缺的只有两样 —— 他不知道可以对着话筒说，
  // 也不知道该说什么进去。所以这里做的是一句问话，不是一个录音器。
  //
  // 这同时是候选 D 的实验：区分「他自己的话」和「精选的句子」不需要新字段，
  // 翻译产物的 id 一律带 t_ 前缀，而 597 条预设句子里没有一条是。
  // 不改数据格式，也就不需要迁移。

  const OWN_WORDS_PREFIX = "t_";

  // 这条收藏是家长自己讲出来的，还是从现成句子里收的。
  function isOwnWords(phrase) {
    return !!phrase
      && typeof phrase === "object"
      && typeof phrase.id === "string"
      && phrase.id.startsWith(OWN_WORDS_PREFIX);
  }

  // 该不该在这个场景页上问他。问完一次就让路 —— 问话的作用是让他知道
  // 「可以说」和「该说什么」，他一旦讲过，这两件事都不用再讲了。
  //
  // 注意「讲过」只认他自己的话：收藏了一堆现成句子不算。混淆这两件事，
  // 实验的两组样本就分不开了。
  // 【2026-09-07 推翻】上一版在他讲过一句之后返回 null —— 整张卡消失。
  // 当时的理由是「问话的作用是让他知道『可以说』和『该说什么』，讲过一次
  // 这两件事就都不用再讲了」。推理没错，错在把「说明不用再讲」当成了
  // 「入口不用再留」：Victor 在手机上试用时报的第一句话就是「文字只能输入
  // 一次翻译，输入一次之后这个文本就会被折叠，再也不能展示出」。
  // 现在入口永远留着，收起来的只是那段说明。
  function ownWordsInvite({ scenarioTag, scenarioName, saved }) {
    const list = Array.isArray(saved) ? saved : [];
    const spoken = list.some(p => isOwnWords(p) && p && p.scenario === scenarioTag);
    // 场景名进问话里：笼统地问「说点什么」，他还是不知道该说什么。
    const name = String(scenarioName || "").trim() || "这个场景";
    if (spoken) {
      return {
        mode: "repeat",
        // 教「可以对着话筒说」的那段话讲一次就够了。每次进来都念一遍，
        // 它就从提示变成了噪音。
        text: `再说一句你在「${name}」常讲的中文？`,
        buttonLabel: "🎤 说说看",
      };
    }
    return {
      mode: "first",
      text: `不确定自己平时怎么说？说说你在「${name}」时常对孩子讲的中文 —— ` +
            `点下面的框，用键盘上的 🎤 说就行，我们把它变成你能说出口的英文。`,
      buttonLabel: "🎤 说说看",
    };
  }

  // 翻出来的英文，得当场出现在他眼前。
  //
  // 【2026-09-07 新增】之前提交完就重画整屏、弹一句「收好了」。他打了一句
  // 中文、等了两秒，然后什么也没看见 —— 这个软件存在的理由就是给他那句
  // 英文，而那句英文从没在他眼前出现过。Victor 的原话：「翻译的内容会直接
  // 进入收藏，在当前页面看不了」。
  function ownWordsResult(entry) {
    if (!entry || typeof entry !== "object") return null;
    const zh = typeof entry.zh === "string" ? entry.zh.trim() : "";
    const en = typeof entry.en === "string" ? entry.en.trim() : "";
    if (!zh || !en) return null;
    // id 必须跟着走：生成的那段音频是按 id 存的，卡片不知道 id 就只能退回
    // 浏览器自带的合成音——「同一句话在两处音色不同」这个毛病本会话已经
    // 由用户报过一次。
    return {
      id: entry.id || null,
      zh, en,
      note: "已存进这个场景的收藏 —— 明天它会回来找你。",
    };
  }

  var api = { OWN_WORDS_PREFIX: OWN_WORDS_PREFIX, isOwnWords: isOwnWords, ownWordsInvite: ownWordsInvite, ownWordsResult: ownWordsResult };
  if (typeof module !== "undefined" && module.exports) module.exports = api;   // Node（测试）
  else root.llOwnWords = api;                                                  // 浏览器
})(typeof globalThis !== "undefined" ? globalThis : this);
