'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const vm = require('node:vm');
const { harness, source } = require('./qa-harness');
const settle = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
function button(h, id) {
  const events = {};
  return h.elements[id] = { checked: false, disabled: false, events,
    addEventListener: (name, fn) => { events[name] = fn; } };
}
function realUI(h) {
  h.box.window.matchMedia = () => ({ matches: false, addListener() {} });
  h.box.document.querySelectorAll = () => [];
  h.box.document.querySelector = () => null;
  const classes = new Set();
  h.box.document.body.classList = { contains: c => classes.has(c),
    toggle: (c, on) => on ? classes.add(c) : classes.delete(c),
    add: c => classes.add(c), remove: c => classes.delete(c) };
  Object.defineProperty(h.box.document.body, 'className', {
    get: () => [...classes].join(' '), set: s => { classes.clear(); s.split(/\s+/).forEach(c => classes.add(c)); }
  });
  vm.runInContext(source('js/ui.js') + ';globalThis.RealUI=UI;', h.box);
  return h.box.RealUI;
}

test('reminders default off; existing explicit preferences and progress survive', () => {
  assert.equal(harness().ST.getSave().settings.notifications, false);
  for (const notifications of [true, false]) {
    const h = harness({ 'arrowOut.v2': JSON.stringify({ v: 2, unlocked: 900, coins: 400, settings: { notifications } }) });
    assert.equal(h.ST.getSave().settings.notifications, notifications);
    assert.equal(h.ST.getSave().unlocked, 900); assert.equal(h.ST.getSave().coins, 400);
  }
});

test('notification opt-out captures its endpoint before unsubscribing and reports failed deletion', async () => {
  const h = harness(), toggle = button(h, 'chk-notifs'), lookup = deferred(), calls = [], toasts = [];
  h.ui.toast = text => toasts.push(text);
  h.box.PWA = { getPushSubscriptionJson: () => lookup.promise,
    deletePushSubscription: async json => { calls.push(['delete', json]); return false; },
    unsubscribePush: async () => { calls.push(['unsubscribe']); return true; } };
  h.G.test.setupEventListeners(); toggle.events.change();
  await settle(); assert.equal(calls.length, 0, 'must capture subscription before removal');
  assert.equal(toggle.disabled, true);
  lookup.resolve('synthetic-subscription'); await settle();
  assert.deepEqual(calls, [['delete', 'synthetic-subscription'], ['unsubscribe']]);
  assert.equal(toggle.disabled, false); assert.equal(h.ST.getSave().settings.notifications, false);
  assert(toasts.some(t => /send list|removal|cleanup/i.test(t)), 'failed deletion must be visible');
});

test('notification toggle serializes requests and recovers after a rejected API', async () => {
  const h = harness(), toggle = button(h, 'chk-notifs'), subscribe = deferred(); let creates = 0;
  h.box.PWA = { notifPermission: () => 'granted', subscribePush: () => { creates++; return subscribe.promise; },
    submitPushSubscription: async () => true };
  h.G.test.setupEventListeners(); toggle.checked = true;
  toggle.events.change(); toggle.events.change(); await settle();
  assert.equal(creates, 1); assert.equal(toggle.disabled, true);
  subscribe.resolve('synthetic-subscription'); await settle(); assert.equal(toggle.disabled, false);
  h.box.PWA.subscribePush = async () => { throw Error('synthetic API failure'); };
  toggle.events.change(); await settle(); assert.equal(toggle.disabled, false);
});

test('late subscription status cannot overwrite Off or imply server delivery', async () => {
  const h = harness(), pending = deferred();
  h.box.PWA = { notifPermission: () => 'granted', getPushSubscriptionJson: () => pending.promise };
  h.elements['st-notif'] = { textContent: '' }; button(h, 'chk-notifs');
  const ui = realUI(h); h.ST.getSave().settings.notifications = true; ui.updateNotifUI();
  h.ST.getSave().settings.notifications = false; ui.updateNotifUI();
  pending.resolve('synthetic'); await settle(); assert.equal(h.elements['st-notif'].textContent, 'Off');
  h.ST.getSave().settings.notifications = true; ui.updateNotifUI(); await settle();
  assert.match(h.elements['st-notif'].textContent, /browser subscribed/i);
});

