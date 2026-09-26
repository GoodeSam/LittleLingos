// INVARIANT (checked by the critique gate): CACHE below is mechanically
// derived — never hand-edit it. Run `node scripts/stamp-sw.mjs` after any
// change to a precached file (index.html, scenarios.js, manifest.json, the
// icons/ shell assets, or any mp3 under audio/) to rewrite this line to
// `ll-<sha256-8>` of those files' CONTENTS — every SHELL entry and every
// audio byte participates, so changing any shipped asset always produces a
// new cache name. Run `node scripts/stamp-sw.mjs --check` (exit 1 on
// mismatch) to verify it is still fresh before deploy. CACHE is the only
// cache-busting signal for the install/activate handlers (old ll-* caches
// are deleted on activate, which is also what evicts stale cached audio
// served by the cache-first branch below); without a fresh hash, an
// already-installed offline client can keep serving a stale shell, stale
// phrase data, or a stale audio recording indefinitely even though
// NETWORK_FIRST tries to refresh the shell/data opportunistically on every
// online GET.
const CACHE = 'll-71d5698f';
const SHELL = [
  './',
  './index.html',
  './icons.js',
  './audio-controller.mjs',
  './storage.js',
  './scenarios.js',
  './dictionary-words.js',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

// HTML and data files that must always be fresh. Confirmed both index.html and
// scenarios.js are covered here (plus '/' and any navigate request below), so
// the network-first path does reach both the shell and the phrase data.
// dictionary-words.js joins them for the same reason scenarios.js is here,
// not because it's static shell chrome: it's curated content maintained by
// maya-curriculum-designer (currently mid-edit on entry wording/senses per
// Unit B increment A's handoff), so a parent who already installed the app
// should see corrected/expanded entries on next online load without waiting
// for a new SW version to activate — cache-first would only pick up the
// change on a LATER visit (the stale-while-revalidate write happens in the
// background of the request that misses). It is still a SHELL entry above
// too, so stamp-sw.mjs's content hash still forces a fresh install for an
// offline client that never gets a network-first hit.
const NETWORK_FIRST = ['/', '/index.html', '/scenarios.js', '/dictionary-words.js'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      // Delete only this app's own old caches (ll-*): other caches on the
      // same origin belong to other pages/workers and are not ours to clear.
      Promise.all(keys.filter(k => k !== CACHE && k.startsWith('ll-')).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Single write policy for both strategies. Guards, in order:
//  - only full 200 bodies (Cache Storage rejects 206 Partial Content, which
//    audio Range requests produce — an uncaught put would also leave the
//    file never cached for offline)
//  - no Range requests (a partial-body request must not poison the
//    full-body cache entry)
//  - no query-string variants (each unique ?query would grow the cache
//    without bound; every asset this app serves is query-less)
// The write itself is attached to the event via waitUntil so the worker
// isn't torn down mid-put, and failures (quota, private mode) are swallowed:
// caching is an optimization, never a reason to fail the response.
function cacheResponse(e, res) {
  if (res.status !== 200) return;
  if (e.request.headers.has('range')) return;
  if (new URL(e.request.url).search) return;
  const clone = res.clone();
  e.waitUntil(caches.open(CACHE).then(c => c.put(e.request, clone)).catch(() => {}));
}

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  const isNetworkFirst = e.request.mode === 'navigate' ||
    NETWORK_FIRST.includes(url.pathname);

  if (isNetworkFirst) {
    // Network-first: always fetch fresh HTML/data, fall back to cache offline
    e.respondWith(
      fetch(e.request).then(res => {
        cacheResponse(e, res);
        return res;
      }).catch(() => caches.match(e.request).then(c => c || caches.match('./index.html')))
    );
  } else {
    // Cache-first: audio, icons, other static assets
    e.respondWith(
      caches.match(e.request).then(cached => {
        const network = fetch(e.request).then(res => {
          cacheResponse(e, res);
          return res;
        }).catch(() => Response.error());
        return cached || network;
      })
    );
  }
});

// ── 到点提醒的推送（ADR 0008）──────────────────────────────────────────
// 推送是空的，通知写什么、点开去哪由这里决定。页面开启提醒时把目标（复习 / 连播）
// 写进 push-spike 这个缓存（名字是试验期起的，沿用下来）；不以 ll- 开头，所以
// activate 清旧缓存时不会碰它。目标只认两个值，其余一律当复习——点开的地址不能由外面决定。
const PUSH_TARGET_CACHE = 'push-spike';
const PUSH_TARGET_KEY = './__push-target';
const PUSH_URLS = { review: './?to=review', loop: './?to=loop' };
const pushTo = (t) => (Object.prototype.hasOwnProperty.call(PUSH_URLS, t) ? t : 'review');

function readPushTarget() {
  return caches.open(PUSH_TARGET_CACHE)
    .then(c => c.match(PUSH_TARGET_KEY))
    .then(r => (r ? r.text() : ''))
    .then(pushTo)
    .catch(() => 'review');
}

// 开启到点提醒时，服务器马上推一条确认通知。它和到点的提醒是同一种空推送，
// 分不出来，所以页面在开启前先留一个记号。读到就换一句话，并且擦掉，只管这一次。
const PUSH_CONFIRM_KEY = './__push-confirm';

function takeConfirmMark() {
  return caches.open(PUSH_TARGET_CACHE)
    .then(c => c.match(PUSH_CONFIRM_KEY).then(r => (r ? c.delete(PUSH_CONFIRM_KEY).then(() => true) : false)))
    .catch(() => false);
}

// iOS：收到推送却不弹出可见通知，订阅会被吊销。所以无论目标读没读到都要弹，
// 并且整段包在 waitUntil 里，弹完之前不许后台被停掉。
self.addEventListener('push', e => {
  e.waitUntil(Promise.all([readPushTarget(), takeConfirmMark()]).then(([to, confirm]) =>
    self.registration.showNotification('LittleLingos', {
      body: confirm ? '到点提醒已开启。到时候就会像这样来一条'
        : to === 'loop' ? '到点了，点开就连续播放' : '到点了，点开复习几句',
      tag: 'll-reminder',
      data: { to },
    })
  ));
});

// App 还开在后台就把它叫回前台、告诉它去哪；没开才新开一个。
// includeUncontrolled：刚更新过、还没被新 Service Worker 接管的窗口也算开着。
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const to = pushTo(e.notification.data && e.notification.data.to);
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const win = list[0];
      if (win) {
        win.postMessage({ type: 'll-push-open', to });
        return win.focus();
      }
      return self.clients.openWindow(PUSH_URLS[to]);
    })
  );
});
