/**
 * Arrow Out! Service Worker
 * Version: v8
 * Handles caching for offline gameplay
 */

const CACHE = 'arrow-out-v8';
const ASSETS = [
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
  './js/main.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
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
      icon: data.icon || './icon.png',
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
