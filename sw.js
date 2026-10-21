/**
 * Arrow Out! — Service Worker (v40)
 * Bumped from arrow-out-v39 -> arrow-out-v40 to precache js/map.js and map redesign styles.
 */
const CACHE_NAME = 'arrow-out-v40';
const CORE_ASSETS = [
  './',
  './index.html',
  './about.html',
  './privacy.html',
  './contact.html',
  './manifest.webmanifest',
  './css/styles.css',
  './js/storage.js',
  './js/audio.js',
  './js/haptics.js',
  './js/bgfx.js',
  './js/game.js',
  './js/render.js',
  './js/map.js',
  './js/ui.js',
  './js/pwa.js',
  './js/reminders.js',
  './js/main.js',
  './js/tests.js',
  './icons/favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('arrow-out-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((networkResp) => {
          if (networkResp && networkResp.status === 200 && networkResp.type === 'basic') {
            const copy = networkResp.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return networkResp;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
