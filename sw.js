const CACHE = 'daily-habits-v4';
const ASSETS = ['./', './index.html', './styles.css', './app.js', './news.js', './words.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  // cache: 'reload' skips the browser's HTTP cache so a new version never stores stale files.
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Network first so updates show up immediately; fall back to the cached copy when offline.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(cache =>
    fetch(e.request, { cache: 'no-cache' })
      .then(res => { if (res.ok) cache.put(e.request, res.clone()); return res; })
      .catch(() => cache.match(e.request, { ignoreSearch: true }))));
});
