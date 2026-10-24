// Service worker: keeps the app shell on the phone so Coach opens offline.
// Bump VERSION whenever app files change so phones pick up the new shell.

const VERSION = 'coach-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/storage.js',
  './js/github.js',
  './js/sync.js',
  './js/progression.js',
  './js/csv.js',
  './js/library.js',
  './js/templates.js',
  './js/session.js',
  './js/ui/dom.js',
  './js/ui/badge.js',
  './js/ui/today.js',
  './js/ui/workout.js',
  './js/ui/summary.js',
  './js/ui/history.js',
  './js/ui/split.js',
  './js/ui/settings.js',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;

  // GitHub API: always live, never cached here (the app keeps its own copy).
  if (url.hostname === 'api.github.com') return;

  // App shell and fonts: serve from cache right away, refresh in the background.
  const sameOrigin = url.origin === self.location.origin;
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!sameOrigin && !isFont) return;

  event.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const cached = await cache.match(event.request, { ignoreSearch: sameOrigin });
      const network = fetch(event.request)
        .then((res) => {
          if (res && (res.ok || res.type === 'opaque')) cache.put(event.request, res.clone());
          return res;
        })
        .catch(() => null);
      if (cached) {
        event.waitUntil(network);
        return cached;
      }
      const res = await network;
      if (res) return res;
      // Offline and not cached: fall back to the app page for navigations.
      if (event.request.mode === 'navigate') return cache.match('./index.html');
      return new Response('', { status: 504 });
    }),
  );
});
