/**
 * Arrow Out! - PWA Module
 * Handles Progressive Web App functionality
 */
'use strict';

const PWA = (function() {
  var deferredPrompt = null;
  var swActive = false;
  var manifestBuilt = false;

  // Copy the deployed worker, never an outdated second implementation.
  function getServiceWorkerSource() {
    return fetch('sw.js', { cache: 'no-store' }).then(function(response) {
      if (!response.ok) throw new Error('Service worker unavailable');
      return response.text();
    }).then(function(text) {
      if (!text.trim() || text.indexOf("addEventListener('fetch'") === -1) return null;
      return text;
    }).catch(function() { return null; });
  }

  function isStandalone() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
           window.navigator.standalone === true;
  }

  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function iconDataURL(size, bgColor, arrowColor) {
    var c = document.createElement('canvas');
    c.width = size; c.height = size;
    var g = c.getContext('2d');
    
    // Background
    g.fillStyle = bgColor || '#4c6ef5';
    if (g.roundRect) { 
      g.beginPath(); 
      g.roundRect(0, 0, size, size, size * 0.22); 
    } else {
      g.beginPath(); 
      g.moveTo(size * 0.22, 0);
      g.arcTo(size, 0, size, size, size * 0.22);
      g.arcTo(size, size, 0, 0, size * 0.22); 
      g.arcTo(0, size, 0, 0, size * 0.22);
      g.arcTo(0, 0, size, 0, size * 0.22); 
      g.closePath();
    }
    g.fill();
    
    // Arrow
    g.save();
    g.translate(size / 2, size / 2);
    var a = size * 0.3;
    g.beginPath();
    g.moveTo(0, -1.05 * a);
    g.lineTo(0.72 * a, -0.05 * a);
    g.lineTo(0.26 * a, -0.05 * a);
    g.lineTo(0.26 * a, 0.95 * a);
    g.lineTo(-0.26 * a, 0.95 * a);
    g.lineTo(-0.26 * a, -0.05 * a);
    g.lineTo(-0.72 * a, -0.05 * a);
    g.closePath();
    g.fillStyle = arrowColor || '#ffffff';
    g.fill();
    g.restore();
    
    return c.toDataURL('image/png');
  }

  function buildManifest() {
    if (manifestBuilt) return;
    manifestBuilt = true;
    
    try {
      var i192 = iconDataURL(192, '#0d1230', '#748ffc');
      var i512 = iconDataURL(512, '#0d1230', '#748ffc');
      var base = location.href.indexOf('#') > -1 ? location.href.slice(0, location.href.indexOf('#')) : location.href;
      
      var man = {
        name: 'Arrow Out!',
        short_name: 'Arrow Out!',
        description: 'Tap arrows away and clear the board. A premium tap-away logic puzzle.',
        start_url: base,
        scope: base.slice(0, base.lastIndexOf('/') + 1) || './',
        display: 'standalone',
        orientation: 'any',
        background_color: '#0d1230',
        theme_color: '#748ffc',
        icons: [
          { src: i192, sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: i512, sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: i512, sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      };
      
      // A real, same-origin manifest file is required for Chrome installability.
      // Fall back to the runtime data: URL only if no real manifest is linked.
      var link = document.querySelector('link[rel="manifest"]');
      if (!link || !/^https?:/i.test(link.href)) {
        if (!link) {
          link = document.createElement('link');
          link.rel = 'manifest';
          document.head.appendChild(link);
        }
        link.href = 'data:application/manifest+json;charset=utf-8,' + encodeURIComponent(JSON.stringify(man));
      }
      
      var apple = document.querySelector('link[rel="apple-touch-icon"]');
      if (!apple) { 
        apple = document.createElement('link'); 
        apple.rel = 'apple-touch-icon';
        document.head.appendChild(apple); 
      }
      apple.href = i192;
      
      // Add meta tags for theme color
      var themeMeta = document.querySelector('meta[name="theme-color"]');
      if (!themeMeta) {
        themeMeta = document.createElement('meta');
        themeMeta.name = 'theme-color';
        document.head.appendChild(themeMeta);
      }
      themeMeta.content = '#0d1230';
      
    } catch (e) {
      console.log('Manifest build error:', e);
    }
  }

  function showInstallBanner(label, action) {
    var bb = document.getElementById('install-banner');
    if (!bb) return;
    
    var btn = document.getElementById('btn-banner-install');
    var text = document.getElementById('ib-text');
    
    if (btn) btn.textContent = label;
    if (text) {
      text.innerHTML = (label === 'Add')
        ? '\ud83d\udcf2 <b>Add Arrow Out! to your Home Screen</b> \u2014 tap Add, then \u201cAdd to Home Screen\ud83d\udc47.'
        : '\ud83d\udcf2 <b>Install Arrow Out!</b> \u2014 play full-screen, works offline.';
    }
    
    if (btn) {
      btn.onclick = function() { 
        hideBanner(); 
        action(); 
      };
    }
    
    bb.classList.add('show');
  }

  function hideBanner() {
    var bb = document.getElementById('install-banner');
    if (bb) bb.classList.remove('show');
    
    // Update save to remember banner was hidden
    var save = Storage.getSave();
    save.installHidden = true;
    Storage.updateSave(save);
  }

  function maybeIOSBanner() {
    var save = Storage.getSave();
    if (save.installHidden || isStandalone()) return;
    if (isIOS()) showInstallBanner('Add', function() { installAction(); });
  }

  function installAction() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt = null;
      return;
    }
    
    if (isIOS()) {
      // Show iOS instructions
      var dlg = document.getElementById('dlg-ios');
      if (dlg) {
        dlg.classList.add('show');
      }
      return;
    }
    
    // Show install dialog
    var dlg = document.getElementById('dlg-install');
    if (dlg) {
      var status = document.getElementById('inst-status');
      if (status) {
        status.textContent = 'The browser has not offered installation in this context. ' +
          (isStandalone()
            ? 'You are already running the installed app.'
            : 'To enable one-tap install: host this file over HTTPS, save the service worker code as sw.js next to it, then open it in Chrome on Android.');
      }
      dlg.classList.add('show');
    }
  }

  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    
    var deployable = location.protocol === 'https:' ||
      location.hostname === 'localhost' || 
      location.hostname === '127.0.0.1';
    
    if (!deployable) {
      // In non-deployable context, service worker won't work
      // but we can still try for testing
      try {
        navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(function() {
          swActive = true;
        }).catch(function() { 
          swActive = false; 
        });
      } catch(e) {
        swActive = false;
      }
      return;
    }
    
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(function(reg) {
      swActive = true;
      watchForUpdates(reg);
    }).catch(function() { 
      swActive = false; 
    });
  }

  // --- Notifications (real Web Push, backend-free) ---
  // The game is a static site, so the "push server" is a scheduled
  // GitHub Actions workflow (.github/workflows/notify.yml) that sends
  // five daily reminders at fixed IST times through the Web Push API. The VAPID
  // public key below pairs with the repo secret PUSH_VAPID_PRIVATE_KEY.
  // Each player's subscription is auto-saved to a free Supabase roster
  // table (intended restricted writes for players and service-role reads;
  // actual policies require owner verification) - no copy-paste, no per-player setup.
  //  - the permission prompt only ever fires from the deliberate
  //    Settings toggle, never on page load
  //  - subscribePush() returns the subscription JSON or null
  //  - sw.js validates every incoming push payload and click URL
  var VAPID_PUBLIC_KEY = 'BCZi4Grxq_wVF9j-pIP7buv5lwCGfSdNCrDmRaeuojmIwkCQCK1o2NdqIIqamu4nuW1Yn3doDR31W1opJzR_9H4';

  function notifSupported() {
    return typeof Notification !== 'undefined';
  }

  function pushSupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window;
  }

  function notifPermission() {
    if (!notifSupported()) return 'unsupported';
    try { return Notification.permission; } catch (e) { return 'denied'; }
  }

  function requestNotifPermission() {
    if (!notifSupported()) return Promise.resolve('unsupported');
    try {
      var p = Notification.requestPermission();
      if (p && typeof p.then === 'function') return p;
      // Legacy callback-style API (older Safari)
      return new Promise(function(resolve) {
        Notification.requestPermission(function(res) { resolve(res); });
      });
    } catch (e) {
      return Promise.resolve('denied');
    }
  }

  // base64url -> Uint8Array for the applicationServerKey option
  function urlB64ToUint8Array(b64) {
    var s = b64.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var raw = atob(s);
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  function withPushManager(fn, create) {
    if (!pushSupported()) return Promise.resolve(null);
    return navigator.serviceWorker.ready.then(function(reg) {
      return reg.pushManager.getSubscription().then(function(sub) {
        return sub || (create ? reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY)
        }) : null);
      });
    }).then(fn, function() { return null; });
  }

  // Returns the subscription JSON string, or null
  function subscribePush() {
    return withPushManager(function(sub) { return sub ? JSON.stringify(sub) : null; }, true);
  }

  // Existing subscription JSON or null (for status display only)
  function getPushSubscriptionJson() {
    return withPushManager(function(sub) { return sub ? JSON.stringify(sub) : null; });
  }

  function unsubscribePush() {
    if (!pushSupported()) return Promise.resolve(false);
    return navigator.serviceWorker.ready.then(function(reg) {
      return reg.pushManager.getSubscription();
    }).then(function(sub) {
      return sub ? sub.unsubscribe().catch(function() { return false; }) : false;
    }).catch(function() { return false; });
  }

  // --- Supabase: subscription auto-submit (backend-free push roster) ---
  // Every player who turns on Daily reminders gets their push subscription
  // saved here automatically - no copy-paste, no repo secrets per player.
  // Intended RLS restricts anonymous subscription writes and reserves roster
  // reads for the sender service key. Verify grants, duplicate-upsert and
  // deletion policies externally; this client cannot establish authorization.
  var SUPABASE_URL = 'https://usszcnaaylbsgqaehsgp.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzc3pjbmFheWxic2dxYWVoc2dwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4ODY4ODMsImV4cCI6MjEwNzQ2Mjg4M30.6LQPGdiJ8ggDgCdJdTXmxQNkBjV0fA0_vXYHehExMzc';

  function supabaseHeaders(extra) {
    var h = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    };
    if (extra) {
      for (var k in extra) {
        if (Object.prototype.hasOwnProperty.call(extra, k)) h[k] = extra[k];
      }
    }
    return h;
  }

  // Upsert this device's push subscription. Returns true on success.
  function submitPushSubscription(subJson) {
    var sub = null;
    try { sub = JSON.parse(subJson); } catch (e) { return Promise.resolve(false); }
    if (!sub || typeof sub.endpoint !== 'string' || !sub.endpoint) return Promise.resolve(false);
    // merge-duplicates: toggling reminders off/on for the same device
    // updates the existing row instead of hitting the primary key.
    return fetch(SUPABASE_URL + '/rest/v1/push_subscriptions', {
      method: 'POST',
      headers: supabaseHeaders({ 'Prefer': 'resolution=merge-duplicates' }),
      body: JSON.stringify({ endpoint: sub.endpoint, subscription: sub })
    }).then(function(resp) { return resp.ok; }, function() { return false; });
  }

  // Best-effort removal when reminders are toggled off (privacy: off =
  // the developer's send list forgets this device). Returns true on success.
  function deletePushSubscription(subJson) {
    var sub = null;
    try { sub = JSON.parse(subJson); } catch (e) { return Promise.resolve(false); }
    if (!sub || typeof sub.endpoint !== 'string' || !sub.endpoint) return Promise.resolve(false);
    return fetch(SUPABASE_URL + '/rest/v1/push_subscriptions?endpoint=eq.' + encodeURIComponent(sub.endpoint), {
      method: 'DELETE',
      headers: supabaseHeaders()
    }).then(function(resp) { return resp.ok; }, function() { return false; });
  }

  // Game version - kept in sync with sw.js CACHE version
  var VERSION = 'v35';

  // --- Update flow ---
  // The page shows a small banner when a newer service worker (a new game
  // version) has been downloaded. The player taps Refresh to load it;
  // progress lives in localStorage and is never touched by updates.
  var updateBannerShown = false;

  function showUpdateBanner() {
    if (updateBannerShown) return;
    updateBannerShown = true;
    var b = document.getElementById('update-banner');
    if (b) b.classList.add('show');
  }

  function hideUpdateBanner() {
    var b = document.getElementById('update-banner');
    if (b) b.classList.remove('show');
  }

  // Manual update check - safe to call any time
  function checkForUpdates() {
    if (!('serviceWorker' in navigator)) return Promise.resolve(false);
    return navigator.serviceWorker.getRegistration().then(function(reg) {
      if (!reg) return false;
      return reg.update().then(function() { return true; }).catch(function() { return false; });
    }).catch(function() { return false; });
  }

  function watchForUpdates(reg) {
    try {
      // A newer worker is already installed and waiting -> update is ready
      if (reg.waiting && navigator.serviceWorker.controller) {
        showUpdateBanner();
      }

      reg.addEventListener('updatefound', function() {
        var installing = reg.installing;
        if (!installing) return;
        installing.addEventListener('statechange', function() {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            // New version downloaded and ready - ask the player to refresh
            showUpdateBanner();
          }
        });
      });

      // A new worker took control while this page is open (skipWaiting).
      // Ignore the very first install (no previous controller).
      var hadController = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.addEventListener('controllerchange', function() {
        if (hadController) showUpdateBanner();
        hadController = true;
      });

      // Check for updates when the player returns to the game,
      // at most once per hour (faster than the browser's 24h check).
      var lastCheck = 0;
      document.addEventListener('visibilitychange', function() {
        if (document.visibilityState !== 'visible') return;
        var now = Date.now();
        if (now - lastCheck < 3600000) return;
        lastCheck = now;
        reg.update().catch(function() {});
      });
    } catch (e) { /* update watching is best-effort */ }
  }

  function canPrompt() {
    return !!deferredPrompt;
  }

  // Set up event listeners
  function setupListeners() {
    // One-time re-arm of the install banner for the v9 install fix:
    // users who previously dismissed the banner get one more chance.
    try {
      if (!localStorage.getItem('ao-install-v9-reset')) {
        localStorage.setItem('ao-install-v9-reset', '1');
        var s = Storage.getSave();
        if (s && s.installHidden) {
          s.installHidden = false;
          Storage.updateSave(s);
        }
      }
    } catch (e2) { /* storage unavailable; banner logic still works via save */ }

    window.addEventListener('beforeinstallprompt', function(e) {
      e.preventDefault();
      deferredPrompt = e;
      
      var save = Storage.getSave();
      if (!save.installHidden && !isStandalone()) {
        showInstallBanner('Install', function() { installAction(); });
      } else {
        // Can't show banner, but user can still install via menu
      }
    });
    
    window.addEventListener('appinstalled', function() {
      deferredPrompt = null;
      // Show toast or update UI
      var toast = document.getElementById('toast');
      if (toast) {
        toast.textContent = 'Installed \u2713 Enjoy Arrow Out!';
        toast.classList.add('show');
        setTimeout(function() { toast.classList.remove('show'); }, 2200);
      }
    });
    
    // Handle banner close button
    var closeBtn = document.getElementById('btn-banner-close');
    if (closeBtn) {
      closeBtn.onclick = function() { hideBanner(); };
    }
    
    // Update banner: Refresh loads the new version (progress stays in localStorage)
    var updReload = document.getElementById('btn-update-reload');
    if (updReload) {
      updReload.onclick = function() { location.reload(); };
    }
    var updClose = document.getElementById('btn-update-close');
    if (updClose) {
      updClose.onclick = function() { hideUpdateBanner(); };
    }
  }

  // Initialize
  buildManifest();
  registerSW();
  setupListeners();

  return {
    isStandalone: isStandalone,
    isIOS: isIOS,
    canPrompt: canPrompt,
    buildManifest: buildManifest,
    registerSW: registerSW,
    maybeIOSBanner: maybeIOSBanner,
    installAction: installAction,
    get swActive() { return swActive; },
    getServiceWorkerSource: getServiceWorkerSource,
    get VERSION() { return VERSION; },
    checkForUpdates: checkForUpdates,
    notifSupported: notifSupported,
    pushSupported: pushSupported,
    notifPermission: notifPermission,
    requestNotifPermission: requestNotifPermission,
    subscribePush: subscribePush,
    getPushSubscriptionJson: getPushSubscriptionJson,
    unsubscribePush: unsubscribePush,
    submitPushSubscription: submitPushSubscription,
    deletePushSubscription: deletePushSubscription
  };
})();