test('theme changes preserve the home navigation class', () => {
  const h = harness(), ui = realUI(h); h.box.document.body.classList.add('at-home');
  ui.setTheme('light'); assert(h.box.document.body.classList.contains('at-home'));
  assert(h.box.document.body.classList.contains('theme-light'));
  assert(!h.box.document.body.classList.contains('theme-dark'));
});

test('onboarding is deferred until actually shown after the first daily reward', () => {
  const h = harness(), claim = button(h, 'btn-reward-claim'); let rewardOpen = false; const shown = [];
  h.ui.openDlg = id => { shown.push(id); if (id === 'dlg-reward') rewardOpen = true; };
  h.ui.closeAll = () => { rewardOpen = false; };
  h.ui.anyOpen = () => rewardOpen;
  h.elements['dlg-reward'] = { classList: { contains: () => rewardOpen } };
  h.G.init(); assert(!shown.includes('dlg-howto')); assert.equal(h.ST.getSave().settings.seenOnboarding, false);
  claim.events.click(); assert(shown.includes('dlg-howto')); assert.equal(h.ST.getSave().settings.seenOnboarding, true);
  const coins = h.ST.getSave().coins; claim.events.click(); assert.equal(h.ST.getSave().coins, coins);
  assert.equal(shown.filter(id => id === 'dlg-howto').length, 1);
});

test('muted sound survives boot and both sound controls persist their choice', () => {
  const h = harness({ 'arrowOut.v2': '{"v":2,"sound":false}' });
  const sound = button(h, 'btn-sound'), check = button(h, 'chk-sound');
  h.box.Audio = new Proxy({ enabled: true }, { get: (obj, key) => key in obj ? obj[key] : () => {} });
  h.G.init(); assert.equal(h.box.Audio.enabled, false);
  sound.events.click(); assert.equal(JSON.parse(h.data['arrowOut.v2']).sound, true);
  check.checked = false; check.events.change(); assert.equal(JSON.parse(h.data['arrowOut.v2']).sound, false);
});

test('Continue refreshes renderer/HUD and completes an all-removed in-flight snapshot exactly once', () => {
  const h = harness(), resume = button(h, 'btn-continue'); h.G.test.setupEventListeners(); h.G.loadLevel(1);
  const c = h.ST.getSave().cur; c.alive.fill(0); c.undoIds = c.arrows.map((a, i) => i);
  let fits = 0, updates = 0; h.render.fitCanvas = () => fits++; h.ui.updateHUD = () => updates++;
  resume.events.click(); assert(h.G.getState().over); assert.equal(h.ST.getSave().unlocked, 2);
  assert(fits > 0 && updates > 0); assert.equal(h.ST.getSave().cur, null);
  const coins = h.ST.getSave().coins; h.G.test.scheduleWin(); assert.equal(h.ST.getSave().coins, coins);
});

test('login streak uses UTC dates across a local daylight-saving transition', () => {
  const previousTZ = process.env.TZ;
  process.env.TZ = 'America/New_York';
  try {
    const h = harness(), claim = button(h, 'btn-reward-claim');
    const now = '2026-03-08T23:30:00Z';
    h.box.Date = class extends Date { constructor(...args) { super(...(args.length ? args : [now])); } };
    h.ST.getSave().loginRewards = { lastClaim: '2026-03-07', streak: 2 };
    h.G.test.setupEventListeners(); claim.events.click();
    assert.equal(h.ST.getSave().loginRewards.streak, 3); assert.equal(h.ST.getSave().coins, 30);
  } finally { if (previousTZ === undefined) delete process.env.TZ; else process.env.TZ = previousTZ; }
});

test('displayed release matches the service worker cache version', () => {
  const version = source('js/pwa.js').match(/var VERSION = '(v\d+)'/)[1];
  assert.equal(source('sw.js').match(/const CACHE = 'arrow-out-(v\d+)'/)[1], version);
});

