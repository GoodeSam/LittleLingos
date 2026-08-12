// ── LittleLingos curated dictionary seed ────────────────
// Authored by maya-curriculum-designer. Entries here are the reviewed fast
// path for the home-screen word lookup: if a typed word matches a `forms`
// entry below, the app shows THIS card.
//
// Review status — rev 2, 2026-08-12: CLEARED by leo-linguist (EN) and
// nina-native-editor (ZH), each returning an overall CLEARED verdict with zero
// new findings. Clearance took two rounds: round 1 both reviewers returned NOT
// CLEARED with 6 defects; maya authored the fixes on their rulings; round 2
// re-audited the fixed revision and cleared it. Nina passed the other 42
// entries explicitly; leo ruled water/n and gentle/adv example.en both PASS.
//
// Round-1 defect ledger — all six resolved, cleared in round 2:
//   1. help/v  example.en -> "Do you want me to help?" (leo: "help" after
//      "need" is a noun, so pos:"v." was false; "want me to ___" is verbal).
//   2. sleep/v example.en -> "Time to go to sleep now." (leo: translation-ese;
//      headword stays a verb, so he overruled maya's "Time for bed").
//   3. hug/v   example.en -> "We're going now — go hug Grandma!" (leo: "hug
//      bye-bye" is a calque; "give Grandma a hug" duplicates the n sense).
//      Meaning shifted, so nina rewrote example.zh -> "我们要走啦，去抱抱奶奶！".
//   4. water/n example.zh -> "水在这儿，小口抿一下。" (nina: an offering, not an
//      imperative; the cup is at hand per the tip, unlike bottle/n's 来啦).
//   5. gentle/adv example.zh -> "…软软的、柔柔的。" (nina: matches this file's
//      "Nice and X" -> 叠词 pattern).
//   6. wait/v  sense zh gloss -> "等；等一下" (nina: bare-lemma level, like
//      eat->吃; example.zh untouched).
//
// Rulings recorded 2026-08-12, both closing their item:
//   sleep/v   — leo ruled this not a defect: "go to sleep" is a frozen idiom
//     whose internal POS is arguable, and changing the line would shift meaning
//     for no real gain. Cleared as written.
//   help/v zh — nina ruled no rewrite: 需要帮忙吗？is the natural Chinese
//     offer-to-help and aligns on intent and warmth, which is Pillar 4's bar.
//
// Disclaimer policy: both reviewers cleared this revision, so these entries are
// human-reviewed content, not unreviewed AI output. index.html gates
// suppression of the "AI 释义，未经人工审核" disclaimer on a DICT_CURATED_CLEARED
// constant, owned by devon-frontend-engineer. Clearance applies to this
// revision only — an edited entry has not been reviewed in its edited form.
//
// Shape contract (devon-frontend-engineer depends on it):
//   lemma  — unique across the file; the stable identity of the entry
//   forms  — lowercase surface forms, includes the lemma; globally unique
//            across all entries (devon builds a form -> entry index)
//   senses — always an array; `key` unique within the lemma
window.dictionaryWords = [

  // ── Daily-routine verbs ───────────────────────────────
  {
    lemma: "eat",
    forms: ["eat", "eats", "ate", "eaten", "eating"],
    senses: [
      {
        key: "v", pos: "v.", zh: "吃",
        example: { en: "Let's eat!", zh: "我们开饭啦！" },
        tip: "把宝宝抱进餐椅、把碗端上桌的那一刻说，让这个词和坐下开饭的动作绑在一起。"
      }
    ]
  },
  {
    lemma: "drink",
    forms: ["drink", "drinks", "drank", "drinking"],
    senses: [
      {
        key: "v", pos: "v.", zh: "喝",
        example: { en: "Here's your water. Drink up!", zh: "你的水在这儿。喝光光！" },
        tip: "把杯子递到宝宝手里，手扶着杯底看他喝，边扶边说。"
      },
      {
        key: "n", pos: "n.", zh: "喝的东西；饮料",
        example: { en: "Do you want a drink?", zh: "想喝点什么吗？" },
        tip: "一手水杯一手奶瓶举到宝宝面前，让他伸手指一个。"
      }
    ]
  },
  {
    lemma: "sleep",
    forms: ["sleep", "sleeps", "slept", "sleeping"],
    senses: [
      {
        key: "v", pos: "v.", zh: "睡觉",
        example: { en: "Time to go to sleep now. Night night!", zh: "该睡觉啦。晚安喽！" },
        tip: "关灯、轻拍宝宝后背时用最轻的声音说，每晚同一句话就变成睡觉信号。"
      }
    ]
  },
  {
    lemma: "nap",
    forms: ["nap", "naps", "napped", "napping"],
    senses: [
      {
        key: "n", pos: "n.", zh: "午觉",
        example: { en: "It's nap time!", zh: "午睡时间到啦！" },
        tip: "拉上窗帘、抱着小毯子走向床边时说，动作先到，话跟上。"
      },
      {
        key: "v", pos: "v.", zh: "睡一会儿；小睡",
        example: { en: "You napped for a whole hour!", zh: "你睡了整整一个小时呢！" },
        tip: "孩子睡醒坐起来时摸摸他的背，告诉他刚才睡了多久。"
      }
    ]
  },
  {
    lemma: "wash",
    forms: ["wash", "washes", "washed", "washing"],
    senses: [
      {
        key: "v", pos: "v.", zh: "洗",
        example: { en: "Let's wash your hands.", zh: "我们来洗手手。" },
        tip: "牵着宝宝走到水池边、打开水龙头的同时说，把话和洗手的动作连起来。"
      }
    ]
  },
  {
    lemma: "brush",
    forms: ["brush", "brushes", "brushed", "brushing"],
    senses: [
      {
        key: "v", pos: "v.", zh: "刷（牙）；梳（头）",
        example: { en: "Let's brush your teeth!", zh: "我们来刷牙啦！" },
        tip: "挤好牙膏把牙刷递到宝宝手里，自己也拿一把同步刷给他看。"
      },
      {
        key: "n", pos: "n.", zh: "梳子；刷子",
        example: { en: "Where's your brush? Let's do your hair.", zh: "你的小梳子呢？我们来梳梳头。" },
        tip: "先拿梳子在自己头上比划两下，再帮宝宝梳，让他知道梳子是干嘛的。"
      }
    ]
  },
  {
    lemma: "wear",
    forms: ["wear", "wears", "wore", "worn", "wearing"],
    senses: [
      {
        key: "v", pos: "v.", zh: "穿；戴",
        example: { en: "Do you want to wear the red shirt or the blue one?", zh: "你想穿红色的还是蓝色的？" },
        tip: "两手各举一件衣服到孩子面前，让他伸手指出想穿的那件。"
      }
    ]
  },
  {
    lemma: "sit",
    forms: ["sit", "sits", "sat", "sitting"],
    senses: [
      {
        key: "v", pos: "v.", zh: "坐",
        example: { en: "Come sit with me.", zh: "过来和我一起坐。" },
        tip: "拍拍身边的空位招招手，等孩子自己走过来坐下。"
      }
    ]
  },
  {
    lemma: "wait",
    forms: ["wait", "waits", "waited", "waiting"],
    senses: [
      {
        key: "v", pos: "v.", zh: "等；等一下",
        example: { en: "Wait a second — let me help you.", zh: "等一下下，我来帮你。" },
        tip: "说的同时举起一根手指做出「等」的手势，让宝宝看得见这个词的样子。"
      }
    ]
  },
  {
    lemma: "help",
    forms: ["help", "helps", "helped", "helping"],
    senses: [
      {
        key: "v", pos: "v.", zh: "帮忙",
        example: { en: "Do you want me to help?", zh: "需要帮忙吗？" },
        tip: "先蹲到孩子旁边，手停在半空问一句，等他点头再动手——问了再帮，孩子才有机会自己试。"
      }
    ]
  },
  {
    lemma: "hold",
    forms: ["hold", "holds", "held", "holding"],
    senses: [
      {
        key: "v", pos: "v.", zh: "牵着；拿着",
        example: { en: "Hold my hand. We're crossing the street.", zh: "牵着我的手。我们要过马路了。" },
        tip: "伸出手掌停在孩子面前，等他自己握上来再迈步。"
      }
    ]
  },
  {
    lemma: "share",
    forms: ["share", "shares", "shared", "sharing"],
    senses: [
      {
        key: "v", pos: "v.", zh: "分享",
        example: { en: "Can you share with your friend?", zh: "你能和小朋友分享吗？" },
        tip: "指指旁边等着的小朋友，把宝宝手里的一个玩具轻轻托起来，引导他递过去。"
      }
    ]
  },
  {
    lemma: "hug",
    forms: ["hug", "hugs", "hugged", "hugging"],
    senses: [
      {
        key: "n", pos: "n.", zh: "抱抱",
        example: { en: "Come here, give me a hug.", zh: "过来，抱抱。" },
        tip: "蹲下来张开双臂等孩子扑过来，抱住的那一刻再说一次。"
      },
      {
        key: "v", pos: "v.", zh: "抱一抱",
        example: { en: "We're going now — go hug Grandma!", zh: "我们要走啦，去抱抱奶奶！" },
        tip: "把孩子轻轻朝奶奶的方向送一送，边送边说，别硬推。"
      }
    ]
  },
  {
    lemma: "try",
    forms: ["try", "tries", "tried", "trying"],
    senses: [
      {
        key: "v", pos: "v.", zh: "试一试",
        example: { en: "You can do it. Try again!", zh: "你可以的。再试一次！" },
        tip: "把东西放回孩子手里，自己退后半步，给他空间自己再来一次。"
      }
    ]
  },
  {
    lemma: "stop",
    forms: ["stop", "stops", "stopped", "stopping"],
    senses: [
      {
        key: "v", pos: "v.", zh: "停下",
        example: { en: "Stop! Wait for me.", zh: "停一下！等等我。" },
        tip: "说的同时伸出手掌做出「停」的手势，声音和手势一起到，宝宝反应更快。"
      }
    ]
  },
  {
    lemma: "listen",
    forms: ["listen", "listens", "listened", "listening"],
    senses: [
      {
        key: "v", pos: "v.", zh: "听",
        example: { en: "Listen! Do you hear the birds?", zh: "听！听到小鸟了吗？" },
        tip: "停下脚步，把手拢在耳朵后面，和宝宝一起安静三秒钟再说话。"
      }
    ]
  },
  {
    lemma: "clean",
    forms: ["clean", "cleans", "cleaned", "cleaning"],
    senses: [
      {
        key: "adj", pos: "adj.", zh: "干净的",
        example: { en: "All clean! Look at those hands.", zh: "干干净净啦！看看这双小手。" },
        tip: "洗完把宝宝的手举起来翻给他看，边看边说，让他自己确认「干净」的样子。"
      },
      {
        key: "v", pos: "v.", zh: "收拾；打扫",
        example: { en: "Let's clean up the toys together.", zh: "我们一起把玩具收好。" },
        tip: "自己先捡一个玩具放进箱子做示范，再把箱子推到孩子面前。"
      }
    ]
  },
  {
    lemma: "wipe",
    forms: ["wipe", "wipes", "wiped", "wiping"],
    senses: [
      {
        key: "v", pos: "v.", zh: "擦一擦",
        example: { en: "Let me wipe your mouth.", zh: "我帮你擦擦嘴。" },
        tip: "先用纸巾在孩子手背上碰一下预告，再擦嘴，突然上手他会躲。"
      },
      {
        key: "n", pos: "n.", zh: "湿巾（常用复数 wipes）",
        example: { en: "Can you pass me a wipe?", zh: "帮我拿一张湿巾好吗？" },
        tip: "指着湿巾盒请孩子抽一张递给你，把「帮忙」变成每天的小任务。"
      }
    ]
  },

  // ── Caregiving nouns ──────────────────────────────────
  {
    lemma: "bath",
    forms: ["bath", "baths"],
    senses: [
      {
        key: "n", pos: "n.", zh: "洗澡",
        example: { en: "Bath time! In you go!", zh: "洗澡时间！进去咯！" },
        tip: "抱起宝宝走向浴室时说，每次都用同一句，慢慢就成了洗澡的信号。"
      }
    ]
  },
  {
    lemma: "diaper",
    forms: ["diaper", "diapers"],
    senses: [
      {
        key: "n", pos: "n.", zh: "尿布；纸尿裤",
        example: { en: "Let's change your diaper. Nice and clean!", zh: "我们来换尿布。干干净净的！" },
        tip: "先把干净尿布举给宝宝看一眼再开始换，边换边说，让他知道接下来会发生什么。"
      }
    ]
  },
  {
    lemma: "spoon",
    forms: ["spoon", "spoons"],
    senses: [
      {
        key: "n", pos: "n.", zh: "勺子",
        example: { en: "Can you use your spoon?", zh: "你能自己用勺子吗？" },
        tip: "把勺子放进宝宝手里，握着他的手舀起一口，再慢慢松开让他自己送进嘴里。"
      }
    ]
  },
  {
    lemma: "bottle",
    forms: ["bottle", "bottles"],
    senses: [
      {
        key: "n", pos: "n.", zh: "奶瓶",
        example: { en: "Here's your bottle. Nice and warm.", zh: "奶瓶来啦。温温的。" },
        tip: "先把奶瓶贴一下自己的手腕试温度，再递给宝宝，边试边说。"
      }
    ]
  },
  {
    lemma: "potty",
    forms: ["potty", "potties"],
    senses: [
      {
        key: "n", pos: "n.", zh: "小马桶；（go potty）上厕所",
        example: { en: "Do you need to go potty?", zh: "要不要去尿尿？" },
        tip: "指指小马桶蹲下来问，每天在固定的几个时间点问一次，比等他憋不住再问有效。"
      }
    ]
  },
  {
    lemma: "snack",
    forms: ["snack", "snacks"],
    senses: [
      {
        key: "n", pos: "n.", zh: "点心；加餐",
        example: { en: "Snack time! Are you hungry?", zh: "加餐时间！饿了吗？" },
        tip: "把小碗放上桌、拉开椅子时说，让这个词和坐下吃点心的动作绑在一起。"
      }
    ]
  },
  {
    lemma: "water",
    forms: ["water", "waters", "watered", "watering"],
    senses: [
      {
        key: "n", pos: "n.", zh: "水",
        example: { en: "Here's some water. Take a sip.", zh: "水在这儿，小口抿一下。" },
        tip: "把水杯递到宝宝手边，手扶着杯底陪他喝完这一口。"
      },
      {
        key: "v", pos: "v.", zh: "浇水",
        example: { en: "Let's water the plants. Just a little!", zh: "我们来给花浇浇水。一点点就好！" },
        tip: "把小水壶交到孩子手里，扶着他的手往花盆里倒一点点。"
      }
    ]
  },
  {
    lemma: "blanket",
    forms: ["blanket", "blankets"],
    senses: [
      {
        key: "n", pos: "n.", zh: "小毯子；被子",
        example: { en: "Let's get your blanket. Nice and cozy!", zh: "去拿你的小毯子。暖暖和和的！" },
        tip: "牵着孩子一起去拿毯子，盖好的那一刻再说一次「cozy」。"
      }
    ]
  },
  {
    lemma: "bib",
    forms: ["bib", "bibs"],
    senses: [
      {
        key: "n", pos: "n.", zh: "围兜；口水巾",
        example: { en: "Bib on! Time to eat.", zh: "戴上围兜！要吃饭啦。" },
        tip: "举起围兜在宝宝面前晃一晃再给他戴上，戴好就开饭，形成固定顺序。"
      }
    ]
  },
  {
    lemma: "stroller",
    forms: ["stroller", "strollers"],
    senses: [
      {
        key: "n", pos: "n.", zh: "婴儿推车",
        example: { en: "Into the stroller! Let's go outside.", zh: "坐进推车！我们出门啦。" },
        tip: "拍拍推车的座位，抱宝宝坐进去、扣安全带的时候说。"
      }
    ]
  },
  {
    lemma: "pacifier",
    forms: ["pacifier", "pacifiers"],
    senses: [
      {
        key: "n", pos: "n.", zh: "安抚奶嘴",
        example: { en: "Where's your pacifier? There it is!", zh: "你的安抚奶嘴呢？在这儿呢！" },
        tip: "假装到处找一找，再举起来给宝宝看，把找东西变成一个小游戏。"
      }
    ]
  },

  // ── Behavior / emotion words (discipline and praise moments) ──
  {
    lemma: "gentle",
    forms: ["gentle", "gentler", "gentlest", "gently"],
    senses: [
      {
        key: "adj", pos: "adj.", zh: "轻轻的；温柔的",
        example: { en: "Be gentle with the kitty.", zh: "对小猫要轻轻的哦。" },
        tip: "握着宝宝的手放慢速度摸一下小猫，让他的手先感受到「轻」是什么样子。"
      },
      {
        key: "adv", pos: "adv.", zh: "轻轻地（gently）",
        example: { en: "Gently, gently. Nice and soft.", zh: "轻轻的，轻轻的。软软的、柔柔的。" },
        tip: "自己先用一根手指示范轻轻地摸，再牵着宝宝的手照做一遍。"
      }
    ]
  },
  {
    lemma: "careful",
    forms: ["careful", "carefully"],
    senses: [
      {
        key: "adj", pos: "adj.", zh: "小心",
        example: { en: "Careful — that's hot!", zh: "小心，那个烫！" },
        tip: "把手掌横在孩子和烫的东西之间挡一下，边挡边说，动作先到位再解释。"
      },
      {
        key: "adv", pos: "adv.", zh: "小心地（carefully）",
        example: { en: "Carry it carefully. Two hands!", zh: "小心地端着。两只手哦！" },
        tip: "把碗放进孩子的两只手里，帮他摆好手的位置再松开。"
      }
    ]
  },
  {
    lemma: "hungry",
    forms: ["hungry", "hungrier", "hungriest"],
    senses: [
      {
        key: "adj", pos: "adj.", zh: "饿了",
        example: { en: "Are you hungry? Let's get you some food.", zh: "饿了吗？我们去吃点东西。" },
        tip: "摸摸自己的肚子做出饿的表情再问，动作帮宝宝把这个词和身体感觉对上。"
      }
    ]
  },
  {
    lemma: "thirsty",
    forms: ["thirsty", "thirstier", "thirstiest"],
    senses: [
      {
        key: "adj", pos: "adj.", zh: "渴了",
        example: { en: "Thirsty? Here's your water.", zh: "渴了吗？水给你。" },
        tip: "一边问一边把水杯递过去，让词和喝水的动作同时发生。"
      }
    ]
  },
  {
    lemma: "sleepy",
    forms: ["sleepy", "sleepier", "sleepiest"],
    senses: [
      {
        key: "adj", pos: "adj.", zh: "困了",
        example: { en: "You look sleepy. Let's go to bed.", zh: "你看起来困啦。我们去睡觉。" },
        tip: "看到宝宝揉眼睛、打哈欠的那一刻说，把他身上的动作和这个词对上。"
      }
    ]
  },
  {
    lemma: "tired",
    forms: ["tired"],
    senses: [
      {
        key: "adj", pos: "adj.", zh: "累了",
        example: { en: "Are you tired? Let's take a little break.", zh: "累了吗？我们歇一会儿。" },
        tip: "牵着孩子在旁边一起坐下来，坐下的动作本身就是这个词的意思。"
      }
    ]
  },
  {
    lemma: "wet",
    forms: ["wet", "wetter", "wettest"],
    senses: [
      {
        key: "adj", pos: "adj.", zh: "湿了",
        example: { en: "Uh-oh, your socks are wet. Let's change them.", zh: "哎呀，袜子湿了。我们换一双。" },
        tip: "先摸一下湿袜子，再摸摸宝宝的手，让他感受到「湿」，然后再换。"
      }
    ]
  },
  {
    lemma: "dirty",
    forms: ["dirty", "dirtier", "dirtiest"],
    senses: [
      {
        key: "adj", pos: "adj.", zh: "脏了",
        example: { en: "Your hands are dirty. Let's wash them.", zh: "手脏脏了。我们去洗一洗。" },
        tip: "翻开宝宝的手心指给他看脏在哪里，再牵着他走去水池。"
      }
    ]
  },
  {
    lemma: "hot",
    forms: ["hot", "hotter", "hottest"],
    senses: [
      {
        key: "adj", pos: "adj.", zh: "烫；热",
        example: { en: "Careful, it's hot! Let's blow on it.", zh: "小心，很烫！我们吹一吹。" },
        tip: "自己先对着食物吹几下做示范，再请宝宝跟着吹，吹完再喂。"
      }
    ]
  },
  {
    lemma: "scared",
    forms: ["scared"],
    senses: [
      {
        key: "adj", pos: "adj.", zh: "害怕",
        example: { en: "Were you scared? I'm right here.", zh: "刚才吓到了吗？我就在这儿。" },
        tip: "先把孩子搂进怀里抱一会儿，等呼吸平稳了再说话，身体安抚要走在语言前面。"
      }
    ]
  },
  {
    lemma: "proud",
    forms: ["proud", "prouder", "proudest"],
    senses: [
      {
        key: "adj", pos: "adj.", zh: "为你骄傲",
        example: { en: "I'm so proud of you for trying that.", zh: "你愿意去试，我真为你骄傲。" },
        tip: "蹲下来看着孩子的眼睛说，并且把夸奖对准他刚做的那件具体的事，而不是夸他聪明。"
      }
    ]
  },
  {
    lemma: "brave",
    forms: ["brave", "braver", "bravest"],
    senses: [
      {
        key: "adj", pos: "adj.", zh: "勇敢",
        example: { en: "That was brave! You climbed all the way up.", zh: "刚才好勇敢！你自己爬到最上面了。" },
        tip: "指着孩子刚爬过的地方，边指边说他哪里勇敢，让夸奖有具体的落点。"
      }
    ]
  },
  {
    lemma: "hurt",
    forms: ["hurt", "hurts", "hurting"],
    senses: [
      {
        key: "v", pos: "v.", zh: "疼；弄疼",
        example: { en: "Does it hurt? Let me see.", zh: "疼吗？我看看。" },
        tip: "轻轻托起孩子磕到的地方看一看，语气放平静——大人先不慌，孩子才不会更慌。"
      }
    ]
  },
  {
    lemma: "sorry",
    forms: ["sorry"],
    senses: [
      {
        key: "adj", pos: "adj.", zh: "对不起",
        example: { en: "I'm sorry, buddy. That was my fault.", zh: "对不起，宝贝。是我不好。" },
        tip: "蹲到孩子的视线高度说，父母自己道歉一次，比让孩子说十次都管用。"
      }
    ]
  },
  {
    lemma: "quiet",
    forms: ["quiet", "quieter", "quietest"],
    senses: [
      {
        key: "adj", pos: "adj.", zh: "小小声；安静",
        example: { en: "Let's use quiet voices in here.", zh: "在这里我们要小小声说话。" },
        tip: "自己先把音量压到接近耳语，孩子会跟着模仿你的音量，比喊「安静」有效。"
      }
    ]
  },
  {
    lemma: "watch",
    forms: ["watch", "watches", "watched", "watching"],
    senses: [
      {
        key: "v", pos: "v.", zh: "看着；注意看",
        example: { en: "Watch me — I'll show you how.", zh: "看着我，我做给你看。" },
        tip: "先把孩子的注意力引到你手上，用慢动作做一遍，再把东西交给他试。"
      },
      {
        key: "n", pos: "n.", zh: "手表",
        example: { en: "Look at Daddy's watch. Tick tock!", zh: "看爸爸的手表。滴答滴答！" },
        tip: "把手表凑到宝宝耳边让他听滴答声，边听边说这个词。"
      }
    ]
  },

];
