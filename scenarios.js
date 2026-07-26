// ── LittleLingos scenario data ──────────────────────────
window.scenarios = {

  bath: {
    icon: "🛁", name: "洗澡时间", color: "var(--blue)",
    phrases: {
      "0-1": [
        { id:"b01", en:"Bath time!", zh:"洗澡时间！", tip:"在你抱起宝宝走向浴室时重复说，建立条件反射。" },
        { id:"b02", en:"Warm water. Nice and warm.", zh:"温温的水，暖暖的。", tip:"用手把温水轻轻淋在宝宝的手上和肚子上，边淋边说，让宝宝感受水温。" },
        { id:"b03", en:"Kick kick kick!", zh:"踢踢踢！", tip:"轻轻带动宝宝的小脚在水里踢动，边说边做。" },
        { id:"b04", en:"In you go!", zh:"进去咯！", tip:"放入浴盆时说，声调轻快，配合动作。" },
        { id:"b05", en:"Look at the bubbles!", zh:"看泡泡！", tip:"手指指向泡沫，吸引宝宝视线，培养注意力。" },
      ],
      "1-2": [
        { id:"b11", en:"Let's splash! Kick kick kick!", zh:"让我们溅水！踢踢踢！", tip:"带动宝宝双脚踢水，重复的节奏帮助宝宝预测和记住词汇。" },
        { id:"b12", en:"Where's your tummy? There it is!", zh:"肚子在哪里？在这里！", tip:"边说边点点宝宝的肚子再假装找不到，用躲猫猫的方式命名身体部位。" },
        { id:"b13", en:"Scrub scrub scrub! Clean clean clean!", zh:"刷刷刷！干净干净！", tip:"边说边模仿搓洗动作，让宝宝觉得洗澡是游戏。" },
        { id:"b14", en:"Look at the bubbles! Pop pop!", zh:"看泡泡！啵啵啵！", tip:"手指轻戳泡泡同时说pop，音效词对宝宝很吸引。" },
        { id:"b15", en:"Warm water! Is it warm?", zh:"暖和的水！暖不暖？", tip:"把宝宝的小手放进水里感受水温，边说边等他点头或回应。" },
        { id:"b16", en:"All done! Squeaky clean!", zh:"洗好了！干净溜溜！", tip:"洗完时说，配合毛巾包裹的动作，形成仪式感。" },
      ],
      "2-3": [
        { id:"b21", en:"Can you wash your tummy? Where's your tummy?", zh:"你能洗肚肚吗？肚肚在哪？", tier:"basic",
          tip:"把宝宝的小手放到他的肚子上，引导他自己搓一搓。",
          why:"让宝宝参与自己的洗澡，自主行动强化词汇记忆，比父母帮洗学得更快",
          next:"「Good job! Now let's do your arms!」继续引导下一个身体部位",
          fallback:"先指着自己的肚子说「My tummy!」再指向宝宝，示范比提问更有效" },
        { id:"b22", en:"What color is your duck?", zh:"你的小鸭子是什么颜色？", tier:"basic",
          tip:"举起宝宝的小鸭子玩具在他眼前转一转，边转边问它的颜色。",
          why:"问题句让宝宝主动思考，这是最有效的语言习得方式",
          next:"「Yellow! It's a yellow duck. Can you say yellow?」重复颜色词，不纠正发音",
          fallback:"改为「Yellow duck!」指着颜色说，转为陈述句降低难度" },
        { id:"b23", en:"Close your eyes! Here comes the shampoo!", zh:"闭上眼睛！洗发水来咯！", tier:"basic",
          tip:"用手在宝宝额前挡住水流，边说边慢慢往下淋，提前预告减少抵触。",
          why:"预告行动让宝宝心理上做好准备，是减少洗头抵触最有效的方式",
          next:"「Almost done! One more rinse...」进度提示帮助宝宝预期结束",
          fallback:"用玩具先演示洗头，再给宝宝，降低实际洗头的抵触感" },
        { id:"b24", en:"Let's wash your hair now! Are you ready?", zh:"现在来洗头发！准备好了吗？", tier:"basic",
          tip:"举起洗发水瓶给宝宝看一看，边说边等他点头再开始。",
          why:"用问句给宝宝参与感，让他自己点头或说「好」，感受到被尊重和参与",
          next:"「Tip your head back. Good! Water time!」分步骤引导配合动作",
          fallback:"唱歌版：「Wash wash wash your hair, gently now~」旋律帮助配合" },
        { id:"b25", en:"Are you all clean? Let me check... yes! Squeaky clean!", zh:"都洗干净了吗？我来看看……是的！干净溜溜！", tier:"expressive",
          tip:"夸张地检查宝宝的手脚，变成游戏。",
          why:"Squeaky clean 是生动的表达，宝宝喜欢这种夸张的声音感",
          next:"「Let's wrap you up! Cozy cozy!」用毛巾包裹宝宝时说",
          fallback:"简化为「All done! Clean!」加竖大拇指，视觉反馈很有效" },
      ],
      "3-6": [
        { id:"b31", en:"Okay, it's bath time! Can you get undressed by yourself?", zh:"好了，洗澡时间！你能自己脱衣服吗？", tip:"把宝宝的衣角递到他手里，退后一步，让他自己试着脱。" },
        { id:"b32", en:"What toys do you want to bring in the bath?", zh:"你想带什么玩具去洗澡？", tip:"指向浴室架上的几个玩具，让宝宝伸手指出想带哪个。" },
        { id:"b33", en:"Let's count your toes! One, two, three...", zh:"我们数数脚趾！一、二、三……", tip:"洗脚时数数，寓教于乐。" },
        { id:"b34", en:"Almost done. Can you rinse your hair by yourself?", zh:"快好了。你能自己冲头发吗？", tip:"把花洒递到孩子手里，站在旁边看着他自己冲头发。" },
        { id:"b35", en:"Great job washing up! You're so responsible!", zh:"洗得真好！你好负责任！", tip:"边说边指着他刚洗干净的手臂或身体部位，让夸奖对上具体动作。" },
      ],
    }
  },

  meal: {
    icon: "🍚", name: "吃饭时间", color: "var(--green)",
    phrases: {
      "0-1": [
        { id:"m01", en:"Yummy yummy!", zh:"好好吃！", tip:"用夸张表情和愉快语气说，传递积极情绪。" },
        { id:"m02", en:"Open wide! Here comes the airplane!", zh:"嘴巴张大！飞机来咯！", tip:"经典喂食游戏，勺子像飞机飞进嘴里。" },
        { id:"m03", en:"One more bite. Yum!", zh:"再吃一小口。好吃！", tip:"把勺子轻轻送到宝宝嘴边，用愉快的语气说。" },
        { id:"m04", en:"All done! Empty bowl!", zh:"吃完啦！碗空空！", tip:"拿起空碗轻轻晃一晃给宝宝看，语气轻快。" },
      ],
      "1-2": [
        { id:"m11", en:"Open wide! Here comes the airplane! Vroom!", zh:"嘴巴张大！飞机来咯！呜——", tip:"把勺子当飞机，配合呜的音效，让吃饭更有趣。" },
        { id:"m12", en:"Yummy! Do you want more?", zh:"好吃！还要吗？", tip:"端着碗轻轻凑近再收回，边问边等宝宝用手势或词表达还要不要。" },
        { id:"m13", en:"All done? Let's clean your hands.", zh:"吃完了？我们洗手手。", tip:"说着就牵起宝宝的手走向水池，把话和洗手的动作连起来。" },
        { id:"m14", en:"Mmm, that's broccoli! Green!", zh:"嗯，这是西兰花！绿色的！", tip:"用勺子举起那块西兰花给宝宝看一看，边指边说出名字和颜色。" },
        { id:"m15", en:"Big bite! Good job!", zh:"大口吃！好棒！", tip:"宝宝咽下一口时立刻竖起大拇指，边比边夸。" },
      ],
      "2-3": [
        { id:"m21", en:"What would you like to eat? Rice or noodles?", zh:"你想吃什么？米饭还是面条？", tier:"basic",
          tip:"两只手各端一样食物举到宝宝面前，让他伸手指出想要的。",
          why:"两选一结构完美：给宝宝真实选择权同时教了两个词汇",
          next:"「Rice! Good choice! Let's get the rice!」重复宝宝的选择强化词汇",
          fallback:"把两碗放在宝宝面前，让他用手指选，接受非语言回答" },
        { id:"m22", en:"That's broccoli! Can you say broccoli?", zh:"这是西兰花！你能说西兰花吗？", tier:"basic",
          tip:"用勺子指着那块西兰花，边点边邀请宝宝跟着说。",
          why:"命名后马上邀请重复——发音不重要，宝宝尝试的意愿才是学习在发生的信号",
          next:"「Bro-co-li! Three parts!」夸张分音节，把发音变成游戏",
          fallback:"改为「Green! Broccoli is green!」先教颜色再教名字，降低难度" },
        { id:"m23", en:"Mmm, yummy! Do you like it?", zh:"嗯，好好吃！你喜欢吗？", tier:"basic",
          tip:"自己先夸张地做出好吃的表情摸摸肚子，再问宝宝好不好吃。",
          why:"先示范评价再提问，给宝宝语言脚手架——他可以模仿说 yummy 无需完整回答",
          next:"「What else do you want? More rice?」趁势扩展对话",
          fallback:"自己做出「Mmm!」表情，宝宝会模仿面部表情和声音" },
        { id:"m24", en:"Can you use your spoon?", zh:"你能用勺子吃吗？", tier:"basic",
          tip:"把勺子放进宝宝手里，握着他的手舀一口再慢慢松开。",
          why:"语言+具体行动一体，语言学习在做事情过程中效果最佳",
          next:"「Hold it like this. Good grip!」示范握法给语言支架",
          fallback:"先帮宝宝握好勺子，说「Together! Our spoon.」再慢慢放手" },
        { id:"m25", en:"Almost done! Two more bites!", zh:"快吃完了！再吃两口！", tier:"expressive",
          tip:"竖起两根手指给宝宝看，边比边说还剩两口。",
          why:"具体数字给宝宝可预测的终点，减少进食抗拒",
          next:"「One more! Last one! You did it!」倒计时庆祝完成",
          fallback:"改为「One bite? Just one?」把目标降到最低，更容易接受" },
      ],
      "3-6": [
        { id:"m31", en:"What do you want for breakfast today?", zh:"今天早饭想吃什么？", tip:"蹲到孩子视线高度，指着冰箱或几样食物问，等他自己说出选择。" },
        { id:"m32", en:"Let's try the carrots! They're so crunchy and sweet!", zh:"试试胡萝卜！又脆又甜！", tip:"夹起一根胡萝卜举到孩子眼前晃一晃，边说它又脆又甜，邀请孩子咬一口。" },
        { id:"m33", en:"How does it taste? Sweet? Sour? Salty?", zh:"味道怎么样？甜？酸？咸？", tip:"指着孩子正在嚼的食物，掰着手指一个个说甜、酸、咸让他选。" },
        { id:"m34", en:"Can you help set the table?", zh:"你能帮忙摆碗筷吗？", tip:"把一摞碗筷递到孩子手里，指着餐桌请他帮忙摆。" },
        { id:"m35", en:"You tried something new today! I'm so proud of you!", zh:"你今天尝试了新东西！我真为你骄傲！", tip:"蹲下来搂住孩子，边抱边具体夸他今天尝试了新东西。" },
      ],
    }
  },

  bedtime: {
    icon: "🌙", name: "睡前时间", color: "var(--purple)",
    phrases: {
      "0-1": [
        { id:"d01", en:"Time for sleep, little one.", zh:"睡觉时间了，小宝贝。", tip:"把灯光调暗、轻拍宝宝的后背，用最柔和的语气说，建立睡前信号。" },
        { id:"d02", en:"Shh... it's sleepy time.", zh:"嘘……要睡觉咯。", tip:"把灯调暗、竖起手指嘘一声，音量逐渐放低帮宝宝安静下来。" },
        { id:"d03", en:"Close your eyes. Good night.", zh:"闭上眼睛。晚安。", tip:"可以轻轻盖上宝宝的眼皮，配合动作。" },
        { id:"d04", en:"I love you. Sweet dreams.", zh:"我爱你。做个好梦。", tip:"俯身在宝宝额头轻轻一吻，每晚重复相同的话建立安全感。" },
      ],
      "1-2": [
        { id:"d11", en:"It's bedtime! Time to say good night.", zh:"睡觉时间！该说晚安了。", tip:"调暗灯光牵起宝宝的手，用轻快但不刺激的语气宣布睡前开始。" },
        { id:"d12", en:"Let's brush your little teeth! Up up up, down down down!", zh:"刷刷小牙齿！上上上，下下下！", tip:"边说边做刷牙动作，节奏感让宝宝更配合。" },
        { id:"d13", en:"Into your cozy bed! Snuggle in!", zh:"钻进暖暖的小床！窝进来吧！", tip:"帮宝宝盖好被子时说，配合动作增强词汇理解。" },
        { id:"d14", en:"I love you so much. Good night, sleep tight!", zh:"我好爱你。晚安，睡个好觉！", tip:"关灯前俯身抱一抱宝宝，每晚用同样的话结束，给他安全感。" },
        { id:"d15", en:"Let's read one book before sleep. Pick one!", zh:"睡前读一本书。挑一本吧！", tip:"举起两本书让宝宝伸手挑一本，增加参与感和期待感。" },
      ],
      "2-3": [
        { id:"d21", en:"It's almost bedtime. Let's do five more minutes of playtime.", zh:"快要睡觉了。我们再玩五分钟。", tier:"basic",
          tip:"竖起五根手指给宝宝看，边比边说再玩五分钟就睡觉。",
          why:"提前预告并给缓冲时间，是减少睡前哭闹的核心技术",
          next:"「Okay, five minutes are up! Let's get pajamas!」兑现承诺，宝宝会建立信任",
          fallback:"用手机定时器辅助——让规则客观化，减少亲子冲突" },
        { id:"d22", en:"What was your favorite thing today?", zh:"今天你最喜欢什么？", tier:"expressive",
          tip:"关灯前挨着宝宝躺下，摸摸他的头问今天最喜欢什么。",
          why:"睡前回顾帮宝宝处理情绪、整合记忆，也是英语高级表达的最佳练习场景",
          next:"「That sounds so fun! Tell me more.」或「I liked that too!」父母分享让对话继续",
          fallback:"改为「Did you have fun today? Yes?」封闭式问题，点头就能回答" },
        { id:"d23", en:"Let's count the stars! One, two, three...", zh:"我们数星星！一、二、三……", tier:"basic",
          tip:"看窗外或天花板上的贴纸，把入睡引导变成游戏。",
          why:"数数节奏帮助大脑从兴奋过渡到平静，星星提供视觉焦点",
          next:"「I see so many! Can you see the big one?」引导视线转移",
          fallback:"用天花板灯点当星星，或指贴纸，室内也完全成立" },
        { id:"d24", en:"You had such a good day. I'm proud of you.", zh:"你今天真的很棒。我为你骄傲。", tier:"expressive",
          tip:"俯身抱一抱入睡前的宝宝，在他耳边说这句正向的话。",
          why:"睡前无条件正向肯定，是建立孩子安全感和自信心最重要的语言行为",
          next:"「I love you so much. You make me so happy.」用爱的句子结束一天",
          fallback:"如果宝宝不理解，用拥抱配合，非语言的爱同样有力量" },
        { id:"d25", en:"Close your eyes. I'll be right here.", zh:"闭上眼睛。我就在这里。", tier:"basic",
          tip:"坐到床边握住宝宝的手，边轻拍边说我就在这里。",
          why:"分离焦虑的核心是「你会不会走」——这句话直接回应，是最重要的睡前安慰语",
          next:"「I'm right outside. If you need me, just call me.」具体说明去哪里",
          fallback:"如果宝宝抓着你，说「I'm here. I'm staying.」暂时留下再慢慢过渡" },
      ],
      "3-6": [
        { id:"d31", en:"Okay, it's time to wind down. What do you need before bed?", zh:"好了，该放松一下了。睡前你需要什么？", tip:"调暗灯光蹲到孩子面前，让他自己说出睡前需要做什么。" },
        { id:"d32", en:"Let's talk about the best part of your day.", zh:"我们聊聊今天最棒的事。", tip:"关灯后挨着孩子躺下，摸摸他的头请他讲讲今天最棒的事。" },
        { id:"d33", en:"You were so brave today. Remember when you...?", zh:"你今天好勇敢。还记得你……那一次吗？", tip:"搂着孩子的肩，具体回忆今天一个勇敢的时刻讲给他听。" },
        { id:"d34", en:"Lights out! Sleep is how you grow big and strong!", zh:"关灯！睡觉可以让你长高变强壮！", tip:"伸手关掉灯，捏捏孩子的手臂说睡觉能让你长高变强壮。" },
        { id:"d35", en:"Good night. I love you to the moon and back.", zh:"晚安。我爱你，爱到月亮，再从月亮爱回来。", tip:"搂着孩子指一指窗外的月亮，边指边说这句经典的睡前情话。" },
      ],
    }
  },

  emotion: {
    icon: "🤗", name: "情绪安慰", color: "var(--accent)",
    phrases: {
      "0-1": [
        { id:"e01", en:"I'm here. You're safe.", zh:"我在这里。你很安全。", tip:"紧紧抱住宝宝，平稳声音比内容更重要。" },
        { id:"e02", en:"It's okay. It's okay.", zh:"没事的。没事的。", tip:"轻轻摇晃宝宝、拍拍他的后背，让规律的动作配合重复的话语；重复能给宝宝节奏感和安全感。" },
        { id:"e03", en:"I'm here.", zh:"我在呢。", tip:"把宝宝抱到胸前贴紧，边轻拍边说，让他感到你就在这里。" },
      ],
      "1-2": [
        { id:"e11", en:"I know, I know. It's okay.", zh:"我知道，我知道。没事的。", tip:"把宝宝抱进怀里轻轻晃，先说我知道认可情绪再慢慢安抚。" },
        { id:"e12", en:"Come here. I've got you.", zh:"过来。我抱着你。", tip:"张开双臂，同时说这句话，让宝宝知道你随时可以接住他。" },
        { id:"e13", en:"That was scary, wasn't it?", zh:"刚才好吓人，对不对？", tip:"蹲下来搂着宝宝拍拍他的背，边拍边替他把害怕说出来。" },
        { id:"e14", en:"Whoa, big feelings! You're okay, you're okay.", zh:"哇，好大的情绪！你没事，你没事的。", tip:"张开双臂把宝宝搂过来，边抱边说有大情绪没关系。" },
        { id:"e15", en:"You're safe. I'm right here.", zh:"你很安全。我就在这里。", tip:"蹲到宝宝面前把他搂进怀里、额头贴额头，边抱边轻声说这句话；抱稳后再查看有没有磕碰。" },
      ],
      "2-3": [
        { id:"e21", en:"I can see you're feeling upset. That's okay.", zh:"我看到你不高兴了。没关系的。", tip:"蹲到宝宝视线高度看着他的眼睛，边看边说我看到你不高兴了。" },
        { id:"e22", en:"Do you need a hug?", zh:"需要抱抱吗？", tip:"张开双臂等在宝宝面前，边问边让他自己决定要不要抱。" },
        { id:"e23", en:"What happened? Tell me.", zh:"发生什么了？告诉我。", tip:"蹲下来握住宝宝的手，看着他的眼睛请他告诉你发生了什么。" },
        { id:"e24", en:"It's hard, isn't it? I understand.", zh:"这很难，对不对？我理解。", tip:"挨着宝宝坐下轻轻揽住他的肩，边靠边说这很难我理解。" },
        { id:"e25", en:"Let's take a deep breath together. In... and out.", zh:"我们一起深呼吸。吸气……呼气。", tip:"一只手放在自己肚子上、另一只手轻放在宝宝肚子上，用鼻子慢慢吸气再从嘴巴慢慢呼气，让宝宝感受到肚子起伏的节奏跟着一起做。" },
      ],
      "3-6": [
        { id:"e31", en:"It looks like you're feeling angry. Is that right?", zh:"你好像很生气。对吗？", tip:"蹲到孩子面前看着他的表情，边看边帮他把生气这个词说出来。" },
        { id:"e32", en:"It's okay to feel sad. Want to tell me what happened?", zh:"难过是没关系的。想告诉我发生什么事了吗？", tip:"挨着孩子坐下轻轻搂住他，边靠边说难过没关系想不想说说。" },
        { id:"e33", en:"I'm proud of how you handled that.", zh:"你处理那件事的方式让我很骄傲。", tip:"事后蹲下来拍拍孩子的肩，具体夸他刚才处理情绪的方式。" },
        { id:"e34", en:"Everyone feels frustrated sometimes. Even me.", zh:"每个人有时都会沮丧。连我也会。", tip:"坐到孩子身边指指自己，边说连我有时也会沮丧让他安心。" },
        { id:"e35", en:"What would make you feel better right now?", zh:"你现在需要什么能好一点？", tip:"蹲下来平视孩子，轻轻摸摸他的背，问完安静地等他回答。" },
      ],
    }
  },

  morning: {
    icon: "🌅", name: "起床时间", color: "var(--accent2)",
    phrases: {
      "0-1": [
        { id:"mo01", en:"Good morning!", zh:"早上好！", tip:"轻轻摸摸宝宝的脸颊把他唤醒，每天用同样愉快的语气问好。" },
        { id:"mo02", en:"Wake up, little one!", zh:"醒醒，小宝贝！", tip:"轻轻摸摸宝宝的后背把他唤醒，声音温柔别突然开灯或大声。" },
        { id:"mo03", en:"The sun is up! Rise and shine!", zh:"太阳出来了！起床咯！", tip:"拉开窗帘的同时说，让光线帮助宝宝自然醒来。" },
        { id:"mo04", en:"Stretch! Reach up high!", zh:"伸懒腰！手臂举高高！", tip:"帮宝宝做伸展动作，边说边做，让身体慢慢苏醒。" },
        { id:"mo05", en:"A brand new day!", zh:"新的一天开始了！", tip:"张开双臂把宝宝抱起来，边抱边愉快地迎接新的一天。" },
      ],
      "1-2": [
        { id:"mo11", en:"Good morning! Did you sleep well?", zh:"早上好！睡得好吗？", tip:"俯身摸摸宝宝的头和他对视问好，让他感受到被关心。" },
        { id:"mo12", en:"Rise and shine! Time to wake up!", zh:"起来咯！起床时间！", tip:"重复短句配合轻拍，帮宝宝从睡眠过渡到清醒。" },
        { id:"mo13", en:"Let's stretch! Arms up! Wiggle wiggle!", zh:"伸懒腰！手臂举高！扭一扭！", tip:"拉着宝宝的小手举高高、扭一扭，边做伸展边说。" },
        { id:"mo14", en:"Look! Sunshine! It's morning!", zh:"看！阳光！早上啦！", tip:"指向窗户，帮宝宝建立早晨和白天的时间概念。" },
        { id:"mo15", en:"Yay! Good morning, sunshine!", zh:"太棒了！早上好，小太阳！", tip:"捧着宝宝的小脸亲一下，用昵称说这句早安。" },
      ],
      "2-3": [
        { id:"mo21", en:"Good morning! Are you ready to wake up?", zh:"早上好！准备好起床了吗？", tip:"轻轻掀开一角被子摸摸宝宝，边问边等他准备好起床。" },
        { id:"mo22", en:"Do you want to get up now or in one minute?", zh:"你要现在起来，还是再等一分钟？", tip:"竖起一根手指比一比，边问宝宝现在起来还是再等一分钟。" },
        { id:"mo23", en:"What do you want for breakfast? Eggs or porridge?", zh:"早饭想吃什么？鸡蛋还是粥？", tip:"伸出两只手比划鸡蛋和粥，让宝宝选一样愿意离开被窝。" },
        { id:"mo24", en:"Let's open the curtains! Peek-a-boo, sun!", zh:"我们拉开窗帘！躲猫猫，太阳！", tip:"把拉窗帘变成游戏，吸引宝宝主动起身。" },
        { id:"mo25", en:"Good morning hug! I missed you while you slept!", zh:"早安抱抱！你睡觉时我好想你！", tip:"张开双臂给宝宝一个大大的晨间拥抱，边抱边说。" },
      ],
      "3-6": [
        { id:"mo31", en:"Good morning! Time to get up. Can you do it by yourself?", zh:"早上好！起床时间了。你能自己起来吗？", tip:"掀开被子退后一步，指指孩子鼓励他自己坐起来。" },
        { id:"mo32", en:"What's your plan for today? What are you excited about?", zh:"今天有什么计划？你期待什么？", tip:"坐到床边摸摸孩子，问他今天最期待什么让他想起床。" },
        { id:"mo33", en:"Let's see who can get dressed the fastest!", zh:"我们看看谁穿衣服最快！", tip:"自己也拿起衣服和孩子比赛穿，边穿边喊看谁快。" },
        { id:"mo34", en:"You slept so well! You're all charged up and ready to go!", zh:"你睡得真好！现在浑身充满能量，准备好出发啦！", tip:"捏捏孩子的手臂假装给他充电，边捏边说身体充满了能量。" },
        { id:"mo35", en:"What are you going to do first this morning?", zh:"今天早上你要先做什么？", tip:"扳着手指和孩子一起数晨间要做的事，让他排出先做什么。" },
      ],
    }
  },

  dress: {
    icon: "👕", name: "穿衣服", color: "var(--blue)",
    phrases: {
      "0-1": [
        { id:"dr01", en:"Let's get dressed!", zh:"穿衣服咯！", tip:"抱起宝宝准备换衣时说，建立穿衣的开始信号。" },
        { id:"dr02", en:"Here's your arm. In it goes!", zh:"这是你的小手臂。进去咯！", tip:"边穿边说，帮宝宝建立身体部位和动作的联系。" },
        { id:"dr03", en:"One foot, two feet! All done!", zh:"一只脚，两只脚！穿好了！", tip:"穿裤子或袜子时数脚，自然地引入数字概念。" },
        { id:"dr04", en:"So cozy! Nice and warm!", zh:"好舒服！暖暖的！", tip:"把衣服往下拉平再抱一抱宝宝，边说边让他感受暖暖的舒适。" },
        { id:"dr05", en:"That's your shirt! Hello, shirt!", zh:"这是你的衣服！你好，衣服！", tip:"举起衣服在宝宝眼前挥一挥，像小人偶一样和他打招呼。" },
      ],
      "1-2": [
        { id:"dr11", en:"Arms up! Let's put on your shirt!", zh:"手臂举高！穿衣服啦！", tip:"手势配合语言，让宝宝学会配合穿衣动作。" },
        { id:"dr12", en:"Where did your head go? Peek-a-boo! There you are!", zh:"头去哪里了？躲猫猫！在这里！", tip:"把套头衫变成躲猫猫游戏，宝宝会期待穿衣服。" },
        { id:"dr13", en:"One sock, two socks! Wiggly toes!", zh:"一只袜子，两只袜子！小脚趾扭一扭！", tip:"穿袜子时数数并逗弄脚趾，增加互动乐趣。" },
        { id:"dr14", en:"This is blue! Your shirt is blue!", zh:"这是蓝色！你的衣服是蓝色的！", tip:"拎起衣服在宝宝眼前晃一晃，指着说出它的颜色。" },
        { id:"dr15", en:"All dressed! You look great!", zh:"穿好了！你看起来真棒！", tip:"帮宝宝转个圈照照镜子，边拍手边夸他穿好了。" },
      ],
      "2-3": [
        { id:"dr21", en:"Which shirt do you want? The red one or the blue one?", zh:"你想穿哪件衣服？红色的还是蓝色的？", tip:"两手各举一件衣服到宝宝面前，让他伸手指出想穿哪件。" },
        { id:"dr22", en:"Can you put your arm in here? That's it! Good job!", zh:"你能把手臂放进来吗？就是这样！好棒！", tip:"撑开袖口对准宝宝的小手，扶着他把手臂伸进去。" },
        { id:"dr23", en:"What color are your socks today?", zh:"你今天的袜子是什么颜色？", tip:"指着宝宝脚上的袜子，边指边问他今天是什么颜色。" },
        { id:"dr24", en:"It's cold today! We need a warm jacket!", zh:"今天很冷！我们需要穿暖和的外套！", tip:"拿起外套抖开、假装打个冷颤，边说今天很冷要穿暖。" },
        { id:"dr25", en:"Do you want to try putting on your shoes yourself?", zh:"你想自己试着穿鞋吗？", tip:"把鞋子摆到宝宝脚边，指指鞋口鼓励他自己试着穿。" },
      ],
      "3-6": [
        { id:"dr31", en:"Time to get dressed! Can you pick your outfit today?", zh:"穿衣服时间！今天你来挑衣服好吗？", tip:"拉开衣柜让孩子自己挑今天穿什么，站旁边等他决定。" },
        { id:"dr32", en:"Let's check the weather! Is it hot or cold today?", zh:"我们看看天气！今天热还是冷？", tip:"拉着孩子到窗边看看外面，边看边问今天热还是冷。" },
        { id:"dr33", en:"Can you button your shirt by yourself? Try it!", zh:"你能自己扣扣子吗？试试看！", tip:"把扣子对到扣眼前示范一颗，再把衣襟交给孩子自己扣。" },
        { id:"dr34", en:"You got dressed all by yourself! I'm so proud of you!", zh:"你自己把衣服全穿好了！我真为你骄傲！", tip:"蹲下来和孩子击个掌，具体夸他自己把衣服全穿好了。" },
        { id:"dr35", en:"What are we doing today? Let's dress for that!", zh:"我们今天要做什么？穿适合的衣服吧！", tip:"拿出当天要穿的衣服铺在床上，边指边和孩子聊今天要做什么。" },
      ],
    }
  },

  teeth: {
    icon: "🦷", name: "刷牙时间", color: "var(--teal)",
    phrases: {
      "0-1": [
        { id:"te01", en:"Open up! Let's brush your teeth!", zh:"张开嘴！刷牙啦！", tip:"拿起牙刷在宝宝眼前晃一晃，边说边张开自己的嘴示范。" },
        { id:"te02", en:"Here comes the toothbrush!", zh:"牙刷来咯！", tip:"举着牙刷像小人偶一样让它走到宝宝面前打招呼。" },
        { id:"te03", en:"Up and down! Up and down!", zh:"上下刷！上下刷！", tip:"边刷边有节奏地说，帮宝宝理解刷牙的动作。" },
        { id:"te04", en:"Good teeth! Clean teeth!", zh:"好牙牙！干净牙牙！", tip:"刷完后指着镜子里宝宝的牙齿，边指边夸干净。" },
        { id:"te05", en:"All done! Smile for me!", zh:"刷好了！对我笑一笑！", tip:"刷完后请宝宝展示大笑脸，变成有趣的结尾仪式。" },
      ],
      "1-2": [
        { id:"te11", en:"Brush brush brush! Up and down!", zh:"刷刷刷！上上下下！", tip:"握着宝宝的手一起上下刷，边刷边有节奏地说。" },
        { id:"te12", en:"Open wide! Show me your teeth!", zh:"嘴巴张大！给我看看你的牙齿！", tip:"自己先张大嘴露出牙齿示范，再请宝宝张嘴给你看。" },
        { id:"te13", en:"This is yummy toothpaste! Mmm!", zh:"这是好吃的牙膏！嗯！", tip:"挤一点牙膏给宝宝闻一闻，边闻边做出好香的表情。" },
        { id:"te14", en:"Let's count! One tooth, two teeth, three teeth!", zh:"数一数！一颗牙，两颗牙，三颗牙！", tip:"用牙刷一颗一颗点着宝宝的牙齿数数。" },
        { id:"te15", en:"Spit it out! Good job! Clean teeth!", zh:"吐出来！真棒！牙齿干净啦！", tip:"宝宝吐出泡沫时立刻竖起大拇指，边比边夸。" },
      ],
      "2-3": [
        { id:"te21", en:"How many teeth do you have? Let's count them!", zh:"你有几颗牙齿？我们数一数！", tip:"让宝宝对着镜子张大嘴，你用手指点着数他的牙齿。" },
        { id:"te22", en:"Can you brush the top teeth? Now the bottom ones!", zh:"你能刷上面的牙吗？现在刷下面的！", tip:"先指指上排牙、再指指下排牙，一步步引导宝宝刷。" },
        { id:"te23", en:"Did the sugar bugs go away? Brush them out!", zh:"糖虫虫走了吗？把它们刷走！", tip:"指着宝宝的牙缝假装找糖虫，边说边帮他刷走。" },
        { id:"te24", en:"Two whole minutes! Can you do it?", zh:"刷满两分钟！你能做到吗？", tip:"指着计时器给宝宝看，边刷边比赛看能不能刷满两分钟。" },
        { id:"te25", en:"Rinse and spit! You're a pro!", zh:"漱口吐出来！你真专业！", tip:"递上漱口杯让宝宝漱口吐出，边竖大拇指边夸他真专业。" },
      ],
      "3-6": [
        { id:"te31", en:"Two minutes of brushing! Let's set the timer!", zh:"刷两分钟！我们定个计时器！", tip:"用计时器让刷牙时间变得可见，减少磨蹭。" },
        { id:"te32", en:"Do you know why we brush our teeth? Tell me!", zh:"你知道为什么要刷牙吗？告诉我！", tip:"张开嘴指指自己的牙，问孩子知不知道为什么要刷牙。" },
        { id:"te33", en:"Make sure to brush the back ones too — those are sneaky!", zh:"记得也刷后面的牙齿——它们最容易被忘记！", tip:"张开嘴指指自己最里面的牙，提醒孩子后面的牙也要刷。" },
        { id:"te34", en:"Don't forget to brush your tongue! It gets germs too!", zh:"别忘了刷舌头！舌头上也有细菌！", tip:"伸出舌头做示范，请孩子也轻轻刷一刷舌头。" },
        { id:"te35", en:"Great brushing! Healthy teeth, healthy you!", zh:"刷得真好！牙齿健康，人才健康！", tip:"刷完对着镜子和孩子一起露出大笑脸，边指牙齿边说牙齿健康人才健康。" },
      ],
    }
  },

  handwash: {
    icon: "🫧", name: "洗手时间", color: "var(--blue)",
    phrases: {
      "0-1": [
        { id:"hw01", en:"Hand-washing time! Splash, splash!", zh:"洗手手啦！哗啦哗啦！", tip:"抱着宝宝到水龙头边时说，建立洗手的开始信号。" },
        { id:"hw02", en:"Here's the water. Nice and warm!", zh:"水来了。暖暖的！", tip:"把宝宝的小手伸到温水下，边冲边说暖暖的。" },
        { id:"hw03", en:"Rub rub rub! Soap on!", zh:"搓搓搓！抹上皂！", tip:"帮宝宝搓手时有节奏地说，让动作和语言同步。" },
        { id:"hw04", en:"Rinse it off! All the soap goes bye-bye!", zh:"冲干净！皂皂拜拜！", tip:"把宝宝的手放到水流下冲，边冲边和泡泡说拜拜。" },
        { id:"hw05", en:"Dry your hands! Pat pat pat!", zh:"擦干手！拍拍拍！", tip:"帮宝宝用毛巾时说，配合拍打动作。" },
      ],
      "1-2": [
        { id:"hw11", en:"Time to wash our hands! Turn on the water!", zh:"洗手时间！开水龙头！", tip:"扶着宝宝的手一起拧开水龙头，边开边说。" },
        { id:"hw12", en:"Soap! Rub rub rub! Make bubbles!", zh:"皂皂！搓搓搓！泡泡来了！", tip:"在宝宝手心挤点洗手液，握着他的手搓出泡泡。" },
        { id:"hw13", en:"Look at the bubbles! Scrub between your fingers!", zh:"看泡泡！手指缝也要搓！", tip:"掰开宝宝的手指一根根搓，边搓边指给他看泡泡。" },
        { id:"hw14", en:"Rinse! All gone! Bye-bye, germs!", zh:"冲走！都没了！细菌拜拜！", tip:"把宝宝的手放到水下冲干净，边冲边和细菌说拜拜。" },
        { id:"hw15", en:"Dry dry dry! Clean hands!", zh:"擦擦擦！手手干净了！", tip:"用毛巾把宝宝的手一根根擦干，边擦边夸干净了。" },
      ],
      "2-3": [
        { id:"hw21", en:"Before we eat, what do we do? Wash hands!", zh:"吃饭前要做什么？洗手！", tip:"饭前牵着宝宝走到水池边，边走边一问一答。" },
        { id:"hw22", en:"Can you scrub your palms? Now the backs!", zh:"你能搓手心吗？现在搓手背！", tip:"先搓搓手心再翻过来搓手背，一步步带着宝宝做。" },
        { id:"hw23", en:"We wash hands after playing outside, right?", zh:"在外面玩完要洗手，对不对？", tip:"从外面回来就牵宝宝去水池，边洗边说玩完要洗手。" },
        { id:"hw24", en:"How long do we scrub? Let's count to ten!", zh:"要搓多久？我们数到十！", tip:"握着宝宝的手一边搓一边数到十。" },
        { id:"hw25", en:"Are they clean? Let me see! Wow, so clean!", zh:"洗干净了吗？让我看！哇，好干净！", tip:"夸张地检查，让宝宝为洗干净的手感到自豪。" },
      ],
      "3-6": [
        { id:"hw31", en:"Do you know when we need to wash our hands?", zh:"你知道什么时候需要洗手吗？", tip:"扳着手指和孩子一个个数出该洗手的时候。" },
        { id:"hw32", en:"Soap washes away the germs you can't even see!", zh:"皂皂能把看不见的细菌都洗走！", tip:"把手上的泡泡指给孩子看，边冲边说泡泡把看不见的细菌带走了。" },
        { id:"hw33", en:"Scrub for twenty seconds — as long as singing Happy Birthday twice!", zh:"搓二十秒——就像唱两遍生日歌那么长！", tip:"和孩子一起唱两遍生日歌，边唱边搓够二十秒。" },
        { id:"hw34", en:"Don't forget under your nails! Germs hide there!", zh:"指甲缝也别忘了！细菌藏在那里！", tip:"翻起孩子的手指指着指甲缝，提醒这里也要搓。" },
        { id:"hw35", en:"After the bathroom, always wash hands. It's the rule!", zh:"上完厕所一定要洗手。这是规定！", tip:"上完厕所牵着孩子直接走到水池边，边洗边说这是规定。" },
      ],
    }
  },

  reading: {
    icon: "📚", name: "亲子阅读", color: "var(--teal)",
    phrases: {
      "0-1": [
        { id:"rd01", en:"Look at the picture! Look look look!", zh:"看这幅图！看呀，看呀！", tip:"手指指向图片，吸引宝宝视线，共同关注是语言的基础。" },
        { id:"rd02", en:"A dog! Woof woof!", zh:"小狗！汪汪！", tip:"指着书上的小狗，边指边学它汪汪叫。" },
        { id:"rd03", en:"This is red. Red ball!", zh:"这是红色的。红色球球！", tip:"手指点着书上的红色球球，边点边说出颜色和名字。" },
        { id:"rd04", en:"Turn the page! Flip flip!", zh:"翻页咯！翻翻翻！", tip:"握着宝宝的小手一起翻页，感受翻书的动作。" },
        { id:"rd05", en:"So cute! Look at the baby!", zh:"好可爱！看这个小宝宝！", tip:"指向书中的婴儿，宝宝对同龄形象特别感兴趣。" },
      ],
      "1-2": [
        { id:"rd11", en:"What's that? Point to the dog!", zh:"那是什么？指指小狗！", tip:"拉着宝宝的手一起指向书上的小狗。" },
        { id:"rd12", en:"The cat says meow! Can you say meow?", zh:"猫咪说喵！你能说喵吗？", tip:"指着书上的猫咪学一声喵，再指指宝宝邀请他也喵一声。" },
        { id:"rd13", en:"Where's the ball? Find the ball!", zh:"球球在哪里？找找球球！", tip:"用手指在画面上到处找，边找边问球球在哪里。" },
        { id:"rd14", en:"Big elephant! Little mouse! Big, little!", zh:"大大的大象！小小的老鼠！大，小！", tip:"手指先张大比大象、再捏小比老鼠，边比边说大和小。" },
        { id:"rd15", en:"Again! Should we read it again?", zh:"再读！要再读一遍吗？", tip:"翻回第一页举给宝宝看，边翻边问要不要再读一遍。" },
      ],
      "2-3": [
        { id:"rd21", en:"What do you think happens next?", zh:"你觉得接下来会发生什么？", tip:"翻页前用手盖住下一页，边卖关子边问接下来会怎样。" },
        { id:"rd22", en:"How do you think the bunny feels? Happy or sad?", zh:"你觉得小兔子感觉怎么样？开心还是难过？", tip:"指着书上小兔子的表情，问孩子它是开心还是难过。" },
        { id:"rd23", en:"Can you find something blue on this page?", zh:"你能在这页上找到蓝色的东西吗？", tip:"和宝宝一起在这一页上用手指找蓝色的东西。" },
        { id:"rd24", en:"What's the dog doing? Running? Jumping?", zh:"小狗在做什么？跑步？跳跳？", tip:"指着图里的小狗，边指边问它在跑还是在跳。" },
        { id:"rd25", en:"This is your favorite part, isn't it? Tell me why!", zh:"这是你最喜欢的部分，对不对？告诉我为什么！", tip:"翻到这一页停下来，指着问宝宝为什么最喜欢这里。" },
      ],
      "3-6": [
        { id:"rd31", en:"What was the story about? Can you tell me?", zh:"这个故事讲的是什么？你能告诉我吗？", tip:"合上书放到孩子手里，请他抱着书把故事讲给你听。" },
        { id:"rd32", en:"Why did the character do that? What do you think?", zh:"为什么那个角色那样做？你怎么看？", tip:"指着书上那个角色，问孩子他为什么要那样做。" },
        { id:"rd33", en:"If you were in the story, what would you do?", zh:"如果你在故事里，你会怎么做？", tip:"指着书里的主角，问孩子如果是他会怎么做。" },
        { id:"rd34", en:"Do you have a favorite character? What do you like about them?", zh:"你有最喜欢的角色吗？你喜欢他什么？", tip:"翻到有那个角色的一页指给孩子看，问他喜欢他什么。" },
        { id:"rd35", en:"Let's find another book by the same author!", zh:"我们再找一本同一个作者写的书吧！", tip:"翻到封面指着作者的名字，和孩子一起找同一个作者的书。" },
      ],
    }
  },

  music: {
    icon: "🎵", name: "音乐律动", color: "var(--accent2)",
    phrases: {
      "0-1": [
        { id:"mu01", en:"Clap clap clap!", zh:"拍拍拍！", tip:"握住宝宝的小手轻轻拍在一起，建立节奏感。" },
        { id:"mu02", en:"Bounce bounce bounce! Up and down!", zh:"跳跳跳！上上下下！", tip:"轻轻托起宝宝做弹跳动作，配合节奏让宝宝感受音乐。" },
        { id:"mu03", en:"La la la la la!", zh:"啦啦啦啦啦！", tip:"抱着宝宝随旋律轻轻摇晃，边晃边哼啦啦啦。" },
        { id:"mu04", en:"Listen! Music!", zh:"听！音乐！", tip:"播放音乐时指向音源，帮宝宝建立「听」的意识。" },
        { id:"mu05", en:"Shake shake shake!", zh:"摇摇摇！", tip:"摇动沙铃或宝宝的小手，音效词和动作同步最有效。" },
      ],
      "1-2": [
        { id:"mu11", en:"Let's dance! Wiggle wiggle!", zh:"跳舞咯！扭一扭！", tip:"带着宝宝一起扭动身体，让音乐和运动结合。" },
        { id:"mu12", en:"Stomp stomp stomp! Big feet!", zh:"踩踩踩！大脚步！", tip:"夸张地跺脚，宝宝喜欢大声的动作游戏。" },
        { id:"mu13", en:"Shake your hands! Shake shake shake!", zh:"摇摇手！摇摇摇！", tip:"握着小手一起摇，重复的节奏让宝宝预测和期待。" },
        { id:"mu14", en:"Clap along! Can you clap?", zh:"跟着拍！你会拍手吗？", tip:"自己拍两下手给宝宝看，再握起他的小手一起拍。" },
        { id:"mu15", en:"Fast! Now slow... slow... slow.", zh:"快！现在慢……慢……慢。", tip:"带着宝宝拍手先快后慢，边拍边说快和慢。" },
      ],
      "2-3": [
        { id:"mu21", en:"Can you clap to the beat? Listen first!", zh:"你能跟着节拍拍手吗？先听一听！", tip:"先停下来和宝宝一起听，再带着他跟着节拍拍手。" },
        { id:"mu22", en:"What song do you want to sing?", zh:"你想唱什么歌？", tip:"伸出手比划几首歌的动作，让宝宝指出想唱哪一首。" },
        { id:"mu23", en:"Let's sing together! Ready? One, two, three!", zh:"我们一起唱！准备好了吗？一、二、三！", tip:"竖起手指一二三倒数，数完和宝宝一起开口唱。" },
        { id:"mu24", en:"That's loud! Now make it soft and quiet.", zh:"这是大声的！现在变轻轻的、安静的。", tip:"拍手先大声再变轻轻的，让宝宝感受大声和小声。" },
        { id:"mu25", en:"Spin around! Keep spinning to the music!", zh:"转圈圈！跟着音乐一直转！", tip:"牵着宝宝的手跟着音乐一起转圈圈。" },
      ],
      "3-6": [
        { id:"mu31", en:"Let's learn the words to this song! Repeat after me!", zh:"我们来学这首歌的歌词！跟我说！", tip:"一句一句唱给孩子听，每句停下来让他跟着你说。" },
        { id:"mu32", en:"Can you tap the beat on your knees? Listen to the music!", zh:"你能用手拍膝盖打节拍吗？听听音乐！", tip:"拍拍自己的膝盖打节拍给孩子看，再请他跟着一起拍。" },
        { id:"mu33", en:"Is this song fast or slow? Happy or sad?", zh:"这首歌是快还是慢？快乐还是悲伤？", tip:"跟着音乐做出快乐或悲伤的表情，问孩子这首歌是哪一种。" },
        { id:"mu34", en:"Let's make up our own song! What rhymes with cat?", zh:"我们自己编一首歌！什么英文词和「cat」押韵呀？", tip:"拍着手打拍子，和孩子一起用英文找和 cat 押韵的词（比如 hat、bat、mat），边拍边编。" },
        { id:"mu35", en:"You are a great dancer! Show me your best move!", zh:"你是超棒的舞蹈家！给我看你最厉害的动作！", tip:"自己先跳一个动作，再退到一旁给孩子舞台让他展示。" },
      ],
    }
  },

  art: {
    icon: "🎨", name: "涂鸦美工", color: "var(--pink)",
    phrases: {
      "0-1": [
        { id:"ar01", en:"Red! So much red!", zh:"红色！好多红色呀！", tip:"宝宝涂画时，指着纸上的红色，边指边说出颜色。" },
        { id:"ar02", en:"Squish squish! Soft and squishy!", zh:"捏捏捏！软软的！", tip:"手指触碰颜料时描述触感，丰富宝宝的感觉词汇。" },
        { id:"ar03", en:"Big circle! Round and round!", zh:"大圆圈！转啊转！", tip:"手握宝宝的小手画圆，边说边做，感受形状。" },
        { id:"ar04", en:"Look what you made!", zh:"看你画的！", tip:"指向宝宝的作品，让他感受到自己的行为有意义。" },
        { id:"ar05", en:"Blue! Touch the blue!", zh:"蓝色！摸摸蓝色！", tip:"手指颜色，让宝宝用手触碰，建立颜色和名称的联系。" },
      ],
      "1-2": [
        { id:"ar11", en:"Let's draw! Round and round! Scribble scribble!", zh:"画画咯！转圈圈！涂鸦涂鸦！", tip:"把蜡笔放进宝宝手里，握着他的手在纸上转圈涂鸦。" },
        { id:"ar12", en:"Yellow! That's yellow! Pretty yellow!", zh:"黄色！那是黄色！漂亮的黄色！", tip:"举起黄色蜡笔在宝宝眼前晃一晃，边晃边说三遍黄色。" },
        { id:"ar13", en:"More blue! Put more blue here!", zh:"再加蓝色！在这里加更多蓝色！", tip:"把蓝色蜡笔递到宝宝手里，指指画纸请他多加一点蓝。" },
        { id:"ar14", en:"Big line! Now a little line!", zh:"大线条！现在画小线条！", tip:"握着宝宝的手先画一条大线，再画一条小线。" },
        { id:"ar15", en:"Wow, look at your picture! So colorful!", zh:"哇，看你的画！好多颜色！", tip:"把画举起来对着光看，边指颜色边夸这么多颜色。" },
      ],
      "2-3": [
        { id:"ar21", en:"What are you drawing? Tell me about your picture!", zh:"你在画什么？跟我说说你的画！", tip:"指着画上的一处，问宝宝这是什么，请他讲给你听。" },
        { id:"ar22", en:"Which color do you want to use? Pick one!", zh:"你想用什么颜色？挑一个！", tip:"把几支蜡笔摊开在宝宝面前，让他伸手挑一支。" },
        { id:"ar23", en:"Should we mix yellow and blue? What color do we get?", zh:"我们把黄色和蓝色混在一起？会变成什么颜色？", tip:"把黄色和蓝色挤在一起，和宝宝一起用手指搅拌看变什么色。" },
        { id:"ar24", en:"Let's make a sun! Big circle, then lines all around!", zh:"我们画太阳！大圆圈，然后四周画线条！", tip:"先带着宝宝画一个大圆，再在四周一笔一笔加线条。" },
        { id:"ar25", en:"You worked so hard on this! Look at all the colors!", zh:"你这幅画花了好多心思！看这么多颜色！", tip:"指着画上宝宝涂得最用力的地方，边指边夸他很用心。" },
      ],
      "3-6": [
        { id:"ar31", en:"Tell me about your drawing. What's happening in your picture?", zh:"跟我说说你的画。画里发生了什么事？", tip:"指着画面里的一处，问孩子这里正在发生什么。" },
        { id:"ar32", en:"What colors do you need to make orange?", zh:"要做橙色需要用哪些颜色？", tip:"把红黄两支颜料摆到孩子面前，问他要怎么调出橙色。" },
        { id:"ar33", en:"Let's create something together! What should we make?", zh:"我们一起做个东西！做什么好？", tip:"拿出一张大纸铺在两人中间，问孩子我们一起做什么。" },
        { id:"ar34", en:"Your art makes me feel happy. What feeling does it give you?", zh:"你的画让我感到开心。你自己有什么感觉？", tip:"举起孩子的画放到胸前，边看边问他自己有什么感觉。" },
        { id:"ar35", en:"Should we hang this up? Let's find the best spot!", zh:"我们要把它挂起来吗？找个最好的位置！", tip:"举着画和孩子一起在墙上找个最好的位置贴起来。" },
      ],
    }
  },

  blocks: {
    icon: "🧱", name: "积木游戏", color: "var(--accent2)",
    phrases: {
      "0-1": [
        { id:"bl01", en:"Stack! Stack it up!", zh:"叠！叠起来！", tip:"帮宝宝把积木叠在一起，边说边做，建立动作词汇。" },
        { id:"bl02", en:"Up up up! So tall!", zh:"高高高！好高！", tip:"每叠一块就说一次，让宝宝感受高度变化的节奏。" },
        { id:"bl03", en:"Boom! It fell down!", zh:"轰！倒下来了！", tip:"轻轻推倒积木塔，边倒边夸张地喊轰。" },
        { id:"bl04", en:"Again! Let's build again!", zh:"再来！我们再搭！", tip:"把积木重新堆到面前，边招呼宝宝边一起再搭。" },
        { id:"bl05", en:"Red block! Here's the red one!", zh:"红色积木！这是红色的！", tip:"拿起一块红积木举到宝宝眼前，边给他看边说颜色。" },
      ],
      "1-2": [
        { id:"bl11", en:"Put it on top! On top!", zh:"放到上面！上面！", tip:"指向顶部，帮宝宝理解「上面」的方位概念。" },
        { id:"bl12", en:"Blue block! Yellow block! So many colors!", zh:"蓝色积木！黄色积木！好多颜色！", tip:"每拿起一块积木就举给宝宝看，边看边说颜色。" },
        { id:"bl13", en:"So tall! Touch the top!", zh:"好高！摸摸最顶上！", tip:"扶着宝宝伸手去摸塔的最顶端，边摸边说好高。" },
        { id:"bl14", en:"Knock it down! Boom! Crash!", zh:"推倒它！轰！哗啦！", tip:"让宝宝推倒积木，音效词让这个动作充满乐趣。" },
        { id:"bl15", en:"Big tower! We built a big tower!", zh:"大塔楼！我们搭了一座大塔楼！", tip:"指着搭好的塔从下往上比一比，边比边说我们搭了座大塔。" },
      ],
      "2-3": [
        { id:"bl21", en:"How high can we build? Let's try!", zh:"我们能搭多高？试试看！", tip:"把积木推到宝宝面前，一块块往上叠边叠边问能搭多高。" },
        { id:"bl22", en:"What shape is this block? Square? Rectangle?", zh:"这块积木是什么形状？正方形？长方形？", tip:"拿起一块积木翻转给宝宝看各个面，边指边问是什么形状。" },
        { id:"bl23", en:"Can you find a big block? Now find a small one!", zh:"你能找一块大积木吗？现在找一块小的！", tip:"把一大一小两块积木摆在宝宝面前，请他伸手拿大的。" },
        { id:"bl24", en:"Let's build a house! What does a house need?", zh:"我们搭一座房子！房子需要什么？", tip:"把积木堆到中间，边摆出房子的底边问房子还需要什么。" },
        { id:"bl25", en:"Uh oh, it's wobbly! How can we make it stronger?", zh:"哦不，它摇摇晃晃！怎么让它更稳固？", tip:"轻轻晃一晃摇摇欲坠的塔，边晃边问怎么让它更稳。" },
      ],
      "3-6": [
        { id:"bl31", en:"What are you going to build today? Tell me your plan!", zh:"你今天要搭什么？告诉我你的计划！", tip:"把一堆积木推到孩子面前，蹲下来问他今天打算搭什么。" },
        { id:"bl32", en:"Which blocks do you need? Let's sort them by color first!", zh:"你需要哪些积木？先按颜色分类吧！", tip:"和孩子一起把积木按颜色分成几堆，边分边说。" },
        { id:"bl33", en:"Why did it fall? What could we do differently?", zh:"为什么倒了？我们可以怎么改进？", tip:"指着刚倒下的积木，问孩子它为什么倒、可以怎么改。" },
        { id:"bl34", en:"Wow, that's an amazing structure! How did you make it so strong?", zh:"哇，真厉害的建筑！你怎么让它这么稳？", tip:"指着孩子搭的建筑最稳的地方，问他是怎么做到这么稳的。" },
        { id:"bl35", en:"Let's take a photo of your building before we clean up!", zh:"收拾之前我们先给你的建筑拍张照片！", tip:"举起手机和孩子一起给他的建筑拍张照，再收拾。" },
      ],
    }
  },

  pretend: {
    icon: "🎭", name: "角色扮演", color: "var(--pink)",
    phrases: {
      "0-1": [
        { id:"pr01", en:"Look, the bear is sleeping! Shh!", zh:"看，小熊在睡觉！嘘！", tip:"把小熊放平假装睡着，竖起手指嘘一声。" },
        { id:"pr02", en:"Cup! The cup goes here.", zh:"杯子！杯子放这里。", tip:"拿起小杯子放到桌上，边放边说杯子放这里。" },
        { id:"pr03", en:"Nom nom nom! Yummy!", zh:"嗯嗯嗯！好吃！", tip:"拿起假食物凑到嘴边假装大口吃，边吃边发出声音。" },
        { id:"pr04", en:"Hi teddy! Say hi to teddy!", zh:"嗨泰迪！和泰迪打招呼！", tip:"举着泰迪熊的小手向宝宝挥一挥，再请宝宝也挥手回应。" },
        { id:"pr05", en:"Rock-a-bye baby! The doll is sleeping.", zh:"摇啊摇！洋娃娃在睡觉。", tip:"抱着玩具摇睡，模仿照顾行为，宝宝很快会模仿。" },
      ],
      "1-2": [
        { id:"pr11", en:"The doll is hungry! Feed the doll!", zh:"洋娃娃饿了！喂洋娃娃吃东西！", tip:"把小勺送到洋娃娃嘴边假装喂饭，再把勺递给宝宝。" },
        { id:"pr12", en:"Ring ring! Hello? Who is it?", zh:"铃铃铃！喂？是谁呀？", tip:"拿起玩具电话贴到耳边假装接听，再递给宝宝。" },
        { id:"pr13", en:"Vroom vroom! The car is going fast!", zh:"呜呜！汽车开得好快！", tip:"推着玩具车在地上跑，边推边发出呜呜声。" },
        { id:"pr14", en:"Oh no, teddy fell! Is he okay? Kiss it better!", zh:"哦不，泰迪摔倒了！他没事吧？亲亲好了！", tip:"抱起摔倒的泰迪熊亲一下，边哄边问它好点没。" },
        { id:"pr15", en:"Time for bed, dolly! Tuck her in!", zh:"洋娃娃该睡觉了！给她盖好被子！", tip:"和宝宝一起给洋娃娃盖好小被子拍一拍。" },
      ],
      "2-3": [
        { id:"pr21", en:"Let's pretend you're the doctor! I have a tummy ache!", zh:"我们假装你是医生！我肚子疼！", tip:"捂着肚子假装疼给宝宝看，请他当医生来看看。" },
        { id:"pr22", en:"What are you cooking? It smells so good!", zh:"你在做什么菜？好香啊！", tip:"凑到宝宝的假想锅前假装闻一闻，边闻边说好香。" },
        { id:"pr23", en:"I'll be the baby and you be the mommy. Okay?", zh:"我来当宝宝，你来当妈妈。好不好？", tip:"把玩偶抱到自己怀里当宝宝，请宝宝来当妈妈照顾你。" },
        { id:"pr24", en:"The shop is open! What would you like to buy?", zh:"店铺开门了！你想买什么？", tip:"把几样玩具摆成小商店，站到柜台后问宝宝想买什么。" },
        { id:"pr25", en:"Choo choo! All aboard the train! Where are we going?", zh:"呜呜！上火车！我们要去哪里？", tip:"把椅子排成一列小火车坐上去，边呜呜边问要去哪里。" },
      ],
      "3-6": [
        { id:"pr31", en:"Let's make up a story together! You start!", zh:"我们一起编故事！你先开始！", tip:"和孩子并排坐下拍拍腿，说我们来编故事你先开头。" },
        { id:"pr32", en:"What happens next in our story? What does the hero do?", zh:"我们的故事接下来怎样？主角会怎么做？", tip:"手在空中往前一推做出继续的手势，问孩子主角接下来做什么。" },
        { id:"pr33", en:"I'm the customer. Hello, I'd like to order a pizza please!", zh:"我是顾客。你好，我想点一份披萨！", tip:"假装推门进店坐下来，向当店员的孩子点一份披萨。" },
        { id:"pr34", en:"You're the superhero! What's your superpower?", zh:"你是超级英雄！你有什么超能力？", tip:"给孩子肩上披一块布当披风，问他有什么超能力。" },
        { id:"pr35", en:"The dragon is blocking the castle! How do we get past?", zh:"龙挡住了城堡！我们怎么过去？", tip:"张开双臂当挡路的龙，问孩子我们怎么过去。" },
      ],
    }
  },

  potty: {
    icon: "🚽", name: "如厕训练", color: "var(--teal)",
    phrases: {
      "0-1": [
        { id:"pt01", en:"You made a wet diaper! That's okay.", zh:"宝宝尿湿了！没关系的。", tip:"换尿布时轻拍宝宝的小肚子，平静地说尿湿了没关系。" },
        { id:"pt02", en:"Time to change your diaper! Nice and clean!", zh:"换尿布时间！干干净净的！", tip:"一边给宝宝换上干净尿布，一边说干干净净的。" },
        { id:"pt03", en:"Wet! Your diaper is wet.", zh:"湿了！尿布湿了。", tip:"轻轻摸一下湿尿布再摸摸宝宝的手，边摸边说湿了。" },
        { id:"pt04", en:"Clean and dry! All fresh!", zh:"干净又干爽！焕然一新！", tip:"换好尿布拍拍宝宝的小屁股，边拍边说干净又干爽。" },
        { id:"pt05", en:"There you go. All done!", zh:"好了。换好了！", tip:"换完尿布后说，给过程一个清晰的结束信号。" },
      ],
      "1-2": [
        { id:"pt11", en:"Do you have a wet diaper? Let's check!", zh:"你的尿布湿了吗？我们检查一下！", tip:"轻轻摸摸宝宝的尿布检查一下，边摸边问湿了没。" },
        { id:"pt12", en:"This is the potty! Pee pee and poo poo go here!", zh:"这是小马桶！尿尿和便便都到这里来！", tip:"拍拍小马桶指给宝宝看，边指边说尿尿便便都到这来。" },
        { id:"pt13", en:"Do you want to try sitting on the potty?", zh:"你想试着坐坐小马桶吗？", tip:"拍拍小马桶的座圈，笑着邀请宝宝来坐一坐试试。" },
        { id:"pt14", en:"Pee pee goes in the potty! Big kids use the potty!", zh:"尿尿要去小马桶！大孩子用小马桶！", tip:"指着小马桶告诉宝宝大孩子都用它，边说边扶他坐上去。" },
        { id:"pt15", en:"You sat on the potty! Good job trying!", zh:"你坐上小马桶了！很棒，你尝试了！", tip:"宝宝从马桶上起来就和他击个掌，夸他勇敢尝试了。" },
      ],
      "2-3": [
        { id:"pt21", en:"Do you need to go potty? Tell me if you do!", zh:"你需要上厕所吗？有需要告诉我！", tip:"指指小马桶蹲下来问宝宝要不要上厕所，每天多问几次。" },
        { id:"pt22", en:"Let's try the potty before we go out! Just in case.", zh:"出门前我们先去试试小马桶！以防万一。", tip:"出门前牵宝宝到小马桶边，边扶他坐下边说以防万一。" },
        { id:"pt23", en:"You did it! You went pee pee in the potty! I'm so proud!", zh:"你做到了！你在小马桶里尿尿了！我好骄傲！", tip:"宝宝成功后立刻抱起来转个圈，具体夸他尿到马桶里了。" },
        { id:"pt24", en:"Oops, an accident! That's okay. Let's clean up together.", zh:"哎呀，出意外了！没关系。我们一起收拾。", tip:"平静地拿抹布和宝宝一起擦干净，边擦边说没关系。" },
        { id:"pt25", en:"You told me you needed to go! That was so smart!", zh:"你告诉我你要上厕所了！你真聪明！", tip:"蹲下来和宝宝对视竖起大拇指，夸他主动告诉了你。" },
      ],
      "3-6": [
        { id:"pt31", en:"Remember to go potty before we leave the house!", zh:"记得出门前先上厕所！", tip:"出门前指指卫生间提醒孩子先去上厕所。" },
        { id:"pt32", en:"You can go to the bathroom by yourself now. You're so grown up!", zh:"你现在能自己上厕所了。你长大了好多！", tip:"拍拍孩子的肩夸他现在能自己上厕所、长大了。" },
        { id:"pt33", en:"Don't forget to flush and wash your hands! That's the rule.", zh:"别忘了冲水和洗手！这是规定。", tip:"指着冲水按钮和水池，提醒孩子冲水、洗手一步都不少。" },
        { id:"pt34", en:"How do you know when you need to go? Your body tells you!", zh:"你怎么知道要上厕所了？是你的身体在告诉你！", tip:"摸摸孩子的小肚子，问他身体是怎么告诉他要上厕所的。" },
        { id:"pt35", en:"You went all by yourself! High five!", zh:"你自己去上厕所了！击掌！", tip:"在宝宝的高度举起张开的手掌，等他抬手拍上来，啪地和他击一下掌。" },
      ],
    }
  },

  goodbye: {
    icon: "👋", name: "出门告别", color: "var(--accent)",
    phrases: {
      "0-1": [
        { id:"gb01", en:"Wave bye-bye! Bye-bye!", zh:"挥手拜拜！拜拜！", tip:"握着宝宝的小手挥动，边说边做，建立告别动作。" },
        { id:"gb02", en:"Daddy's going bye-bye. Bye-bye Daddy!", zh:"爸爸要拜拜了。爸爸拜拜！", tip:"指着要出门的爸爸向宝宝挥挥手，边挥边说爸爸拜拜。" },
        { id:"gb03", en:"See you soon! Bye-bye!", zh:"一会见！拜拜！", tip:"蹲下来和宝宝对视挥挥手，用轻松的语气说一会见。" },
        { id:"gb04", en:"Mommy will be back. I love you!", zh:"妈妈会回来的。我爱你！", tip:"临走前抱一抱宝宝再放下，边抱边说妈妈会回来。" },
        { id:"gb05", en:"Blow a kiss! Mwah!", zh:"飞吻！么哒！", tip:"把手贴到嘴上再朝宝宝送出一个飞吻。" },
      ],
      "1-2": [
        { id:"gb11", en:"Bye-bye! See you soon! I'll be back!", zh:"拜拜！一会见！我会回来的！", tip:"出门前挥挥手每次都说同样的告别语，让宝宝安心。" },
        { id:"gb12", en:"Wave bye-bye to Grandma! Can you wave?", zh:"向奶奶挥手拜拜！你会挥手吗？", tip:"拉着宝宝的手朝奶奶挥一挥，边挥边说拜拜。" },
        { id:"gb13", en:"Mommy is going to work. She'll come back later!", zh:"妈妈去上班了。她等一下会回来！", tip:"指指门外，蹲下来告诉宝宝妈妈去上班等会儿回来。" },
        { id:"gb14", en:"Big hug! One more hug before I go!", zh:"大抱抱！走之前再抱一下！", tip:"走之前张开双臂给宝宝一个大大的拥抱。" },
        { id:"gb15", en:"Give me a kiss! See you later, alligator!", zh:"亲我一下！一会儿见，小宝贝！", tip:"凑过去让宝宝亲一下脸颊，边笑边说一会儿见小宝贝。" },
      ],
      "2-3": [
        { id:"gb21", en:"Daddy's going to work. Can you blow him a kiss goodbye?", zh:"爸爸要去上班啦。你能给他一个飞吻说再见吗？", tip:"指着门口告诉宝宝爸爸去上班了，教他把一个飞吻送给爸爸说再见。" },
        { id:"gb22", en:"You feel sad when Mommy leaves. That's okay!", zh:"妈妈离开你会难过。没关系的！", tip:"蹲下来搂住宝宝，边拍背边说妈妈走了你会难过没关系。" },
        { id:"gb23", en:"Mommy will come back after your nap. Ready, set, bye!", zh:"妈妈等你睡完午觉就回来。准备好，出发，拜拜！", tip:"蹲下来握住宝宝的手比出发的手势，说睡完午觉就回来。" },
        { id:"gb24", en:"Should we do our special goodbye? One hug, one kiss, one wave!", zh:"我们做特别的告别仪式吧？一个抱，一个亲，一个挥手！", tip:"和宝宝做固定的告别三连：抱一个、亲一下、挥挥手。" },
        { id:"gb25", en:"You're so brave! I'll think of you while I'm gone.", zh:"你好勇敢！我离开的时候也会想你的。", tip:"摸摸宝宝的头夸他勇敢，说妈妈不在也会想你。" },
      ],
      "3-6": [
        { id:"gb31", en:"I'll be back after dinner. Can you remember that?", zh:"我吃完晚饭后回来。你能记住吗？", tip:"蹲到孩子面前告诉他晚饭后就回来，问他能不能记住。" },
        { id:"gb32", en:"It's okay to feel a little sad. Missing people means you love them!", zh:"有点难过是没关系的。想念别人说明你爱他们！", tip:"搂着孩子告诉他有点难过没关系，想念就是因为爱。" },
        { id:"gb33", en:"What will you do while I'm gone? You've got fun things planned!", zh:"我不在的时候你要做什么？你有很多有趣的事要做！", tip:"指着孩子的玩具或活动，问他等你不在时打算玩什么。" },
        { id:"gb34", en:"I love you! Be good and have fun. I'll be so excited to hear about your day!", zh:"我爱你！乖乖玩得开心。我很期待听你讲今天的事！", tip:"抱一抱孩子说我爱你，期待回来听他讲今天的事。" },
        { id:"gb35", en:"Goodbye hug! You're getting so good at brave goodbyes!", zh:"告别抱抱！你越来越擅长勇敢地说再见了！", tip:"给孩子一个告别抱抱，夸他越来越会勇敢说再见了。" },
      ],
    }
  },

  outing: {
    icon: "🚗", name: "外出坐车", color: "var(--blue)",
    phrases: {
      "0-1": [
        { id:"ot01", en:"Car ride! In the car!", zh:"坐车咯！上车了！", tip:"把宝宝抱进安全座椅时每次都说同样的话开始出行。" },
        { id:"ot02", en:"Click! Buckle up! Safe and snug.", zh:"咔嗒！扣好了！安全舒适。", tip:"扣安全带时说咔嗒声，让宝宝熟悉这个必要步骤。" },
        { id:"ot03", en:"Look out the window! Trees! So many trees!", zh:"看窗外！树！好多树！", tip:"指向窗外，给宝宝提供感知世界的语言工具。" },
        { id:"ot04", en:"Vroom vroom! The car is moving!", zh:"呜呜！汽车动起来了！", tip:"车子起步时轻拍宝宝的手，边拍边发出呜呜的声音。" },
        { id:"ot05", en:"Almost there! We're almost there!", zh:"快到了！我们快到了！", tip:"指指窗外快到的方向，重复说我们快到了。" },
      ],
      "1-2": [
        { id:"ot11", en:"Let's go! Shoes on! Ready?", zh:"出发！穿鞋！准备好了吗？", tip:"把鞋子递给宝宝一起穿上，边穿边说出发咯。" },
        { id:"ot12", en:"Car! We're going in the car! Vroom!", zh:"汽车！我们要坐汽车！呜呜！", tip:"指着门外的汽车给宝宝看，边指边说我们要坐汽车。" },
        { id:"ot13", en:"Look! A red car! And a blue one!", zh:"看！红色汽车！还有一辆蓝色的！", tip:"指着窗外驶过的车，边指边说出它们的颜色。" },
        { id:"ot14", en:"Where are we going? To the park! Yay!", zh:"我们去哪里？去公园！耶！", tip:"指着前方问宝宝我们去哪里，再自己答去公园。" },
        { id:"ot15", en:"Sit down in your seat! Good job!", zh:"坐好在座位上！真棒！", tip:"宝宝坐好后拍拍他的座椅竖起大拇指夸他真棒。" },
      ],
      "2-3": [
        { id:"ot21", en:"Where are we going today? Can you remember?", zh:"我们今天要去哪里？你还记得吗？", tip:"转头问坐在座椅上的宝宝还记不记得今天去哪里。" },
        { id:"ot22", en:"Let's count the traffic lights! Red means stop!", zh:"我们数数红绿灯！红色表示停！", tip:"指着窗外的红绿灯和宝宝一起数，边指边说红色停。" },
        { id:"ot23", en:"Can you see any animals? Look out your window!", zh:"你能看到动物吗？看看你那边的窗外！", tip:"指指宝宝那侧的车窗，请他找找外面有没有动物。" },
        { id:"ot24", en:"We're almost there! Just two more streets — can you spot them?", zh:"我们快到了！还有两条街——你能找到吗？", tip:"指着窗外的街道和宝宝一起数，还有两条街就到啦。" },
        { id:"ot25", en:"Buckle up! That's how we stay safe in the car.", zh:"扣好安全带！这是我们在车里保持安全的方法。", tip:"扣好安全带拉一拉给宝宝看，边拉边说这样才安全。" },
      ],
      "3-6": [
        { id:"ot31", en:"We're going to the supermarket. What do you think we need to buy?", zh:"我们去超市。你觉得我们需要买什么？", tip:"扳着手指和孩子一起列出要买的东西，边数边聊。" },
        { id:"ot32", en:"Let's play the color game! First one to see something yellow wins!", zh:"我们玩颜色游戏！第一个看到黄色东西的人赢！", tip:"指着窗外和孩子比赛，看谁先找到黄色的东西。" },
        { id:"ot33", en:"How far away do you think it is? Near or far?", zh:"你觉得有多远？近还是远？", tip:"指着窗外的路问孩子觉得还有多远，是近还是远。" },
        { id:"ot34", en:"Can you tell me three things you see out the window right now?", zh:"你能告诉我现在窗外看到的三件东西吗？", tip:"指指车窗请孩子说出现在看到的三样东西。" },
        { id:"ot35", en:"We're here! Remember to take your things with you.", zh:"到了！记得带上你的东西。", tip:"到站后指指孩子的东西，提醒他自己带下车。" },
      ],
    }
  },

  shopping: {
    icon: "🛒", name: "超市购物", color: "var(--green)",
    phrases: {
      "0-1": [
        { id:"sh01", en:"In the cart! Wheee!", zh:"坐进购物车！嗖嗖嗖！", tip:"把宝宝放进购物车时用愉快的语气，让购物一开始就是乐趣。" },
        { id:"sh02", en:"Look at all the colors! Red apples! Yellow bananas!", zh:"看这么多颜色！红色苹果！黄色香蕉！", tip:"超市是天然的颜色学习场所，边走边指。" },
        { id:"sh03", en:"So many things! Big store!", zh:"好多东西！大商店！", tip:"推着购物车张开手臂比一比，边比边说好大的商店。" },
        { id:"sh04", en:"Here comes the cart! Vroom vroom!", zh:"购物车来了！呜呜！", tip:"推购物车时加音效，让宝宝感受移动的乐趣。" },
        { id:"sh05", en:"Look! An orange! Round and round!", zh:"看！一个橙子！圆圆的，转呀转！", tip:"指着橙子，用手指沿着圆圆的边缘划圈给宝宝看。" },
      ],
      "1-2": [
        { id:"sh11", en:"Apple! Red apple! Can you touch the apple?", zh:"苹果！红色苹果！你能摸摸苹果吗？", tip:"拿起一个苹果放到宝宝手里让他摸摸，边摸边说。" },
        { id:"sh12", en:"Banana! Yellow banana! Peel and eat! Mmm!", zh:"香蕉！黄色香蕉！剥皮吃！嗯！", tip:"拿起香蕉假装剥皮吃一口，边做边说黄色香蕉真好吃。" },
        { id:"sh13", en:"Let's find the milk! Where is the milk?", zh:"我们找牛奶！牛奶在哪里？", tip:"推着车往货架走，边走边问宝宝牛奶在哪里一起找。" },
        { id:"sh14", en:"Big pumpkin! Little potato! Big, little!", zh:"大南瓜！小土豆！大，小！", tip:"一手拿大南瓜一手拿小土豆举给宝宝看，边比边说大小。" },
        { id:"sh15", en:"In the bag! Everything goes in the bag!", zh:"放进袋子！所有东西放进袋子！", tip:"把商品递给宝宝让他放进袋子，边放边说进去咯。" },
      ],
      "2-3": [
        { id:"sh21", en:"Can you find the apples? Look for the red ones!", zh:"你能找到苹果吗？找红色的！", tip:"指着货架请宝宝帮忙找红苹果，找到就一起放进车。" },
        { id:"sh22", en:"Which one should we get? The big one or the small one?", zh:"我们选哪个？大的还是小的？", tip:"一手一个大小不同的举到宝宝面前，让他挑一个。" },
        { id:"sh23", en:"What do carrots look like? Orange and long!", zh:"胡萝卜是什么样的？橙色的，长长的！", tip:"拿起胡萝卜在宝宝眼前比一比长度，边比边说橙色长长的。" },
        { id:"sh24", en:"Let's count the yogurts! One, two, three, four!", zh:"我们数酸奶！一、二、三、四！", tip:"指着货架上的酸奶一盒一盒和宝宝一起数。" },
        { id:"sh25", en:"We got everything! Ready to pay? Let's go to the checkout!", zh:"我们买完了！准备结账？去收银台！", tip:"推着装满的车招呼宝宝去收银台，边走边说去结账。" },
      ],
      "3-6": [
        { id:"sh31", en:"Can you read what that sign says? Sound it out!", zh:"你能读出那个牌子上写的什么吗？拼一拼！", tip:"指着货架上的标牌，请孩子试着把上面的字拼读出来。" },
        { id:"sh32", en:"We have ten dollars. What can we buy with that?", zh:"我们有十块钱。用这些钱能买什么？", tip:"把十块钱放到孩子手里，问他用这些钱能买些什么。" },
        { id:"sh33", en:"Can you be my helper and find three vegetables?", zh:"你能帮我找三种蔬菜吗？", tip:"指指蔬菜区请孩子当小帮手帮你找三种蔬菜。" },
        { id:"sh34", en:"Why do you think apples are in this section? What else is here?", zh:"你觉得苹果为什么在这个区域？这里还有什么？", tip:"指着摆苹果的货架，问孩子为什么苹果都放在这里。" },
        { id:"sh35", en:"We need to choose healthy food. Is this a healthy choice?", zh:"我们要选健康的食物。这是健康的选择吗？", tip:"拿起手里的食物给孩子看，问他这算不算健康的选择。" },
      ],
    }
  },

  friends: {
    icon: "👫", name: "见小朋友", color: "var(--accent2)",
    phrases: {
      "0-1": [
        { id:"fr01", en:"Look! A baby! Hi baby!", zh:"看！一个小宝宝！宝宝你好！", tip:"指向另一个小宝宝，用温柔的语气打招呼。" },
        { id:"fr02", en:"The baby is smiling! So cute!", zh:"那个宝宝在笑！好可爱！", tip:"指着那个宝宝的笑脸给自家宝宝看，边指边说他在笑。" },
        { id:"fr03", en:"Wave hello! Say hi!", zh:"挥手打招呼！说嗨！", tip:"拉起宝宝的小手朝小朋友挥一挥说嗨。" },
        { id:"fr04", en:"Playing together! Look at the babies!", zh:"一起玩！看看宝宝们！", tip:"指着一起玩的小朋友们给宝宝看，边指边说一起玩。" },
        { id:"fr05", en:"New friend! Hello, new friend!", zh:"新朋友！你好，新朋友！", tip:"牵着宝宝走近新的小朋友，笑着说你好新朋友。" },
      ],
      "1-2": [
        { id:"fr11", en:"Say hi! Can you say hi to your friend?", zh:"打招呼！你能和小朋友说嗨吗？", tip:"蹲到宝宝身边轻轻推一推他，鼓励他跟小朋友说嗨。" },
        { id:"fr12", en:"Hello, friend! Wave and smile!", zh:"你好，小朋友！挥挥手，笑一笑！", tip:"自己先向小朋友挥手微笑做示范，鼓励宝宝跟着挥挥小手。" },
        { id:"fr13", en:"Share the toy! One for you, one for me!", zh:"分享玩具！一个给你，一个给我！", tip:"用实际动作演示分享，比说教更直观有效。" },
        { id:"fr14", en:"Your friend is sad. Can you give them a hug?", zh:"你的朋友难过了。你能给他一个抱抱吗？", tip:"指着难过的小朋友，轻轻推宝宝过去给他一个抱抱。" },
        { id:"fr15", en:"Play together! So fun with a friend!", zh:"一起玩！和朋友玩好开心！", tip:"拉着宝宝加入小朋友的游戏，边玩边说和朋友玩真开心。" },
      ],
      "2-3": [
        { id:"fr21", en:"Can I play with you? Let's ask!", zh:"我可以和你们一起玩吗？我们去问问！", tip:"牵着宝宝走到玩耍的小朋友旁边，示范问我可以一起玩吗。" },
        { id:"fr22", en:"Whose turn is it? It's your friend's turn now!", zh:"该谁了？现在轮到你的朋友了！", tip:"轻轻按住宝宝的手指指小朋友，说现在轮到他了。" },
        { id:"fr23", en:"You have to share. Can you give them a turn?", zh:"要分享哦。你能让他玩一下吗？", tip:"指着宝宝手里的玩具，引导他递一个给小朋友玩一下。" },
        { id:"fr24", en:"How does your friend feel? Do they look happy?", zh:"你的朋友感觉怎么样？他们看起来开心吗？", tip:"指着小朋友的脸，问宝宝他看起来开不开心。" },
        { id:"fr25", en:"Say sorry. Saying sorry helps make it better!", zh:"说对不起。说对不起能让事情好一点！", tip:"牵着宝宝走到小朋友面前，示范说对不起再解释为什么。" },
      ],
      "3-6": [
        { id:"fr31", en:"What's your name? Where do you go to school?", zh:"你叫什么名字？你在哪里上学？", tip:"陪孩子走到新朋友面前，示范伸手问名字和在哪上学。" },
        { id:"fr32", en:"Do you want to be friends? I like playing with you!", zh:"你想和我做朋友吗？我喜欢和你一起玩！", tip:"陪孩子走近小朋友，示范笑着伸出手说想不想做朋友。" },
        { id:"fr33", en:"Good friends take turns and share. Are you being a good friend?", zh:"好朋友轮流和分享。你是个好朋友吗？", tip:"蹲下来看着孩子的眼睛，问他刚才有没有轮流和分享。" },
        { id:"fr34", en:"If a friend feels left out, what can you do?", zh:"如果朋友感觉被排除在外，你能做什么？", tip:"指着落单的小朋友，问孩子能做点什么让他加入进来。" },
        { id:"fr35", en:"It's hard to say goodbye to friends. You'll see them again soon!", zh:"和朋友道别很难受。你很快就会再见到他们的！", tip:"搂着孩子的肩告诉他和朋友说再见很难受，很快会再见面。" },
      ],
    }
  },

  share: {
    icon: "🤝", name: "分享礼让", color: "var(--green)",
    phrases: {
      "0-1": [
        { id:"sr01", en:"Look what baby has!", zh:"看宝宝有什么！", tip:"指着宝宝手里的东西，边指边说看宝宝有什么。" },
        { id:"sr02", en:"Passing it over! Here it comes!", zh:"传过来咯！来了！", tip:"把物品递给宝宝时说，帮他感受传递的动作。" },
        { id:"sr03", en:"Together! We play together!", zh:"一起！我们一起玩！", tip:"把两个孩子的玩具挪到一起，边指边说我们一起玩。" },
        { id:"sr04", en:"Your turn! Baby's turn!", zh:"轮到你了！宝宝的回合！", tip:"先指指自己再指指宝宝，边指边说轮到你了。" },
        { id:"sr05", en:"Sharing is nice! Nice and kind!", zh:"分享真好！好温柔！", tip:"宝宝把东西递出去时摸摸他的头，温柔地说分享真好。" },
      ],
      "1-2": [
        { id:"sr11", en:"My turn! Your turn! My turn! Your turn!", zh:"我的回合！你的回合！我的！你的！", tip:"轮流指自己和宝宝，边指边有节奏地说我的、你的。" },
        { id:"sr12", en:"Pass it to me! Thank you! Now I pass it back!", zh:"传给我！谢谢！现在我传回去！", tip:"把玩具递给宝宝再请他递回来，边传边说谢谢。" },
        { id:"sr13", en:"Can you give some to your friend? Good sharing!", zh:"能给你的朋友一些吗？分享得真好！", tip:"宝宝分给朋友后立刻竖起大拇指夸他分享得真好。" },
        { id:"sr14", en:"One for you, one for me! Fair and equal!", zh:"一个给你，一个给我！公平！", tip:"把零食一个给宝宝一个给自己地分，边分边说公平。" },
        { id:"sr15", en:"Wait! It's their turn. You'll get a turn soon!", zh:"等一下！现在是他们的回合。你很快就轮到了！", tip:"轻轻搂着等待的宝宝，边拍背边说很快就轮到你了。" },
      ],
      "2-3": [
        { id:"sr21", en:"Can you share with your friend? They would love a turn!", zh:"你能和朋友分享吗？他们很想玩一下！", tip:"指着眼巴巴看着的小朋友，引导宝宝分一个给他玩。" },
        { id:"sr22", en:"How long do you need? Then your friend can have a turn.", zh:"你还需要多久？然后朋友可以玩一下。", tip:"指着玩具比划一会儿的手势，问宝宝还要玩多久再给朋友。" },
        { id:"sr23", en:"Let's wait patiently. It's not easy, but you can do it!", zh:"我们耐心等一等。不容易，但你能做到！", tip:"握着宝宝的手陪他一起等，边等边说不容易但你能做到。" },
        { id:"sr24", en:"Your friend shared with you! How does that feel?", zh:"你的朋友和你分享了！你感觉怎么样？", tip:"指着朋友刚分给宝宝的玩具，问他现在感觉怎么样。" },
        { id:"sr25", en:"When you share, everyone gets to be happy!", zh:"当你分享的时候，大家都能开心！", tip:"指着一起玩得开心的小朋友们，边指边说分享大家都开心。" },
      ],
      "3-6": [
        { id:"sr31", en:"How does it feel when someone shares with you?", zh:"别人和你分享的时候你感觉怎么样？", tip:"蹲下来看着孩子，问他别人分东西给他时是什么感觉。" },
        { id:"sr32", en:"It can be hard to share your favorite toy. That's okay to feel.", zh:"分享最喜欢的玩具很难。有这种感觉没关系。", tip:"指着孩子最爱的玩具，搂着他说分享它很难有这种感觉没关系。" },
        { id:"sr33", en:"Is there a fair way to decide who goes first?", zh:"有没有公平的方法决定谁先来？", tip:"把玩具放到两个孩子中间，问他们有什么公平的办法决定谁先来。" },
        { id:"sr34", en:"You waited so patiently! That was really mature of you.", zh:"你等得好有耐心！这真的很成熟。", tip:"蹲下来和孩子对视，具体夸他刚才等得很有耐心很成熟。" },
        { id:"sr35", en:"Real friends share and take turns. You're being a great friend!", zh:"真正的朋友分享和轮流。你是个很棒的朋友！", tip:"指着正一起玩的孩子和朋友，边指边夸他是个懂分享的好朋友。" },
      ],
    }
  },

  manners: {
    icon: "😊", name: "礼貌用语", color: "var(--accent)",
    phrases: {
      "0-1": [
        { id:"mn01", en:"Please! More milk, please!", zh:"请！再要牛奶，请！", tip:"递东西给宝宝前先自己说一句please做示范。" },
        { id:"mn02", en:"Thank you! Thank you, sweetie!", zh:"谢谢！谢谢你，小宝贝！", tip:"宝宝把东西递给你时，微笑着接过来说谢谢，亲身示范感恩，不期待宝宝开口回应。" },
        { id:"mn03", en:"You're welcome! Of course!", zh:"不客气！当然！", tip:"宝宝或家人说谢谢时，笑着点点头回一句不客气做示范。" },
        { id:"mn04", en:"Ooh, so polite! Good job!", zh:"哦，真有礼貌！真棒！", tip:"看到宝宝有礼貌的举动立刻竖起大拇指夸他真有礼貌。" },
        { id:"mn05", en:"Excuse me! Pardon me!", zh:"打扰一下！借过！", tip:"牵着宝宝从别人身边经过时说一声借过做示范。" },
      ],
      "1-2": [
        { id:"mn11", en:"Say please! Can you say please?", zh:"说请！你能说请吗？", tip:"把宝宝想要的东西先拿在手里，轻声提示他说请。" },
        { id:"mn12", en:"Say thank you! Someone gave you something nice!", zh:"说谢谢！有人给了你好东西！", tip:"有人递东西给宝宝时，轻轻碰碰他提示说谢谢。" },
        { id:"mn13", en:"Good manners! You said please! That's so nice!", zh:"好有礼貌！你说了请！真好！", tip:"宝宝自己说了请就立刻蹲下来抱抱他，夸他真有礼貌。" },
        { id:"mn14", en:"Excuse me! We say excuse me when we need to pass!", zh:"打扰一下！需要经过时我们说打扰一下！", tip:"需要从别人身边经过时，牵着宝宝一起说打扰一下。" },
        { id:"mn15", en:"Sorry! Oops, say sorry!", zh:"对不起！哎呀，说对不起！", tip:"发生小碰撞时立刻自己说一声对不起给宝宝做示范。" },
      ],
      "2-3": [
        { id:"mn21", en:"What do we say when we want something? Please!", zh:"想要东西的时候说什么？请！", tip:"把宝宝想要的东西举在手里，问他想要东西时说什么。" },
        { id:"mn22", en:"Someone helped you. What do you say? Thank you!", zh:"有人帮了你。你说什么？谢谢！", tip:"有人帮了宝宝后，蹲下来问他这时候该说什么。" },
        { id:"mn23", en:"You bumped into someone. What's the polite thing to say?", zh:"你碰到了别人。有礼貌的说法是什么？", tip:"宝宝碰到别人时蹲下来问他有礼貌的说法是什么。" },
        { id:"mn24", en:"We say excuse me when we need to pass. Can you try?", zh:"需要经过时我们说打扰一下。你能试试吗？", tip:"在需要经过的场合轻推宝宝，鼓励他自己说打扰一下。" },
        { id:"mn25", en:"When someone gives you a gift, what do we say?", zh:"别人送你礼物的时候，我们说什么？", tip:"收到礼物前先问宝宝别人送你礼物时我们说什么。" },
      ],
      "3-6": [
        { id:"mn31", en:"It makes people feel good when you say thank you. Did you see them smile?", zh:"你说谢谢会让别人感觉很好。你看到他们笑了吗？", tip:"指向刚刚微笑的那个人，让孩子顺着你的手看过去，把「谢谢」和对方的笑脸联系起来。" },
        { id:"mn32", en:"Do you know which words make people feel respected? Please, thank you, excuse me!", zh:"你知道哪些词能让人感到被尊重吗？请、谢谢、打扰一下！", tip:"掰着手指一个个数请、谢谢、打扰一下，问孩子哪些让人被尊重。" },
        { id:"mn33", en:"Even if you don't like the gift, what's the kind thing to say?", zh:"就算你不喜欢礼物，善意的说法是什么？", tip:"拿起一件礼物递到孩子手里，问他就算不喜欢该怎么说。" },
        { id:"mn34", en:"How do you ask politely when you want something at the table?", zh:"在餐桌上想要东西时，你怎么礼貌地请求？", tip:"在餐桌上指着孩子够不到的菜，问他怎么礼貌地请人递。" },
        { id:"mn35", en:"When you're polite, people can tell you really care about them.", zh:"你有礼貌，别人就能感受到你真的在乎他们。", tip:"指着刚被礼貌对待而微笑的人，让孩子看到有礼貌就是在乎别人。" },
      ],
    }
  },

  safety: {
    icon: "🚸", name: "安全规则", color: "var(--accent)",
    phrases: {
      "0-1": [
        { id:"sf01", en:"Stop! Stop right there!", zh:"停！就停在那里！", tip:"伸手轻轻拦住宝宝，用坚定但不吓人的声音说停。" },
        { id:"sf02", en:"Wait! Wait for Mommy!", zh:"等！等妈妈！", tip:"在危险前一把牵住宝宝的手，平静而明确地说等一等。" },
        { id:"sf03", en:"Hold on! I've got you.", zh:"抓好！我抱着你。", tip:"抱着宝宝时说，让宝宝感受到被保护和支撑。" },
        { id:"sf04", en:"No no, hot! Don't touch!", zh:"不不，烫！不要碰！", tip:"在宝宝伸手够热东西时挡住他的手，严肃地说烫不要碰。" },
        { id:"sf05", en:"Stay close! Right here with me.", zh:"待在旁边！就在我这里。", tip:"在人多的地方把宝宝拉到身边，边拉边说待在旁边。" },
      ],
      "1-2": [
        { id:"sf11", en:"Hold my hand! We hold hands near the road.", zh:"牵我的手！在马路边要牵手。", tip:"每次走近马路就牵起宝宝的手，边牵边说过马路要牵手。" },
        { id:"sf12", en:"Wait for Mommy! Wait for Daddy!", zh:"等妈妈！等爸爸！", tip:"伸手拦住宝宝，指指自己让他等妈妈等爸爸。" },
        { id:"sf13", en:"Stop at the road! Cars are coming!", zh:"在马路边停下！有汽车来了！", tip:"指向道路同时说，建立视觉和语言的安全联系。" },
        { id:"sf14", en:"Don't run near the road! Walk with me!", zh:"马路边不要跑！和我一起走！", tip:"牵住宝宝放慢脚步一起走，边走边说马路边不能跑。" },
        { id:"sf15", en:"You waited so nicely! You stopped! Well done!", zh:"等得真好！你停下来了！真棒！", tip:"宝宝停下来时立刻蹲下来抱抱他，夸他等得真好。" },
      ],
      "2-3": [
        { id:"sf21", en:"Why do we hold hands near cars?", zh:"为什么在汽车旁边要牵手？", tip:"在车旁牵着宝宝的手，问他为什么在汽车旁边要牵手。" },
        { id:"sf22", en:"Cars can go very fast. We need to be careful!", zh:"汽车可以跑得很快。我们需要小心！", tip:"指着飞驰而过的汽车，边指边说车很快我们要小心。" },
        { id:"sf23", en:"Before we cross, we look left and right. Can you do that?", zh:"过马路前，我们向左看向右看。你能这样做吗？", tip:"牵着宝宝在路口一起向左看向右看，边看边说。" },
        { id:"sf24", en:"If you get lost, find a safe grown-up to help.", zh:"如果你走失了，找一个安全的大人帮忙。", tip:"指指周围穿制服的工作人员，告诉宝宝走失了就找这样的大人。" },
        { id:"sf25", en:"We always stop at the curb. The curb is our stop line!", zh:"我们总是在路沿石停下。路沿石是我们的停止线！", tip:"走到路沿石就停下脚步指给宝宝看，说这是我们的停止线。" },
      ],
      "3-6": [
        { id:"sf31", en:"What do we do before we cross the street? Look, listen, then go!", zh:"过马路前我们做什么？看、听、然后走！", tip:"在路边停下，牵住孩子的手，配合口诀左右转头看一看，示范「看、听、走」。" },
        { id:"sf32", en:"Why is it dangerous to run near the road?", zh:"为什么在马路边跑步危险？", tip:"在马路边停下牵着孩子，问他为什么在马路边跑步危险。" },
        { id:"sf33", en:"What would you do if a stranger asked you to go with them?", zh:"如果一个陌生人叫你跟他走，你会怎么做？", tip:"和孩子面对面坐下，演一遍陌生人搭话让他练习怎么应对。" },
        { id:"sf34", en:"I know rules can feel annoying sometimes — but they keep you safe.", zh:"我知道规则有时让人觉得烦，但它们能保护你的安全。", tip:"蹲下来看着孩子的眼睛，边点头认可他的烦躁边解释规则保护他。" },
        { id:"sf35", en:"If there's an emergency, what's our family's plan?", zh:"如果有紧急情况，我们家的计划是什么？", tip:"和孩子一起坐下画出家里的紧急计划，边画边讲每一步。" },
      ],
    }
  },

  sick: {
    icon: "🤒", name: "生病照顾", color: "var(--purple)",
    phrases: {
      "0-1": [
        { id:"sk01", en:"I know, I know. You don't feel well.", zh:"我知道，我知道。你不舒服。", tip:"把宝宝抱在怀里轻轻摇，平静地说我知道你不舒服。" },
        { id:"sk02", en:"I'm here. You're going to be okay.", zh:"我在这里。你会好起来的。", tip:"把生病的宝宝抱紧一点，边轻拍后背边说我在这里。" },
        { id:"sk03", en:"So warm. Let me feel your forehead.", zh:"好暖。让我摸摸你的额头。", tip:"轻轻触碰额头时说，帮宝宝习惯检查体温的过程。" },
        { id:"sk04", en:"Rest now. Shh, rest.", zh:"现在休息。嘘，休息。", tip:"把手轻轻搭在宝宝背上有节奏地拍，柔声说休息。" },
        { id:"sk05", en:"You're safe. I'm right here with you.", zh:"你很安全。我就在你身边。", tip:"守在宝宝身边握着他的手，反复轻声说我就在这里。" },
      ],
      "1-2": [
        { id:"sk11", en:"Does your tummy hurt? Show me where it hurts.", zh:"肚子疼吗？告诉我哪里疼。", tip:"摸摸宝宝的小肚子，请他指一指哪里疼。" },
        { id:"sk12", en:"You have a fever. Your body is fighting the germs!", zh:"你发烧了。你的身体在对抗细菌！", tip:"摸摸宝宝发烫的额头，笑着说身体在打败细菌呢。" },
        { id:"sk13", en:"Does your head hurt? Your throat? Show me!", zh:"头疼吗？嗓子疼吗？告诉我！", tip:"轻轻点点宝宝的头、嗓子，边点边问是这里疼吗。" },
        { id:"sk14", en:"Time for medicine. It will help you feel better!", zh:"吃药时间。它会帮你好起来！", tip:"把药端到宝宝面前，笑着说它会帮你好起来。" },
        { id:"sk15", en:"Rest and cuddle time. Mommy will stay with you.", zh:"休息和抱抱时间。妈妈会陪着你。", tip:"把宝宝搂进怀里靠着你，边抱边说妈妈陪着你。" },
      ],
      "2-3": [
        { id:"sk21", en:"You have a fever. We need to see the doctor today.", zh:"你发烧了。我们今天需要去看医生。", tip:"摸摸宝宝的额头，平静地说发烧了我们今天去看医生。" },
        { id:"sk22", en:"The doctor will check your ears and throat. It won't hurt much.", zh:"医生会检查你的耳朵和嗓子。不会很疼的。", tip:"指指自己的耳朵和嗓子，告诉宝宝医生会检查这里不太疼。" },
        { id:"sk23", en:"How do you feel today? Better or the same?", zh:"你今天感觉怎么样？好一些还是一样？", tip:"摸摸宝宝的脸问他今天感觉好些了还是一样。" },
        { id:"sk24", en:"Drinking water helps your body get better faster!", zh:"喝水能帮你的身体更快好起来！", tip:"把水杯递到宝宝手里，边喝边说喝水能帮身体快点好。" },
        { id:"sk25", en:"Your body is strong. It knows how to get better!", zh:"你的身体很强壮。它知道怎么好起来！", tip:"把手放在宝宝胸口，告诉他身体很强壮知道怎么好起来。" },
      ],
      "3-6": [
        { id:"sk31", en:"The medicine will help you feel better. Can you be brave and take it?", zh:"药会帮你好起来。你能勇敢地吃吗？", tip:"把药端到孩子面前，问他能不能勇敢地把它吃下去。" },
        { id:"sk32", en:"What part of your body hurts? Can you describe it?", zh:"你身体哪里疼？你能描述一下吗？", tip:"摸摸孩子的身体问他哪里疼，请他试着描述一下。" },
        { id:"sk33", en:"Even doctors and nurses get sick sometimes. Everyone does.", zh:"医生和护士有时也会生病。每个人都会。", tip:"挨着孩子坐下搂住他，告诉他医生护士有时也会生病人人都会。" },
        { id:"sk34", en:"Let's read a book while you rest. What would you like?", zh:"你休息的时候我们读本书。你想读什么？", tip:"拿几本书坐到孩子床边，问他休息时想读哪一本。" },
        { id:"sk35", en:"You were so brave at the doctor! I'm really proud of you.", zh:"你在医生那里好勇敢！我真的很为你骄傲。", tip:"从医院回来抱抱孩子，具体夸他在医生那里好勇敢。" },
      ],
    }
  },

  cleanup: {
    icon: "🧹", name: "收拾整理", color: "var(--teal)",
    phrases: {
      "0-1": [
        { id:"cl01", en:"In it goes! Into the box!", zh:"放进去！放进盒子里！", tip:"帮宝宝把玩具放入盒中时说，建立收纳动作的语言联系。" },
        { id:"cl02", en:"Out it comes! Now in again!", zh:"拿出来！现在再放进去！", tip:"和宝宝把玩具拿出来再放进去反复玩，边做边说。" },
        { id:"cl03", en:"Plop! In the basket!", zh:"扑通！放进篮子！", tip:"把玩具扔进篮子发出扑通声，逗宝宝一起放。" },
        { id:"cl04", en:"All gone! Everything in!", zh:"都不见了！全放进去了！", tip:"把最后一个玩具放进去后摊开手，说都收好了。" },
        { id:"cl05", en:"Good helper! You helped put things away!", zh:"好帮手！你帮忙收拾了！", tip:"宝宝放进一个玩具就竖起大拇指夸他是好帮手。" },
      ],
      "1-2": [
        { id:"cl11", en:"Clean up time! Into the box, toys!", zh:"收拾时间！玩具进盒子！", tip:"拍拍手指指玩具箱，宣布收拾时间到，带宝宝一起放。" },
        { id:"cl12", en:"Let's sing the cleanup song! Clean up, clean up, everybody clean up!", zh:"我们唱收拾歌！收啊收，收啊收，大家一起收！", tip:"一边唱收拾歌一边把玩具往盒里放，带着宝宝一起。" },
        { id:"cl13", en:"Where does this go? In the box! Good job!", zh:"这个放哪里？放盒子里！好棒！", tip:"拿起玩具问宝宝这个放哪里，再和他一起放进盒子。" },
        { id:"cl14", en:"All the blocks in! Can you find any more?", zh:"积木全放进去了！你还能找到吗？", tip:"和宝宝一起在地上到处找剩下的积木放进去。" },
        { id:"cl15", en:"We're all done! The room looks so tidy!", zh:"收拾好了！房间看起来好整齐！", tip:"收好后拉着宝宝环顾房间，边指边说好整齐。" },
      ],
      "2-3": [
        { id:"cl21", en:"Where does this toy live? Let's put it back home!", zh:"这个玩具住在哪里？我们送它回家！", tip:"拿起玩具和宝宝一起送它回到自己的盒子家里。" },
        { id:"cl22", en:"Can you find all the blocks? They need to go in the bag!", zh:"你能找到所有积木吗？它们要放进袋子里！", tip:"指着散落的积木请宝宝帮忙找出来放进袋子。" },
        { id:"cl23", en:"First we clean up, then we can have a snack. Ready?", zh:"先收拾，然后我们吃零食。准备好了吗？", tip:"指指玩具再指指零食，说先收拾再吃零食，带他一起收。" },
        { id:"cl24", en:"You cleaned up all by yourself! That was a big job!", zh:"你自己收拾好了！这是一件大工作！", tip:"看着收拾好的房间和宝宝击掌，夸他自己完成了大工作。" },
        { id:"cl25", en:"When we're done playing, we always put things away. That's our rule!", zh:"玩完后我们总是收拾好。这是我们的规定！", tip:"边说边和孩子一起把玩具放进收纳箱，用动作示范这条规则。" },
      ],
      "3-6": [
        { id:"cl31", en:"Your room will feel nicer when it's tidy. Let's make it cozy!", zh:"收拾整齐后你的房间会更舒适。我们让它变温馨吧！", tip:"和孩子一起把散乱的东西归位，边收边说房间会变得更舒适。" },
        { id:"cl32", en:"Can you sort the toys into the right boxes? Books with books, cars with cars!", zh:"你能把玩具分类放入正确的盒子吗？书和书，车和车！", tip:"和孩子一起把书和车分别放进不同的盒子，边分边说。" },
        { id:"cl33", en:"Let's set a timer! Can you clean up before it goes off?", zh:"我们定个计时器！你能在响之前收拾好吗？", tip:"设好计时器给孩子看，比赛看他能不能在响之前收好。" },
        { id:"cl34", en:"Let's take good care of your toys so they last a long time!", zh:"我们好好爱惜玩具，它们就能用很久！", tip:"拿起一件玩具和孩子一起放好，边放边说好好爱惜它就能用很久。" },
        { id:"cl35", en:"You did a great job tidying! How does the room feel now?", zh:"你收拾得真棒！现在房间感觉怎么样？", tip:"收好后和孩子一起环顾房间，问他现在感觉怎么样。" },
      ],
    }
  },

  discover: {
    icon: "🔍", name: "认识世界", color: "var(--teal)",
    phrases: {
      "0-1": [
        { id:"dc01", en:"Look! A bird! Tweet tweet!", zh:"看！小鸟！叽叽叽！", tip:"指向鸟时加上叫声，音效词对宝宝极具吸引力。" },
        { id:"dc02", en:"Yellow! The flower is yellow!", zh:"黄色！花是黄色的！", tip:"指向花朵命名颜色，颜色和实物同时出现学习效果最好。" },
        { id:"dc03", en:"Round! The ball is round!", zh:"圆的！球是圆的！", tip:"描述形状时手做圆形手势，帮宝宝用多感官理解。" },
        { id:"dc04", en:"Soft! Touch the soft blanket!", zh:"软软的！摸摸软软的毯子！", tip:"拉着宝宝的手摸摸软软的毯子，边摸边说软。" },
        { id:"dc05", en:"Big dog! Small cat! Big, small!", zh:"大狗！小猫！大，小！", tip:"指着大狗再指着小猫，边指边说大和小。" },
      ],
      "1-2": [
        { id:"dc11", en:"What's that? A car! Vroom vroom!", zh:"那是什么？汽车！呜呜！", tip:"指着路过的汽车问那是什么，再自己答汽车呜呜。" },
        { id:"dc12", en:"A dog! Can you say dog? Woof woof!", zh:"狗狗！你能说狗吗？汪汪！", tip:"指着小狗学一声汪汪，再邀请宝宝跟着说狗。" },
        { id:"dc13", en:"Look at the butterfly! It's flying! Flutter flutter!", zh:"看蝴蝶！它在飞！扑扑扑！", tip:"用手指跟着飞舞的蝴蝶划过去，边追边说它在飞。" },
        { id:"dc14", en:"Hot sun! The sun is warm! Feel the warmth!", zh:"热热的太阳！太阳很暖和！感受暖意！", tip:"把宝宝的手摊向阳光，边晒边说太阳暖暖的。" },
        { id:"dc15", en:"Truck! Big big truck! It's so big!", zh:"大卡车！好大的卡车！好大啊！", tip:"指着大卡车张开手臂比一比，边比边夸张地说好大。" },
      ],
      "2-3": [
        { id:"dc21", en:"Why does the dog bark? It's talking to us!", zh:"狗狗为什么叫？它在跟我们说话！", tip:"指着叫的小狗，边指边说它在跟我们说话呢。" },
        { id:"dc22", en:"What color is the sky today? Blue! What about the clouds?", zh:"今天天空是什么颜色？蓝色！那云呢？", tip:"抬头指着天空问宝宝今天是什么颜色，再指指云。" },
        { id:"dc23", en:"Where do you think the bird is going? Maybe to find food!", zh:"你觉得小鸟要去哪里？也许去找食物！", tip:"指着飞走的小鸟，问宝宝它要去哪里。" },
        { id:"dc24", en:"Feel the rough bark! The tree's skin is bumpy!", zh:"摸摸粗糙的树皮！树的皮是凹凸不平的！", tip:"拉着宝宝的手摸摸粗糙的树皮，边摸边说凹凸不平。" },
        { id:"dc25", en:"It's raining! Where does the rain come from?", zh:"下雨了！雨从哪里来？", tip:"伸手接几滴雨给宝宝看，问他雨是从哪里来的。" },
      ],
      "3-6": [
        { id:"dc31", en:"How do you think that works?", zh:"你觉得这个是怎么运作的？", tip:"指着那个东西，问孩子你觉得它是怎么运作的。" },
        { id:"dc32", en:"Why do you think leaves change color in autumn?", zh:"你觉得为什么树叶在秋天会变色？", tip:"捡起一片变色的叶子递给孩子，问他为什么秋天叶子会变色。" },
        { id:"dc33", en:"Let's look it up! I wonder if we can find the answer.", zh:"我们来查一查！我想知道能不能找到答案。", tip:"拿起书或手机和孩子一起查，边翻边说我们来找答案。" },
        { id:"dc34", en:"You asked a great question! I don't know either — let's find out!", zh:"你问了一个很好的问题！我也不知道——我们一起找答案！", tip:"摸摸孩子的头说这个问题真好我也不知道，拉他一起找答案。" },
        { id:"dc35", en:"What do you notice about this bug? How many legs does it have?", zh:"你注意到这只虫子的什么？它有几条腿？", tip:"和孩子一起蹲下来指着虫子，数一数它有几条腿。" },
      ],
    }
  },

  praise: {
    icon: "⭐", name: "表扬鼓励", color: "var(--accent2)",
    phrases: {
      "0-1": [
        { id:"pw01", en:"Good job! You did it!", zh:"做得好！你做到了！", tip:"用愉快的声音和表情配合夸奖，宝宝会感受到你的喜悦。" },
        { id:"pw02", en:"Yes! Well done, little one!", zh:"耶！做得好，小宝贝！", tip:"宝宝有小进步时立刻拍手欢呼，夸他做得好。" },
        { id:"pw03", en:"Look at you go! Amazing!", zh:"看你！太棒了！", tip:"指着宝宝刚做到的动作，边指边惊喜地夸太棒了。" },
        { id:"pw04", en:"I love watching you try!", zh:"我喜欢看你尝试！", tip:"看着正在尝试的宝宝点点头微笑，说我喜欢看你尝试。" },
        { id:"pw05", en:"You're doing great! Keep going!", zh:"你做得很好！继续！", tip:"宝宝在坚持时凑近拍拍手，为他加油说继续。" },
      ],
      "1-2": [
        { id:"pw11", en:"Good job! You did it all by yourself!", zh:"好棒！你自己做到了！", tip:"指着宝宝独自完成的东西竖起大拇指，夸他自己做到了。" },
        { id:"pw12", en:"You tried so hard! I'm proud of you!", zh:"你那么努力尝试！我为你骄傲！", tip:"蹲下来抱抱宝宝，具体夸他刚才那么努力地尝试。" },
        { id:"pw13", en:"Yay! You did it! High five!", zh:"耶！你做到了！击掌！", tip:"伸出张开的手掌举到宝宝面前，让他用小手拍上来，完成击掌。" },
        { id:"pw14", en:"You're getting better and better!", zh:"你越来越好了！", tip:"比一比宝宝以前和现在的样子，笑着说你越来越好了。" },
        { id:"pw15", en:"I see you trying! That makes me so happy!", zh:"我看到你在努力！这让我好开心！", tip:"看着努力中的宝宝点点头，说我看到你在努力真开心。" },
      ],
      "2-3": [
        { id:"pw21", en:"I love how you didn't give up! You kept trying!", zh:"我喜欢你没有放弃！你一直在尝试！", tip:"蹲下来和宝宝对视，具体夸他刚才一直没放弃。" },
        { id:"pw22", en:"That was tricky and you did it anyway! Wow!", zh:"那很难，但你还是做到了！哇！", tip:"指着刚完成的难事，边拍手边说那么难你还是做到了。" },
        { id:"pw23", en:"You worked really hard on that! Look what you made!", zh:"你为那个真的很努力！看你做的！", tip:"指着孩子做出来的东西，边指边夸他为这个很努力。" },
        { id:"pw24", en:"Mistakes help you learn! You're getting smarter!", zh:"犯错帮助你学习！你越来越聪明了！", tip:"宝宝出错时摸摸他的头，笑着说犯错帮你越来越聪明。" },
        { id:"pw25", en:"You did something hard! Are you proud of yourself?", zh:"你做了一件很难的事！你是不是也为自己感到骄傲呀？", tip:"指着孩子完成的难事，问他是不是也为自己感到骄傲。" },
      ],
      "3-6": [
        { id:"pw31", en:"You practiced and got better! That's how learning works!", zh:"你练习了然后进步了！这就是学习的方式！", tip:"比划出孩子练习前后的变化，指着说你练习了所以进步了。" },
        { id:"pw32", en:"I noticed you didn't give up when it was hard. That's real courage!", zh:"我注意到在困难的时候你没有放弃。那是真正的勇气！", tip:"蹲下来看着孩子的眼睛，说困难时你没放弃那是真勇气。" },
        { id:"pw33", en:"It's not about being the best — it's about doing your best!", zh:"不是要成为最好的——而是要尽力做到最好！", tip:"拍拍孩子的胸口，告诉他不用跟别人比只要尽力做到最好。" },
        { id:"pw34", en:"What part are you most proud of? Tell me!", zh:"你最骄傲哪个部分？告诉我！", tip:"指着孩子的作品，问他最骄傲哪个部分。" },
        { id:"pw35", en:"I'm proud of you not just for finishing, but for trying so hard.", zh:"我为你骄傲，不只是因为你做完了，更因为你这么努力。", tip:"搂着孩子告诉他，我为你的努力比为结果更骄傲。" },
      ],
    }
  },

  exercise: {
    icon: "🏃", name: "运动游戏", color: "var(--green)",
    phrases: {
      "0-1": [
        { id:"ex01", en:"Kick kick kick! Strong legs!", zh:"踢踢踢！有力的小腿！", tip:"轻轻帮宝宝踢动双腿，配合节奏感的语言刺激。" },
        { id:"ex02", en:"Tummy time! Look up, look up!", zh:"趴趴时间！抬头，抬头！", tip:"趴着时在宝宝前方吸引注意，鼓励头部力量发展。" },
        { id:"ex03", en:"Reach! Grab it! You can do it!", zh:"够！抓住它！你能做到！", tip:"把玩具放在稍远处鼓励伸手，发展上肢力量和协调。" },
        { id:"ex04", en:"Roll over! There you go!", zh:"翻身！好样的！", tip:"帮宝宝翻身时说，建立翻身动作和语言的联系。" },
        { id:"ex05", en:"Up up up! Stand up!", zh:"起来起来！站起来！", tip:"扶着宝宝站立时说，为之后的独立站立做语言准备。" },
      ],
      "1-2": [
        { id:"ex11", en:"Run run run! Fast feet!", zh:"跑跑跑！快脚丫！", tip:"跟着宝宝跑，配合夸张的语气，让运动充满乐趣。" },
        { id:"ex12", en:"Jump! Jump jump jump!", zh:"跳！跳跳跳！", tip:"示范跳的动作并说出来，宝宝会模仿大人的动作和声音。" },
        { id:"ex13", en:"Stomp your feet! Big stomps!", zh:"踩脚！用力踩！", tip:"夸张地踩脚，给宝宝展示全身投入运动的乐趣。" },
        { id:"ex14", en:"Spin around! Wheee!", zh:"转圈圈！嗖嗖嗖！", tip:"抱着宝宝轻轻转圈圈，边转边喊嗖。" },
        { id:"ex15", en:"Get the ball! Go get it!", zh:"去拿球！快去拿！", tip:"把球轻轻推向前方，指着球，鼓励宝宝爬或走过去把它拿回来。" },
      ],
      "2-3": [
        { id:"ex21", en:"How high can you jump? Show me your biggest jump!", zh:"你能跳多高？给我看你最大的跳！", tip:"自己先跳一下做示范，问宝宝能跳多高。" },
        { id:"ex22", en:"Let's count your jumps! One, two, three...", zh:"我们数你的跳！一、二、三……", tip:"宝宝每跳一下就拍手数一个数，边跳边数。" },
        { id:"ex23", en:"Can you walk on tiptoe? Try it!", zh:"你能踮起脚尖走路吗？试试！", tip:"自己踮起脚尖走两步给宝宝看，请他跟着试试。" },
        { id:"ex24", en:"Touch your toes! Bend down low!", zh:"碰脚趾！弯腰低下去！", tip:"自己弯腰碰碰脚趾做示范，请宝宝也弯下去碰一碰。" },
        { id:"ex25", en:"Freeze! Now go! Freeze! Now go!", zh:"定住！现在动！定住！现在动！", tip:"喊定住就和宝宝一起停住不动，喊动就一起跑起来。" },
      ],
      "3-6": [
        { id:"ex31", en:"Simon says jump! Simon says touch your nose!", zh:"西蒙说跳！西蒙说摸鼻子！", tip:"自己边说边做动作带头玩，看孩子有没有跟对指令。" },
        { id:"ex32", en:"Can you follow the leader? Do everything I do!", zh:"你能跟着领队做吗？我做什么，你就做什么！", tip:"在前面做各种动作让孩子跟着你做，边做边说。" },
        { id:"ex33", en:"Let's do ten jumping jacks! Count with me!", zh:"我们做十个开合跳！跟我一起数！", tip:"和孩子并排一起做开合跳，边跳边数到十。" },
        { id:"ex34", en:"It's okay if you lose a game. What matters is you played hard!", zh:"输了没关系。重要的是你全力以赴！", tip:"孩子输了时蹲下来拍拍他的肩，说全力以赴最重要。" },
        { id:"ex35", en:"When you move and play, your body gets strong!", zh:"动一动，玩一玩，身体就会变强壮！", tip:"捏捏孩子运动后的手臂，笑着说多动一动身体就变强壮。" },
      ],
    }
  },

  kitchen: {
    icon: "🥄", name: "厨房帮忙", color: "var(--accent)",
    phrases: {
      "0-1": [
        { id:"kt01", en:"Mommy is stirring! Round and round!", zh:"妈妈在搅拌！转啊转！", tip:"一边搅拌锅里的食物一边转给宝宝看，边做边说。" },
        { id:"kt02", en:"Listen! Sizzle sizzle! Dinner's cooking!", zh:"听！滋滋滋！在做饭啦！", tip:"把宝宝抱到锅边听滋滋声，边听边说这是在做饭。" },
        { id:"kt03", en:"Mmm, it smells so good! Something yummy is cooking!", zh:"嗯，好香！有好吃的东西在做了！", tip:"抱着宝宝凑近锅边闻一闻，边闻边说好香。" },
        { id:"kt04", en:"Look at all the vegetables! Colors everywhere!", zh:"看这么多蔬菜！到处都是颜色！", tip:"拿起不同颜色的蔬菜举给宝宝看，边指边说颜色。" },
        { id:"kt05", en:"Daddy is chopping! Chop chop chop!", zh:"爸爸在切菜！切切切！", tip:"一边切菜一边发出切切切的声音给宝宝听。" },
      ],
      "1-2": [
        { id:"kt11", en:"Can you stir? Round and round! Good job!", zh:"你能搅拌吗？转啊转！好棒！", tip:"把安全的勺子递给宝宝，握着他的手一起搅几下。" },
        { id:"kt12", en:"Spoon! This is a spoon. Stir stir stir!", zh:"勺子！这是勺子。搅搅搅！", tip:"举起勺子给宝宝看，再示范用它搅一搅。" },
        { id:"kt13", en:"Bowl! Put it in the bowl! Plop plop!", zh:"碗！放进碗里！扑扑扑！", tip:"让宝宝把食材放入碗中，简单参与建立厨房自信心。" },
        { id:"kt14", en:"That's a carrot! Orange! Crunch crunch!", zh:"这是胡萝卜！橙色的！嚼嚼嚼！", tip:"拿起胡萝卜在宝宝眼前晃一晃，边晃边说橙色、嚼嚼嚼。" },
        { id:"kt15", en:"Wash the vegetable! Rub rub rub! Clean and ready!", zh:"洗蔬菜！搓搓搓！干净可以吃了！", tip:"把菜和宝宝的手一起放到水下搓一搓，边搓边说。" },
      ],
      "2-3": [
        { id:"kt21", en:"Pour the water in! Slowly, carefully!", zh:"把水倒进去！慢慢的，小心！", tip:"扶着宝宝的手把水慢慢倒进碗里，边倒边说慢慢来。" },
        { id:"kt22", en:"Wash the vegetable! Can you rub it clean?", zh:"洗蔬菜！你能把它搓干净吗？", tip:"把菜递到宝宝手里，请他在水下搓干净。" },
        { id:"kt23", en:"What do you think we're making? Can you guess?", zh:"你觉得我们在做什么？你能猜猜吗？", tip:"让宝宝闻一闻锅里的味道，问他猜猜我们在做什么。" },
        { id:"kt24", en:"Is it hot or cold? Don't touch the stove — it's hot!", zh:"是热的还是冷的？不要碰炉子——很烫！", tip:"指着炉子伸手拦住宝宝，边拦边说很烫不要碰。" },
        { id:"kt25", en:"You're my little helper! This soup is going to be so yummy!", zh:"你是我的小帮手！这汤会很好喝！", tip:"把搅汤的勺子递到宝宝手里，一起搅一搅，边搅边夸他是小帮手。" },
      ],
      "3-6": [
        { id:"kt31", en:"First we wash the vegetables, then we cut them. What comes next?", zh:"先洗蔬菜，然后切。接下来是什么？", tip:"洗好一把菜再拿起刀，边做边问孩子接下来该做什么。" },
        { id:"kt32", en:"Can you measure two cups of flour? Let's count!", zh:"你能量两杯面粉吗？我们数一数！", tip:"把量杯递到孩子手里，扶着他舀面粉、再用手指把杯口的面粉刮平；烘焙中的测量是数学概念的真实应用，意义感强。" },
        { id:"kt33", en:"What do you think will happen when we mix these together?", zh:"你觉得我们把这些混在一起会发生什么？", tip:"把要混合的材料摆到孩子面前，问他混在一起会怎样。" },
        { id:"kt34", en:"You helped make this! How does it feel to eat something you made?", zh:"你帮忙做了这个！吃自己做的东西感觉怎么样？", tip:"把孩子帮忙做的菜端到他面前，问他吃自己做的感觉怎么样。" },
        { id:"kt35", en:"Look at you cooking! You're getting so good at this!", zh:"哇，你在做饭呢！你越来越拿手了！", tip:"把搅拌勺递到孩子手里，或握着他的手一起搅拌，边做边具体夸他做得越来越好。" },
      ],
    }
  },

  nap: {
    icon: "😴", name: "午睡时间", color: "var(--purple)",
    phrases: {
      "0-1": [
        { id:"np01", en:"Sleepy time. Close your eyes.", zh:"睡觉时间。闭上眼睛。", tip:"用最轻柔的声音说，配合轻拍背部节奏。" },
        { id:"np02", en:"Shhh... time to rest.", zh:"嘘……该休息了。", tip:"把灯调暗、声音渐渐放轻，帮宝宝安静下来。" },
        { id:"np03", en:"Cozy and warm. Nap time.", zh:"暖暖的，舒舒服服的。午睡时间。", tip:"用毯子包好宝宝时说，强化安全舒适感。" },
        { id:"np04", en:"Sweet dreams, little one.", zh:"做个好梦，小宝贝。", tip:"给宝宝掖好被子，每次午睡都轻声说同样的话。" },
        { id:"np05", en:"I'm right here. Sleep well.", zh:"我就在这里。好好睡。", tip:"坐到床边握着宝宝的小手，轻声说我就在这里。" },
      ],
      "1-2": [
        { id:"np11", en:"It's nap time! Let's find your blanket.", zh:"午睡时间到！我们去找你的小毯子。", tip:"牵着宝宝一起去找他的小毯子，边找边说午睡时间到了。" },
        { id:"np12", en:"Lie down. Close your eyes. Good.", zh:"躺下来。闭上眼睛。很好。", tip:"自己躺下闭眼做示范，扶着宝宝也躺好闭上眼睛。" },
        { id:"np13", en:"Shh, everything is quiet now.", zh:"嘘，现在一切都安静了。", tip:"竖起手指嘘一声，把周围调安静，轻声说都安静了。" },
        { id:"np14", en:"Teddy is sleeping too. Shhh!", zh:"小熊也在睡觉呢。嘘！", tip:"把小熊放到宝宝身边假装睡着，竖手指嘘一声。" },
        { id:"np15", en:"Sleep sleep sleep. Wake up happy!", zh:"睡呀睡呀睡。醒来开开心心！", tip:"轻拍着宝宝有节奏地哼睡呀睡，再笑说醒来开开心心。" },
      ],
      "2-3": [
        { id:"np21", en:"It's time for your nap. Your body needs rest.", zh:"该午睡了。你的身体需要休息。", tip:"拉上窗帘、把宝宝放到床上躺好时说，用动作配合「休息」这个词。" },
        { id:"np22", en:"Do you want your bunny or your bear for nap?", zh:"午睡要抱小兔子还是小熊？", tip:"一手拿小兔一手拿小熊举给宝宝，让他挑一个抱着午睡。" },
        { id:"np23", en:"Let's count to ten while you close your eyes. One, two...", zh:"我们闭上眼睛数到十。一、二……", tip:"陪宝宝一起闭上眼睛，轻声数一二三帮他平静下来。" },
        { id:"np24", en:"What did we do this morning? Tell me and then sleep.", zh:"我们早上做了什么？说完就睡觉。", tip:"坐在床边摸摸宝宝，问他早上做了什么说完就睡。" },
        { id:"np25", en:"After your nap we'll go to the park. Sleep first!", zh:"午睡后我们去公园。先睡觉！", tip:"给宝宝盖好被子，告诉他睡醒就去公园先睡觉。" },
      ],
      "3-6": [
        { id:"np31", en:"Even if you don't sleep, just rest your body.", zh:"就算不睡着，也要让身体休息一下。", tip:"给孩子掖好被子，轻声说不睡也没关系让身体歇一歇。" },
        { id:"np32", en:"Your brain grows when you sleep. That's why we rest!", zh:"睡觉的时候大脑会成长。所以我们要休息！", tip:"摸摸孩子的头，告诉他睡觉时大脑会长大所以要休息。" },
        { id:"np33", en:"You can look at a book quietly until you fall asleep.", zh:"你可以安静地看书，直到睡着为止。", tip:"把一本书放到孩子枕边，说可以安静看书直到睡着。" },
        { id:"np34", en:"How are you feeling? Tired? A little bit?", zh:"你感觉怎么样？累吗？有一点？", tip:"摸摸孩子的脸问他现在累不累、是不是有一点困。" },
        { id:"np35", en:"Let's set a timer. When it rings, nap time is over.", zh:"我们定个计时器。响了就结束午睡时间。", tip:"设好计时器放到孩子看得到的地方，说响了就结束午睡。" },
      ],
    }
  },

  snack: {
    icon: "🍎", name: "零食时间", color: "var(--green)",
    phrases: {
      "0-1": [
        { id:"sn01", en:"Snack time! Open wide.", zh:"零食时间！张开嘴巴。", tip:"把零食端到宝宝面前，笑着宣布零食时间张开嘴。" },
        { id:"sn02", en:"Mmm! So yummy!", zh:"嗯！好好吃！", tip:"夸张的表情和语气帮宝宝感受食物的乐趣。" },
        { id:"sn03", en:"It's a banana! Banana!", zh:"是香蕉！香蕉！", tip:"举起香蕉在宝宝眼前晃一晃，边晃边重复说香蕉。" },
        { id:"sn04", en:"One more. Yum yum!", zh:"再来一个。香香！", tip:"递上另一块零食，边送到宝宝手边边说。" },
        { id:"sn05", en:"All done! Good job!", zh:"吃完啦！真棒！", tip:"边说边和宝宝一起拍拍手，把「吃完了」和开心的动作连起来。" },
      ],
      "1-2": [
        { id:"sn11", en:"Snack time! What do we have today?", zh:"零食时间！今天吃什么？", tip:"把零食盒端到宝宝面前，边打开边问今天吃什么。" },
        { id:"sn12", en:"Apple! Red apple. Crunch crunch!", zh:"苹果！红色的苹果。嘎吱嘎吱！", tip:"拿起红苹果咬一口发出嘎吱声，边吃边说红苹果。" },
        { id:"sn13", en:"Can you say cracker? Crac-ker!", zh:"你能说饼干吗？饼-干！", tip:"举起饼干在宝宝眼前，边点边把饼-干拆开说给他听。" },
        { id:"sn14", en:"Big bite! Little bite. Now big again!", zh:"大口！小口。再大口！", tip:"自己张大嘴再抿小嘴做示范，带宝宝一起大口小口吃。" },
        { id:"sn15", en:"Yummy in your tummy! Pat pat pat.", zh:"美味进肚子！拍拍拍。", tip:"边拍肚子边说，帮宝宝理解食物和身体的关系。" },
      ],
      "2-3": [
        { id:"sn21", en:"What would you like for your snack — fruit or crackers?", zh:"零食想吃什么——水果还是饼干？", tip:"两手各端一样零食举到宝宝面前，让他伸手选一个。" },
        { id:"sn22", en:"Let's wash your hands first, then snack!", zh:"先洗手，再吃零食！", tip:"牵着宝宝先去洗手再回来吃零食，边走边说先洗手。" },
        { id:"sn23", en:"What color is your apple? Red! Can you say red?", zh:"你的苹果是什么颜色？红色！你能说红色吗？", tip:"举起宝宝的苹果问是什么颜色，再邀请他跟着说红色。" },
        { id:"sn24", en:"Is it sweet or sour? Tell me!", zh:"是甜的还是酸的？告诉我！", tip:"宝宝咬一口后自己做个表情，问他是甜的还是酸的。" },
        { id:"sn25", en:"Save one for me! Can you share?", zh:"留一个给我！能分享吗？", tip:"笑着向宝宝伸出手，问他能不能留一个给你。" },
      ],
      "3-6": [
        { id:"sn31", en:"Choose your snack. What looks good to you?", zh:"选你的零食。你觉得什么好吃？", tip:"把几样零食摊在孩子面前，让他自己挑喜欢的。" },
        { id:"sn32", en:"Fruit gives you energy to play! Let's try some.", zh:"水果给你玩耍的能量！来尝尝。", tip:"把水果递到孩子手里，说吃了它玩起来更有力气。" },
        { id:"sn33", en:"How many grapes can you count? Let's see!", zh:"你能数几颗葡萄？来看看！", tip:"指着盘里的葡萄和孩子一个一个数出来。" },
        { id:"sn34", en:"Snack time is almost over. Two more bites!", zh:"零食时间快结束了。再吃两口！", tip:"竖起两根手指给孩子看，说零食快结束了再吃两口。" },
        { id:"sn35", en:"Did you enjoy your snack? What was your favorite part?", zh:"零食好吃吗？你最喜欢哪个？", tip:"吃完后蹲下来问孩子零食好不好吃、最喜欢哪个。" },
      ],
    }
  },

  outdoor: {
    icon: "🌳", name: "户外玩耍", color: "var(--green)",
    phrases: {
      "0-1": [
        { id:"od01", en:"Outside! Feel the breeze!", zh:"外面！感受微风！", tip:"把宝宝的小手摊向微风，边吹边说感受风。" },
        { id:"od02", en:"Look at the sky! Blue sky!", zh:"看天空！蓝色的天空！", tip:"指向天空，帮宝宝学习颜色和方向词。" },
        { id:"od03", en:"Grass! Green grass. Touch it.", zh:"草！绿色的草。摸摸看。", tip:"拉着宝宝的手摸摸绿草，边摸边说草。" },
        { id:"od04", en:"Birdie! Tweet tweet tweet!", zh:"小鸟！啾啾啾！", tip:"指着树上的小鸟学它啾啾叫，逗宝宝一起听。" },
        { id:"od05", en:"Sun is warm! Nice and sunny.", zh:"太阳好温暖！阳光真好。", tip:"把宝宝的手摊向阳光，边晒边说太阳暖暖的。" },
      ],
      "1-2": [
        { id:"od11", en:"Let's go outside! Get your shoes!", zh:"我们出去玩！去拿你的鞋子！", tip:"指着门口的鞋子，请宝宝自己去拿来准备出门。" },
        { id:"od12", en:"Run run run! Fast fast fast!", zh:"跑跑跑！快快快！", tip:"牵着宝宝一起往前跑，边跑边喊快快快。" },
        { id:"od13", en:"What do you see? A dog! A big dog!", zh:"你看到什么？一只狗！一只大狗！", tip:"指着路过的小狗给宝宝看，边指边说一只大狗。" },
        { id:"od14", en:"Leaves! Pick up the leaf. Yellow leaf!", zh:"叶子！捡起叶子。黄色的叶子！", tip:"和宝宝一起捡起一片叶子，边捡边说黄色的叶子。" },
        { id:"od15", en:"Puddle! Jump over! Splash!", zh:"水坑！跳过去！溅起来！", tip:"牵着宝宝一起跳过小水坑，边跳边喊溅起来。" },
      ],
      "2-3": [
        { id:"od21", en:"What can you hear outside? Listen carefully!", zh:"户外能听到什么声音？仔细听！", tip:"和宝宝一起停下脚步竖起耳朵，问听到了什么。" },
        { id:"od22", en:"Let's collect some rocks. Which one do you like best?", zh:"我们来收集石头。你最喜欢哪一块？", tip:"蹲下来和宝宝一起捡石头，问他最喜欢哪一块。" },
        { id:"od23", en:"Can you find something red? Look around!", zh:"你能找到红色的东西吗？四处看看！", tip:"拉着宝宝四处看，一起找找有没有红色的东西。" },
        { id:"od24", en:"How does the dirt feel? Soft or hard?", zh:"泥土摸起来怎么样？软的还是硬的？", tip:"拉着宝宝的手摸摸泥土，问他是软的还是硬的。" },
        { id:"od25", en:"Time to go home soon. Five more minutes of playing!", zh:"快要回家了。再玩五分钟！", tip:"蹲下来指指手表告诉宝宝再玩五分钟就回家。" },
      ],
      "3-6": [
        { id:"od31", en:"What do you want to play at the park today?", zh:"今天在公园想玩什么？", tip:"到公园蹲下来问孩子今天想先玩什么，让他带路。" },
        { id:"od32", en:"Let's look for bugs! I wonder what we'll find.", zh:"我们来找虫虫！不知道会找到什么。", tip:"和孩子一起蹲下来翻找草丛里的虫子，边找边说不知会找到什么。" },
        { id:"od33", en:"How many steps to the big tree? Let's count!", zh:"走到大树需要多少步？我们数数！", tip:"牵着孩子一步步走向大树，边走边一起数步数。" },
        { id:"od34", en:"Watch out for other kids! Take turns on the slide.", zh:"注意其他小朋友！溜滑梯要轮流。", tip:"指着滑梯旁的小朋友，提醒孩子注意别人、轮流玩。" },
        { id:"od35", en:"What was your favorite thing about the park today?", zh:"今天公园里你最喜欢的是什么？", tip:"离开公园时牵着孩子问他今天最喜欢玩什么。" },
      ],
    }
  },

}; // end window.scenarios

window.scenarioOrder = [
  "bath", "meal", "bedtime", "emotion",
  "morning", "dress", "teeth", "handwash", "nap", "snack",
  "outdoor", "reading", "music", "art", "blocks", "pretend",
  "potty", "goodbye", "outing", "shopping", "friends", "share",
  "manners", "safety", "sick", "cleanup", "discover", "praise",
  "exercise", "kitchen"
];
