// 「这条句子的声音地址从哪儿来」的唯一主人（ADR 0009 第十一块；原 ll:audio-playback 块）。
// 预设句子 → 随应用下发的 mp3 文件；家长自己存的 → 本机 IndexedDB 里那一份，
// 在卡片**渲染时**就变成可播地址，点击那一刻才是同步的（iOS 的限制，见下面原注释）。
//
// 三个依赖从 create(deps) 传进来，不抓全局：
//   getAudio(id)      → 从本机存储取那段音频（audio-store.js）
//   isAudioBacked(item)→ 这条是不是有随应用下发的 mp3（item-kind.js）
//   URL               → 造/回收临时地址（浏览器的 URL 对象；测试里换成假的好数数）
// 纯的：不碰 document / window / indexedDB。普通脚本 + CommonJS 出口。
(function (root) {
  "use strict";

  function create(deps) {
    deps = deps || {};
    var getAudio = deps.getAudio;
    var isAudioBacked = typeof deps.isAudioBacked === "function" ? deps.isAudioBacked : function () { return false; };
    var URL = deps.URL;

    // Handing a stored clip to the player. Depends on ll:audio-store below.
    //
    // The reason this is a module and not two lines inside playReviewAudio():
    // reading from IndexedDB is asynchronous, and on iOS an audio element that
    // starts playing after an await may no longer count as "started by that tap" —
    // Safari can refuse it silently. Paying for these clips only to have them
    // refused is the one outcome worth designing around. So the Blob becomes a
    // playable address when the card RENDERS, and the tap stays synchronous,
    // exactly as it already is for the 1204 preset phrases.
    //
    // ⚠️ UNVERIFIED: that iOS rule is the premise of this design and it has not
    // been tested on a device. If someone later wants to simplify this into "read
    // it when tapped", that has to be checked on a real iPhone first — a green
    // test suite here says nothing about it.
    //
    // Each address holds its clip in memory until released. The review card shows
    // one phrase at a time and releases the previous one, so at most a couple are
    // alive; without releasing, an afternoon of reviewing would leave dozens of
    // copies of the same audio held open.
    const audioUrlCache = new Map();
    const audioUrlPending = new Map();

    // Each live address pins its clip in memory (~52KB). The saved list primes
    // every row, so without a ceiling a large library would hold all of it open at
    // once. Eviction is oldest-first; the Map keeps insertion order.
    const AUDIO_URL_CAP = 120;
    // 上限可以由外面按需给（index.html 传「收藏条数 + 20」）：一个 200 条都有声音的收藏，
    // 死的 120 会把 80 行的地址挤掉——那些行标着 🔊 却放机器音。不传就还是 120。
    const urlCap = typeof deps.urlCap === "function" ? deps.urlCap : function () { return AUDIO_URL_CAP; };

    // Synchronous by design — see above. Returns null when nothing is ready, and
    // the caller falls back to speech synthesis exactly as it does today.
    function audioUrlFor(id) {
      if (!id) return null;
      return audioUrlCache.get(id) || null;
    }

    // Called at render time, never at tap time.
    async function primeAudioUrl(id) {
      if (!id) return null;
      const cached = audioUrlCache.get(id);
      if (cached) return cached;
      // A card re-rendering while its first prime is still in flight must join it
      // rather than start a second read and hold a second copy.
      const inFlight = audioUrlPending.get(id);
      if (inFlight) return inFlight;

      const job = (async () => {
        try {
          const blob = await getAudio(id);
          if (!blob) return null;
          const url = URL.createObjectURL(blob);
          audioUrlCache.set(id, url);
          while (audioUrlCache.size > urlCap()) {
            const oldest = audioUrlCache.keys().next().value;
            if (oldest === id) break;               // never evict the one just made
            try { URL.revokeObjectURL(audioUrlCache.get(oldest)); } catch {}
            audioUrlCache.delete(oldest);
          }
          return url;
        } catch {
          // No store, no clip, a read that failed — all the same to the caller:
          // this phrase has no recorded voice, and speech synthesis takes over.
          return null;
        } finally {
          audioUrlPending.delete(id);
        }
      })();
      audioUrlPending.set(id, job);
      return job;
    }

    // Where THIS item's recording comes from, whatever its origin. Two sources
    // exist and nothing outside this function should have to know which is which:
    // preset phrases ship with the app as ./audio/<id>_normal.mp3, while saved
    // translations and dictionary words are voiced one at a time and kept on the
    // device (ADR 0003).
    //
    // It lives here because the loop got this wrong by rewriting it: it filtered
    // on audioUrlFor() alone, so a library made entirely of preset phrases was
    // judged to have nothing playable at all. One implementation, so the two
    // playback paths cannot drift apart again.
    //
    // Synchronous, like audioUrlFor() and for the same iOS reason.
    function playableUrlFor(item) {
      if (!item || !item.id) return null;
      if (isAudioBacked(item)) {
        return `./audio/${item.id}_normal.mp3`;
      }
      return audioUrlFor(item.id);
    }

    function releaseAudioUrls() {
      for (const url of audioUrlCache.values()) {
        try { URL.revokeObjectURL(url); } catch {}
      }
      audioUrlCache.clear();
    }

    return { audioUrlFor: audioUrlFor, primeAudioUrl: primeAudioUrl, playableUrlFor: playableUrlFor, releaseAudioUrls: releaseAudioUrls };
  }

  var api = { create: create };
  if (typeof module !== "undefined" && module.exports) module.exports = api;   // Node（测试）
  else root.llPlaybackLib = api;                                               // 浏览器
})(typeof globalThis !== "undefined" ? globalThis : this);
