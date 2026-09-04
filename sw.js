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
const CACHE = 'll-e0267d16';
const SHELL = [
  './',
  './index.html',
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
