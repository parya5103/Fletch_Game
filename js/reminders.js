/** Local, best-effort reminders. The page schedules checks; the worker has no timer. */
'use strict';
const Reminders = (function() {
  const KEY = 'arrowOut.reminders.v1', CLAIMS = 'arrowOut.reminderClaims.v1', TAG = 'arrow-out-local';
  let initialized = false, busy = false, prompting = false, pushBusy = false;
  let storageAvailable = true, lastWrite = 0;
  let memory = { activityAt: Date.now(), notifiedFor: 0, lastTestAt: 0, pending: false };
  const $ = id => document.getElementById(id);
  const prefs = () => Storage.getSave().settings;
  function permission() {
    try { return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission; }
    catch (_) { return 'unsupported'; }
  }
  function systemSupported() {
    return window.isSecureContext === true && permission() !== 'unsupported' &&
      !!(navigator.serviceWorker && navigator.serviceWorker.getRegistration && navigator.locks && navigator.locks.request);
  }
  function read() {
    try {
      const value = JSON.parse(localStorage.getItem(KEY) || 'null');
      const claims = JSON.parse(localStorage.getItem(CLAIMS) || 'null'), now = Date.now();
      storageAvailable = true;
      if (value && Number.isSafeInteger(value.activityAt) && value.activityAt >= 0 && value.activityAt <= now)
        memory.activityAt = Math.max(memory.activityAt, value.activityAt);
      if (claims && typeof claims === 'object') {
        for (const key of ['notifiedFor', 'lastTestAt']) {
          if (Number.isSafeInteger(claims[key]) && claims[key] >= 0 && claims[key] <= now)
            memory[key] = Math.max(memory[key], claims[key]);
        }
        memory.pending = claims.notifiedFor === memory.notifiedFor && claims.notifiedFor >= memory.activityAt && claims.pending === true;
      }
      if (memory.activityAt > now) memory = { activityAt: now, notifiedFor: 0, lastTestAt: 0, pending: false };
    } catch (_) { storageAvailable = false; }
    return memory;
  }
  function write() {
    try { localStorage.setItem(KEY, JSON.stringify({ activityAt: memory.activityAt })); storageAvailable = true; lastWrite = Date.now(); return true; }
    catch (_) { storageAvailable = false; return false; }
  }
  // Only delivery/test code holding the Web Lock writes claims. Activity
  // flushes must never overwrite a claim made concurrently by another tab.
  function writeClaims() {
    try {
      localStorage.setItem(CLAIMS, JSON.stringify({ notifiedFor: memory.notifiedFor, lastTestAt: memory.lastTestAt, pending: memory.pending }));
      storageAvailable = true; return true;
    } catch (_) { storageAvailable = false; return false; }
  }
  function hideBanner() { if ($('reminder-banner')) $('reminder-banner').hidden = true; }
  function activity(force) {
    read(); memory.activityAt = Date.now(); memory.pending = false;
    hideBanner();
    if (prefs().notifications && (force === true || Date.now() - lastWrite >= 15000)) write();
  }
  function showBanner() { if ($('reminder-banner')) $('reminder-banner').hidden = false; }
  async function registration() {
    try {
      if (!navigator.serviceWorker || !navigator.serviceWorker.getRegistration) return null;
      const scope = new URL('./', location.href).href;
      const reg = await navigator.serviceWorker.getRegistration(scope);
      return reg && reg.scope === scope && reg.active ? reg : null;
    } catch (_) { return null; }
  }
  function options(test) {
    return { body: test ? 'Local reminder test. Browser or OS settings may suppress its display.' :
      'Your puzzle is waiting. Return whenever you are ready.',
    // No silent flag: sound and vibration follow the browser and OS
    // notification settings the user already configured (never forced silent).
    tag: TAG, icon: './icons/icon-192.png', data: { url: './' } };
  }
  async function deliver(coordinated) {
    const state = read(), settings = prefs(), now = Date.now(), episode = state.activityAt;
    if (!settings.notifications) { hideBanner(); return false; }
    if (state.pending && !document.hidden) {
      state.pending = false; if (coordinated) writeClaims(); showBanner(); return true;
    }
    if (now - episode < settings.reminderMinutes * 60000 || state.notifiedFor >= episode) return false;
    if (!document.hidden) {
      state.notifiedFor = episode; state.pending = false; if (coordinated) writeClaims(); showBanner(); return true;
    }
    if (!coordinated || !storageAvailable || !settings.systemNotifications || !systemSupported() || permission() !== 'granted') return false;
    const reg = await registration();
    // Recheck after async work: Off or renewed activity must cancel delivery.
    if (!reg || typeof reg.showNotification !== 'function' || !prefs().notifications ||
        !prefs().systemNotifications || read().activityAt !== episode || permission() !== 'granted') return false;
    state.notifiedFor = episode; state.pending = false;
    if (!writeClaims()) return false; // no persistent cross-tab claim -> no system notification
    try {
      await reg.showNotification('Arrow Out!', options(false));
      if (!prefs().notifications || !prefs().systemNotifications || permission() !== 'granted' || read().activityAt !== episode) await closeLocalNotifications();
    } catch (_) {
      if (prefs().notifications && read().activityAt === episode) { state.pending = true; writeClaims(); }
    }
    return true;
  }
  async function check() {
    if (busy) return false;
    busy = true;
    try {
      if (navigator.locks && navigator.locks.request) {
        return await navigator.locks.request('arrow-out-reminder', { ifAvailable: true }, lock => lock ? deliver(true) : false);
      }
      // Without cross-tab locking, only an in-game banner is supported.
      return await deliver(false);
    } catch (_) { return false; }
    finally { busy = false; refreshUI(); }
  }
  async function closeLocalNotifications() {
    const reg = await registration();
    try { if (reg && reg.getNotifications) (await reg.getNotifications({ tag: TAG })).forEach(n => n.close()); }
    catch (_) { /* permission revocation must not break the game */ }
  }
  function setEnabled(enabled) {
    prefs().notifications = enabled === true; Storage.persist(); activity(true);
    if (!enabled) closeLocalNotifications();
    refreshUI();
  }
  async function allowSystem() {
    const settings = prefs();
    if (prompting || !settings.notifications || !systemSupported()) return;
    let perm = permission();
    if (perm === 'default') {
      // A dismissed browser prompt still reports 'default', so every
      // explicit button click may ask again; notificationPrompted only
      // informs the hint text, it never locks the button.
      settings.notificationPrompted = true; Storage.persist(); prompting = true; refreshUI();
      try {
        // A single invocation, synchronously from the explicit button action.
        perm = await new Promise(resolve => {
          const result = Notification.requestPermission(resolve);
          if (result && result.then) result.then(resolve, () => resolve('default'));
        });
      } catch (_) { perm = 'default'; }
      finally { prompting = false; }
    }
    prefs().systemNotifications = perm === 'granted' && prefs().notifications;
    Storage.persist(); refreshUI();
  }
  async function testSystem() {
    if (!prefs().notifications || !prefs().systemNotifications || !systemSupported() || permission() !== 'granted') return false;
    return navigator.locks.request('arrow-out-reminder', { ifAvailable: true }, async lock => {
      if (!lock || Date.now() - read().lastTestAt < 60000) return false;
      const reg = await registration();
      if (!reg || !reg.showNotification || !prefs().notifications || !prefs().systemNotifications || permission() !== 'granted') return false;
      memory.lastTestAt = Date.now(); if (!writeClaims()) return false;
      try {
        await reg.showNotification('Arrow Out! test', options(true));
        if (!prefs().notifications || !prefs().systemNotifications || permission() !== 'granted') {
          await closeLocalNotifications(); return false;
        }
        return true;
      }
      catch (_) { return false; }
    }).catch(() => false);
  }
  function pushStatus(msg) { if ($('push-status')) $('push-status').textContent = msg || ''; }
  async function pushStatusRefresh() {
    if (pushBusy) return;
    if (!prefs().pushReminders) { pushStatus(''); return; }
    if (typeof PWA === 'undefined') { pushStatus('Push unavailable in this browser'); return; }
    try {
      const sub = await PWA.getPushSubscriptionJson();
      pushStatus(sub ? 'Daily push reminders active' : 'Setup incomplete — toggle off and on');
    } catch (_) { pushStatus('Setup incomplete — toggle off and on'); }
  }
  // Daily push is genuine Web Push: a scheduled workflow delivers ~5
  // notifications a day even when the game is closed. Local reminders
  // (banner/system while the page can run) stay fully separate.
  async function pushToggle() {
    if (pushBusy) return;
    pushBusy = true;
    try {
      const checked = !!($('chk-push') && $('chk-push').checked);
      if (!checked) {
        prefs().pushReminders = false; Storage.persist();
        try {
          if (typeof PWA !== 'undefined') {
            const sub = await PWA.getPushSubscriptionJson();
            if (sub) { await PWA.deletePushSubscription(sub); await PWA.unsubscribePush(); }
          }
        } catch (_) { /* roster removal is best-effort */ }
        pushStatus(''); refreshUI(); return;
      }
      if (typeof PWA === 'undefined' || !PWA.pushSupported()) {
        pushStatus('Daily push reminders are not available in this browser'); refreshUI(); return;
      }
      let perm = PWA.notifPermission();
      if (perm === 'default') perm = await PWA.requestNotifPermission();
      if (perm === 'denied') { pushStatus('Blocked in browser notification settings'); refreshUI(); return; }
      const sub = await PWA.subscribePush();
      if (!sub) { pushStatus('Could not subscribe — check your connection, then toggle off and on'); refreshUI(); return; }
      const saved = await PWA.submitPushSubscription(sub);
      if (!saved) { pushStatus('Could not save reminders — check your connection, then toggle off and on'); refreshUI(); return; }
      prefs().pushReminders = true; Storage.persist();
      pushStatus('Daily push reminders on — see you soon!'); refreshUI();
    } finally { pushBusy = false; }
  }
  function status() {
    if (!prefs().notifications) return 'Off';
    if (!systemSupported()) return 'In-game only — system notifications unavailable here';
    if (permission() === 'denied') return 'In-game only — system permission blocked in browser settings';
    if (!prefs().systemNotifications) return 'In-game only';
    if (permission() !== 'granted') return 'In-game only — allow notifications in browser settings';
    if (!storageAvailable) return 'In-game only — local reminder storage unavailable';
    return 'In-game + system when the page can run; delivery is not guaranteed';
  }
  function refreshUI() {
    const settings = prefs(), perm = permission();
    const enabled = $('chk-notifs'), system = $('chk-system-notifs'), minutes = $('reminder-minutes');
    if (enabled) enabled.checked = settings.notifications;
    if (minutes) { minutes.value = String(settings.reminderMinutes); minutes.disabled = !settings.notifications; }
    if (system) { system.checked = settings.systemNotifications; system.disabled = !settings.notifications || !systemSupported() || perm !== 'granted'; }
    for (const id of ['st-notif','reminder-status']) if ($(id)) $(id).textContent = status();
    if ($('btn-notif-permission')) $('btn-notif-permission').disabled = !settings.notifications || !systemSupported() ||
      perm !== 'default' || prompting;
    if ($('reminder-permission')) $('reminder-permission').textContent = 'System permission: ' + perm +
      (settings.notificationPrompted && perm === 'default' ? '. Prompt shown before; this button can ask again.' : '.');
    if ($('btn-notif-test')) $('btn-notif-test').disabled = !settings.notifications || !settings.systemNotifications ||
      !systemSupported() || perm !== 'granted';
    const push = $('chk-push');
    if (push) push.checked = settings.pushReminders === true;
    pushStatusRefresh();
    if (!settings.notifications) hideBanner();
  }
  function reset() {
    memory = { activityAt: Date.now(), notifiedFor: 0, lastTestAt: 0, pending: false };
    try { localStorage.removeItem(KEY); localStorage.removeItem(CLAIMS); } catch (_) { storageAvailable = false; }
    hideBanner(); closeLocalNotifications(); refreshUI();
  }
  function init() {
    if (initialized) return;
    initialized = true; activity(true);
    const on = (id, event, fn) => { if ($(id)) $(id).addEventListener(event, fn); };
    on('chk-notifs','change', () => setEnabled($('chk-notifs').checked));
    on('reminder-minutes','change', () => {
      const value = Number($('reminder-minutes').value);
      prefs().reminderMinutes = [60,90,120].includes(value) ? value : 90;
      Storage.persist(); activity(true); refreshUI();
    });
    on('chk-system-notifs','change', () => {
      prefs().systemNotifications = $('chk-system-notifs').checked && prefs().notifications && systemSupported() && permission() === 'granted';
      Storage.persist(); if (!prefs().systemNotifications) closeLocalNotifications(); refreshUI();
    });
    on('btn-notif-permission','click', allowSystem);
    on('btn-notif-test','click', async () => {
      const ok = await testSystem();
      if ($('reminder-test-status')) $('reminder-test-status').textContent = ok ?
        'Request handed to the browser. OS settings may suppress display; this does not test closed-browser delivery.' :
        'No notification sent. Check permission, active offline worker and storage; wait a minute between tests.';
    });
    on('chk-push','change', pushToggle);
    on('btn-reminder-dismiss','click', () => activity(true));
    document.addEventListener('pointerdown', () => activity(false), { passive: true, capture: true });
    document.addEventListener('keydown', () => activity(false), { capture: true });
    document.addEventListener('visibilitychange', () => { if (document.hidden && prefs().notifications) { read(); write(); } check(); });
    window.addEventListener('pagehide', () => { if (prefs().notifications) { read(); write(); } });
    window.addEventListener('focus', () => { refreshUI(); check(); });
    window.addEventListener('storage', () => { read(); refreshUI(); if (Date.now() - memory.activityAt < 15000) hideBanner(); });
    setInterval(check, 30000); // browser suspension can delay or stop this; never a background guarantee
    refreshUI();
  }
  return { init, reset, check, activity, setEnabled, permission, status, refreshUI, allowSystem, testSystem };
})();