test('Home snapshots the last move before an immediate Continue', () => {
  const h = harness(), home = button(h, 'btn-home'), resume = button(h, 'btn-continue');
  h.G.test.setupEventListeners(); h.G.loadLevel(1);
  const s = h.G.getState(), id = h.GC.hintArrow(s.arrows, s.occ, s.cols, s.rows);
  h.G.tapArrow(id); home.events.click(); resume.events.click();
  assert.equal(h.G.getState().arrows[id].alive, false); assert.equal(h.G.getState().undoIds.length, 1);
});

test('a redirected core asset cannot activate a broken service worker update', async () => {
  const handlers = {}; let activated = false, pending;
  const box = vm.createContext({ URL, console,
    self: { addEventListener: (name, fn) => { handlers[name] = fn; }, skipWaiting: () => { activated = true; } },
    caches: { open: async () => ({ put: async () => {}, add: async () => {} }) },
    Request: class { constructor(url) { this.url = url; } },
    fetch: async req => ({ ok: true, status: 200, redirected: req.url.endsWith('js/main.js') }) });
  vm.runInContext(source('sw.js'), box);
  handlers.install({ waitUntil: p => { pending = p; } });
  await assert.rejects(pending, /precache failed/); assert.equal(activated, false);
});

async function senderScenario(cleanupStatus = 204) {
  const workflow = source('.github/workflows/notify.yml');
  const script = workflow.split("cat > send.js <<'EOF'\n")[1].split('\n          EOF')[0].replace(/^          /gm, '');
  const rows = ['ok', 'gone404', 'gone410', 'retry'].map(id => ({ subscription: { endpoint: 'https://push.example.test/' + id } }));
  const logs = [], deleted = []; let finish;
  const done = new Promise(resolve => { finish = resolve; });
  const box = vm.createContext({ Date, JSON, URL, encodeURIComponent,
    console: { log: message => logs.push(message) },
    process: { env: { VAPID_PRIVATE: 'synthetic-private', SERVICE_KEY: 'synthetic-service', SUPABASE_URL: 'https://database.example.test' }, exit: finish },
    require: name => { assert.equal(name, 'web-push'); return {
      setVapidDetails() {}, sendNotification: async sub => {
        if (sub.endpoint.endsWith('ok')) return;
        const err = Error('provider response contains ' + sub.endpoint + ' synthetic-private');
        err.statusCode = sub.endpoint.endsWith('gone404') ? 404 : sub.endpoint.endsWith('gone410') ? 410 : 429;
        throw err;
      }
    }; },
    fetch: async (url, options = {}) => {
      if (options.method === 'DELETE') {
        deleted.push(new URL(url).searchParams.get('endpoint'));
        return { ok: cleanupStatus === 204, status: cleanupStatus };
      }
      return { ok: true, json: async () => rows };
    }
  });
  vm.runInContext(script, box); const code = await done;
  return { code, logs: logs.join('\n'), deleted };
}
test('push sender removes only expired endpoints without exposing subscriptions or provider errors', async () => {
  const result = await senderScenario();
  assert.deepEqual(result.deleted, ['eq.https://push.example.test/gone404', 'eq.https://push.example.test/gone410']);
  assert.equal(result.code, 0);
  assert(!/push\.example|synthetic-private|provider response/.test(result.logs));
});
test('push sender reports failed expired-roster cleanup without claiming deletion', async () => {
  const result = await senderScenario(503);
  assert.equal(result.code, 1); assert.match(result.logs, /cleanup failed.*503/i);
  assert(!/push\.example|synthetic-private/.test(result.logs));
});

test('timed bonus is paid once across undo, replay and persisted restore', () => {
  const h = harness(); h.G.loadLevel(5); const s = h.G.getState(), id = s.bonus.idx, reward = s.bonus.coins;
  assert.equal(h.GC.pieceBlocker(s.occ, s.arrows, s.cols, s.rows, id), -1);
  h.G.tapArrow(id); assert.equal(h.ST.getSave().coins, reward);
  h.G.undo(); h.G.tapArrow(id); assert.equal(h.ST.getSave().coins, reward);
  h.G.test.saveCur(); const copy = harness(h.data); assert(copy.G.test.tryRestore());
  assert.equal(copy.G.getState().bonus, null);
  copy.G.loadLevel(5); assert.equal(copy.G.getState().bonus, null); assert.equal(copy.ST.getSave().coins, reward);
});
