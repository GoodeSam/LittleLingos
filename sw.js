const CACHE = 'll-v4';
const SHELL = [
  './',
  './index.html',
  './scenarios.js',
  './manifest.json',
  './icon.svg',
  './icon-maskable.svg',
];

// HTML and data files that must always be fresh
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
