/**
 * Arrow Out! Service Worker
 * Version: v10
 * Handles caching for offline gameplay
 */

const CACHE = 'arrow-out-v10';
const CORE_ASSETS = [
  './',
  './index.html',
  './sw.js',
  './css/styles.css',
  './js/game.js',
  './js/render.js',
  './js/audio.js',
  './js/haptics.js',
  './js/storage.js',
  './js/pwa.js',
  './js/ui.js',
  './js/main.js',
  './manifest.webmanifest',
  './icons/favicon.svg'
];

// Real PNG icons are committed by the icon-generation workflow.
// Cache them opportunistically, but never fail installation if they
// are not on the server yet (the workflow may run after this deploy).
const EXTRA_ASSETS = [
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      c.addAll(CORE_ASSETS).then(() =>
        Promise.all(EXTRA_ASSETS.map((a) => c.add(a).catch(() => null)))
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => 
      Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  // Let cross-origin requests pass through untouched
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => 
      hit || fetch(e.request).then((resp) => {
        // Only cache successful responses; never cache errors or redirects
        if (resp && resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return resp;
      }).catch(() => caches.match('./index.html'))
    )
  );
});

// Handle push notifications (for future use)
self.addEventListener('push', (e) => {
  if (e.data) {
    const data = e.data.json();
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || './icons/icon-192.png',
      data: data.data
    });
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  if (e.notification.data && e.notification.data.url) {
    clients.openWindow(e.notification.data.url);
  }
});
