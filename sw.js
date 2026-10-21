/**
 * Arrow Out! Service Worker
 * Version: v42
 * Audit fixes: notification privacy, saved settings and interrupted game restoration.
 * Handles caching for offline gameplay
 */

const CACHE = 'arrow-out-v42';
// Only obsolete caches that belong to THIS game (arrow-out-*) are ever deleted,
// so other apps served from the same origin keep their caches.
const CACHE_PREFIX = 'arrow-out-';
const CORE_ASSETS = [
  './',
  './index.html',
  './about.html',
  './privacy.html',
  './contact.html',
  './css/styles.css',
  './js/game.js',
  './js/render.js',
  './js/audio.js',
  './js/haptics.js',
  './js/bgfx.js',
  './js/storage.js',
  './js/pwa.js',
  './js/map.js',
  './js/story.js',
  './js/reminders.js',
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

// Precache with cache:'reload' so the HTTP cache can never leak OLD bytes
// into a fresh versioned cache. Static hosts (e.g. GitHub Pages) serve
// assets with max-age=600: without this, a browser that loaded the
// previous version less than ~10 minutes before an update check would
// "precache" the OLD assets into the NEW cache, and the player would
// stay on stale files until the next release (fetch is cache-first).
function precacheFresh(cache, url) {
  return fetch(new Request(url, { cache: 'reload' })).then((resp) => {
    if (!resp.ok || resp.redirected) throw new Error('precache failed: ' + url + ' (' + resp.status + ')');
    return cache.put(url, resp);
  });
}

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.all(CORE_ASSETS.map((a) => precacheFresh(c, a))).then(() =>
        Promise.all(EXTRA_ASSETS.map((a) => c.add(a).catch(() => null)))
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => 
      Promise.all(
        keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// The page can ask a waiting worker to take over immediately
// (used by the in-game update banner flow).
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  // Let cross-origin requests pass through untouched
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  const scope = new URL(self.registration.scope);
  if (!url.pathname.startsWith(scope.pathname)) return;
  const known = CORE_ASSETS.concat(EXTRA_ASSETS).some((asset) =>
    new URL(asset, scope).pathname === url.pathname);
  const navigation = e.request.mode === 'navigate';
  // Cache only the finite app shell. Arbitrary URLs and query variants
  // must not fill storage; asset failures must never return HTML as JS.
  e.respondWith(caches.open(CACHE).catch(() => null).then(async (cache) => {
    const key = new URL(url.pathname, url.origin).href;
    const hit = known && cache ? await cache.match(key).catch(() => null) : null;
    if (hit) return hit;
    try {
      const resp = await fetch(e.request);
      if (known && cache && resp.ok && !resp.redirected) {
        e.waitUntil(cache.put(key, resp.clone()).catch(() => {}));
      }
      return resp;
    } catch (err) {
      if (navigation && cache) {
        const home = await cache.match(new URL('./index.html', scope).href).catch(() => null);
        if (home) return home;
      }
      return Response.error();
    }
  }));
});

// Local reminder clicks are untrusted; only app-scope destinations are allowed.
// Resolve a notification click target. Only same-origin URLs inside the
// app scope are allowed. javascript:, data:, external origins, malformed
// and scope-escaping URLs are all rejected (null).
function safeNotifUrl(v) {
  if (typeof v !== 'string' || !v.length || v.length > 200) return null;
  if (/[\u0000-\u001f]/.test(v)) return null;
  try {
    const scope = new URL(self.registration.scope);
    const u = new URL(v, scope);
    if (u.origin !== scope.origin) return null;
    if (u.pathname !== scope.pathname && !u.pathname.startsWith(scope.pathname)) return null;
    return u.href;
  } catch (e) {
    return null;
  }
}

// Handle notification clicks
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const raw = (e.notification && e.notification.data) || null;
  // Validate the click destination; fall back to the app scope itself
  // (the game home screen) when the URL is missing or unsafe.
  const target = (raw && typeof raw === 'object' && !Array.isArray(raw))
    ? safeNotifUrl(raw.url)
    : null;
  const dest = target || self.registration.scope;

  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      // Focus an already-open window at the destination instead of piling
      // up new ones.
      for (const w of wins) {
        const u = new URL(w.url), scope = new URL(self.registration.scope);
        const gameWindow = u.origin === scope.origin &&
          (u.pathname === scope.pathname || u.pathname === scope.pathname + 'index.html');
        if ((w.url === dest || gameWindow && dest === self.registration.scope) && typeof w.focus === 'function') return w.focus();
      }
      return self.clients.openWindow(dest).catch(() => null);
    }).catch(() => null)
  );
});
