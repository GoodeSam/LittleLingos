---
vmark:
  id: 019f7fbf-fdcb-7002-9c80-c73b302944c7
---

借鉴 /Users/victor/projects/no-one-did-it-GoodeSam 的工程能力，以及xiaolai/bureau 中的 scripts/crew\.mjs 和 test/run.mjs，给我制作一个制作 可以打造littleLingoes的系统，其中的Agents，skills，hooks，rules要互相引用，其中评估系统要使用Codex而不是claude code。

其中必须要有两个Agent来对系统生成的产品从功能和外观两个角度提出比较严格的要求，不能是很宽松的要求。

进行两轮：/nlpm-score，/nlpm-fix 和codex评估并修改

从最终的结果来看，用户看到了这个系统生成的内容后，会对我的产品信任增加吗，会愿意来更多地了解和使用这个产品吗

如何递归

借鉴一人公司的内容，我只用和ceo这个机器人交流，其他的是CEO去按排

---

把最近收藏的放在最上面，方便复习。

用户提供一个翻译内容后，不仅翻译这段文字本身，还要展示和这个相关的一系列地道的表达。

把收藏界面放在最醒目的位置，方便复习

---

用户选择了年龄段以后，就记住其选择的年龄段，在翻译界面也保持这个年龄段

使用Claude AI design来优化外观

继续优化以使本项目的各个方面都达标

给这个系统设计一个图标

---

如何让其他人也使用这个littleLongos

<https://littlelingos.netlify.app>&#x20;

已提交：65a4e39，共 23 个文件（564 增 / 89 删），内容与线上 ll-49aa0489 完全对应——包括缓存戳修复、内容与视觉修复、新图标集、crew 测试规格和你的两份构建笔记。

---

这个软件的搜索部分允许文字输入，评估如何实现用户输入语音，然后语音转文字，从而实现不用手动输入文字

这个语音转文字有时可以，有时不行，找出原因并优化

---

我有以下需求，根据最佳实践，来思考如何实现下面所有要求，先列计划，不直接写代码：

1.在目前的little lingo上应该增加一个英语词典，方便用户查询英语单词。

2.对于查询过的单词，也会进入复习界面，提醒用户复习。

3.对于用户已经收藏过的翻译内容和查询过的单词，按照遗忘曲线的实践规律，题型用户当天该复习什么内容

4.对于之前收藏过的翻译，在复习界面，也可以提供之前翻译时的语音选项

---

使用TDD来实现修订版



---

/cc-suite:audit-fix

- 7月24日探索新领域的元概念。

- 建议提问顺序

- 第一步：framework + strategies（先摸清地图）

  原文明确说"在你问出问题之前，先在那个领域里面搜索一下，这个领域里常见的 framework 是什么，常见的 strategy 是什么"——这是唯一被原文点名"要在提问之前做"的一步，所以排第一。

  ▎ 提问模板："

- 在本项目所在的领域常见的思维/工作框架有哪些？在这些框架下，各自对应的具体策略是什么？

---

-

- /cc-suite:audit-fix

- ask codex for advices.

  . ask codex to grill your plan. ask codex to audit this branch.

- `recursion，递归`

- 第二步：best practices + best criteria（校准好坏的标准）

  原文说"你到任何一个领域当中，可能是新手，但上来就去了解这个领域当中的最佳实践模式是什么"——"上来就"也是强调尽早问，紧跟在框架之后：先知道地图（框架/策略），再知道路怎么走才算走对（最佳实践）、怎么判断走得好不好（评判标准）。

  ▎ 提问模板："

- 这个领域公认的最佳实践是什么？评判一件事在这个领域做得好不好的标准是什么？

- Grill yourself

- Grill yourself to improve, not to tear yourself down

- /cc-suite:audit-fix

- ask codex for advices.

  ask codex for help. ask codex to grill your plan. ask codex to audit this branch.

- 递归

- `recursion，递归`

- 第三步：failure mode（提前踩雷点）

  原文说"不管干什么…到最后你都要问它：最常见的失败模式是什么"——"到最后"意味着这是准备阶段的收尾：框架、策略、标准都摸清后，再问哪里最容易翻车，两个层面都要问（自己作为执行者会怎么失败 + AI 作为工具会怎么失败）。

  ▎ 提问模板："

- 完成这件事最常见的失败模式是什么？我自己作为执行者容易在哪里失败？你（AI）作为我的助手容易在哪里失败？

- Grill yourself

- Grill yourself to improve, not to tear yourself down

- /cc-suite:audit-fix

- ask codex for advices.

  ask codex for help. ask codex to grill your plan. ask codex to audit this branch.

- 递归

- `recursion，递归`

- 第四步：optimal toolkits（武装好再动手）

  原文说"再加一个：这个领域当中都有哪些工具可以使用"——排在失败模式之后，是准备阶段最后一步：知道了地图、标准、雷区之后，最后配齐装备再正式开干。

  ▎ 提问模板："

-

- 做这件事这个领域有哪些常用工具？帮我从中选出一套最优工具集。

- Grill yourself

- Grill yourself to improve, not to tear yourself down

- /cc-suite:audit-fix

- ask codex for advices.

  ask codex for help. ask codex to grill your plan. ask codex to audit this branch.

- `recursion，递归`

---

- ·`AI 让你选的时候怎么办？`
- Don't ask me. Ask Codex, Gemini(agy) and Grok to make this decision professionally, then choose the most optimal one and provide supporting reasons so I understand."

