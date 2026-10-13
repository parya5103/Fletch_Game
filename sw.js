/**
 * Arrow Out! Service Worker
 * Version: v7
 * Handles caching for offline gameplay
 */

const CACHE = 'arrow-out-v7';
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
  
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => 
      hit || fetch(e.request).then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
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
