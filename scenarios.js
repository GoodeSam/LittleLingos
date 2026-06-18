// ── LittleLingos scenario data ──────────────────────────
window.scenarios = {

  bath: {
    icon: "🛁", name: "洗澡时间", color: "var(--blue)",
    phrases: {
      "0-1": [
        { id:"b01", en:"Bath time!", zh:"洗澡时间！", tip:"在你抱起宝宝走向浴室时重复说，建立条件反射。" },
        { id:"b02", en:"Warm water. Nice and warm.", zh:"温温的水，暖暖的。", tip:"用平静舒缓的语气，让宝宝感受安全感。" },
        { id:"b03", en:"Kick kick kick!", zh:"踢踢踢！", tip:"轻轻带动宝宝的小脚在水里踢动，边说边做。" },
        { id:"b04", en:"In you go!", zh:"进去咯！", tip:"放入浴盆时说，声调轻快，配合动作。" },
        { id:"b05", en:"Look at the bubbles!", zh:"看泡泡！", tip:"手指指向泡沫，吸引宝宝视线，培养注意力。" },
      ],
      "1-2": [
        { id:"b11", en:"Let's splash! Kick kick kick!", zh:"让我们溅水！踢踢踢！", tip:"带动宝宝双脚踢水，重复的节奏帮助宝宝预测和记住词汇。" },
        { id:"b12", en:"Where's your tummy? There it is!", zh:"肚子在哪里？在这里！", tip:"用游戏方式命名身体部位，这个年龄段效果最好。" },
        { id:"b13", en:"Scrub scrub scrub! Clean clean clean!", zh:"刷刷刷！干净干净！", tip:"边说边模仿搓洗动作，让宝宝觉得洗澡是游戏。" },
        { id:"b14", en:"Look at the bubbles! Pop pop!", zh:"看泡泡！啵啵啵！", tip:"手指轻戳泡泡同时说pop，音效词对宝宝很吸引。" },
        { id:"b15", en:"Warm water! Is it warm?", zh:"暖和的水！暖不暖？", tip:"鼓励宝宝感受并回应，哪怕只是点头或笑。" },
        { id:"b16", en:"All done! Squeaky clean!", zh:"洗好了！干净溜溜！", tip:"洗完时说，配合毛巾包裹的动作，形成仪式感。" },
      ],
      "2-3": [
        { id:"b21", en:"Can you wash your tummy? Where's your tummy?", zh:"你能洗肚肚吗？肚肚在哪？", tier:"basic",
          tip:"鼓励宝宝自己动手，培养自主性。",
          why:"让宝宝参与自己的洗澡，自主行动强化词汇记忆，比父母帮洗学得更快",
          next:"「Good job! Now let's do your arms!」继续引导下一个身体部位",
          fallback:"先指着自己的肚子说「My tummy!」再指向宝宝，示范比提问更有效" },
        { id:"b22", en:"What color is your duck?", zh:"你的小鸭子是什么颜色？", tier:"basic",
          tip:"结合玩具提问，自然地教颜色词汇。",
          why:"问题句让宝宝主动思考，这是最有效的语言习得方式",
          next:"「Yellow! It's a yellow duck. Can you say yellow?」重复颜色词，不纠正发音",
          fallback:"改为「Yellow duck!」指着颜色说，转为陈述句降低难度" },
        { id:"b23", en:"Close your eyes! Here comes the shampoo!", zh:"闭上眼睛！洗发水来咯！", tier:"basic",
          tip:"提前预告，减少宝宝对洗头的抵触。",
          why:"预告行动让宝宝心理上做好准备，是减少洗头抵触最有效的方式",
          next:"「Almost done! One more rinse...」进度提示帮助宝宝预期结束",
          fallback:"用玩具先演示洗头，再给宝宝，降低实际洗头的抵触感" },
        { id:"b24", en:"Should we do your hair now? Okay!", zh:"要洗头发了好吗？好！", tier:"basic",
          tip:"给宝宝参与感，减少抵触情绪。",
          why:"用问句给宝宝参与感，即使你替他回答 Okay，宝宝也感受到了被尊重",
          next:"「Tip your head back. Good! Water time!」分步骤引导配合动作",
          fallback:"唱歌版：「Wash wash wash your hair, gently now~」旋律帮助配合" },
        { id:"b25", en:"Are you all clean? Let me check... yes! Squeaky clean!", zh:"都洗干净了吗？我来看看……是的！干净溜溜！", tier:"expressive",
          tip:"夸张地检查宝宝的手脚，变成游戏。",
          why:"Squeaky clean 是生动的表达，宝宝喜欢这种夸张的声音感",
          next:"「Let's wrap you up! Cozy cozy!」用毛巾包裹宝宝时说",
          fallback:"简化为「All done! Clean!」加竖大拇指，视觉反馈很有效" },
      ],
      "3-6": [
        { id:"b31", en:"Okay, it's bath time! Can you get undressed by yourself?", zh:"好了，洗澡时间！你能自己脱衣服吗？", tip:"给予自主权，培养独立能力。" },
        { id:"b32", en:"What toys do you want to bring in the bath?", zh:"你想带什么玩具去洗澡？", tip:"让宝宝做决定，提升参与度。" },
        { id:"b33", en:"Let's count your toes! One, two, three...", zh:"我们数数脚趾！一、二、三……", tip:"洗脚时数数，寓教于乐。" },
        { id:"b34", en:"Almost done. Can you rinse your hair by yourself?", zh:"快好了。你能自己冲头发吗？", tip:"大孩子喜欢被信任，逐步让他们承担步骤。" },
        { id:"b35", en:"Great job washing up! You're so responsible!", zh:"洗得真好！你好负责任！", tip:"具体夸奖行为而非笼统夸聪明，更有效。" },
      ],
    }
  },

  meal: {
    icon: "🍚", name: "吃饭时间", color: "var(--green)",
    phrases: {
      "0-1": [
        { id:"m01", en:"Yummy yummy!", zh:"好好吃！", tip:"用夸张表情和愉快语气说，传递积极情绪。" },
        { id:"m02", en:"Open wide! Here comes the airplane!", zh:"嘴巴张大！飞机来咯！", tip:"经典喂食游戏，勺子像飞机飞进嘴里。" },
        { id:"m03", en:"One more bite?", zh:"再吃一口？", tip:"轻柔地询问，不强迫，让宝宝感受饥饱自主。" },
        { id:"m04", en:"All done? Show me your bowl.", zh:"吃完了？给我看看碗。", tip:"观察宝宝信号，尊重饱腹感。" },
      ],
      "1-2": [
        { id:"m11", en:"Open wide! Here comes the airplane! Vroom!", zh:"嘴巴张大！飞机来咯！呜——", tip:"把勺子当飞机，配合呜的音效，让吃饭更有趣。" },
        { id:"m12", en:"Yummy! Do you want more?", zh:"好吃！还要吗？", tip:"饭后询问，让宝宝练习用手势或词语表达需求。" },
        { id:"m13", en:"All done? Let's clean your hands.", zh:"吃完了？我们洗手手。", tip:"建立饭后洗手的仪式，自然过渡到下一个活动。" },
        { id:"m14", en:"Mmm, that's broccoli! Green!", zh:"嗯，这是西兰花！绿色的！", tip:"命名食物和颜色，边吃边学词汇最自然。" },
        { id:"m15", en:"Big bite! Good job!", zh:"大口吃！好棒！", tip:"在宝宝成功吃一口时立即夸奖，强化正向行为。" },
      ],
      "2-3": [
        { id:"m21", en:"What would you like to eat? Rice or noodles?", zh:"你想吃什么？米饭还是面条？", tier:"basic",
          tip:"给出两个选项，让宝宝练习做选择和表达。",
          why:"两选一结构完美：给宝宝真实选择权同时教了两个词汇",
          next:"「Rice! Good choice! Let's get the rice!」重复宝宝的选择强化词汇",
          fallback:"把两碗放在宝宝面前，让他用手指选，接受非语言回答" },
        { id:"m22", en:"That's broccoli! Can you say broccoli?", zh:"这是西兰花！你能说西兰花吗？", tier:"basic",
          tip:"鼓励宝宝模仿说新词，不纠正发音，鼓励尝试。",
          why:"命名后马上邀请重复——发音不重要，宝宝尝试的意愿才是学习在发生的信号",
          next:"「Bro-co-li! Three parts!」夸张分音节，把发音变成游戏",
          fallback:"改为「Green! Broccoli is green!」先教颜色再教名字，降低难度" },
        { id:"m23", en:"Yummy! Is it delicious?", zh:"好吃！好吃吗？", tier:"basic",
          tip:"引导宝宝描述感受，建立味道词汇。",
          why:"先示范评价再提问，给宝宝语言脚手架——他可以模仿说 yummy 无需完整回答",
          next:"「What else do you want? More rice?」趁势扩展对话",
          fallback:"自己做出「Mmm!」表情，宝宝会模仿面部表情和声音" },
        { id:"m24", en:"Can you use your spoon?", zh:"你能用勺子吃吗？", tier:"basic",
          tip:"鼓励宝宝自己用工具，哪怕会洒也要鼓励。",
          why:"语言+具体行动一体，语言学习在做事情过程中效果最佳",
          next:"「Hold it like this. Good grip!」示范握法给语言支架",
          fallback:"先帮宝宝握好勺子，说「Together! Our spoon.」再慢慢放手" },
        { id:"m25", en:"Almost done! Two more bites!", zh:"快吃完了！再吃两口！", tier:"expressive",
          tip:"具体数字让宝宝有目标感，比再吃一点更有效。",
          why:"具体数字给宝宝可预测的终点，减少进食抗拒",
          next:"「One more! Last one! You did it!」倒计时庆祝完成",
          fallback:"改为「One bite? Just one?」把目标降到最低，更容易接受" },
      ],
      "3-6": [
        { id:"m31", en:"What do you want for breakfast today?", zh:"今天早饭想吃什么？", tip:"培养自主性和表达能力。" },
        { id:"m32", en:"Let's try the carrots! They help you see in the dark!", zh:"试试胡萝卜！它能让你在黑暗里看得更清楚！", tip:"用有趣的理由介绍新食物，减少抵触。" },
        { id:"m33", en:"How does it taste? Sweet? Sour? Salty?", zh:"味道怎么样？甜？酸？咸？", tip:"引导宝宝描述味道，丰富感知词汇。" },
        { id:"m34", en:"Can you help set the table?", zh:"你能帮忙摆碗筷吗？", tip:"让大宝宝参与准备，培养责任感。" },
        { id:"m35", en:"Good eating! You tried something new today!", zh:"吃得真好！你今天尝试了新东西！", tip:"夸具体行为（尝试），比夸结果更有激励效果。" },
      ],
    }
  },

  bedtime: {
    icon: "🌙", name: "睡前时间", color: "var(--purple)",
    phrases: {
      "0-1": [
        { id:"d01", en:"Time for sleep, little one.", zh:"睡觉时间了，小宝贝。", tip:"用最柔和的语气，建立睡前信号。" },
        { id:"d02", en:"Shh... it's sleepy time.", zh:"嘘……要睡觉咯。", tip:"音量逐渐放低，帮宝宝过渡到安静状态。" },
        { id:"d03", en:"Close your eyes. Good night.", zh:"闭上眼睛。晚安。", tip:"可以轻轻盖上宝宝的眼皮，配合动作。" },
        { id:"d04", en:"I love you. Sweet dreams.", zh:"我爱你。做个好梦。", tip:"每晚重复相同的话，建立安全感和仪式感。" },
      ],
      "1-2": [
        { id:"d11", en:"It's bedtime! Time to say good night.", zh:"睡觉时间！该说晚安了。", tip:"用轻快但不刺激的语气宣布睡前开始，帮宝宝切换状态。" },
        { id:"d12", en:"Let's brush your little teeth! Up up up, down down down!", zh:"刷刷小牙齿！上上上，下下下！", tip:"边说边做刷牙动作，节奏感让宝宝更配合。" },
        { id:"d13", en:"Into your cozy bed! Snuggle in!", zh:"钻进暖暖的小床！裹好好！", tip:"帮宝宝盖好被子时说，配合动作增强词汇理解。" },
        { id:"d14", en:"I love you so much. Good night, sleep tight!", zh:"妈妈/爸爸好爱你。晚安，睡个好觉！", tip:"每晚用同样的话结束，是宝宝安全感的来源。" },
        { id:"d15", en:"Let's read one book before sleep. Pick one!", zh:"睡前读一本书。挑一本吧！", tip:"让宝宝自己选书，增加参与感和期待感。" },
      ],
      "2-3": [
        { id:"d21", en:"It's almost bedtime. Let's do five more minutes of playtime.", zh:"快要睡觉了。我们再玩五分钟。", tier:"basic",
          tip:"提前预警比突然终止游戏效果更好，减少哭闹。",
          why:"提前预告并给缓冲时间，是减少睡前哭闹的核心技术",
          next:"「Okay, five minutes are up! Let's get pajamas!」兑现承诺，宝宝会建立信任",
          fallback:"用手机定时器辅助——让规则客观化，减少亲子冲突" },
        { id:"d22", en:"What was your favorite thing today?", zh:"今天你最喜欢什么？", tier:"expressive",
          tip:"睡前回顾一天，帮宝宝建立语言表达和情感处理能力。",
          why:"睡前回顾帮宝宝处理情绪、整合记忆，也是英语高级表达的最佳练习场景",
          next:"「That sounds so fun! Tell me more.」或「I liked that too!」父母分享让对话继续",
          fallback:"改为「Did you have fun today? Yes?」封闭式问题，点头就能回答" },
        { id:"d23", en:"Let's count the stars! One, two, three...", zh:"我们数星星！一、二、三……", tier:"starter",
          tip:"看窗外或天花板上的贴纸，把入睡引导变成游戏。",
          why:"数数节奏帮助大脑从兴奋过渡到平静，星星提供视觉焦点",
          next:"「I see so many! Can you see the big one?」引导视线转移",
          fallback:"用天花板灯点当星星，或指贴纸，室内也完全成立" },
        { id:"d24", en:"You had such a good day. I'm proud of you.", zh:"你今天真的很棒。我为你骄傲。", tier:"expressive",
          tip:"在宝宝入睡前说正向的话，有助于建立自信心。",
          why:"睡前无条件正向肯定，是建立孩子安全感和自信心最重要的语言行为",
          next:"「I love you so much. You make me so happy.」用爱的句子结束一天",
          fallback:"如果宝宝不理解，用拥抱配合，非语言的爱同样有力量" },
        { id:"d25", en:"Close your eyes. I'll be right here.", zh:"闭上眼睛。我就在这里。", tier:"basic",
          tip:"给宝宝安全感，减少分离焦虑。",
          why:"分离焦虑的核心是「你会不会走」——这句话直接回应，是最重要的睡前安慰语",
          next:"「I'm right outside. If you need me, just call me.」具体说明去哪里",
          fallback:"如果宝宝抓着你，说「I'm here. I'm staying.」暂时留下再慢慢过渡" },
      ],
      "3-6": [
        { id:"d31", en:"Okay, it's time to wind down. What do you need before bed?", zh:"好了，该放松一下了。睡前你需要什么？", tip:"大孩子喜欢被尊重，参与自己的睡前流程。" },
        { id:"d32", en:"Let's talk about the best part of your day.", zh:"我们聊聊今天最棒的事。", tip:"培养语言表达和情感反思，也帮助大人了解孩子。" },
        { id:"d33", en:"You were so brave today. Remember when you...?", zh:"你今天好勇敢。还记得你……那一次吗？", tip:"具体回忆一个勇敢时刻，强化孩子的自我认知。" },
        { id:"d34", en:"Lights out! Sleep is how you grow big and strong!", zh:"关灯！睡觉可以让你长高变强壮！", tip:"用孩子关心的结果（长高）解释睡觉的意义。" },
        { id:"d35", en:"Good night. I love you to the moon and back.", zh:"晚安。妈妈/爸爸爱你爱到月亮又回来。", tip:"经典睡前表达，来自绘本《I Love You to the Moon and Back》。" },
      ],
    }
  },

  emotion: {
    icon: "🤗", name: "情绪安慰", color: "var(--accent)",
    phrases: {
      "0-1": [
        { id:"e01", en:"I'm here. You're safe.", zh:"我在这里。你很安全。", tip:"紧紧抱住宝宝，平稳声音比内容更重要。" },
        { id:"e02", en:"It's okay. It's okay.", zh:"没事的。没事的。", tip:"重复能给宝宝节奏感和安全感。" },
        { id:"e03", en:"Mommy/Daddy is here.", zh:"妈妈/爸爸在呢。", tip:"强调你的存在，是最基本的安慰。" },
      ],
      "1-2": [
        { id:"e11", en:"I know, I know. It's okay.", zh:"我知道，我知道。没事的。", tip:"先用我知道认可情绪，不急于解决，宝宝更容易平静。" },
        { id:"e12", en:"Come here. I've got you.", zh:"过来。我抱着你。", tip:"张开双臂，同时说这句话，让宝宝知道你随时可以接住他。" },
        { id:"e13", en:"That was scary, wasn't it?", zh:"刚才好吓人，对不对？", tip:"帮宝宝命名情绪，是情绪管理的第一步。" },
        { id:"e14", en:"Big feelings! Big feelings are okay.", zh:"大情绪！有大情绪是没问题的。", tip:"让宝宝知道情绪本身不是坏事，减少情绪羞耻。" },
        { id:"e15", en:"You're safe. I'm right here.", zh:"你很安全。我就在这里。", tip:"在宝宝受惊或受伤时，先建立安全感，再检查伤口。" },
      ],
      "2-3": [
        { id:"e21", en:"I can see you're feeling upset. That's okay.", zh:"我看到你不高兴了。没关系的。", tip:"「我看到」比「你不要哭」更能让宝宝感到被理解。" },
        { id:"e22", en:"Do you need a hug?", zh:"需要抱抱吗？", tip:"询问比强迫更好，尊重宝宝的身体自主权。" },
        { id:"e23", en:"What happened? Tell me.", zh:"发生什么了？告诉我。", tip:"引导宝宝用语言描述，是从哭闹过渡到沟通的关键。" },
        { id:"e24", en:"It's hard, isn't it? I understand.", zh:"这很难，对不对？我理解。", tip:"表达理解，而不是急于给方案，让宝宝感到被接纳。" },
        { id:"e25", en:"Let's take a deep breath together. In... and out.", zh:"我们一起深呼吸。吸气……呼气。", tip:"呼吸练习对2岁以上有效，父母带头做，宝宝会跟上。" },
      ],
      "3-6": [
        { id:"e31", en:"It looks like you're feeling angry. Is that right?", zh:"你好像很生气。对吗？", tip:"帮大孩子识别和命名具体情绪，比「别哭」有效十倍。" },
        { id:"e32", en:"It's okay to feel sad. Want to tell me what happened?", zh:"难过是没关系的。想告诉我发生什么事了吗？", tip:"允许情绪存在，再开放地邀请表达。" },
        { id:"e33", en:"I'm proud of how you handled that.", zh:"你处理那件事的方式让我很骄傲。", tip:"事后肯定孩子的情绪调节行为，比批评更有塑造力。" },
        { id:"e34", en:"Everyone feels frustrated sometimes. Even me.", zh:"每个人有时都会沮丧。连我也会。", tip:"父母自我袒露，帮孩子正常化自己的情绪。" },
        { id:"e35", en:"What would make you feel better right now?", zh:"你现在需要什么能好一点？", tip:"教孩子自我觉察和寻求支持，是重要的情绪技能。" },
      ],
    }
  },

  morning: {
    icon: "🌅", name: "起床时间", color: "var(--accent2)",
    phrases: {
      "0-1": [
        { id:"mo01", en:"Good morning!", zh:"早上好！", tip:"每天用同样的语气打招呼，建立起床的愉快信号。" },
        { id:"mo02", en:"Wake up, little one!", zh:"醒醒，小宝贝！", tip:"用温柔轻快的声音，避免突然开灯或大声。" },
        { id:"mo03", en:"The sun is up! Rise and shine!", zh:"太阳出来了！起床咯！", tip:"拉开窗帘的同时说，让光线帮助宝宝自然醒来。" },
        { id:"mo04", en:"Stretch! Reach up high!", zh:"伸懒腰！手臂举高高！", tip:"帮宝宝做伸展动作，边说边做，让身体慢慢苏醒。" },
        { id:"mo05", en:"A brand new day!", zh:"新的一天开始了！", tip:"用愉快的语气建立对新一天的期待感。" },
      ],
      "1-2": [
        { id:"mo11", en:"Good morning! Did you sleep well?", zh:"早上好！睡得好吗？", tip:"问候习惯从小养成，也让宝宝感受到被关心。" },
        { id:"mo12", en:"Rise and shine! Time to wake up!", zh:"起来咯！起床时间！", tip:"重复短句配合轻拍，帮宝宝从睡眠过渡到清醒。" },
        { id:"mo13", en:"Let's stretch! Arms up! Wiggle wiggle!", zh:"伸懒腰！手臂举高！扭一扭！", tip:"把晨间伸展变成游戏，让宝宝喜欢起床。" },
        { id:"mo14", en:"Look! Sunshine! It's morning!", zh:"看！阳光！早上啦！", tip:"指向窗户，帮宝宝建立早晨和白天的时间概念。" },
        { id:"mo15", en:"Yay! Good morning, sunshine!", zh:"太棒了！早上好，小太阳！", tip:"用昵称让早晨的第一句话充满爱意。" },
      ],
      "2-3": [
        { id:"mo21", en:"Good morning! Are you ready to wake up?", zh:"早上好！准备好起床了吗？", tip:"给宝宝一个确认的机会，减少抵触起床的情绪。" },
        { id:"mo22", en:"Do you want to get up now or in one minute?", zh:"你要现在起来，还是再等一分钟？", tip:"给出选项让宝宝有控制感，比直接命令更有效。" },
        { id:"mo23", en:"What do you want for breakfast? Eggs or porridge?", zh:"早饭想吃什么？鸡蛋还是粥？", tip:"晨间选择从早饭开始，让宝宝愿意离开被窝。" },
        { id:"mo24", en:"Let's open the curtains! Peek-a-boo, sun!", zh:"我们拉开窗帘！躲猫猫，太阳！", tip:"把拉窗帘变成游戏，吸引宝宝主动起身。" },
        { id:"mo25", en:"Good morning hug! I missed you while you slept!", zh:"早安抱抱！你睡觉时我好想你！", tip:"晨间拥抱让宝宝以爱开启新的一天。" },
      ],
      "3-6": [
        { id:"mo31", en:"Good morning! Time to get up. Can you do it by yourself?", zh:"早上好！起床时间了。你能自己起来吗？", tip:"鼓励独立，给大孩子展示能力的机会。" },
        { id:"mo32", en:"What's your plan for today? What are you excited about?", zh:"今天有什么计划？你期待什么？", tip:"引导孩子对一天产生期待，主动想起床。" },
        { id:"mo33", en:"Let's see who can get dressed the fastest!", zh:"我们看看谁穿衣服最快！", tip:"用比赛激发动力，让早晨更有趣。" },
        { id:"mo34", en:"You slept so well! Your body is all charged up!", zh:"你睡得好好！身体充满能量了！", tip:"用生动的比喻帮孩子理解睡眠的意义。" },
        { id:"mo35", en:"What are you going to do first this morning?", zh:"今天早上你要先做什么？", tip:"让孩子规划自己的晨间流程，培养自主管理能力。" },
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
        { id:"dr04", en:"So cozy! Nice and warm!", zh:"好舒服！暖暖的！", tip:"穿好衣服后说，让宝宝将穿衣和舒适感联系起来。" },
        { id:"dr05", en:"That's your shirt! Hello, shirt!", zh:"这是你的衣服！你好，衣服！", tip:"给衣物打招呼，让穿衣过程变得有趣好玩。" },
      ],
      "1-2": [
        { id:"dr11", en:"Arms up! Let's put on your shirt!", zh:"手臂举高！穿衣服啦！", tip:"手势配合语言，让宝宝学会配合穿衣动作。" },
        { id:"dr12", en:"Where did your head go? Peek-a-boo! There you are!", zh:"头去哪里了？躲猫猫！在这里！", tip:"把套头衫变成躲猫猫游戏，宝宝会期待穿衣服。" },
        { id:"dr13", en:"One sock, two socks! Wiggly toes!", zh:"一只袜子，两只袜子！小脚趾扭一扭！", tip:"穿袜子时数数并逗弄脚趾，增加互动乐趣。" },
        { id:"dr14", en:"This is blue! Your shirt is blue!", zh:"这是蓝色！你的衣服是蓝色的！", tip:"命名颜色，每次穿衣都是学习颜色的机会。" },
        { id:"dr15", en:"All dressed! You look great!", zh:"穿好了！你看起来真棒！", tip:"穿好后给予鼓励，让宝宝对穿衣结果感到满意。" },
      ],
      "2-3": [
        { id:"dr21", en:"Which shirt do you want? The red one or the blue one?", zh:"你想穿哪件衣服？红色的还是蓝色的？", tip:"给出两个选项，让宝宝练习做决定和颜色词汇。" },
        { id:"dr22", en:"Can you put your arm in here? That's it! Good job!", zh:"你能把手臂放进来吗？就是这样！好棒！", tip:"引导宝宝参与穿衣，哪怕很慢也要耐心等待。" },
        { id:"dr23", en:"What color are your socks today?", zh:"你今天的袜子是什么颜色？", tip:"让宝宝观察和描述颜色，强化颜色词汇。" },
        { id:"dr24", en:"It's cold today! We need a warm jacket!", zh:"今天很冷！我们需要穿暖和的外套！", tip:"联系天气和穿衣，帮宝宝理解穿衣的实际意义。" },
        { id:"dr25", en:"Do you want to try putting on your shoes yourself?", zh:"你想自己试着穿鞋吗？", tip:"鼓励尝试独立穿鞋，培养自主能力。" },
      ],
      "3-6": [
        { id:"dr31", en:"Time to get dressed! Can you pick your outfit today?", zh:"穿衣服时间！今天你来挑衣服好吗？", tip:"让孩子选择穿什么，培养自主性和审美意识。" },
        { id:"dr32", en:"Let's check the weather! Is it hot or cold today?", zh:"我们看看天气！今天热还是冷？", tip:"结合天气选衣服，培养逻辑思维和生活技能。" },
        { id:"dr33", en:"Can you button your shirt by yourself? Try it!", zh:"你能自己扣扣子吗？试试看！", tip:"精细动作的练习需要鼓励，哪怕费时也值得等。" },
        { id:"dr34", en:"You got dressed all by yourself! I'm so proud of you!", zh:"你自己把衣服全穿好了！我真为你骄傲！", tip:"独立完成穿衣后的具体夸奖，强化自我效能感。" },
        { id:"dr35", en:"What are we doing today? Let's dress for that!", zh:"我们今天要做什么？穿适合的衣服吧！", tip:"把穿衣和活动联系起来，培养场合意识。" },
      ],
    }
  },

  teeth: {
    icon: "🦷", name: "刷牙时间", color: "var(--teal)",
    phrases: {
      "0-1": [
        { id:"te01", en:"Open up! Let's brush your teeth!", zh:"张开嘴！刷牙啦！", tip:"用轻快的语气介绍刷牙，从小建立口腔卫生习惯。" },
        { id:"te02", en:"Here comes the toothbrush!", zh:"牙刷来咯！", tip:"把牙刷当角色出场，让宝宝对它产生好感。" },
        { id:"te03", en:"Up and down! Up and down!", zh:"上下刷！上下刷！", tip:"边刷边有节奏地说，帮宝宝理解刷牙的动作。" },
        { id:"te04", en:"Good teeth! Clean teeth!", zh:"好牙牙！干净牙牙！", tip:"刷完后夸奖牙齿，让宝宝为干净的牙齿感到骄傲。" },
        { id:"te05", en:"All done! Smile for me!", zh:"刷好了！对我笑一笑！", tip:"刷完后请宝宝展示大笑脸，变成有趣的结尾仪式。" },
      ],
      "1-2": [
        { id:"te11", en:"Brush brush brush! Up and down!", zh:"刷刷刷！上上下下！", tip:"节奏感强的重复词对这个年龄段效果最好。" },
        { id:"te12", en:"Open wide! Show me your teeth!", zh:"嘴巴张大！给我看看你的牙齿！", tip:"让宝宝感觉是在展示，而不是被检查。" },
        { id:"te13", en:"This is yummy toothpaste! Mmm!", zh:"这是好吃的牙膏！嗯！", tip:"用愉快的态度介绍牙膏，减少宝宝的抗拒。" },
        { id:"te14", en:"Let's count! One tooth, two teeth, three teeth!", zh:"数一数！一颗牙，两颗牙，三颗牙！", tip:"数牙齿让刷牙变成有趣的游戏。" },
        { id:"te15", en:"Spit it out! Good job! Clean teeth!", zh:"吐出来！真棒！牙齿干净啦！", tip:"夸奖每一个步骤，建立正向的刷牙体验。" },
      ],
      "2-3": [
        { id:"te21", en:"How many teeth do you have? Let's count them!", zh:"你有几颗牙齿？我们数一数！", tip:"让宝宝主动参与，把刷牙变成探索游戏。" },
        { id:"te22", en:"Can you brush the top teeth? Now the bottom ones!", zh:"你能刷上面的牙吗？现在刷下面的！", tip:"分步骤指导，让宝宝有成就感。" },
        { id:"te23", en:"Did the sugar bugs go away? Brush them out!", zh:"糖虫虫走了吗？把它们刷走！", tip:"用「糖虫」的比喻让宝宝理解刷牙的意义。" },
        { id:"te24", en:"Two whole minutes! Can you do it?", zh:"刷满两分钟！你能做到吗？", tip:"设立时间目标，让宝宝有挑战感。" },
        { id:"te25", en:"Rinse and spit! You're a pro!", zh:"漱口吐出来！你真专业！", tip:"夸宝宝像大人一样专业，满足他们的成长欲望。" },
      ],
      "3-6": [
        { id:"te31", en:"Two minutes of brushing! Let's set the timer!", zh:"刷两分钟！我们定个计时器！", tip:"用计时器让刷牙时间变得可见，减少磨蹭。" },
        { id:"te32", en:"Do you know why we brush our teeth? Tell me!", zh:"你知道为什么要刷牙吗？告诉我！", tip:"让孩子解释原因，加深理解，比反复催促有效。" },
        { id:"te33", en:"Make sure to brush the back ones too — those are sneaky!", zh:"记得也刷后面的牙齿——它们最容易被忘记！", tip:"提醒容易忽略的位置，培养刷牙的细心习惯。" },
        { id:"te34", en:"Don't forget to brush your tongue! It gets germs too!", zh:"别忘了刷舌头！舌头上也有细菌！", tip:"引入刷舌头的步骤，建立更全面的口腔卫生意识。" },
        { id:"te35", en:"Great brushing! Healthy teeth, healthy you!", zh:"刷得真好！牙齿健康，人才健康！", tip:"将口腔健康和整体健康联系起来，建立长期意识。" },
      ],
    }
  },

  handwash: {
    icon: "🫧", name: "洗手时间", color: "var(--blue)",
    phrases: {
      "0-1": [
        { id:"hw01", en:"Wash your hands! Water on!", zh:"洗手手！开水啦！", tip:"抱着宝宝到水龙头边时说，建立洗手的开始信号。" },
        { id:"hw02", en:"Here's the water. Nice and warm!", zh:"水来了。暖暖的！", tip:"让宝宝感受水温，建立积极的触觉体验。" },
        { id:"hw03", en:"Rub rub rub! Soap on!", zh:"搓搓搓！抹上皂！", tip:"帮宝宝搓手时有节奏地说，让动作和语言同步。" },
        { id:"hw04", en:"Rinse it off! All the soap goes bye-bye!", zh:"冲干净！皂皂拜拜！", tip:"用拟人化的方式描述冲洗，让宝宝觉得有趣。" },
        { id:"hw05", en:"Dry your hands! Pat pat pat!", zh:"擦干手！拍拍拍！", tip:"帮宝宝用毛巾时说，配合拍打动作。" },
      ],
      "1-2": [
        { id:"hw11", en:"Time to wash our hands! Turn on the water!", zh:"洗手时间！开水龙头！", tip:"让宝宝参与开水龙头，给予小小的控制感。" },
        { id:"hw12", en:"Soap! Rub rub rub! Make bubbles!", zh:"皂皂！搓搓搓！泡泡来了！", tip:"强调泡泡的出现，让搓手变成有趣的魔法时刻。" },
        { id:"hw13", en:"Look at the bubbles! Scrub between your fingers!", zh:"看泡泡！手指缝也要搓！", tip:"引导宝宝注意手指缝，同时欣赏泡泡吸引注意力。" },
        { id:"hw14", en:"Rinse! All gone! Bye-bye, germs!", zh:"冲走！都没了！细菌拜拜！", tip:"把冲洗细菌变成驱赶坏蛋的游戏。" },
        { id:"hw15", en:"Dry dry dry! Clean hands!", zh:"擦擦擦！手手干净了！", tip:"擦手时夸奖干净的结果，强化完成感。" },
      ],
      "2-3": [
        { id:"hw21", en:"Before we eat, what do we do? Wash hands!", zh:"吃饭前要做什么？洗手！", tip:"用问答形式帮宝宝建立「饭前洗手」的规则意识。" },
        { id:"hw22", en:"Can you scrub your palms? Now the backs!", zh:"你能搓手心吗？现在搓手背！", tip:"分步骤指导，让宝宝练习全面清洗。" },
        { id:"hw23", en:"We wash hands after playing outside, right?", zh:"在外面玩完要洗手，对不对？", tip:"建立场景和行为的联系，帮宝宝理解洗手的时机。" },
        { id:"hw24", en:"How long do we scrub? Let's count to ten!", zh:"要搓多久？我们数到十！", tip:"用数数代替计时，让宝宝主动参与时间管理。" },
        { id:"hw25", en:"Are they clean? Let me see! Wow, so clean!", zh:"洗干净了吗？让我看！哇，好干净！", tip:"夸张地检查，让宝宝为洗干净的手感到自豪。" },
      ],
      "3-6": [
        { id:"hw31", en:"Do you know when we need to wash our hands?", zh:"你知道什么时候需要洗手吗？", tip:"让孩子列举场合，主动建立卫生知识体系。" },
        { id:"hw32", en:"Soap washes away the germs you can't even see!", zh:"皂皂能把看不见的细菌都洗走！", tip:"解释细菌的概念，让孩子理解洗手的科学原理。" },
        { id:"hw33", en:"Scrub for twenty seconds — as long as singing Happy Birthday twice!", zh:"搓二十秒——就像唱两遍生日歌那么长！", tip:"用生日歌计时，让二十秒变得具体可感。" },
        { id:"hw34", en:"Don't forget under your nails! Germs hide there!", zh:"指甲缝也别忘了！细菌藏在那里！", tip:"指出容易被忽视的位置，培养细心的卫生习惯。" },
        { id:"hw35", en:"After the bathroom, always wash hands. It's the rule!", zh:"上完厕所一定要洗手。这是规定！", tip:"明确规则，让孩子内化为自动行为。" },
      ],
    }
  },

  reading: {
    icon: "📚", name: "亲子阅读", color: "var(--teal)",
    phrases: {
      "0-1": [
        { id:"rd01", en:"Look at the picture! Look look look!", zh:"看这幅图！看呀，看呀！", tip:"手指指向图片，吸引宝宝视线，共同关注是语言的基础。" },
        { id:"rd02", en:"A dog! Woof woof!", zh:"小狗！汪汪！", tip:"看到动物时加上叫声，音效词对宝宝极具吸引力。" },
        { id:"rd03", en:"This is red. Red ball!", zh:"这是红色的。红色球球！", tip:"简单命名颜色和物体，重复是宝宝学词汇的关键。" },
        { id:"rd04", en:"Turn the page! What's next?", zh:"翻页！下一页是什么？", tip:"用期待的语气翻页，培养对阅读的兴趣和期待感。" },
        { id:"rd05", en:"So cute! Look at the baby!", zh:"好可爱！看这个小宝宝！", tip:"指向书中的婴儿，宝宝对同龄形象特别感兴趣。" },
      ],
      "1-2": [
        { id:"rd11", en:"What's that? Point to the dog!", zh:"那是什么？指指小狗！", tip:"让宝宝用手指回应，手指动作是语言理解的重要信号。" },
        { id:"rd12", en:"The cat says meow! Can you say meow?", zh:"猫咪说喵！你能说喵吗？", tip:"邀请宝宝模仿动物叫声，降低语言门槛，鼓励开口。" },
        { id:"rd13", en:"Where's the ball? Find the ball!", zh:"球球在哪里？找找球球！", tip:"在图画中寻找物品，把阅读变成寻宝游戏。" },
        { id:"rd14", en:"Big elephant! Little mouse! Big, little!", zh:"大大的大象！小小的老鼠！大，小！", tip:"利用对比教形容词，大小对比在绘本中很常见。" },
        { id:"rd15", en:"Again! Should we read it again?", zh:"再读！要再读一遍吗？", tip:"宝宝喜欢重复阅读同一本书，这对语言学习非常有益。" },
      ],
      "2-3": [
        { id:"rd21", en:"What do you think happens next?", zh:"你觉得接下来会发生什么？", tip:"预测情节激活思维，是阅读理解最重要的技能之一。" },
        { id:"rd22", en:"How do you think the bunny feels? Happy or sad?", zh:"你觉得小兔子感觉怎么样？开心还是难过？", tip:"引导情绪识别，结合书中角色让讨论更自然。" },
        { id:"rd23", en:"Can you find something blue on this page?", zh:"你能在这页上找到蓝色的东西吗？", tip:"颜色寻找游戏让宝宝仔细观察图画，提升专注力。" },
        { id:"rd24", en:"What's the dog doing? Running? Jumping?", zh:"小狗在做什么？跑步？跳跳？", tip:"描述图中的动作，丰富宝宝的动词词汇。" },
        { id:"rd25", en:"This is your favorite part, isn't it? Tell me why!", zh:"这是你最喜欢的部分，对不对？告诉我为什么！", tip:"鼓励宝宝表达偏好和原因，锻炼语言组织能力。" },
      ],
      "3-6": [
        { id:"rd31", en:"What was the story about? Can you tell me?", zh:"这个故事讲的是什么？你能告诉我吗？", tip:"故事复述是语言和记忆能力的综合练习。" },
        { id:"rd32", en:"Why did the character do that? What do you think?", zh:"为什么那个角色那样做？你怎么看？", tip:"引导推断人物动机，培养同理心和批判性思维。" },
        { id:"rd33", en:"If you were in the story, what would you do?", zh:"如果你在故事里，你会怎么做？", tip:"代入情境激发创意表达，让阅读与自身经历连接。" },
        { id:"rd34", en:"Do you have a favorite character? What do you like about them?", zh:"你有最喜欢的角色吗？你喜欢他什么？", tip:"谈论最喜欢的角色，帮孩子建立价值观和审美偏好。" },
        { id:"rd35", en:"Let's find another book by the same author!", zh:"我们再找一本同一个作者写的书吧！", tip:"引导孩子关注作者，培养对文学的持续兴趣。" },
      ],
    }
  },

  music: {
    icon: "🎵", name: "音乐律动", color: "var(--accent2)",
    phrases: {
      "0-1": [
        { id:"mu01", en:"Clap clap clap!", zh:"拍拍拍！", tip:"握住宝宝的小手轻轻拍在一起，建立节奏感。" },
        { id:"mu02", en:"Bounce bounce bounce! Up and down!", zh:"跳跳跳！上上下下！", tip:"轻轻托起宝宝做弹跳动作，配合节奏让宝宝感受音乐。" },
        { id:"mu03", en:"La la la la la!", zh:"啦啦啦啦啦！", tip:"用欢快的旋律哼唱，音调变化吸引宝宝的注意力。" },
        { id:"mu04", en:"Listen! Music!", zh:"听！音乐！", tip:"播放音乐时指向音源，帮宝宝建立「听」的意识。" },
        { id:"mu05", en:"Shake shake shake!", zh:"摇摇摇！", tip:"摇动沙铃或宝宝的小手，音效词和动作同步最有效。" },
      ],
      "1-2": [
        { id:"mu11", en:"Let's dance! Wiggle wiggle!", zh:"跳舞咯！扭一扭！", tip:"带着宝宝一起扭动身体，让音乐和运动结合。" },
        { id:"mu12", en:"Stomp stomp stomp! Big feet!", zh:"踩踩踩！大脚步！", tip:"夸张地跺脚，宝宝喜欢大声的动作游戏。" },
        { id:"mu13", en:"Shake your hands! Shake shake shake!", zh:"摇摇手！摇摇摇！", tip:"握着小手一起摇，重复的节奏让宝宝预测和期待。" },
        { id:"mu14", en:"Clap along! Can you clap?", zh:"跟着拍！你会拍手吗？", tip:"邀请宝宝模仿拍手，这是音乐互动的第一步。" },
        { id:"mu15", en:"Fast! Now slow... slow... slow.", zh:"快！现在慢……慢……慢。", tip:"用速度变化让宝宝体验节奏，也是对比概念的初体验。" },
      ],
      "2-3": [
        { id:"mu21", en:"Can you clap to the beat? Listen first!", zh:"你能跟着节拍拍手吗？先听一听！", tip:"引导宝宝感受节拍，是音乐能力发展的重要里程碑。" },
        { id:"mu22", en:"What song do you want to sing?", zh:"你想唱什么歌？", tip:"让宝宝自己选歌，激发主动参与音乐的兴趣。" },
        { id:"mu23", en:"Let's sing together! Ready? One, two, three!", zh:"我们一起唱！准备好了吗？一、二、三！", tip:"倒数给宝宝准备的时间，增加期待感和参与度。" },
        { id:"mu24", en:"That's loud! Now make it soft and quiet.", zh:"这是大声的！现在变轻轻的、安静的。", tip:"用音量变化教形容词，宝宝能直接感受对比。" },
        { id:"mu25", en:"Spin around! Keep spinning to the music!", zh:"转圈圈！跟着音乐一直转！", tip:"旋转动作刺激前庭感觉，也是宝宝最喜欢的律动之一。" },
      ],
      "3-6": [
        { id:"mu31", en:"Let's learn the words to this song! Repeat after me!", zh:"我们来学这首歌的歌词！跟我说！", tip:"学歌词锻炼记忆力和语言节奏感，让孩子感受成就。" },
        { id:"mu32", en:"Can you tap the beat on your knees? Listen to the music!", zh:"你能用手拍膝盖打节拍吗？听听音乐！", tip:"身体打节拍是音乐感知的重要练习，也训练协调性。" },
        { id:"mu33", en:"Is this song fast or slow? Happy or sad?", zh:"这首歌是快还是慢？快乐还是悲伤？", tip:"引导孩子描述音乐情感，培养音乐理解和情绪词汇。" },
        { id:"mu34", en:"Let's make up our own song! What rhymes with cat?", zh:"我们自己编一首歌！什么词和「猫」押韵？", tip:"押韵游戏培养语言意识，是阅读准备能力的重要基础。" },
        { id:"mu35", en:"You are a great dancer! Show me your best move!", zh:"你是超棒的舞蹈家！给我看你最厉害的动作！", tip:"鼓励自由表达和创意，建立孩子对身体表达的自信。" },
      ],
    }
  },

  art: {
    icon: "🎨", name: "涂鸦美工", color: "var(--pink)",
    phrases: {
      "0-1": [
        { id:"ar01", en:"Red! You're making red marks!", zh:"红色！你在画红色的印记！", tip:"描述宝宝正在做的事，把感官体验和语言联系起来。" },
        { id:"ar02", en:"Squish squish! Soft and squishy!", zh:"捏捏捏！软软的！", tip:"手指触碰颜料时描述触感，丰富宝宝的感觉词汇。" },
        { id:"ar03", en:"Big circle! Round and round!", zh:"大圆圈！转啊转！", tip:"手握宝宝的小手画圆，边说边做，感受形状。" },
        { id:"ar04", en:"Look what you made!", zh:"看你画的！", tip:"指向宝宝的作品，让他感受到自己的行为有意义。" },
        { id:"ar05", en:"Blue! Touch the blue!", zh:"蓝色！摸摸蓝色！", tip:"手指颜色，让宝宝用手触碰，建立颜色和名称的联系。" },
      ],
      "1-2": [
        { id:"ar11", en:"Let's draw! Round and round! Scribble scribble!", zh:"画画咯！转圈圈！涂鸦涂鸦！", tip:"鼓励随意涂鸦，不要纠正，这个阶段重在过程体验。" },
        { id:"ar12", en:"Yellow! That's yellow! Pretty yellow!", zh:"黄色！那是黄色！漂亮的黄色！", tip:"重复颜色名称三次，帮宝宝在大脑中固化词汇。" },
        { id:"ar13", en:"More blue! Put more blue here!", zh:"再加蓝色！在这里加更多蓝色！", tip:"引导宝宝主动加颜色，培养对画面的控制感。" },
        { id:"ar14", en:"Big line! Now a little line!", zh:"大线条！现在画小线条！", tip:"用大小对比引导线条练习，自然教授大小概念。" },
        { id:"ar15", en:"Wow, look at your picture! So colorful!", zh:"哇，看你的画！好多颜色！", tip:"夸奖作品的颜色丰富，让宝宝爱上创作。" },
      ],
      "2-3": [
        { id:"ar21", en:"What are you drawing? Tell me about your picture!", zh:"你在画什么？跟我说说你的画！", tip:"不猜测宝宝画的是什么，而是邀请他们解说，尊重创意。" },
        { id:"ar22", en:"Which color do you want to use? Pick one!", zh:"你想用什么颜色？挑一个！", tip:"让宝宝选择颜色，培养决策能力和颜色词汇。" },
        { id:"ar23", en:"Should we mix yellow and blue? What color do we get?", zh:"我们把黄色和蓝色混在一起？会变成什么颜色？", tip:"颜色混合是小小科学家的探索时刻，充满惊喜感。" },
        { id:"ar24", en:"Let's make a sun! Big circle, then lines all around!", zh:"我们画太阳！大圆圈，然后四周画线条！", tip:"分步骤指导简单图形，让宝宝体验完成的成就感。" },
        { id:"ar25", en:"You worked so hard on this! Look at all the colors!", zh:"你这幅画花了好多心思！看这么多颜色！", tip:"夸奖努力过程而非结果，培养成长型思维。" },
      ],
      "3-6": [
        { id:"ar31", en:"Tell me about your drawing. What's happening in your picture?", zh:"跟我说说你的画。画里发生了什么事？", tip:"把图画当故事来讨论，连接视觉表达和语言叙述。" },
        { id:"ar32", en:"What colors do you need to make orange?", zh:"要做橙色需要用哪些颜色？", tip:"颜色混合的问答强化颜色知识，也培养逻辑思考。" },
        { id:"ar33", en:"Let's create something together! What should we make?", zh:"我们一起做个东西！做什么好？", tip:"亲子共同创作，让孩子主导，大人配合，建立合作意识。" },
        { id:"ar34", en:"Your art makes me feel happy. What feeling does it give you?", zh:"你的画让我感到开心。你自己有什么感觉？", tip:"引导孩子用情感描述艺术，连接创作与情绪表达。" },
        { id:"ar35", en:"Should we hang this up? Let's find the best spot!", zh:"我们要把它挂起来吗？找个最好的位置！", tip:"展示作品给宝宝传递「你的创作有价值」的重要信息。" },
      ],
    }
  },

  blocks: {
    icon: "🧱", name: "积木游戏", color: "var(--accent2)",
    phrases: {
      "0-1": [
        { id:"bl01", en:"Stack! Stack it up!", zh:"叠！叠起来！", tip:"帮宝宝把积木叠在一起，边说边做，建立动作词汇。" },
        { id:"bl02", en:"Up up up! So tall!", zh:"高高高！好高！", tip:"每叠一块就说一次，让宝宝感受高度变化的节奏。" },
        { id:"bl03", en:"Boom! It fell down!", zh:"轰！倒下来了！", tip:"积木倒塌时夸张地说，宝宝会被音效吸引，喜欢重复。" },
        { id:"bl04", en:"Again! Let's build again!", zh:"再来！我们再搭！", tip:"重新开始搭的时候说，培养宝宝的重复参与兴趣。" },
        { id:"bl05", en:"Red block! Here's the red one!", zh:"红色积木！这是红色的！", tip:"命名颜色，每次拿积木时都是学颜色词汇的好机会。" },
      ],
      "1-2": [
        { id:"bl11", en:"Put it on top! On top!", zh:"放到上面！上面！", tip:"指向顶部，帮宝宝理解「上面」的方位概念。" },
        { id:"bl12", en:"Blue block! Yellow block! So many colors!", zh:"蓝色积木！黄色积木！好多颜色！", tip:"拿积木时命名颜色，自然地在游戏中学习。" },
        { id:"bl13", en:"So tall! Touch the top!", zh:"好高！摸摸最顶上！", tip:"让宝宝伸手触碰顶端，体验高度和成就感。" },
        { id:"bl14", en:"Knock it down! Boom! Crash!", zh:"推倒它！轰！哗啦！", tip:"让宝宝推倒积木，音效词让这个动作充满乐趣。" },
        { id:"bl15", en:"Big tower! We built a big tower!", zh:"大塔楼！我们搭了一座大塔楼！", tip:"命名完成品，让宝宝为自己的作品感到骄傲。" },
      ],
      "2-3": [
        { id:"bl21", en:"How high can we build? Let's try!", zh:"我们能搭多高？试试看！", tip:"设立挑战目标，激发宝宝主动探索的动力。" },
        { id:"bl22", en:"What shape is this block? Square? Rectangle?", zh:"这块积木是什么形状？正方形？长方形？", tip:"游戏中认识形状，比单纯记忆更有趣也更牢固。" },
        { id:"bl23", en:"Can you find a big block? Now find a small one!", zh:"你能找一块大积木吗？现在找一块小的！", tip:"在玩中练习大小概念，强化形容词词汇。" },
        { id:"bl24", en:"Let's build a house! What does a house need?", zh:"我们搭一座房子！房子需要什么？", tip:"引导有目的的搭建，启发想象力和语言表达。" },
        { id:"bl25", en:"Uh oh, it's wobbly! How can we make it stronger?", zh:"哦不，它摇摇晃晃！怎么让它更稳固？", tip:"问题解决情境激发思考，培养早期工程意识。" },
      ],
      "3-6": [
        { id:"bl31", en:"What are you going to build today? Tell me your plan!", zh:"你今天要搭什么？告诉我你的计划！", tip:"鼓励事先规划，培养目标导向和语言表达能力。" },
        { id:"bl32", en:"Which blocks do you need? Let's sort them by color first!", zh:"你需要哪些积木？先按颜色分类吧！", tip:"分类整理是数学思维的基础，也让搭建更有条理。" },
        { id:"bl33", en:"Why did it fall? What could we do differently?", zh:"为什么倒了？我们可以怎么改进？", tip:"引导反思失败，培养解决问题的思维方式。" },
        { id:"bl34", en:"Wow, that's an amazing structure! How did you make it so strong?", zh:"哇，真厉害的建筑！你怎么让它这么稳？", tip:"问方法而非只夸结果，引导孩子反思和总结经验。" },
        { id:"bl35", en:"Let's take a photo of your building before we clean up!", zh:"收拾之前我们先给你的建筑拍张照片！", tip:"记录作品让孩子感到创造有价值，也培养成就感。" },
      ],
    }
  },

  pretend: {
    icon: "🎭", name: "角色扮演", color: "var(--pink)",
    phrases: {
      "0-1": [
        { id:"pr01", en:"Look, the bear is sleeping! Shh!", zh:"看，小熊在睡觉！嘘！", tip:"给玩具赋予行为，引导宝宝关注简单叙事。" },
        { id:"pr02", en:"Cup! The cup goes here.", zh:"杯子！杯子放这里。", tip:"简单物品摆放的叙述，帮宝宝建立物体和名称的联系。" },
        { id:"pr03", en:"Nom nom nom! Yummy!", zh:"嗯嗯嗯！好吃！", tip:"假装吃东西的音效，让假装游戏从感官体验开始。" },
        { id:"pr04", en:"Hi teddy! Say hi to teddy!", zh:"嗨泰迪！和泰迪打招呼！", tip:"让宝宝向玩具打招呼，是最早的角色扮演互动。" },
        { id:"pr05", en:"Rock-a-bye baby! The doll is sleeping.", zh:"摇啊摇！洋娃娃在睡觉。", tip:"抱着玩具摇睡，模仿照顾行为，宝宝很快会模仿。" },
      ],
      "1-2": [
        { id:"pr11", en:"The doll is hungry! Feed the doll!", zh:"洋娃娃饿了！喂洋娃娃吃东西！", tip:"给玩具赋予需求，引导宝宝模仿照顾行为。" },
        { id:"pr12", en:"Ring ring! Hello? Who is it?", zh:"铃铃铃！喂？是谁呀？", tip:"假装打电话是这个年龄最喜欢的角色扮演之一。" },
        { id:"pr13", en:"Vroom vroom! The car is going fast!", zh:"呜呜！汽车开得好快！", tip:"给玩具车配音效，引入交通工具词汇和角色叙事。" },
        { id:"pr14", en:"Oh no, teddy fell! Is he okay? Kiss it better!", zh:"哦不，泰迪摔倒了！他没事吧？亲亲好了！", tip:"照顾受伤玩具的游戏培养同理心和关怀行为。" },
        { id:"pr15", en:"Time for bed, dolly! Tuck her in!", zh:"洋娃娃该睡觉了！给她盖好被子！", tip:"模仿睡前仪式，让宝宝体验「照顾者」的角色。" },
      ],
      "2-3": [
        { id:"pr21", en:"Let's pretend you're the doctor! I have a tummy ache!", zh:"我们假装你是医生！我肚子疼！", tip:"明确角色分配，帮宝宝进入假想游戏的框架。" },
        { id:"pr22", en:"What are you cooking? It smells so good!", zh:"你在做什么菜？好香啊！", tip:"进入宝宝的角色游戏，配合他的叙事，增强参与感。" },
        { id:"pr23", en:"I'll be the baby and you be the mommy. Okay?", zh:"我来当宝宝，你来当妈妈。好不好？", tip:"角色互换让宝宝体验不同视角，培养同理心。" },
        { id:"pr24", en:"The shop is open! What would you like to buy?", zh:"店铺开门了！你想买什么？", tip:"模拟购物场景，引入社交语言和数量概念。" },
        { id:"pr25", en:"Choo choo! All aboard the train! Where are we going?", zh:"呜呜！上火车！我们要去哪里？", tip:"设定旅程目的地，激发孩子讲述故事的欲望。" },
      ],
      "3-6": [
        { id:"pr31", en:"Let's make up a story together! You start!", zh:"我们一起编故事！你先开始！", tip:"让孩子主导叙事，培养创造力和语言组织能力。" },
        { id:"pr32", en:"What happens next in our story? What does the hero do?", zh:"我们的故事接下来怎样？主角会怎么做？", tip:"用「接下来」推动叙事，培养时间顺序和因果逻辑。" },
        { id:"pr33", en:"I'm the customer. Hello, I'd like to order a pizza please!", zh:"我是顾客。你好，我想点一份披萨！", tip:"模拟服务场景，练习礼貌社交语言和对话结构。" },
        { id:"pr34", en:"You're the superhero! What's your superpower?", zh:"你是超级英雄！你有什么超能力？", tip:"超级英雄角色激发想象力，让孩子自由定义自己的力量。" },
        { id:"pr35", en:"The dragon is blocking the castle! How do we get past?", zh:"龙挡住了城堡！我们怎么过去？", tip:"设置障碍推动解决问题，训练创意思维和叙事能力。" },
      ],
    }
  },

  potty: {
    icon: "🚽", name: "如厕训练", color: "var(--teal)",
    phrases: {
      "0-1": [
        { id:"pt01", en:"You made a wet diaper! That's okay.", zh:"宝宝尿湿了！没关系的。", tip:"用平静语气描述，不评判，帮宝宝建立身体觉察。" },
        { id:"pt02", en:"Time to change your diaper! Nice and clean!", zh:"换尿布时间！干干净净的！", tip:"换尿布时描述过程，让宝宝习惯「干净」这个词。" },
        { id:"pt03", en:"Wet! Your diaper is wet.", zh:"湿了！尿布湿了。", tip:"命名状态，帮宝宝把感觉和语言联系起来。" },
        { id:"pt04", en:"Clean and dry! All fresh!", zh:"干净又干爽！焕然一新！", tip:"换好后说，让宝宝把舒适感和「干净」联系起来。" },
        { id:"pt05", en:"There you go. All done!", zh:"好了。换好了！", tip:"换完尿布后说，给过程一个清晰的结束信号。" },
      ],
      "1-2": [
        { id:"pt11", en:"Do you have a wet diaper? Let's check!", zh:"你的尿布湿了吗？我们检查一下！", tip:"引导宝宝注意自己的身体信号，建立如厕意识的基础。" },
        { id:"pt12", en:"This is the potty! Pee pee and poo poo go here!", zh:"这是小马桶！尿尿和便便都到这里来！", tip:"直接介绍马桶用途，用简单词语不让宝宝感到神秘。" },
        { id:"pt13", en:"Do you want to try sitting on the potty?", zh:"你想试着坐坐小马桶吗？", tip:"用邀请语气而非命令，减少宝宝对马桶的抵触。" },
        { id:"pt14", en:"Pee pee goes in the potty! Big kids use the potty!", zh:"尿尿要去小马桶！大孩子用小马桶！", tip:"「大孩子」这个身份对1-2岁的宝宝很有吸引力。" },
        { id:"pt15", en:"You sat on the potty! Good job trying!", zh:"你坐上小马桶了！很棒，你尝试了！", tip:"夸尝试而不是结果，帮宝宝建立正向的马桶体验。" },
      ],
      "2-3": [
        { id:"pt21", en:"Do you need to go potty? Tell me if you do!", zh:"你需要上厕所吗？有需要告诉我！", tip:"这是如厕训练最核心的话，每天多次重复，建立表达习惯。" },
        { id:"pt22", en:"Let's try the potty before we go out! Just in case.", zh:"出门前我们先去试试小马桶！以防万一。", tip:"建立「出门前上厕所」的习惯，减少外出意外。" },
        { id:"pt23", en:"You did it! You went pee pee in the potty! I'm so proud!", zh:"你做到了！你在小马桶里尿尿了！我好骄傲！", tip:"成功时立即给予热烈的具体表扬，强化正向行为。" },
        { id:"pt24", en:"Oops, an accident! That's okay. Let's clean up together.", zh:"哎呀，出意外了！没关系。我们一起收拾。", tip:"意外时保持平静不责怪，让宝宝不因失误感到羞愧。" },
        { id:"pt25", en:"You told me you needed to go! That was so smart!", zh:"你告诉我你要上厕所了！你真聪明！", tip:"夸奖「主动告诉大人」的行为，这才是训练最大的突破。" },
      ],
      "3-6": [
        { id:"pt31", en:"Remember to go potty before we leave the house!", zh:"记得出门前先上厕所！", tip:"把如厕变成出门前的固定步骤，培养独立的生活习惯。" },
        { id:"pt32", en:"You can go to the bathroom by yourself now. You're so grown up!", zh:"你现在能自己上厕所了。你长大了好多！", tip:"认可独立能力，让孩子为自己的成长感到自豪。" },
        { id:"pt33", en:"Don't forget to flush and wash your hands! That's the rule.", zh:"别忘了冲水和洗手！这是规定。", tip:"将冲水和洗手纳入常规，用「规定」让步骤变得不可商量。" },
        { id:"pt34", en:"How do you know when you need to go? Your body tells you!", zh:"你怎么知道要上厕所了？是你的身体在告诉你！", tip:"帮孩子理解身体信号，建立对自身感觉的信任和觉察。" },
        { id:"pt35", en:"You went all by yourself! High five!", zh:"你自己去上厕所了！击掌！", tip:"庆祝独立如厕，用互动仪式（击掌）强化成就感。" },
      ],
    }
  },

  goodbye: {
    icon: "👋", name: "出门告别", color: "var(--accent)",
    phrases: {
      "0-1": [
        { id:"gb01", en:"Wave bye-bye! Bye-bye!", zh:"挥手拜拜！拜拜！", tip:"握着宝宝的小手挥动，边说边做，建立告别动作。" },
        { id:"gb02", en:"Daddy's going bye-bye. Bye-bye Daddy!", zh:"爸爸要拜拜了。爸爸拜拜！", tip:"具体说明谁在离开，帮宝宝建立「人离开后会回来」的概念。" },
        { id:"gb03", en:"See you soon! Bye-bye!", zh:"一会见！拜拜！", tip:"用稳定愉快的语气告别，你的情绪直接影响宝宝的反应。" },
        { id:"gb04", en:"Mommy will be back. I love you!", zh:"妈妈会回来的。我爱你！", tip:"简短的保证加爱的表达，给宝宝最基本的安全感。" },
        { id:"gb05", en:"Blow a kiss! Mwah!", zh:"飞吻！么哒！", tip:"飞吻是宝宝最早能参与的告别仪式之一。" },
      ],
      "1-2": [
        { id:"gb11", en:"Bye-bye! See you soon! I'll be back!", zh:"拜拜！一会见！我会回来的！", tip:"每次离开都说同样的话，建立「告别后必然回归」的信任。" },
        { id:"gb12", en:"Wave bye-bye to Grandma! Can you wave?", zh:"向奶奶挥手拜拜！你会挥手吗？", tip:"具体对象让挥手更有意义，也帮宝宝记住家庭成员称呼。" },
        { id:"gb13", en:"Mommy is going to work. She'll come back later!", zh:"妈妈去上班了。她等一下会回来！", tip:"解释去哪里，帮宝宝建立对父母行踪的理解。" },
        { id:"gb14", en:"Big hug! One more hug before I go!", zh:"大抱抱！走之前再抱一下！", tip:"告别前的拥抱仪式能给宝宝情感能量，减少分离焦虑。" },
        { id:"gb15", en:"Give me a kiss! See you later, alligator!", zh:"亲我一下！回头见，小鳄鱼！", tip:"有趣的告别语让离别变轻松，也让宝宝期待下次重聚。" },
      ],
      "2-3": [
        { id:"gb21", en:"Where is Daddy going? Daddy's going to work!", zh:"爸爸要去哪里？爸爸去上班了！", tip:"让宝宝参与回答，帮他理解离开是有原因的。" },
        { id:"gb22", en:"You feel sad when Mommy leaves. That's okay!", zh:"妈妈离开你会难过。没关系的！", tip:"命名宝宝的情绪，让他知道难过是正常的，被接受的。" },
        { id:"gb23", en:"Mommy will come back after your nap. Ready, set, bye!", zh:"妈妈等你睡完午觉就回来。准备好，出发，拜拜！", tip:"用具体事件（午睡）而非时间说明，宝宝更容易理解。" },
        { id:"gb24", en:"Should we do our special goodbye? One hug, one kiss, one wave!", zh:"我们做特别的告别仪式吧？一个抱，一个亲，一个挥手！", tip:"固定告别仪式让宝宝有掌控感，大大减少分离哭闹。" },
        { id:"gb25", en:"You're so brave! I'll think of you while I'm gone.", zh:"你好勇敢！我离开的时候也会想你的。", tip:"让宝宝知道你也在想他，建立情感上的持续联结。" },
      ],
      "3-6": [
        { id:"gb31", en:"I'll be back after dinner. Can you remember that?", zh:"我吃完晚饭后回来。你能记住吗？", tip:"具体的时间标志帮大孩子预测等待，减少焦虑。" },
        { id:"gb32", en:"It's okay to feel a little sad. Missing people means you love them!", zh:"有点难过是没关系的。想念别人说明你爱他们！", tip:"把「想念」和「爱」联系起来，帮孩子建立正向的情感解读。" },
        { id:"gb33", en:"What will you do while I'm gone? You've got fun things planned!", zh:"我不在的时候你要做什么？你有很多有趣的事要做！", tip:"把注意力引向期待的活动，帮孩子过渡到新状态。" },
        { id:"gb34", en:"I love you! Be good and have fun. I'll be so excited to hear about your day!", zh:"我爱你！乖乖玩得开心。我很期待听你讲今天的事！", tip:"制造「回来后分享」的期待，让离别有了愉快的续集。" },
        { id:"gb35", en:"Goodbye hug! You're getting so good at brave goodbyes!", zh:"告别抱抱！你越来越擅长勇敢地说再见了！", tip:"夸奖「勇敢告别」的能力，让孩子为自己的成长感到骄傲。" },
      ],
    }
  },

  outing: {
    icon: "🚗", name: "外出坐车", color: "var(--blue)",
    phrases: {
      "0-1": [
        { id:"ot01", en:"Car ride! In the car!", zh:"坐车咯！上车了！", tip:"每次坐车都用同样的话开始，建立出行的仪式感。" },
        { id:"ot02", en:"Click! Buckle up! Safe and snug.", zh:"咔嗒！扣好了！安全舒适。", tip:"扣安全带时说咔嗒声，让宝宝熟悉这个必要步骤。" },
        { id:"ot03", en:"Look out the window! Trees! So many trees!", zh:"看窗外！树！好多树！", tip:"指向窗外，给宝宝提供感知世界的语言工具。" },
        { id:"ot04", en:"Vroom vroom! The car is moving!", zh:"呜呜！汽车动起来了！", tip:"引入交通工具的音效词，让坐车体验充满语言刺激。" },
        { id:"ot05", en:"Almost there! We're almost there!", zh:"快到了！我们快到了！", tip:"重复的期待句给宝宝时间概念，也让行程显得更短。" },
      ],
      "1-2": [
        { id:"ot11", en:"Let's go! Shoes on! Ready?", zh:"出发！穿鞋！准备好了吗？", tip:"出门前的固定话语帮宝宝预测将要发生的事。" },
        { id:"ot12", en:"Car! We're going in the car! Vroom!", zh:"汽车！我们要坐汽车！呜呜！", tip:"宣布交通工具让宝宝对出行产生期待。" },
        { id:"ot13", en:"Look! A red car! And a blue one!", zh:"看！红色汽车！还有一辆蓝色的！", tip:"坐车途中观察颜色，把无聊的等待变成颜色学习。" },
        { id:"ot14", en:"Where are we going? To the park! Yay!", zh:"我们去哪里？去公园！耶！", tip:"宣布目的地，让宝宝对出行感到兴奋而非焦虑。" },
        { id:"ot15", en:"Sit down in your seat! Good job!", zh:"坐好在座位上！真棒！", tip:"夸奖正确的安全行为，让宝宝以坐好为傲。" },
      ],
      "2-3": [
        { id:"ot21", en:"Where are we going today? Can you remember?", zh:"我们今天要去哪里？你还记得吗？", tip:"回顾目的地，让宝宝练习记忆和语言表达。" },
        { id:"ot22", en:"Let's count the traffic lights! Red means stop!", zh:"我们数数红绿灯！红色表示停！", tip:"数交通灯是车程中最好的数字和颜色学习活动。" },
        { id:"ot23", en:"Can you see any animals? Look out your window!", zh:"你能看到动物吗？看看你那边的窗外！", tip:"观察窗外的寻找游戏让宝宝主动参与，而不是被动乘车。" },
        { id:"ot24", en:"We're almost there! How many more minutes do you think?", zh:"我们快到了！你觉得还要几分钟？", tip:"猜时间的游戏帮宝宝建立时间感，也转移对等待的焦虑。" },
        { id:"ot25", en:"Buckle up! That's how we stay safe in the car.", zh:"扣好安全带！这是我们在车里保持安全的方法。", tip:"解释安全带的原因，让宝宝理解规则背后的逻辑。" },
      ],
      "3-6": [
        { id:"ot31", en:"We're going to the supermarket. What do you think we need to buy?", zh:"我们去超市。你觉得我们需要买什么？", tip:"让孩子参与计划，培养生活常识和预先思考能力。" },
        { id:"ot32", en:"Let's play the color game! First one to see something yellow wins!", zh:"我们玩颜色游戏！第一个看到黄色东西的人赢！", tip:"车程小游戏让孩子保持专注，也是观察力的训练。" },
        { id:"ot33", en:"How far away do you think it is? Near or far?", zh:"你觉得有多远？近还是远？", tip:"建立距离概念，也鼓励孩子大胆猜测和表达判断。" },
        { id:"ot34", en:"Can you tell me three things you see out the window right now?", zh:"你能告诉我现在窗外看到的三件东西吗？", tip:"三件事的挑战锻炼专注力和语言表达，也是简单的计数练习。" },
        { id:"ot35", en:"We're here! Remember to take your things with you.", zh:"到了！记得带上你的东西。", tip:"培养责任感，让孩子养成到达后整理自己物品的习惯。" },
      ],
    }
  },

  shopping: {
    icon: "🛒", name: "超市购物", color: "var(--green)",
    phrases: {
      "0-1": [
        { id:"sh01", en:"In the cart! Wheee!", zh:"坐进购物车！嗖嗖嗖！", tip:"把宝宝放进购物车时用愉快的语气，让购物一开始就是乐趣。" },
        { id:"sh02", en:"Look at all the colors! Red apples! Yellow bananas!", zh:"看这么多颜色！红色苹果！黄色香蕉！", tip:"超市是天然的颜色学习场所，边走边指。" },
        { id:"sh03", en:"So many things! Big store!", zh:"好多东西！大商店！", tip:"简单描述环境，帮宝宝建立「超市」这个场景的词汇。" },
        { id:"sh04", en:"Here comes the cart! Vroom vroom!", zh:"购物车来了！呜呜！", tip:"推购物车时加音效，让宝宝感受移动的乐趣。" },
        { id:"sh05", en:"What's that? Look! Round and round!", zh:"那是什么？看！圆圆的！", tip:"指向圆形水果，引入形状词汇，描述看到的物品。" },
      ],
      "1-2": [
        { id:"sh11", en:"Apple! Red apple! Can you touch the apple?", zh:"苹果！红色苹果！你能摸摸苹果吗？", tip:"让宝宝触摸水果，多感官体验加强词汇记忆。" },
        { id:"sh12", en:"Banana! Yellow banana! Peel and eat! Mmm!", zh:"香蕉！黄色香蕉！剥皮吃！嗯！", tip:"描述动作链，把食物和吃法联系起来。" },
        { id:"sh13", en:"Let's find the milk! Where is the milk?", zh:"我们找牛奶！牛奶在哪里？", tip:"简单寻找任务让宝宝有参与感和完成的喜悦。" },
        { id:"sh14", en:"Big pumpkin! Little potato! Big, little!", zh:"大南瓜！小土豆！大，小！", tip:"用大小悬殊的蔬菜比较，在超市里自然教对比概念。" },
        { id:"sh15", en:"In the bag! Everything goes in the bag!", zh:"放进袋子！所有东西放进袋子！", tip:"让宝宝参与装袋，培养参与感，也教方位词「进」。" },
      ],
      "2-3": [
        { id:"sh21", en:"Can you find the apples? Look for the red ones!", zh:"你能找到苹果吗？找红色的！", tip:"赋予宝宝寻找任务，他会认真观察货架，充满成就感。" },
        { id:"sh22", en:"Which one should we get? The big one or the small one?", zh:"我们选哪个？大的还是小的？", tip:"购物决策让宝宝练习表达偏好和大小概念。" },
        { id:"sh23", en:"What do carrots look like? Orange and long!", zh:"胡萝卜是什么样的？橙色的，长长的！", tip:"描述特征帮宝宝建立蔬菜外观和名称的联系。" },
        { id:"sh24", en:"Let's count the yogurts! One, two, three, four!", zh:"我们数酸奶！一、二、三、四！", tip:"数货架上的商品把购物变成数学课，真实情境效果最好。" },
        { id:"sh25", en:"We got everything! Ready to pay? Let's go to the checkout!", zh:"我们买完了！准备结账？去收银台！", tip:"引导宝宝了解购物流程，培养对商业交易的基础理解。" },
      ],
      "3-6": [
        { id:"sh31", en:"Can you read what that sign says? Sound it out!", zh:"你能读出那个牌子上写的什么吗？拼一拼！", tip:"超市标牌是早期阅读的真实练习场，让孩子尝试拼读。" },
        { id:"sh32", en:"We have ten dollars. What can we buy with that?", zh:"我们有十块钱。用这些钱能买什么？", tip:"引入钱的概念，帮孩子理解价值和有限资源的选择。" },
        { id:"sh33", en:"Can you be my helper and find three vegetables?", zh:"你能帮我找三种蔬菜吗？", tip:"具体的数字任务让孩子感到被委以重任，积极参与。" },
        { id:"sh34", en:"Why do you think apples are in this section? What else is here?", zh:"你觉得苹果为什么在这个区域？这里还有什么？", tip:"引导孩子思考分类逻辑，培养归类和推理能力。" },
        { id:"sh35", en:"We need to choose healthy food. Is this a healthy choice?", zh:"我们要选健康的食物。这是健康的选择吗？", tip:"讨论食物是否健康，建立营养意识和批判性思考。" },
      ],
    }
  },

  friends: {
    icon: "👫", name: "见小朋友", color: "var(--accent2)",
    phrases: {
      "0-1": [
        { id:"fr01", en:"Look! A baby! Do you see the baby?", zh:"看！一个宝宝！你看到那个宝宝了吗？", tip:"指向其他婴儿，宝宝对同龄人有天然的好奇心。" },
        { id:"fr02", en:"The baby is smiling! So cute!", zh:"那个宝宝在笑！好可爱！", tip:"描述其他宝宝的表情，帮宝宝建立情绪识别的基础。" },
        { id:"fr03", en:"Wave hello! Say hi!", zh:"挥手打招呼！说嗨！", tip:"引导宝宝用动作打招呼，是社交行为的最初形式。" },
        { id:"fr04", en:"Playing together! Look at the babies!", zh:"一起玩！看看宝宝们！", tip:"描述平行游戏，帮宝宝意识到「一起」这个概念。" },
        { id:"fr05", en:"New friend! Hello, new friend!", zh:"新朋友！你好，新朋友！", tip:"用「新朋友」这个词，从小建立对陌生孩子的开放态度。" },
      ],
      "1-2": [
        { id:"fr11", en:"Say hi! Can you say hi to your friend?", zh:"打招呼！你能和小朋友说嗨吗？", tip:"轻柔鼓励，不强迫，让宝宝按自己的节奏学习社交。" },
        { id:"fr12", en:"Hello! My name is... What's your name?", zh:"你好！我叫……你叫什么名字？", tip:"示范打招呼的完整句式，宝宝会模仿大人的社交语言。" },
        { id:"fr13", en:"Share the toy! One for you, one for me!", zh:"分享玩具！一个给你，一个给我！", tip:"用实际动作演示分享，比说教更直观有效。" },
        { id:"fr14", en:"Your friend is sad. Can you give them a hug?", zh:"你的朋友难过了。你能给他一个抱抱吗？", tip:"引导关心他人，是同理心发展的第一步。" },
        { id:"fr15", en:"Play together! So fun with a friend!", zh:"一起玩！和朋友玩好开心！", tip:"强调一起玩的乐趣，让宝宝把「朋友」和「快乐」联系起来。" },
      ],
      "2-3": [
        { id:"fr21", en:"Can I play with you? Let's ask!", zh:"我可以和你们一起玩吗？我们去问问！", tip:"教宝宝主动请求加入游戏，是重要的社交技能起点。" },
        { id:"fr22", en:"Whose turn is it? It's your friend's turn now!", zh:"该谁了？现在轮到你的朋友了！", tip:"理解轮流是社交游戏的基础，需要反复在真实情境中练习。" },
        { id:"fr23", en:"You have to share. Can you give them a turn?", zh:"要分享哦。你能让他玩一下吗？", tip:"具体要求分享，帮宝宝练习控制冲动和考虑他人感受。" },
        { id:"fr24", en:"How does your friend feel? Do they look happy?", zh:"你的朋友感觉怎么样？他们看起来开心吗？", tip:"引导宝宝观察他人表情，是同理心发展的关键练习。" },
        { id:"fr25", en:"Say sorry. Saying sorry helps make it better!", zh:"说对不起。说对不起能让事情好一点！", tip:"示范道歉，同时解释原因，让道歉有意义而不是机械行为。" },
      ],
      "3-6": [
        { id:"fr31", en:"What's your name? Where do you go to school?", zh:"你叫什么名字？你在哪里上学？", tip:"教孩子基本的认识朋友的问题，建立社交自信心。" },
        { id:"fr32", en:"Do you want to be friends? I like playing with you!", zh:"你想和我做朋友吗？我喜欢和你一起玩！", tip:"直接表达友善意愿，帮孩子学习主动建立友谊。" },
        { id:"fr33", en:"Good friends take turns and share. Are you being a good friend?", zh:"好朋友轮流和分享。你是个好朋友吗？", tip:"引导自我反思，把抽象的「好朋友」变成可检查的行为。" },
        { id:"fr34", en:"If a friend feels left out, what can you do?", zh:"如果朋友感觉被排除在外，你能做什么？", tip:"培养孩子主动关注和接纳他人，建立包容的社交意识。" },
        { id:"fr35", en:"It's hard to say goodbye to friends. You'll see them again soon!", zh:"和朋友道别很难受。你很快就会再见到他们的！", tip:"帮孩子处理分离的情绪，建立「再见不是永别」的概念。" },
      ],
    }
  },

  share: {
    icon: "🤝", name: "分享礼让", color: "var(--green)",
    phrases: {
      "0-1": [
        { id:"sr01", en:"Look what baby has!", zh:"看宝宝有什么！", tip:"描述宝宝手中的物品，建立物品和语言的联系。" },
        { id:"sr02", en:"Passing it over! Here it comes!", zh:"传过来咯！来了！", tip:"把物品递给宝宝时说，帮他感受传递的动作。" },
        { id:"sr03", en:"Together! We play together!", zh:"一起！我们一起玩！", tip:"平行游戏时描述「在一起」，建立社交意识的雏形。" },
        { id:"sr04", en:"Your turn! Baby's turn!", zh:"轮到你了！宝宝的回合！", tip:"简单引入轮流概念，即使宝宝还不理解，语言种子已种下。" },
        { id:"sr05", en:"Sharing is nice! Nice and kind!", zh:"分享真好！好温柔！", tip:"用温暖语气描述分享时刻，让宝宝感受到正向氛围。" },
      ],
      "1-2": [
        { id:"sr11", en:"My turn! Your turn! My turn! Your turn!", zh:"我的回合！你的回合！我的！你的！", tip:"节奏性重复帮宝宝感受轮流的韵律，游戏化最有效。" },
        { id:"sr12", en:"Pass it to me! Thank you! Now I pass it back!", zh:"传给我！谢谢！现在我传回去！", tip:"示范完整的传递和感谢循环，宝宝通过模仿学习。" },
        { id:"sr13", en:"Can you give some to your friend? Good sharing!", zh:"能给你的朋友一些吗？分享得真好！", tip:"立即夸奖分享行为，强化正向社交习惯。" },
        { id:"sr14", en:"One for you, one for me! Fair and equal!", zh:"一个给你，一个给我！公平！", tip:"用具体分配演示公平概念，比说教直观得多。" },
        { id:"sr15", en:"Wait! It's their turn. You'll get a turn soon!", zh:"等一下！现在是他们的回合。你很快就轮到了！", tip:"等待的时候给予安慰，帮宝宝培养延迟满足的初步能力。" },
      ],
      "2-3": [
        { id:"sr21", en:"Can you share with your friend? They would love a turn!", zh:"你能和朋友分享吗？他们很想玩一下！", tip:"引导宝宝考虑他人的感受，是同理心发展的关键时期。" },
        { id:"sr22", en:"How long do you need? Then your friend can have a turn.", zh:"你还需要多久？然后朋友可以玩一下。", tip:"协商轮流时间，让宝宝有控制感，更愿意分享。" },
        { id:"sr23", en:"Let's wait patiently. It's not easy, but you can do it!", zh:"我们耐心等一等。不容易，但你能做到！", tip:"肯定等待的难度，同时表达信心，帮宝宝坚持下去。" },
        { id:"sr24", en:"Your friend shared with you! How does that feel?", zh:"你的朋友和你分享了！你感觉怎么样？", tip:"引导宝宝体验被分享的感受，建立共情基础。" },
        { id:"sr25", en:"When you share, everyone gets to be happy!", zh:"当你分享的时候，大家都能开心！", tip:"把分享和集体快乐联系起来，帮宝宝看到社交价值。" },
      ],
      "3-6": [
        { id:"sr31", en:"How does it feel when someone shares with you?", zh:"别人和你分享的时候你感觉怎么样？", tip:"引导孩子反思被分享的感受，内化分享的价值。" },
        { id:"sr32", en:"It can be hard to share your favorite toy. That's okay to feel.", zh:"分享最喜欢的玩具很难。有这种感觉没关系。", tip:"承认分享的情感难度，让孩子感到被理解而非被强迫。" },
        { id:"sr33", en:"Is there a fair way to decide who goes first?", zh:"有没有公平的方法决定谁先来？", tip:"引导孩子自主想出解决方案，培养公平感和解决冲突能力。" },
        { id:"sr34", en:"You waited so patiently! That was really mature of you.", zh:"你等得好有耐心！这真的很成熟。", tip:"夸奖等待的成熟行为，让孩子以自控力为荣。" },
        { id:"sr35", en:"Real friends share and take turns. You're being a great friend!", zh:"真正的朋友分享和轮流。你是个很棒的朋友！", tip:"将分享行为和友谊品质联系起来，建立孩子的社交身份认同。" },
      ],
    }
  },

  manners: {
    icon: "😊", name: "礼貌用语", color: "var(--accent)",
    phrases: {
      "0-1": [
        { id:"mn01", en:"Please! More milk, please!", zh:"请！再要牛奶，请！", tip:"在日常请求中自然使用please，让宝宝从小耳濡目染。" },
        { id:"mn02", en:"Thank you! Say thank you!", zh:"谢谢！说谢谢！", tip:"每次给宝宝东西时说谢谢，示范感恩的语言习惯。" },
        { id:"mn03", en:"You're welcome! Of course!", zh:"不客气！当然！", tip:"回应谢谢时说，完整示范礼貌对话的交流模式。" },
        { id:"mn04", en:"So polite! Good manners!", zh:"真有礼貌！好规矩！", tip:"看到礼貌行为时夸奖，强化宝宝对礼貌的正面印象。" },
        { id:"mn05", en:"Excuse me! Pardon me!", zh:"打扰一下！借过！", tip:"路过别人时说，示范日常礼貌用语的使用场合。" },
      ],
      "1-2": [
        { id:"mn11", en:"Say please! Can you say please?", zh:"说请！你能说请吗？", tip:"温和提示，不强迫，用引导而非命令建立礼貌习惯。" },
        { id:"mn12", en:"Say thank you! Someone gave you something nice!", zh:"说谢谢！有人给了你好东西！", tip:"即时提示，让谢谢和被给予的场景建立直接联系。" },
        { id:"mn13", en:"Good manners! You said please! That's so nice!", zh:"好有礼貌！你说了请！真好！", tip:"立即夸奖自发的礼貌用语，强化行为。" },
        { id:"mn14", en:"Excuse me! We say excuse me when we need to pass!", zh:"打扰一下！需要经过时我们说打扰一下！", tip:"在真实场景中解释用法，比单纯记词效果好。" },
        { id:"mn15", en:"Sorry! Oops, say sorry!", zh:"对不起！哎呀，说对不起！", tip:"在小意外发生时立即示范，让宝宝理解道歉的时机。" },
      ],
      "2-3": [
        { id:"mn21", en:"What do we say when we want something? Please!", zh:"想要东西的时候说什么？请！", tip:"问答形式帮宝宝主动回忆礼貌用语，比直接提示更有效。" },
        { id:"mn22", en:"Someone helped you. What do you say? Thank you!", zh:"有人帮了你。你说什么？谢谢！", tip:"在帮助的场景中练习感谢，让谢谢有真实的情感意义。" },
        { id:"mn23", en:"You bumped into someone. What's the polite thing to say?", zh:"你碰到了别人。有礼貌的说法是什么？", tip:"真实情境中提问比事前教导更能促进语言内化。" },
        { id:"mn24", en:"We say excuse me when we need to pass. Can you try?", zh:"需要经过时我们说打扰一下。你能试试吗？", tip:"鼓励宝宝在真实场合自己说出来，建立使用自信。" },
        { id:"mn25", en:"When someone gives you a gift, what do we say?", zh:"别人送你礼物的时候，我们说什么？", tip:"预先教导特定场景的礼貌，让宝宝有准备感。" },
      ],
      "3-6": [
        { id:"mn31", en:"It makes people feel good when you say thank you. Did you see them smile?", zh:"你说谢谢会让别人感觉很好。你看到他们笑了吗？", tip:"引导孩子观察礼貌的效果，让礼貌成为有意义的社交工具。" },
        { id:"mn32", en:"Which words make people feel respected? Please, thank you, excuse me!", zh:"哪些词让人感到被尊重？请、谢谢、打扰一下！", tip:"用「尊重」这个概念帮大孩子理解礼貌的深层意义。" },
        { id:"mn33", en:"Even if you don't like the gift, what's the kind thing to say?", zh:"就算你不喜欢礼物，善意的说法是什么？", tip:"教导即使不满意也要表达感谢，培养体贴他人的品格。" },
        { id:"mn34", en:"How do you ask politely when you want something at the table?", zh:"在餐桌上想要东西时，你怎么礼貌地请求？", tip:"餐桌礼仪是大孩子需要掌握的重要社交技能。" },
        { id:"mn35", en:"Good manners show that you care about other people's feelings.", zh:"好的礼貌表示你关心别人的感受。", tip:"帮孩子理解礼貌是一种关怀表达，而非单纯的规则服从。" },
      ],
    }
  },

  safety: {
    icon: "⚠️", name: "安全规则", color: "var(--accent)",
    phrases: {
      "0-1": [
        { id:"sf01", en:"Stop! Stop right there!", zh:"停！就停在那里！", tip:"声音坚定但不恐吓，清晰的停止信号从小建立最重要。" },
        { id:"sf02", en:"Wait! Wait for Mommy!", zh:"等！等妈妈！", tip:"在危险情境前用平静但明确的语气说等，建立安全习惯。" },
        { id:"sf03", en:"Hold on! I've got you.", zh:"抓好！我抱着你。", tip:"抱着宝宝时说，让宝宝感受到被保护和支撑。" },
        { id:"sf04", en:"No no, hot! Don't touch!", zh:"不不，烫！不要碰！", tip:"遇到热的东西时立即说，语气严肃帮宝宝记住危险信号。" },
        { id:"sf05", en:"Stay close! Right here with me.", zh:"待在旁边！就在我这里。", tip:"在人多或陌生环境中说，建立靠近大人的安全习惯。" },
      ],
      "1-2": [
        { id:"sf11", en:"Hold my hand! We hold hands near the road.", zh:"牵我的手！在马路边要牵手。", tip:"每次接近马路时说，让牵手成为自动反应。" },
        { id:"sf12", en:"Wait for Mommy! Wait for Daddy!", zh:"等妈妈！等爸爸！", tip:"重复具体的等待对象，让宝宝知道等谁、为什么等。" },
        { id:"sf13", en:"Stop at the road! Cars are coming!", zh:"在马路边停下！有汽车来了！", tip:"指向道路同时说，建立视觉和语言的安全联系。" },
        { id:"sf14", en:"Don't run near the road! Walk with me!", zh:"马路边不要跑！和我一起走！", tip:"给出明确指令并示范正确行为，比单说不要更有效。" },
        { id:"sf15", en:"Good waiting! You stopped! Well done!", zh:"等得真好！你停下来了！真棒！", tip:"立即夸奖正确的安全行为，强化服从安全指令的习惯。" },
      ],
      "2-3": [
        { id:"sf21", en:"Why do we hold hands near cars?", zh:"为什么在汽车旁边要牵手？", tip:"引导宝宝思考安全规则背后的原因，理解比服从更持久。" },
        { id:"sf22", en:"Cars can go very fast. We need to be careful!", zh:"汽车可以跑得很快。我们需要小心！", tip:"用简单语言解释危险，帮宝宝建立对速度和危险的概念。" },
        { id:"sf23", en:"Before we cross, we look left and right. Can you do that?", zh:"过马路前，我们向左看向右看。你能这样做吗？", tip:"让宝宝参与安全检查动作，练习路口规则。" },
        { id:"sf24", en:"If you get lost, find a safe grown-up to help.", zh:"如果你走失了，找一个安全的大人帮忙。", tip:"提前教导走失应对，让宝宝知道该找谁求助。" },
        { id:"sf25", en:"We always stop at the curb. The curb is our stop line!", zh:"我们总是在路沿石停下。路沿石是我们的停止线！", tip:"具体标志物让安全规则变得可操作、易记忆。" },
      ],
      "3-6": [
        { id:"sf31", en:"What do we do before we cross the street? Look, listen, then go!", zh:"过马路前我们做什么？看、听、然后走！", tip:"三步骤口诀让孩子记住过马路的流程，简单实用。" },
        { id:"sf32", en:"Why is it dangerous to run near the road?", zh:"为什么在马路边跑步危险？", tip:"让孩子自己解释危险，深化理解，比反复叮嘱更有效。" },
        { id:"sf33", en:"What would you do if a stranger asked you to go with them?", zh:"如果一个陌生人叫你跟他走，你会怎么做？", tip:"提前演练陌生人安全场景，让孩子有应对方案。" },
        { id:"sf34", en:"Safety rules keep us safe even when it feels annoying to follow them.", zh:"安全规则在遵守时即使感觉烦也能保护我们。", tip:"承认规则有时令人烦躁，同时解释其价值，培养理性服从。" },
        { id:"sf35", en:"If there's an emergency, what's our family's plan?", zh:"如果有紧急情况，我们家的计划是什么？", tip:"讨论家庭紧急应对计划，让孩子感到有备无患。" },
      ],
    }
  },

  sick: {
    icon: "🤒", name: "生病照顾", color: "var(--purple)",
    phrases: {
      "0-1": [
        { id:"sk01", en:"I know, I know. You don't feel well.", zh:"我知道，我知道。你不舒服。", tip:"平静温柔地承认宝宝的不适，声音是最好的安慰。" },
        { id:"sk02", en:"Mommy's here. You're going to be okay.", zh:"妈妈在这里。你会好起来的。", tip:"强调陪伴和保证，给生病的宝宝最基本的安全感。" },
        { id:"sk03", en:"So warm. Let me feel your forehead.", zh:"好暖。让我摸摸你的额头。", tip:"轻轻触碰额头时说，帮宝宝习惯检查体温的过程。" },
        { id:"sk04", en:"Rest now. Shh, rest.", zh:"现在休息。嘘，休息。", tip:"用轻柔的声音和重复的节奏，帮生病的宝宝平静下来。" },
        { id:"sk05", en:"You're safe. I'm right here with you.", zh:"你很安全。我就在你身边。", tip:"生病的宝宝需要持续的陪伴保证，反复说「我在这里」。" },
      ],
      "1-2": [
        { id:"sk11", en:"Does your tummy hurt? Show me where it hurts.", zh:"肚子疼吗？告诉我哪里疼。", tip:"引导宝宝指出疼痛位置，建立身体感觉和语言的连接。" },
        { id:"sk12", en:"You have a fever. Your body is fighting the germs!", zh:"你发烧了。你的身体在对抗细菌！", tip:"用积极的方式解释发烧，减少宝宝的恐惧感。" },
        { id:"sk13", en:"Does your head hurt? Your throat? Show me!", zh:"头疼吗？嗓子疼吗？告诉我！", tip:"命名身体部位，帮宝宝学习描述不同部位的不适。" },
        { id:"sk14", en:"Time for medicine. It will help you feel better!", zh:"吃药时间。它会帮你好起来！", tip:"用积极的框架介绍药物，减少宝宝对吃药的抗拒。" },
        { id:"sk15", en:"Rest and cuddle time. Mommy will stay with you.", zh:"休息和抱抱时间。妈妈会陪着你。", tip:"生病时的身体接触和陪伴是最有效的安慰方式。" },
      ],
      "2-3": [
        { id:"sk21", en:"You have a fever. We need to see the doctor today.", zh:"你发烧了。我们今天需要去看医生。", tip:"平静地解释去医生的原因，提前预告减少宝宝的焦虑。" },
        { id:"sk22", en:"The doctor will check your ears and throat. It won't hurt much.", zh:"医生会检查你的耳朵和嗓子。不会很疼的。", tip:"描述诊察过程，减少对未知的恐惧。" },
        { id:"sk23", en:"How do you feel today? Better or the same?", zh:"你今天感觉怎么样？好一些还是一样？", tip:"引导宝宝描述自己的感受，建立身体觉察和表达能力。" },
        { id:"sk24", en:"Drinking water helps your body get better faster!", zh:"喝水能帮你的身体更快好起来！", tip:"解释喝水的作用，让宝宝更愿意配合。" },
        { id:"sk25", en:"Your body is strong. It knows how to get better!", zh:"你的身体很强壮。它知道怎么好起来！", tip:"鼓励宝宝对自己的身体产生信任和信心。" },
      ],
      "3-6": [
        { id:"sk31", en:"The medicine will help you feel better. Can you be brave and take it?", zh:"药会帮你好起来。你能勇敢地吃吗？", tip:"用勇敢框架鼓励孩子配合吃药，让吃药成为勇气的表现。" },
        { id:"sk32", en:"What part of your body hurts? Can you describe it?", zh:"你身体哪里疼？你能描述一下吗？", tip:"鼓励孩子详细描述症状，建立身体语言和医疗沟通能力。" },
        { id:"sk33", en:"Even doctors and nurses get sick sometimes. Everyone does.", zh:"医生和护士有时也会生病。每个人都会。", tip:"正常化生病经历，减少孩子因生病产生的无助感。" },
        { id:"sk34", en:"Let's read a book while you rest. What would you like?", zh:"你休息的时候我们读本书。你想读什么？", tip:"用阅读陪伴病中的孩子，转移注意力也增进亲子联结。" },
        { id:"sk35", en:"You were so brave at the doctor! I'm really proud of you.", zh:"你在医生那里好勇敢！我真的很为你骄傲。", tip:"事后具体夸奖勇敢行为，强化孩子面对医疗的正向体验。" },
      ],
    }
  },

  cleanup: {
    icon: "🧹", name: "收拾整理", color: "var(--teal)",
    phrases: {
      "0-1": [
        { id:"cl01", en:"In it goes! Into the box!", zh:"放进去！放进盒子里！", tip:"帮宝宝把玩具放入盒中时说，建立收纳动作的语言联系。" },
        { id:"cl02", en:"Out it comes! Now in again!", zh:"拿出来！现在再放进去！", tip:"反复进出的游戏让宝宝享受收拾的过程。" },
        { id:"cl03", en:"Plop! In the basket!", zh:"扑通！放进篮子！", tip:"加上音效词让收纳变得有趣，宝宝喜欢重复。" },
        { id:"cl04", en:"All gone! Everything in!", zh:"都不见了！全放进去了！", tip:"收完后说，给宝宝清晰的完成感。" },
        { id:"cl05", en:"Good helper! You helped put things away!", zh:"好帮手！你帮忙收拾了！", tip:"即使宝宝只参与一个动作也值得夸奖，建立帮忙的正向体验。" },
      ],
      "1-2": [
        { id:"cl11", en:"Clean up time! Into the box, toys!", zh:"收拾时间！玩具进盒子！", tip:"宣告清理开始，帮宝宝切换到收拾模式。" },
        { id:"cl12", en:"Let's sing the cleanup song! Clean up, clean up, everybody clean up!", zh:"我们唱收拾歌！收啊收，收啊收，大家一起收！", tip:"收拾歌让清理变成游戏，宝宝听到歌就知道该做什么了。" },
        { id:"cl13", en:"Where does this go? In the box! Good job!", zh:"这个放哪里？放盒子里！好棒！", tip:"让宝宝参与决定归位，培养空间和归属感。" },
        { id:"cl14", en:"All the blocks in! Can you find any more?", zh:"积木全放进去了！你还能找到吗？", tip:"把寻找玩具变成游戏，让收拾更有趣。" },
        { id:"cl15", en:"We're all done! The room looks so tidy!", zh:"收拾好了！房间看起来好整齐！", tip:"完成后描述干净整洁的结果，帮宝宝感受整理的成果。" },
      ],
      "2-3": [
        { id:"cl21", en:"Where does this toy live? Let's put it back home!", zh:"这个玩具住在哪里？我们送它回家！", tip:"用「玩具的家」的比喻让归位变得有意义。" },
        { id:"cl22", en:"Can you find all the blocks? They need to go in the bag!", zh:"你能找到所有积木吗？它们要放进袋子里！", tip:"寻找任务让清理变成有目标的活动，宝宝更有动力。" },
        { id:"cl23", en:"First we clean up, then we can have a snack. Ready?", zh:"先收拾，然后我们吃零食。准备好了吗？", tip:"先后顺序加上激励让宝宝更愿意完成清理任务。" },
        { id:"cl24", en:"You cleaned up all by yourself! That was a big job!", zh:"你自己收拾好了！这是一件大工作！", tip:"认可自主完成的努力，让宝宝为独立承担感到骄傲。" },
        { id:"cl25", en:"When we're done playing, we always put things away. That's our rule!", zh:"玩完后我们总是收拾好。这是我们的规定！", tip:"把收拾建立为不可商量的规则，减少每次的协商成本。" },
      ],
      "3-6": [
        { id:"cl31", en:"Your room will feel nicer when it's tidy. Let's make it cozy!", zh:"收拾整齐后你的房间会更舒适。我们让它变温馨吧！", tip:"从孩子的角度出发，用舒适感而非规则激励收拾。" },
        { id:"cl32", en:"Can you sort the toys into the right boxes? Books with books, cars with cars!", zh:"你能把玩具分类放入正确的盒子吗？书和书，车和车！", tip:"分类整理是数学思维和逻辑能力的基础练习。" },
        { id:"cl33", en:"Let's set a timer! Can you clean up before it goes off?", zh:"我们定个计时器！你能在响之前收拾好吗？", tip:"计时挑战把清理变成比赛，大孩子喜欢这种自我挑战。" },
        { id:"cl34", en:"Taking care of your things means they'll last longer.", zh:"好好照顾你的东西意味着它们能用更久。", tip:"教导物品保养的因果关系，培养珍惜物品的意识。" },
        { id:"cl35", en:"You did a great job tidying! How does the room feel now?", zh:"你收拾得真棒！现在房间感觉怎么样？", tip:"引导孩子感受整洁的成果，建立清洁和舒适感的正向联结。" },
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
        { id:"dc04", en:"Soft! Touch the soft blanket!", zh:"软软的！摸摸软软的毯子！", tip:"引导触摸并命名触感，丰富宝宝的感知词汇。" },
        { id:"dc05", en:"Big dog! Small cat! Big, small!", zh:"大狗！小猫！大，小！", tip:"用动物对比大小概念，真实的对比最容易理解。" },
      ],
      "1-2": [
        { id:"dc11", en:"What's that? A car! Vroom vroom!", zh:"那是什么？汽车！呜呜！", tip:"问什么并立即回答，帮宝宝把问题和答案联系起来。" },
        { id:"dc12", en:"A dog! Can you say dog? Woof woof!", zh:"狗狗！你能说狗吗？汪汪！", tip:"鼓励模仿动物名称和叫声，双重练习降低门槛。" },
        { id:"dc13", en:"Look at the butterfly! It's flying! Flutter flutter!", zh:"看蝴蝶！它在飞！扑扑扑！", tip:"追踪移动的动物，培养宝宝的视觉追踪和词汇积累。" },
        { id:"dc14", en:"Hot sun! The sun is warm! Feel the warmth!", zh:"热热的太阳！太阳很暖和！感受暖意！", tip:"引导宝宝感受温度，建立天气和感觉的词汇联系。" },
        { id:"dc15", en:"Truck! Big big truck! It's so big!", zh:"大卡车！好大的卡车！好大啊！", tip:"夸张的形容词让词汇更生动，宝宝更容易记住。" },
      ],
      "2-3": [
        { id:"dc21", en:"Why does the dog bark? It's talking to us!", zh:"狗狗为什么叫？它在跟我们说话！", tip:"用有趣的解释回答为什么，引发宝宝对世界的好奇心。" },
        { id:"dc22", en:"What color is the sky today? Blue! What about the clouds?", zh:"今天天空是什么颜色？蓝色！那云呢？", tip:"观察天空颜色是每天都能做的词汇和感知练习。" },
        { id:"dc23", en:"Where do you think the bird is going? Maybe to find food!", zh:"你觉得小鸟要去哪里？也许去找食物！", tip:"鼓励推测和猜测，培养因果思维和想象力。" },
        { id:"dc24", en:"Feel the rough bark! The tree's skin is bumpy!", zh:"摸摸粗糙的树皮！树的皮是凹凸不平的！", tip:"户外触感探索丰富感知词汇，树皮是很好的触觉体验。" },
        { id:"dc25", en:"It's raining! Where does the rain come from?", zh:"下雨了！雨从哪里来？", tip:"用宝宝能理解的方式引发对自然现象的好奇。" },
      ],
      "3-6": [
        { id:"dc31", en:"How do you think that works?", zh:"你觉得这个是怎么运作的？", tip:"开放性问题激发孩子的探究欲，比给答案更能培养思考力。" },
        { id:"dc32", en:"Why do you think leaves change color in autumn?", zh:"你觉得为什么树叶在秋天会变色？", tip:"季节性自然现象是启发科学思维的绝佳话题。" },
        { id:"dc33", en:"Let's look it up! I wonder if we can find the answer.", zh:"我们来查一查！我想知道能不能找到答案。", tip:"示范好奇心和查找知识的习惯，建立终身学习的榜样。" },
        { id:"dc34", en:"You asked a great question! I don't know either — let's find out!", zh:"你问了一个很好的问题！我也不知道——我们一起找答案！", tip:"对不知道的事情坦诚，并一起探索，培养孩子提问的勇气。" },
        { id:"dc35", en:"What do you notice about this bug? How many legs does it have?", zh:"你注意到这只虫子的什么？它有几条腿？", tip:"引导仔细观察，培养科学观察的方法和细心的习惯。" },
      ],
    }
  },

  praise: {
    icon: "⭐", name: "表扬鼓励", color: "var(--accent2)",
    phrases: {
      "0-1": [
        { id:"pw01", en:"Good job! You did it!", zh:"做得好！你做到了！", tip:"用愉快的声音和表情配合夸奖，宝宝会感受到你的喜悦。" },
        { id:"pw02", en:"Yes! Well done, little one!", zh:"耶！做得好，小宝贝！", tip:"任何小进步都值得庆祝，让宝宝感受到努力被看见。" },
        { id:"pw03", en:"Look at you go! Amazing!", zh:"看你！太棒了！", tip:"描述宝宝的行动，让夸奖和具体动作联系起来。" },
        { id:"pw04", en:"I love watching you try!", zh:"我喜欢看你尝试！", tip:"夸奖尝试本身，从最早期就建立成长型思维的基础。" },
        { id:"pw05", en:"You're doing great! Keep going!", zh:"你做得很好！继续！", tip:"在宝宝坚持做某件事时鼓励，强化持续努力的意识。" },
      ],
      "1-2": [
        { id:"pw11", en:"Good job! You did it all by yourself!", zh:"好棒！你自己做到了！", tip:"强调「自己」，让宝宝感受到独立完成的成就感。" },
        { id:"pw12", en:"You tried so hard! I'm proud of you!", zh:"你那么努力尝试！我为你骄傲！", tip:"夸努力而非结果，是成长型思维的核心培养方式。" },
        { id:"pw13", en:"Yay! You did it! High five!", zh:"耶！你做到了！击掌！", tip:"用击掌这个互动仪式让庆祝变得有形有趣。" },
        { id:"pw14", en:"You're getting better and better!", zh:"你越来越好了！", tip:"强调进步的过程，让宝宝感受到成长的动态感。" },
        { id:"pw15", en:"I see you trying! That makes me so happy!", zh:"我看到你在努力！这让我好开心！", tip:"「我看到」是有效夸奖的关键，表示大人在关注和欣赏。" },
      ],
      "2-3": [
        { id:"pw21", en:"I love how you didn't give up! You kept trying!", zh:"我喜欢你没有放弃！你一直在尝试！", tip:"具体夸奖坚持的行为，让不放弃成为值得骄傲的品质。" },
        { id:"pw22", en:"That was tricky and you did it anyway! Wow!", zh:"那很难，但你还是做到了！哇！", tip:"承认难度再夸成就，让孩子感受到克服挑战的价值。" },
        { id:"pw23", en:"You worked really hard on that! Look what you made!", zh:"你为那个真的很努力！看你做的！", tip:"把努力和成果联系起来，让孩子看到付出的意义。" },
        { id:"pw24", en:"Mistakes help you learn! You're getting smarter!", zh:"犯错帮助你学习！你越来越聪明了！", tip:"把错误框架为学习机会，帮宝宝建立对挫折的健康态度。" },
        { id:"pw25", en:"You should feel proud! You did something hard!", zh:"你应该感到骄傲！你做了一件困难的事！", tip:"引导内在自豪感，比依赖外部表扬更能建立持久自信。" },
      ],
      "3-6": [
        { id:"pw31", en:"You practiced and got better! That's how learning works!", zh:"你练习了然后进步了！这就是学习的方式！", tip:"具体指出练习和进步的因果，强化成长型思维的核心概念。" },
        { id:"pw32", en:"I noticed you didn't give up when it was hard. That's real courage!", zh:"我注意到在困难的时候你没有放弃。那是真正的勇气！", tip:"将坚持定义为勇气，提升孩子对自身韧性的认识。" },
        { id:"pw33", en:"It's not about being the best — it's about doing your best!", zh:"不是要成为最好的——而是要尽力做到最好！", tip:"区分与他人比较和自我超越，帮孩子建立健康的成就观。" },
        { id:"pw34", en:"What part are you most proud of? Tell me!", zh:"你最骄傲哪个部分？告诉我！", tip:"引导孩子自我评价，培养内在的成就感和自我认知。" },
        { id:"pw35", en:"I'm not just proud of what you did — I'm proud of how hard you tried.", zh:"我不只为你做了什么感到骄傲——我为你有多努力尝试感到骄傲。", tip:"明确区分结果和努力的表扬，是成长型思维最有力的语言示范。" },
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
        { id:"ex05", en:"Up up up! Standing!", zh:"起来起来！站立！", tip:"扶着宝宝站立时说，为之后的独立站立做语言准备。" },
      ],
      "1-2": [
        { id:"ex11", en:"Run run run! Fast feet!", zh:"跑跑跑！快脚丫！", tip:"跟着宝宝跑，配合夸张的语气，让运动充满乐趣。" },
        { id:"ex12", en:"Jump! Jump jump jump!", zh:"跳！跳跳跳！", tip:"示范跳的动作并说出来，宝宝会模仿大人的动作和声音。" },
        { id:"ex13", en:"Stomp your feet! Big stomps!", zh:"踩脚！用力踩！", tip:"夸张地踩脚，给宝宝展示全身投入运动的乐趣。" },
        { id:"ex14", en:"Spin around! Wheee!", zh:"转圈圈！嗖嗖嗖！", tip:"转圈刺激前庭感觉，宝宝极度喜欢，注意不要过度。" },
        { id:"ex15", en:"Catch! Throw it back!", zh:"接住！扔回来！", tip:"简单的扔接游戏培养手眼协调，从近距离开始。" },
      ],
      "2-3": [
        { id:"ex21", en:"How high can you jump? Show me your biggest jump!", zh:"你能跳多高？给我看你最大的跳！", tip:"挑战性的问题激发宝宝主动尝试，并培养自我评估意识。" },
        { id:"ex22", en:"Let's count your jumps! One, two, three...", zh:"我们数你的跳！一、二、三……", tip:"数数和运动结合，在运动中自然练习数字概念。" },
        { id:"ex23", en:"Can you walk on tiptoe? Try it!", zh:"你能踮起脚尖走路吗？试试！", tip:"平衡挑战培养协调能力，也是有趣的运动游戏。" },
        { id:"ex24", en:"Touch your toes! Bend down low!", zh:"碰脚趾！弯腰低下去！", tip:"简单的柔韧性练习让宝宝感受身体的灵活性。" },
        { id:"ex25", en:"Freeze! Now go! Freeze! Now go!", zh:"定住！现在动！定住！现在动！", tip:"定格游戏培养听指令和自我控制能力，也是全身运动。" },
      ],
      "3-6": [
        { id:"ex31", en:"Simon says jump! Simon says touch your nose!", zh:"西蒙说跳！西蒙说摸鼻子！", tip:"Simon Says游戏练习听指令、自我控制和身体部位词汇。" },
        { id:"ex32", en:"Can you follow the leader? Do everything I do!", zh:"你能跟着领袖做吗？做我做的所有动作！", tip:"Follow the Leader培养模仿、观察和身体协调能力。" },
        { id:"ex33", en:"Let's do ten jumping jacks! Count with me!", zh:"我们做十个开合跳！跟我一起数！", tip:"有计划的运动挑战建立数感和运动习惯。" },
        { id:"ex34", en:"It's okay if you lose a game. What matters is you played hard!", zh:"输了没关系。重要的是你全力以赴！", tip:"游戏中的失败是最自然的体育精神教育时机。" },
        { id:"ex35", en:"When you move and play, your body gets strong!", zh:"动一动，玩一玩，身体就会变强壮！", tip:"建立运动习惯的意识，从小培养对健康生活方式的认识。" },
      ],
    }
  },

  kitchen: {
    icon: "🥄", name: "厨房帮忙", color: "var(--accent)",
    phrases: {
      "0-1": [
        { id:"kt01", en:"Mommy is stirring! Round and round!", zh:"妈妈在搅拌！转啊转！", tip:"在厨房里向宝宝描述你的动作，建立动词和动作的联系。" },
        { id:"kt02", en:"Listen! Sizzle sizzle! That's cooking!", zh:"听！滋滋滋！这是在烹饪！", tip:"厨房声音是丰富的感知体验，描述声音扩展词汇。" },
        { id:"kt03", en:"Mmm, it smells so good! Something yummy is cooking!", zh:"嗯，好香！有好吃的东西在做了！", tip:"引导宝宝感受气味，建立嗅觉和食物词汇的联系。" },
        { id:"kt04", en:"Look at all the vegetables! Colors everywhere!", zh:"看这么多蔬菜！到处都是颜色！", tip:"蔬菜是天然的颜色学习教材，边做饭边命名颜色。" },
        { id:"kt05", en:"Daddy is chopping! Chop chop chop!", zh:"爸爸在切菜！切切切！", tip:"厨房动词的音效化让宝宝更容易记住烹饪词汇。" },
      ],
      "1-2": [
        { id:"kt11", en:"Can you stir? Round and round! Good job!", zh:"你能搅拌吗？转啊转！好棒！", tip:"让宝宝用安全的工具参与，哪怕只搅几下也建立参与感。" },
        { id:"kt12", en:"Spoon! This is a spoon. Stir stir stir!", zh:"勺子！这是勺子。搅搅搅！", tip:"命名厨具并立即示范用法，让词汇和功能同时学习。" },
        { id:"kt13", en:"Bowl! Put it in the bowl! Plop plop!", zh:"碗！放进碗里！扑扑扑！", tip:"让宝宝把食材放入碗中，简单参与建立厨房自信心。" },
        { id:"kt14", en:"That's a carrot! Orange! Crunch crunch!", zh:"这是胡萝卜！橙色的！嚼嚼嚼！", tip:"命名蔬菜、颜色和声音，厨房是多感官词汇学习场所。" },
        { id:"kt15", en:"Wash the vegetable! Rub rub rub! Clean and ready!", zh:"洗蔬菜！搓搓搓！干净可以吃了！", tip:"让宝宝参与洗菜，简单的任务建立厨房习惯和参与感。" },
      ],
      "2-3": [
        { id:"kt21", en:"Pour the water in! Slowly, carefully!", zh:"把水倒进去！慢慢的，小心！", tip:"倒水是宝宝喜欢的活动，也培养精细动作和专注力。" },
        { id:"kt22", en:"Wash the vegetable! Can you rub it clean?", zh:"洗蔬菜！你能把它搓干净吗？", tip:"给宝宝真实任务，让他在厨房中感到有用和重要。" },
        { id:"kt23", en:"What do you think we're making? Can you guess?", zh:"你觉得我们在做什么？你能猜猜吗？", tip:"引导宝宝根据食材和气味推测，培养预测和推理思维。" },
        { id:"kt24", en:"Is it hot or cold? Don't touch the stove — it's hot!", zh:"是热的还是冷的？不要碰炉子——很烫！", tip:"在厨房中自然地强化安全意识，结合实物说明危险。" },
        { id:"kt25", en:"You're Mommy's little helper! This soup is going to be so yummy!", zh:"你是妈妈的小帮手！这汤会很好喝！", tip:"让宝宝感受到贡献，把参与和美好结果联系起来。" },
      ],
      "3-6": [
        { id:"kt31", en:"First we wash the vegetables, then we cut them. What comes next?", zh:"先洗蔬菜，然后切。接下来是什么？", tip:"用步骤顺序引导孩子思考流程，培养逻辑和序列意识。" },
        { id:"kt32", en:"Can you measure two cups of flour? Let's count!", zh:"你能量两杯面粉吗？我们数一数！", tip:"烘焙中的测量是数学概念的真实应用，意义感强。" },
        { id:"kt33", en:"What do you think will happen when we mix these together?", zh:"你觉得我们把这些混在一起会发生什么？", tip:"引发对烹饪科学的预测，培养观察、假设和验证的思维。" },
        { id:"kt34", en:"You helped make this! How does it feel to eat something you made?", zh:"你帮忙做了这个！吃自己做的东西感觉怎么样？", tip:"引导孩子感受创造的成就，将厨房体验和自豪感联系起来。" },
        { id:"kt35", en:"Cooking is a skill you'll use your whole life. You're learning something important!", zh:"烹饪是你一生都会用到的技能。你在学一件重要的事！", tip:"赋予厨房学习重要意义，让孩子对掌握生活技能感到自豪。" },
      ],
    }
  },

  nap: {
    icon: "😴", name: "午睡时间", color: "var(--purple)",
    phrases: {
      "0-1": [
        { id:"np01", en:"Sleepy time. Close your eyes.", zh:"睡觉时间。闭上眼睛。", tip:"用最轻柔的声音说，配合轻拍背部节奏。" },
        { id:"np02", en:"Shhh... time to rest.", zh:"嘘……该休息了。", tip:"音量逐渐降低，帮宝宝过渡到安静状态。" },
        { id:"np03", en:"Cozy and warm. Nap time.", zh:"暖暖的，舒舒服服的。午睡时间。", tip:"用毯子包好宝宝时说，强化安全舒适感。" },
        { id:"np04", en:"Sweet dreams, little one.", zh:"做个好梦，小宝贝。", tip:"每次午睡说同样的话，建立睡前信号。" },
        { id:"np05", en:"I'm right here. Sleep well.", zh:"我就在这里。好好睡。", tip:"让宝宝知道你不会离开，减少分离焦虑。" },
      ],
      "1-2": [
        { id:"np11", en:"It's nap time! Let's find your blanket.", zh:"午睡时间到！我们去找你的小毯子。", tip:"找毯子变成小仪式，帮宝宝启动入睡模式。" },
        { id:"np12", en:"Lie down. Close your eyes. Good.", zh:"躺下来。闭上眼睛。很好。", tip:"简短指令配动作示范，宝宝容易跟上。" },
        { id:"np13", en:"Shh, everything is quiet now.", zh:"嘘，现在一切都安静了。", tip:"降低环境刺激，用语言帮宝宝感知安静氛围。" },
        { id:"np14", en:"Teddy is sleeping too. Shhh!", zh:"小熊也在睡觉呢。嘘！", tip:"让玩具一起「入睡」，宝宝更愿意模仿。" },
        { id:"np15", en:"Sleep sleep sleep. Wake up happy!", zh:"睡呀睡呀睡。醒来开开心心！", tip:"用愉快的尾句让宝宝期待醒来，减少抗拒。" },
      ],
      "2-3": [
        { id:"np21", en:"It's time for your nap. Your body needs rest.", zh:"该午睡了。你的身体需要休息。", tip:"简单解释原因，2-3岁宝宝开始理解「为什么」。" },
        { id:"np22", en:"Do you want your bunny or your bear for nap?", zh:"午睡要抱小兔子还是小熊？", tip:"给选择权减少抵触，宝宝感到被尊重。" },
        { id:"np23", en:"Let's count to ten while you close your eyes. One, two...", zh:"我们闭上眼睛数到十。一、二……", tip:"数数游戏转移注意力，帮宝宝平静入睡。" },
        { id:"np24", en:"What did we do this morning? Tell me and then sleep.", zh:"我们早上做了什么？说完就睡觉。", tip:"睡前回顾有助情绪整理，也是语言练习。" },
        { id:"np25", en:"After your nap we'll go to the park. Sleep first!", zh:"午睡后我们去公园。先睡觉！", tip:"用期待的活动作为动力，让宝宝有盼头。" },
      ],
      "3-6": [
        { id:"np31", en:"Even if you don't sleep, just rest your body.", zh:"就算不睡着，也要让身体休息一下。", tip:"降低入睡压力，「休息」比「必须睡着」更易接受。" },
        { id:"np32", en:"Your brain grows when you sleep. That's why we rest!", zh:"睡觉的时候大脑会成长。所以我们要休息！", tip:"用科学小知识满足大孩子的好奇心。" },
        { id:"np33", en:"You can look at a book quietly until you fall asleep.", zh:"你可以安静地看书，直到睡着为止。", tip:"给自主空间，让午睡变成享受而非强制。" },
        { id:"np34", en:"How are you feeling? Tired? A little bit?", zh:"你感觉怎么样？累吗？有一点？", tip:"引导孩子感知自己的疲劳信号，培养自我察觉。" },
        { id:"np35", en:"Let's set a timer. When it rings, nap time is over.", zh:"我们定个计时器。响了就结束午睡时间。", tip:"计时器给孩子掌控感，减少「什么时候才结束」的焦虑。" },
      ],
    }
  },

  snack: {
    icon: "🍎", name: "零食时间", color: "var(--green)",
    phrases: {
      "0-1": [
        { id:"sn01", en:"Snack time! Open wide.", zh:"零食时间！张开嘴巴。", tip:"用愉快语气宣告零食，建立正面的进食信号。" },
        { id:"sn02", en:"Mmm! So yummy!", zh:"嗯！好好吃！", tip:"夸张的表情和语气帮宝宝感受食物的乐趣。" },
        { id:"sn03", en:"This is banana. Banana!", zh:"这是香蕉。香蕉！", tip:"重复食物名称，是宝宝学词汇的最自然时机。" },
        { id:"sn04", en:"One more? Yes? Okay!", zh:"再来一个？要吗？好的！", tip:"观察宝宝表情和手势，尊重他的饥饱信号。" },
        { id:"sn05", en:"All done! Good eating!", zh:"吃完了！吃得真好！", tip:"及时表扬完成进食，强化正向行为。" },
      ],
      "1-2": [
        { id:"sn11", en:"Snack time! What do we have today?", zh:"零食时间！今天吃什么？", tip:"用问句引发期待，宝宝会开始期待零食时间。" },
        { id:"sn12", en:"Apple! Red apple. Crunch crunch!", zh:"苹果！红色的苹果。嘎吱嘎吱！", tip:"命名食物颜色和声音，让进食变成多感官学习。" },
        { id:"sn13", en:"Can you say cracker? Crac-ker!", zh:"你能说饼干吗？饼-干！", tip:"拆分音节鼓励发音，宝宝喜欢模仿分节词。" },
        { id:"sn14", en:"Big bite! Little bite. Now big again!", zh:"大口！小口。再大口！", tip:"口令游戏让进食更有趣，宝宝配合度更高。" },
        { id:"sn15", en:"Yummy in your tummy! Pat pat pat.", zh:"美味进肚子！拍拍拍。", tip:"边拍肚子边说，帮宝宝理解食物和身体的关系。" },
      ],
      "2-3": [
        { id:"sn21", en:"What would you like for your snack — fruit or crackers?", zh:"零食想吃什么——水果还是饼干？", tip:"给两个选项让宝宝练习表达偏好和做决定。" },
        { id:"sn22", en:"Let's wash your hands first, then snack!", zh:"先洗手，再吃零食！", tip:"建立卫生习惯与零食的固定顺序，形成仪式感。" },
        { id:"sn23", en:"What color is your apple? Red! Can you say red?", zh:"你的苹果是什么颜色？红色！你能说红色吗？", tip:"零食时间学颜色，情境让词汇更容易记忆。" },
        { id:"sn24", en:"Is it sweet or sour? Tell me!", zh:"是甜的还是酸的？告诉我！", tip:"描述味道引导宝宝表达感受，丰富味觉词汇。" },
        { id:"sn25", en:"Save one for me! Can you share?", zh:"留一个给我！能分享吗？", tip:"自然地练习分享，零食场景轻松无压力。" },
      ],
      "3-6": [
        { id:"sn31", en:"Choose your snack. What looks good to you?", zh:"选你的零食。你觉得什么好吃？", tip:"让孩子自主选择，培养判断力和自信。" },
        { id:"sn32", en:"Fruit gives you energy to play! Let's try some.", zh:"水果给你玩耍的能量！来尝尝。", tip:"用孩子关心的结果解释健康饮食，比「要吃健康食品」更有说服力。" },
        { id:"sn33", en:"How many grapes can you count? Let's see!", zh:"你能数几颗葡萄？来看看！", tip:"数数与吃东西结合，让数学学习更有趣。" },
        { id:"sn34", en:"Snack time is almost over. Two more bites!", zh:"零食时间快结束了。再吃两口！", tip:"提前预告和具体数字，让孩子有心理准备。" },
        { id:"sn35", en:"Did you enjoy your snack? What was your favorite part?", zh:"零食好吃吗？你最喜欢哪个？", tip:"引导孩子反思和表达，培养语言组织能力。" },
      ],
    }
  },

  outdoor: {
    icon: "🌳", name: "户外玩耍", color: "var(--green)",
    phrases: {
      "0-1": [
        { id:"od01", en:"Outside! Feel the breeze!", zh:"外面！感受微风！", tip:"让宝宝感受自然，用语言描述触觉体验。" },
        { id:"od02", en:"Look at the sky! Blue sky!", zh:"看天空！蓝色的天空！", tip:"指向天空，帮宝宝学习颜色和方向词。" },
        { id:"od03", en:"Grass! Green grass. Touch it.", zh:"草！绿色的草。摸摸看。", tip:"鼓励触摸，安全的感官探索对发育很重要。" },
        { id:"od04", en:"Birdie! Tweet tweet tweet!", zh:"小鸟！啾啾啾！", tip:"模仿动物声音，宝宝最容易记住有声音的词汇。" },
        { id:"od05", en:"Sun is warm! Nice and sunny.", zh:"太阳好温暖！阳光真好。", tip:"描述温度感受，帮宝宝建立天气词汇。" },
      ],
      "1-2": [
        { id:"od11", en:"Let's go outside! Get your shoes!", zh:"我们出去玩！去拿你的鞋子！", tip:"让宝宝参与出门准备，培养自主意识。" },
        { id:"od12", en:"Run run run! Fast fast fast!", zh:"跑跑跑！快快快！", tip:"节奏词汇配合跑步动作，宝宝边动边学。" },
        { id:"od13", en:"What do you see? A dog! A big dog!", zh:"你看到什么？一只狗！一只大狗！", tip:"引导宝宝注意周围，用命名游戏扩充词汇。" },
        { id:"od14", en:"Leaves! Pick up the leaf. Yellow leaf!", zh:"叶子！捡起叶子。黄色的叶子！", tip:"捡叶子学颜色，户外是天然的学习课堂。" },
        { id:"od15", en:"Puddle! Jump over! Splash!", zh:"水坑！跳过去！溅起来！", tip:"安全范围内的水坑游戏让宝宝充满乐趣。" },
      ],
      "2-3": [
        { id:"od21", en:"What can you hear outside? Listen carefully!", zh:"户外能听到什么声音？仔细听！", tip:"专注倾听训练，培养注意力和语言描述能力。" },
        { id:"od22", en:"Let's collect some rocks. Which one do you like best?", zh:"我们来收集石头。你最喜欢哪一块？", tip:"收集活动满足2-3岁宝宝的探索欲和分类兴趣。" },
        { id:"od23", en:"Can you find something red? Look around!", zh:"你能找到红色的东西吗？四处看看！", tip:"颜色寻宝游戏结合观察力，户外最适合。" },
        { id:"od24", en:"How does the dirt feel? Soft or hard?", zh:"泥土摸起来怎么样？软的还是硬的？", tip:"描述质感词汇在户外探索中最自然地习得。" },
        { id:"od25", en:"Time to go home soon. Five more minutes of playing!", zh:"快要回家了。再玩五分钟！", tip:"提前预告减少突然离开的抵触，具体时间让宝宝有预期。" },
      ],
      "3-6": [
        { id:"od31", en:"What do you want to play at the park today?", zh:"今天在公园想玩什么？", tip:"让孩子主导活动选择，培养自主性和计划能力。" },
        { id:"od32", en:"Let's look for bugs! I wonder what we'll find.", zh:"我们来找虫虫！不知道会找到什么。", tip:"激发好奇心，用「我想知道」语言鼓励探究精神。" },
        { id:"od33", en:"How many steps to the big tree? Let's count!", zh:"走到大树需要多少步？我们数数！", tip:"计步游戏结合数学和运动，趣味无穷。" },
        { id:"od34", en:"Watch out for other kids! Take turns on the slide.", zh:"注意其他小朋友！溜滑梯要轮流。", tip:"公共空间礼仪在真实场景中学习效果最好。" },
        { id:"od35", en:"What was your favorite thing about the park today?", zh:"今天公园里你最喜欢的是什么？", tip:"引导孩子反思和语言表达，将体验转化为记忆。" },
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
