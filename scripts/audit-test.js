'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const vm = require('node:vm');
const { harness, source } = require('./qa-harness');
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

test('Settings opens the dedicated reminder screen and refreshes its status', () => {
  const h=harness(), control=button(h,'btn-reminders'); let refreshes=0, opened;
  h.box.Reminders={refreshUI:()=>refreshes++};h.ui.openDlg=id=>{opened=id;};
  h.G.test.setupEventListeners();control.events.click();
  assert.equal(opened,'dlg-reminders');assert.equal(refreshes,1);
});
test('notification status delegates to the single local reminder implementation', () => {
  const h=harness();let refreshed=0;h.box.Reminders={refreshUI:()=>refreshed++};
  realUI(h).updateNotifUI();assert.equal(refreshed,1);
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

test('timed bonus is paid once across undo, replay and persisted restore', () => {
  const h = harness(); h.G.loadLevel(5); const s = h.G.getState(), id = s.bonus.idx, reward = s.bonus.coins;
  assert.equal(h.GC.pieceBlocker(s.occ, s.arrows, s.cols, s.rows, id), -1);
  h.G.tapArrow(id); assert.equal(h.ST.getSave().coins, reward);
  h.G.undo(); h.G.tapArrow(id); assert.equal(h.ST.getSave().coins, reward);
  h.G.test.saveCur(); const copy = harness(h.data); assert(copy.G.test.tryRestore());
  assert.equal(copy.G.getState().bonus, null);
  copy.G.loadLevel(5); assert.equal(copy.G.getState().bonus, null); assert.equal(copy.ST.getSave().coins, reward);
});

/* ===== v4.3 audit additions: save warnings, bonus pause, focus, bounded loops ===== */
// (extraction marker for sandbox pre-push validation; harmless in CI)

// The qa-harness fires each timer exactly once per flush() call; interval
// tasks do not re-arm. Grab the live 250ms bonusTick watcher that init()
// registered and drive it directly, one call per simulated interval.
function bonusTicker(h) {
  const fns = [];
  for (const task of h.timers.values()) if (task.ms === 250) fns.push(task.fn);
  return () => { for (const fn of fns) fn(); };
}

test('bonus timer freezes while a dialog is open and never underflows on repeated pause/resume', () => {
  const h = harness(); h.G.init(); // registers the 250ms bonusTick watcher
  const tick = bonusTicker(h);
  let now = 1000;
  h.box.performance.now = () => now; // controllable clock
  h.G.loadLevel(5);
  tick(); // first bonusTick anchors b.last at t=1000
  const deadline0 = h.G.getState().bonus.deadline;
  assert.ok(deadline0 - now > 0, 'bonus must start with time on the clock');
  // 30 simulated seconds pass while a dialog is open: the deadline slides
  // forward by the paused time, so no remaining time is lost
  now += 30000; h.ui.anyOpen = () => true; tick();
  let b = h.G.getState().bonus;
  assert.equal(b.deadline, deadline0 + 30000, 'a paused bonus must not lose time');
  assert.equal(b.active, true);
  // resuming consumes time again: the deadline now stays put while playing
  h.ui.anyOpen = () => false; now += 5000; tick();
  b = h.G.getState().bonus;
  assert.equal(b.deadline, deadline0 + 30000, 'active play must consume bonus time');
  // repeated pause/resume cycles: deadline only ever moves forward, stays
  // finite, and never underflows (3 of 6 cycles paused x 4000ms)
  for (let i = 0; i < 6; i++) { h.ui.anyOpen = () => i % 2 === 0; now += 4000; tick(); }
  b = h.G.getState().bonus;
  assert.ok(Number.isFinite(b.deadline), 'deadline must stay finite');
  assert.equal(b.deadline, deadline0 + 42000, 'only paused intervals may extend the deadline');
  assert.equal(b.active, true, 'bonus must still be alive (plenty of time left)');
});

test('an expired bonus pays nothing and no false success is reported', () => {
  const h = harness(); h.G.init(); // registers the 250ms bonusTick watcher
  const tick = bonusTicker(h);
  let now = 1000;
  h.box.performance.now = () => now;
  h.G.loadLevel(5);
  tick(); // anchor b.last
  now += 60000; // bonus timers are 30/40/50s - always shorter than 60s
  tick(); // expiry tick
  const s = h.G.getState();
  assert.equal(s.bonus.active, false, 'bonus must expire');
  const coins = h.ST.getSave().coins;
  h.G.tapArrow(s.bonus.idx); // tap the (now expired) golden piece
  assert.equal(h.ST.getSave().coins, coins, 'expired bonus must pay nothing');
  assert.equal(h.G.getState().bonus.granted, false, 'no reward may be marked granted');
});

test('dialogs move keyboard focus in on open and restore it on close', () => {
  const h = harness(); const UI = realUI(h);
  const opener = button(h, 'btn-focus-opener'); const closer = button(h, 'btn-focus-close');
  let active = opener;
  opener.focus = () => { active = opener; };
  closer.focus = () => { active = closer; };
  h.elements['dlg-focus'] = {
    classList: { add() {}, remove() {}, contains: () => true },
    querySelector: () => closer
  };
  Object.defineProperty(h.box.document, 'activeElement', {
    configurable: true, get: () => active, set: v => { active = v; }
  });
  h.box.document.querySelectorAll = () => [];
  UI.openDlg('dlg-focus');
  assert.equal(active, closer, 'focus must move into the dialog on open');
  UI.closeAll();
  assert.equal(active, opener, 'focus must return to the opener on close');
  UI.closeAll(); // nothing was opened since: focus stays put, no crash
  assert.equal(active, opener);
});

test('map ambient and render loops are structurally bounded (single loop, cleaned up on stop)', () => {
  const mapSrc = source('js/map.js'), renderSrc = source('js/render.js');
  // map ambient: a new start always stops the previous loop first
  assert.ok(mapSrc.indexOf('function startAmbient() {\n    stopAmbient();') !== -1,
    'startAmbient must stop any previous loop before starting a new one');
  assert.ok(/ambient\.parts = \[\];/.test(mapSrc),
    'particles must be rebuilt on every start (no unbounded growth)');
  assert.ok(/function stopAmbient\(\) \{\s*ambient\.running = false;/.test(mapSrc) &&
    /ambient\.raf = 0;/.test(mapSrc), 'loop flags must be cleared on stop');
  // render: needsRender-gated single loop, never stacked
  assert.ok(renderSrc.indexOf('function ensureLoop() {\n    if (!loopOn) {') !== -1,
    'ensureLoop must only start a loop when none is running');
});
