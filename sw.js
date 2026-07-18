// INVARIANT (checked by the critique gate): CACHE below is mechanically
// derived — never hand-edit it. Run `node scripts/stamp-sw.mjs` after any
// change to index.html or scenarios.js to rewrite this line to
// `ll-<sha256-8 of index.html+scenarios.js>`; run
// `node scripts/stamp-sw.mjs --check` (exit 1 on mismatch) to verify it is
// still fresh before deploy. CACHE is the only cache-busting signal for the
// install/activate handlers (old caches are deleted on activate); without a
// fresh hash, an already-installed offline client can keep serving a stale
// shell or stale phrase data indefinitely even though NETWORK_FIRST tries to
// refresh them opportunistically on every online GET.
const CACHE = 'll-9dfb7b12';
const SHELL = [
  './',
  './index.html',
  './scenarios.js',
  './manifest.json',
  './icon.svg',
  './icon-maskable.svg',
];

// HTML and data files that must always be fresh. Confirmed both index.html and
// scenarios.js are covered here (plus '/' and any navigate request below), so
// the network-first path does reach both the shell and the phrase data.
const NETWORK_FIRST = ['/', '/index.html', '/scenarios.js'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

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
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match(e.request).then(c => c || caches.match('./index.html')))
    );
  } else {
    // Cache-first: icons, fonts, other static assets
    e.respondWith(
      caches.match(e.request).then(cached => {
        const network = fetch(e.request).then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        }).catch(() => Response.error());
        return cached || network;
      })
    );
  }
});
