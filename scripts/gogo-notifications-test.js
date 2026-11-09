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

if (failures) {
  console.error('\n' + failures + ' check(s) FAILED');
  process.exit(1);
}
console.log('\nAll GoGo notifications checks passed');
