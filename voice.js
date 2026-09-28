// 音色（ADR 0009 第十七块；原 ll:voice 块）。家长挑哪一把嗓子念给孩子听。
//
// 一个依赖从 create(deps) 传进来：storage（storage.js 的实例）。
// 纯的：不碰 document / window / 网络。普通脚本 + CommonJS 出口。
// 名单和中文提示那把嗓子必须和服务端一致，test/voice-choice 与 voice-consistency 守着。
(function (root) {
  "use strict";

  function create(deps) {
    var storage = (deps && deps.storage) || { readString: function () { return null; }, write: function () { return false; } };

    // 家长挑哪一把嗓子念给孩子听。这一段刻意只碰 localStorage，不碰 DOM，
    // 好让 test/voice-choice.test.mjs 在一个空的沙箱里跑它。
    //
    // 名单必须和 netlify/functions/tts.mjs 的 ALLOWED_VOICES 一致——那边挡下
    // 名单外的音色，这边列出名单内的，测试比对两份，对不上就红。
    // 分组是按 Azure 的代次分的，越靠上越接近真人。这不是我们的主观排序：
    // Dragon HD 是最新一代，Multilingual 次之，原版是 2019 年那一批。
    // 名单里每一个都在 2026-09-10 用本项目这套 SSML 真打过一次 Azure eastus，
    // 都回了可播的 mp3。
    var VOICE_OPTIONS = [
      { id: "en-US-JennyNeural", label: "Jenny · 原版", desc: "温暖女声 · 场景里的预设句子用的就是这把", group: "默认" },

      { id: "en-US-Jenny:DragonHDLatestNeural",   label: "Jenny · 新版", desc: "同一把嗓子的最新一代",   group: "最新一代 · 最接近真人" },
      { id: "en-US-Ava:DragonHDLatestNeural",     label: "Ava",     desc: "女声 · 从容",       group: "最新一代 · 最接近真人" },
      { id: "en-US-Emma:DragonHDLatestNeural",    label: "Emma",    desc: "女声 · 轻快",       group: "最新一代 · 最接近真人" },
      { id: "en-US-Andrew:DragonHDLatestNeural",  label: "Andrew",  desc: "男声 · 从容",       group: "最新一代 · 最接近真人" },
      { id: "en-US-Brian:DragonHDLatestNeural",   label: "Brian",   desc: "男声 · 温和",       group: "最新一代 · 最接近真人" },
      { id: "en-US-Steffan:DragonHDLatestNeural", label: "Steffan", desc: "男声 · 沉稳",       group: "最新一代 · 最接近真人" },

      { id: "en-US-ChristopherMultilingualNeural", label: "Christopher · 新版", desc: "男声 · 沉稳清晰", group: "新一代" },
      { id: "en-US-SerenaMultilingualNeural",      label: "Serena",      desc: "女声 · 柔和",     group: "新一代" },
      { id: "en-US-DavisMultilingualNeural",       label: "Davis",       desc: "男声 · 平实",     group: "新一代" },

      { id: "en-US-ChristopherNeural", label: "Christopher · 原版", desc: "男声 · 2019 年那一代，和上面的新版是同一把嗓子", group: "原版" },
    ];
    var DEFAULT_VOICE_ID = VOICE_OPTIONS[0].id;
    // 连播里每句英文之前先念一遍中文，让家长自己先想一次。这句中文原来是手机
    // 自带的语音合成念的——国产浏览器和微信里音质很差，有的干脆没有中文嗓子。
    // 现在也走 Azure。它是固定的，不进音色选择器：那是给英文句子挑嗓子的地方。
    // 必须和 netlify/functions/tts.mjs 的 CUE_VOICE 一字不差，测试守着这一条。
    var CUE_VOICE_ID = "zh-CN-XiaoxiaoMultilingualNeural";
    var VOICE_KEY = "ll_voice";

    // 手机里存着一个已经下架的音色时，退回默认——而不是从此每句话都生成失败。
    function getVoice() {
      const v = storage.readString(VOICE_KEY, null);
      return VOICE_OPTIONS.some(o => o.id === v) ? v : DEFAULT_VOICE_ID;
    }
    function setVoice(id) {
      if (!VOICE_OPTIONS.some(o => o.id === id)) return false;
      storage.write(VOICE_KEY, id);     // 存不进去也算选了（这一会话有效），和原来一致
      return true;
    }

    return {
      VOICE_OPTIONS: VOICE_OPTIONS,
      DEFAULT_VOICE_ID: DEFAULT_VOICE_ID,
      CUE_VOICE_ID: CUE_VOICE_ID,
      VOICE_KEY: VOICE_KEY,
      getVoice: getVoice,
      setVoice: setVoice,
    };
  }

  var api = { create: create };
  if (typeof module !== "undefined" && module.exports) module.exports = api;   // Node（测试）
  else root.llVoiceLib = api;                                                  // 浏览器
})(typeof globalThis !== "undefined" ? globalThis : this);
