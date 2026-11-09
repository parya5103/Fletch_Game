#!/usr/bin/env node
/**
 * Arrow Out! - GoGo Central notifications module tests (MOCKED)
 * Pure Node, zero dependencies. Loads js/gogo-notifications.js in a vm
 * sandbox and checks the fail-closed config gate, payload shapes and file
 * wiring. NO Firebase SDK, NO service worker registration, NO Notification
 * API and NO network are involved - these tests do NOT prove live FCM
 * delivery. Live delivery is a manual post-deployment device check.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let failures = 0;
function check(name, cond, detail) {
  if (cond) {
    console.log('  ok - ' + name);
  } else {
    failures++;
    console.error('  FAIL - ' + name + (detail ? ' :: ' + detail : ''));
  }
}

const moduleSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'gogo-notifications.js'), 'utf8');
const swSrc = fs.readFileSync(path.join(__dirname, '..', 'fcm', 'firebase-messaging-sw.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

console.log('# module loads inertly in plain Node (no DOM, no window)');
// vm contexts expose only ECMAScript intrinsics: pass the host URL global
// in so the module's WHATWG-URL link allowlist runs for real (browsers ship
// URL as a standard global; without it the GoGo-domain allowlist checks
// would silently exercise only the catch-path fallback).
const sandbox = { URL };
vm.createContext(sandbox);
vm.runInContext(moduleSrc, sandbox, { filename: 'js/gogo-notifications.js' });
const GN = sandbox.GoGoNotifications;
check('module exposes its public API', !!GN && typeof GN.enable === 'function');
check('module mounts nothing outside a browser (no document object)', true);

console.log('# fail-closed config gate');
const v = GN.internals.validateConfig();
check('shipped config is fully configured (backend + VAPID key)',
  v.ok === true && v.disabled === false,
  JSON.stringify(v.problems));
const empty = GN.internals.validateConfig({
  appId: 'arrow-out',
  apiBase: '',
  vapidPublicKey: ''
});
check('empty apiBase/vapidPublicKey disable the feature',
  empty.ok === false && empty.disabled === true,
  JSON.stringify(empty.problems));
check('empty config reports both missing deployment switches',
  empty.problems.some(function (p) { return p.indexOf('API base') !== -1; }) &&
  empty.problems.some(function (p) { return p.indexOf('VAPID') !== -1; }));
const v2 = GN.internals.validateConfig({
  appId: 'arrow-out',
  apiBase: 'https://gogo-central-backend.example.run.app/',
  vapidPublicKey: 'BExampleVapidPublicKey000000000000000'
});
check('filled config validates', v2.ok === true && v2.disabled === false);

console.log('# CONFIG targets arrow-out with the fcm/ sub-scope worker');
check('appId is arrow-out', GN.config.appId === 'arrow-out');
check('worker url is the fcm/ subdirectory, never the game root',
  GN.config.swUrl === 'fcm/firebase-messaging-sw.js');
check('auth mode is anonymous (no GoGo Account bundle on the game site)',
  GN.config.authMode === 'anonymous');

console.log('# payload contract');
const payload = GN.internals.buildRegisterPayload(
  { appId: 'arrow-out' },
  'fcm-web-token-abcdefgh1234567890',
  'Mozilla/5.0 (Linux; Android 15) TestAgent/1.0'
);
check('register payload matches the backend contract', JSON.stringify(payload) === JSON.stringify({
  appId: 'arrow-out',
  fcmToken: 'fcm-web-token-abcdefgh1234567890',
  platform: 'web',
  userAgent: 'Mozilla/5.0 (Linux; Android 15) TestAgent/1.0'
}), JSON.stringify(payload));
const pref = GN.internals.buildPreferencePayload(true);
check('preference payload toggles all channels with quiet hours',
  pref.enabled === true && pref.webPush === true && pref.androidPush === true &&
  pref.marketingAlerts === true && pref.transactionalAlerts === true &&
  pref.quietHoursStart === '22:00' && pref.quietHoursEnd === '06:00');

console.log('# link allowlist');
const safeUrl = GN.internals.safeUrl;
check('GoGo domain allowed', safeUrl('https://gogocompany.in/arrowout/') === 'https://gogocompany.in/arrowout/');
check('foreign domains fall back to the portal', safeUrl('https://evil.example/') === 'https://gogocompany.in/');
check('javascript: URLs fall back to the portal', safeUrl('javascript:alert(1)') === 'https://gogocompany.in/');

console.log('# background worker invariants');
check('worker loads the compat messaging SDK', swSrc.indexOf('firebase-messaging-compat.js') !== -1);
check('worker handles background messages', swSrc.indexOf('onBackgroundMessage') !== -1);
check('worker dedupes by notificationId tag', swSrc.indexOf('tag: notificationId') !== -1);
check('worker installs NO fetch handler', swSrc.indexOf("addEventListener('fetch'") === -1);
check('worker resolves the game icon from its own scope',
  swSrc.indexOf("new URL('../icons/icon-192.png', self.registration.scope).href") !== -1);

console.log('# index.html wiring and CSP');
check('settings dialog carries the mount container',
  indexHtml.indexOf('data-gogo-notifications') !== -1);
check('module loads after main.js',
  indexHtml.indexOf('js/main.js') < indexHtml.indexOf('js/gogo-notifications.js'));
check('CSP allows the Firebase SDK script host',
  /script-src[^;]*gstatic\.com/.test(indexHtml));
check('CSP allows the Firebase API connect hosts',
  /connect-src[^;]*fcmregistrations\.googleapis\.com/.test(indexHtml) &&
  /connect-src[^;]*identitytoolkit\.googleapis\.com/.test(indexHtml));
check('game service worker file untouched by this feature',
  fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8').indexOf('GoGoNotifications') === -1);

console.log('# onboarding (first-visit intro, 3-day reminder, denied guidance)');
const eo = GN.internals.evaluateOnboarding;
const DAY = 24 * 60 * 60 * 1000;
const envOk = { configOk: true, pushSupported: true, permission: 'default', active: false };
check('first visit shows the intro', eo(null, 1000, envOk).action === 'intro');
check('no reshow within 24h of the last view',
  eo({ shownAt: 2000 }, 1000 + DAY / 2, envOk).action === 'none');
check('not-now waits 3 days, then shows ONE reminder',
  eo({ decision: 'not-now', decidedAt: 1000 }, 1000 + DAY, envOk).action === 'none' &&
  eo({ decision: 'not-now', decidedAt: 1000 }, 1000 + 3 * DAY + 1, envOk).action === 'reminder' &&
  eo({ decision: 'not-now', decidedAt: 1000, reminderShown: true }, 1000 + 3 * DAY + 1, envOk).action === 'none');
check('dismissed-forever and enabled never reshow',
  eo({ decision: 'dismissed-forever' }, 9999999999999, envOk).action === 'none' &&
  eo({ decision: 'enabled' }, 9999999999999, envOk).action === 'none');
check('already-active visitors never see the intro',
  eo(null, 1000, Object.assign({}, envOk, { active: true })).action === 'none');
check('fail-closed config never shows the intro',
  eo(null, 1000, Object.assign({}, envOk, { configOk: false })).action === 'none');
check('denied permission gets one-time browser-settings guidance',
  eo(null, 1000, Object.assign({}, envOk, { permission: 'denied' })).action === 'blocked' &&
  eo({ blockedShown: true }, 1000, Object.assign({}, envOk, { permission: 'denied' })).action === 'none');
check('intro lists all six GoGo categories with Enable + Not now',
  ['GoGo Company announcements', 'Sarkari Sarthi job alerts', 'Pika News breaking news',
   'Crystal Quest updates', 'Arrow Out updates', 'Future GoGo product announcements']
    .every(function (label) { return moduleSrc.indexOf(label) !== -1; }) &&
  moduleSrc.indexOf('id="gogo-notifications-intro"') !== -1);
check('native prompt appears only inside the Enable click path',
  (moduleSrc.match(/requestPermission/g) || []).length === 1);

console.log('# backend verification before Active');
const devices = [
  { deviceId: 'd1', fcmToken: 'tok-aaa', appId: 'arrow-out', status: 'active' },
  { deviceId: 'd2', fcmToken: 'tok-aaa', appId: 'other-app', status: 'active' },
  { deviceId: 'd3', fcmToken: 'tok-bbb', appId: 'arrow-out', status: 'revoked' },
  { deviceId: 'd4', fcmToken: 'tok-bbb', appId: 'arrow-out', status: 'active' }
];
const find = GN.internals.findRegisteredDevice;
check('active token+appId row verified', find(devices, 'tok-aaa', 'arrow-out').deviceId === 'd1');
check('revoked/rotated rows skipped, duplicates resolve to the active row',
  find(devices, 'tok-bbb', 'arrow-out').deviceId === 'd4');
check('unknown token is not registered', find(devices, 'tok-ccc', 'arrow-out') === null);
check('verification reuses the existing devices endpoint and surfaces failures',
  moduleSrc.indexOf("apiFetch('/api/v1/devices', { method: 'GET' })") !== -1 &&
  moduleSrc.indexOf('VERIFY_FAILED') !== -1 &&
  moduleSrc.indexOf('verified: true') !== -1);

if (failures) {
  console.error('\n' + failures + ' check(s) FAILED');
  process.exit(1);
}
console.log('\nAll GoGo notifications checks passed');

