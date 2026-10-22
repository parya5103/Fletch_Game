#!/usr/bin/env node
/**
 * Arrow Out! - CI smoke tests (pure Node, zero dependencies)
 * Loads js/game.js in a vm sandbox and verifies the level generator
 * always produces valid, solvable winding-path boards with working
 * hints, deterministic layouts and a sound timed-bonus spec.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'game.js'), 'utf8');
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(src + '\n;globalThis.__GC = GameCore;', sandbox, { filename: 'js/game.js' });
const GC = sandbox.__GC;

if (!GC || typeof GC.genLevel !== 'function') {
  console.error('FAIL - GameCore did not load');
  process.exit(1);
}

let failures = 0;
function check(name, cond, detail) {
  if (cond) {
    console.log('  ok - ' + name);
  } else {
    failures++;
    console.error('  FAIL - ' + name + (detail ? ' :: ' + detail : ''));
  }
}

// Occupancy map from winding pieces (cell -> piece index), as gameplay uses.
function occFrom(W, H, arrows) {
  const occ = new Int32Array(W * H).fill(-1);
  for (let i = 0; i < arrows.length; i++) {
    if (!arrows[i].alive) continue;
    for (const c of arrows[i].cells) occ[c.y * W + c.x] = i;
  }
  return occ;
}

// A valid winding piece: >=2 cells, contiguous orthogonal path, in bounds.
function pieceValid(a, W, H) {
  if (!a || !Array.isArray(a.cells) || a.cells.length < 2) return false;
  if (!(a.dir >= 0 && a.dir <= 3) || a.alive !== true) return false;
  for (let k = 0; k < a.cells.length; k++) {
    const c = a.cells[k];
    if (typeof c.x !== 'number' || typeof c.y !== 'number' ||
        c.x < 0 || c.x >= W || c.y < 0 || c.y >= H) return false;
    if (k > 0) {
      const p = a.cells[k - 1];
      if (Math.abs(c.x - p.x) + Math.abs(c.y - p.y) !== 1) return false;
    }
  }
  return true;
}

// Number of 90-degree turns in a piece's path.
function bends(a) {
  let b = 0;
  for (let k = 2; k < a.cells.length; k++) {
    const c0 = a.cells[k - 2], c1 = a.cells[k - 1], c2 = a.cells[k];
    if (c1.x - c0.x !== c2.x - c1.x || c1.y - c0.y !== c2.y - c1.y) b++;
  }
  return b;
}

console.log('# genLevel sanity');
[1, 2, 5, 7, 10, 15, 20, 25, 50, 51, 60, 100, 200, 500, 1000].forEach(function (n) {
  const lv = GC.genLevel(n);
  const shapeOk = !!lv && !!lv.arrows && lv.arrows.length >= 4 &&
    lv.cols >= 4 && lv.cols <= GC.MAX_GRID && lv.rows === lv.cols;
  let detail = shapeOk ? JSON.stringify({ cols: lv.cols, pieces: lv.arrows.length }) : 'no board';
  const piecesOk = shapeOk && lv.arrows.every(function (a) { return pieceValid(a, lv.cols, lv.rows); });
  // unique steps + no cell shared by two pieces
  let noOverlap = shapeOk;
  if (shapeOk) {
    const seen = new Int32Array(lv.cols * lv.rows).fill(-1);
    const steps = new Set();
    for (let i = 0; i < lv.arrows.length; i++) {
      if (steps.has(lv.arrows[i].step)) noOverlap = false;
      steps.add(lv.arrows[i].step);
      for (const c of lv.arrows[i].cells) {
        if (seen[c.y * lv.cols + c.x] !== -1) noOverlap = false;
        seen[c.y * lv.cols + c.x] = i;
      }
    }
  }
  const solvable = shapeOk && GC.validateBoardSolution(lv.cols, lv.rows, lv.arrows.slice());
  let hintOk = false;
  if (shapeOk) {
    const occ = occFrom(lv.cols, lv.rows, lv.arrows);
    const h = GC.hintArrow(lv.arrows, occ, lv.cols, lv.rows);
    hintOk = h >= 0 && GC.pieceBlocker(occ, lv.arrows, lv.cols, lv.rows, h) === -1;
  }
  check('level ' + n + ' board valid', shapeOk && piecesOk && noOverlap, detail);
  check('level ' + n + ' solvable', solvable);
  check('level ' + n + ' hint points to a safe piece', hintOk);
});

console.log('# genDailyChallenge determinism');
const d1 = GC.genDailyChallenge(new Date('2026-10-15T00:00:00.000Z'));
const d2 = GC.genDailyChallenge(new Date('2026-10-15T00:00:00.000Z'));
const sameArrows = d1.arrows.length === d2.arrows.length &&
  d1.arrows.every(function (a, i) {
    return a.dir === d2.arrows[i].dir && a.c === d2.arrows[i].c &&
      JSON.stringify(a.cells) === JSON.stringify(d2.arrows[i].cells);
  });
check('daily challenge is deterministic for a given date', sameArrows);
check('daily challenge is solvable',
  GC.validateBoardSolution(d1.cols, d1.rows, d1.arrows.slice()));
check('daily challenge has no bonus objective', d1.bonus === null);

console.log('# calcStars');
check('3 stars (0 wrong, 0 hints)', GC.calcStars(0, 0) === 3);
check('2 stars (<=2 wrong, <=1 hint)',
  GC.calcStars(1, 0) === 2 && GC.calcStars(2, 1) === 2 && GC.calcStars(0, 1) === 2);
check('1 star otherwise',
  GC.calcStars(0, 2) === 1 && GC.calcStars(3, 0) === 1 && GC.calcStars(9, 9) === 1);

console.log('# levelConfig bounds');
let boundsOk = true;
let detail = '';
for (let n = 1; n <= 1000; n += 7) {
  const c = GC.levelConfig(n);
  if (!(c.grid >= 4 && c.grid <= GC.MAX_GRID && c.pieces >= 2 && c.pieces <= 600 &&
        Number.isInteger(c.seed))) {
    boundsOk = false;
    detail = 'level ' + n + ' -> ' + JSON.stringify(c);
    break;
  }
}
check('grid 4-72 / pieces 4-600 / integer seed for all levels', boundsOk, detail);
check('DESIGN_LEVELS is 1000', GC.DESIGN_LEVELS === 1000);

console.log('# difficulty tiers');
check('levels 1-50 map to Easy',
  GC.getDifficultyName(1) === 'Easy' && GC.getDifficultyName(50) === 'Easy');
check('levels 51-200 map to Medium',
  GC.getDifficultyName(51) === 'Medium' && GC.getDifficultyName(200) === 'Medium');
check('levels 201-500 map to Hard',
  GC.getDifficultyName(201) === 'Hard' && GC.getDifficultyName(500) === 'Hard');
check('levels 501-800 map to Expert',
  GC.getDifficultyName(501) === 'Expert' && GC.getDifficultyName(800) === 'Expert');
check('levels 801-1000 map to Master',
  GC.getDifficultyName(801) === 'Master' && GC.getDifficultyName(1000) === 'Master');
check('getDifficultyLevel returns valid tier keys', [1, 60, 300, 600, 900].every(function (n) {
  return ['easy', 'medium', 'hard', 'expert', 'master'].indexOf(GC.getDifficultyLevel(n)) !== -1;
}));

console.log('# layout families');
check('FAMILIES exposes 8 unique layout families',
  Array.isArray(GC.FAMILIES) && GC.FAMILIES.length === 8 &&
  Array.from(new Set(GC.FAMILIES)).length === 8,
  JSON.stringify(GC.FAMILIES));
check('familyOf rotates families by level number',
  typeof GC.familyOf === 'function' &&
  GC.familyOf(1) === 'clusters' && GC.familyOf(2) === 'maze' &&
  GC.familyOf(3) === 'spiral' && GC.familyOf(8) === 'blob');
check('milestone levels use the ring family',
  GC.familyOf(50) === 'ring' && GC.familyOf(100) === 'ring' &&
  GC.genLevel(50).family === 'ring');
let famSet = new Set();
for (let n = 11; n <= 50; n++) famSet.add(GC.genLevel(n).family);
check('all 8 layout families appear across levels 11-50',
  GC.FAMILIES.every(function (f) { return famSet.has(f); }),
  Array.from(famSet).sort().join(','));

console.log('# level determinism');
const r1 = GC.genLevel(37);
const r2 = GC.genLevel(37);
check('level 37 reproduces the identical board on replay',
  r1.cols === r2.cols && r1.family === r2.family &&
  r1.arrows.length === r2.arrows.length &&
  r1.arrows.every(function (a, i) {
    return a.dir === r2.arrows[i].dir && a.c === r2.arrows[i].c &&
      a.step === r2.arrows[i].step &&
      JSON.stringify(a.cells) === JSON.stringify(r2.arrows[i].cells);
  }));

console.log('# winding path quality (levels 1-20)');
// The maze look must be visible from level 1: no single-cell pieces,
// long snaking paths (avg 4+ cells), real board coverage, and multiple
// pieces with 2+ turns at 90-degree corners.
let windingFail = '';
for (let n = 1; n <= 20; n++) {
  const lv = GC.genLevel(n);
  const N = lv.cols * lv.rows;
  let occ = 0;
  lv.arrows.forEach(function (a) { occ += a.cells.length; });
  const minLen = Math.min.apply(null, lv.arrows.map(function (a) { return a.cells.length; }));
  const avgLen = occ / lv.arrows.length;
  const bendPieces = lv.arrows.filter(function (a) { return bends(a) >= 2; }).length;
  if (minLen < 2) { windingFail = 'level ' + n + ' has a single-cell piece'; break; }
  if (lv.arrows.length < 5) { windingFail = 'level ' + n + ' has only ' + lv.arrows.length + ' pieces'; break; }
  if (avgLen < 4) { windingFail = 'level ' + n + ' avg piece length ' + avgLen.toFixed(1); break; }
  if (occ / N < 0.55) { windingFail = 'level ' + n + ' fills only ' + Math.round(occ / N * 100) + '% of the board'; break; }
  if (bendPieces < 2) { windingFail = 'level ' + n + ' has only ' + bendPieces + ' multi-turn pieces'; break; }
}
check('levels 1-20 are dense boards of long multi-turn winding paths', !windingFail, windingFail);

console.log('# arrow directions');
let dirSet = new Set();
for (let n = 1; n <= 20; n++) GC.genLevel(n).arrows.forEach(function (a) { dirSet.add(a.dir); });
check('all four directions appear across early levels',
  [0, 1, 2, 3].every(function (d) { return dirSet.has(d); }),
  Array.from(dirSet).sort().join(','));

console.log('# timed bonus objective');
// Bonus levels are every n % 10 === 5. The bonus piece is the LAST placed
// (highest step), which can always exit immediately, so the objective is
// achievable within the countdown. Non-bonus levels carry no bonus.
[5, 15, 25].forEach(function (n) {
  const lv = GC.genLevel(n);
  const b = lv.bonus;
  const ok = !!b && Number.isInteger(b.idx) && b.idx >= 0 && b.idx < lv.arrows.length &&
    b.coins >= 25 && b.coins <= 60 && b.seconds >= 30 && b.seconds <= 50;
  check('level ' + n + ' carries a valid bonus spec', ok, JSON.stringify(b || null));
  if (ok) {
    const maxStep = Math.max.apply(null, lv.arrows.map(function (a) { return a.step; }));
    const occ = occFrom(lv.cols, lv.rows, lv.arrows);
    check('level ' + n + ' bonus piece is the last placed and exits immediately',
      lv.arrows[b.idx].step === maxStep &&
      GC.pieceBlocker(occ, lv.arrows, lv.cols, lv.rows, b.idx) === -1);
  }
});
check('level 7 carries no bonus objective', GC.genLevel(7).bonus === null);
check('daily challenge carries no bonus objective', GC.genDailyChallenge(new Date('2026-10-15T00:00:00.000Z')).bonus === null);

console.log('# full solvability (reverse-step removal, all 1000 levels)');
// Reverse placement guarantees that removing pieces in DESCENDING step
// order always clears the board: when piece k is removed, exactly the
// pieces placed before it (steps 0..k-1) are still on the board, and
// piece k's exit corridor was verified clear against those at placement
// time. Swept over EVERY designed level 1-1000.
let solveFail = '';
const sweepList = [];
for (let n = 1; n <= 1000; n++) sweepList.push(n);
sweepList.forEach(function (n) {
  const lv = GC.genLevel(n);
  if (!GC.validateBoardSolution(lv.cols, lv.rows, lv.arrows.slice())) {
    if (!solveFail) solveFail = 'validator rejected level ' + n;
  }
  const W = lv.cols, H = lv.rows;
  const occ = occFrom(W, H, lv.arrows);
  const order = lv.arrows.map(function (a, i) { return i; })
    .sort(function (x, y) { return lv.arrows[y].step - lv.arrows[x].step; });
  order.forEach(function (pi) {
    const bi = GC.pieceBlocker(occ, lv.arrows, W, H, pi);
    if (bi !== -1 && !solveFail) {
      solveFail = 'level ' + n + ' piece step ' + lv.arrows[pi].step + ' blocked by step ' + lv.arrows[bi].step;
    }
    lv.arrows[pi].alive = false;
    for (const c of lv.arrows[pi].cells) occ[c.y * W + c.x] = -1;
  });
});
check('every level fully clears by removing pieces in reverse placement order',
  !solveFail, solveFail);

console.log('# storage: save validation, migration and economy');
{
  const storageSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'storage.js'), 'utf8');

  // Minimal localStorage mock (fresh per scenario)
  function mockStore(initial) {
    const data = initial || {};
    return {
      getItem: (k) => (Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null),
      setItem: (k, v) => { data[k] = String(v); },
      removeItem: (k) => { delete data[k]; },
      _dump: () => data
    };
  }

  function loadStorage(store) {
    const sb = { console, localStorage: store, GameCore: GC };
    vm.createContext(sb);
    vm.runInContext(storageSrc + '\n;globalThis.__ST = Storage;', sb, { filename: 'js/storage.js' });
    return sb.__ST;
  }

  // 1. Malformed JSON -> safe fallback to a fresh default save
  {
    const ST = loadStorage(mockStore({ 'arrowOut.v2': '{not valid json' }));
    const s = ST.getSave();
    check('malformed JSON falls back to a fresh save without crashing',
      !!s && s.unlocked === 1 && s.coins === 0 && typeof s.best === 'object');
    check('storage still works after a malformed save', ST.addCoins(5) === 5);
  }

  // 2. v1 -> v2 migration goes through the sanitizer
  {
    const ST = loadStorage(mockStore({
      'arrowOut.v1': JSON.stringify({ v: 1, unlocked: 5, best: { '1': { stars: 2, plays: 3 } }, sound: false })
    }));
    const s = ST.getSave();
    check('v1 save migrates to sanitized v2',
      s.v === 2 && s.unlocked === 5 && s.best['1'].stars === 2 && s.best['1'].plays === 3 &&
      s.sound === false && s.owned.default === true);
  }

  // 3. Corrupt v2 save: every junk field is clamped or reset, no crash
  {
    const corrupt = {
      v: 2, unlocked: 99999, coins: -500, cur: 'junk',
      best: { 'x': { stars: 9, plays: -4 }, '3': { stars: 2, plays: 1 }, '77': 'junk', '9': { stars: 99, plays: 0 } },
      stats: 'junk', skin: 'does-not-exist',
      owned: { default: 0, fake: 'yes' },
      achievements: 'junk',
      daily: { lastDate: 5, completed: 'yes', stars: 99 },
      bonusClaimed: { '5': 1, '15': true },
      streaks: { current: -3, best: 'x', lastPlayDate: 42 },
      loginRewards: { lastClaim: 7, streak: -1 },
      settings: 'junk'
    };
    const ST = loadStorage(mockStore({ 'arrowOut.v2': JSON.stringify(corrupt) }));
    const s = ST.getSave();
    check('negative coins clamped to 0', s.coins === 0);
    check('unlocked clamped to the designed level range', s.unlocked === 1000);
    check('junk best keys dropped, valid keys kept', !!s.best['3'] && s.best['3'].stars === 2 && s.best['3'].plays === 1 && !s.best['x'] && !s.best['77']);
    check('best stars clamped to 0-3', s.best['9'].stars === 3);
    check('non-object board snapshot reset to null', s.cur === null);
    check('junk stats replaced with numeric defaults', typeof s.stats.totalPlays === 'number' && s.stats.totalWins === 0);
    check('unknown skin reset to default', s.skin === 'default');
    check('owned map reduced to true flags and default always owned', s.owned.default === true && !s.owned.fake);
    check('junk achievements field replaced with an object', !!s.achievements && typeof s.achievements === 'object');
    check('daily fields sanitized', s.daily.lastDate === null && s.daily.completed === false && s.daily.stars === 3);
    check('bonusClaimed junk entries dropped, valid kept', s.bonusClaimed['15'] === true && !s.bonusClaimed['5']);
    check('streaks sanitized', s.streaks.current === 0 && s.streaks.best === 0 && s.streaks.lastPlayDate === null);
    check('loginRewards sanitized', s.loginRewards.lastClaim === null && s.loginRewards.streak === 0);
    check('settings defaults restored (notifications off)', s.settings.notifications === false && s.settings.reducedMotion === false);
  }

  // 4. Valid progress is preserved exactly - nothing valid is deleted
  {
    const good = {
      v: 2, unlocked: 42, coins: 500, skin: 'default',
      best: { '7': { stars: 3, plays: 4 } },
      cur: null,
      stats: { totalPlays: 9, totalWins: 9, totalStars: 20, hintsUsed: 2, mistakes: 3 },
      streaks: { current: 6, best: 6, lastPlayDate: '2026-10-15' },
      daily: { lastDate: '2026-10-15', completed: true, stars: 2 },
      loginRewards: { lastClaim: '2026-10-15', streak: 3 },
      settings: { reducedMotion: true, notifications: false, seenOnboarding: true },
      owned: { default: true }, bonusClaimed: { '5': true }, achievements: { 'first-win': true }
    };
    const store = mockStore({ 'arrowOut.v2': JSON.stringify(good) });
    const ST = loadStorage(store);
    const s = ST.getSave();
    check('valid progress fully preserved (coins/level/stars/plays)',
      s.coins === 500 && s.unlocked === 42 && s.best['7'].stars === 3 && s.best['7'].plays === 4);
    check('valid stats/streaks/daily/settings preserved',
      s.stats.totalStars === 20 && s.streaks.best === 6 && s.daily.stars === 2 && s.settings.notifications === false);
    ST.addCoins(1);
    check('persist round-trip keeps data intact', JSON.parse(store._dump()['arrowOut.v2']).coins === 501);
  }

  // 5. Oversized / out-of-range values
  {
    const ST = loadStorage(mockStore({
      'arrowOut.v2': JSON.stringify({ v: 2, coins: 1e15, unlocked: 999999999, theme: 'x'.repeat(5000) })
    }));
    const s = ST.getSave();
    check('oversized numeric values clamped', s.coins <= 1000000 && s.unlocked === 1000);
    check('junk oversized theme falls back to dark', s.theme === 'dark');
  }

  // 6. Economy invariants
  {
    const ST = loadStorage(mockStore({}));
    check('addCoins rejects negative amounts', ST.addCoins(-5) === 0);
    check('addCoins floors fractions', ST.addCoins(3.7) === 3);
    check('addCoins ignores junk types', ST.addCoins('junk') === 3);
    check('spendCoins fails safely when balance is short', ST.spendCoins(10) === false && ST.getSave().coins === 3);
    check('spendCoins(0) succeeds without changing balance', ST.spendCoins(0) === true && ST.getSave().coins === 3);
    check('spendCoins succeeds at exact balance', ST.spendCoins(3) === true && ST.getSave().coins === 0);
    ST.updateLevelBest(5, 2, 1);
    ST.updateLevelBest(5, 1, 1);
    const b5 = ST.getSave().best['5'];
    check('updateLevelBest never downgrades stars but counts plays', b5.stars === 2 && b5.plays === 2);
    check('updateLevelBest counts wins (achievement stat)', ST.getSave().stats.totalWins === 2);
  }

  // 7. Regression: deep-merge into a null slot must not crash
  {
    const ST = loadStorage(mockStore({}));
    ST.updateSave({ cur: { level: 3 } }); // save.cur was null here
    check('updateSave deep-merge tolerates null slots', ST.getSave().cur.level === 3);
  }
}

console.log('# service worker: local notification click validation');
{
  const swSrc = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');

  // Synchronous thenable so the test stays a plain sync script
  const syncThen = (v) => ({
    then: (fn) => { fn(v); return syncThen(v); },
    catch: () => syncThen(v)
  });

  const handlers = {};
  const shown = [];
  const opened = [];
  const ORIGIN = 'https://parya5103.github.io';
  const SCOPE = ORIGIN + '/Fletch_Game/';
  const selfMock = {
    location: { origin: ORIGIN },
    registration: {
      scope: SCOPE,
      showNotification: (title, opts) => { shown.push({ title, opts }); return syncThen(); }
    },
    clients: {
      matchAll: () => syncThen([]),
      openWindow: (u) => { opened.push(u); return syncThen(); }
    },
    addEventListener: (name, fn) => { handlers[name] = fn; },
    skipWaiting: () => {}
  };

  const sb = {
    self: selfMock, URL, console,
    caches: { open: () => Promise.reject(new Error('unused')), keys: () => Promise.resolve([]), match: () => Promise.resolve(null), delete: () => Promise.resolve(true) },
    fetch: () => Promise.reject(new Error('unused')),
    Request: function Request() {}
  };
  vm.createContext(sb);
  vm.runInContext(swSrc, sb, { filename: 'sw.js' });

  check('hardened push handler present alongside the safe local click handler',
    typeof handlers.push === 'function' && typeof handlers.notificationclick === 'function');
  const fireClick = (data) => handlers.notificationclick({
    notification: { close: () => {}, data }, waitUntil: () => {}
  });
  const last = arr => arr[arr.length - 1];

  // push: malformed, non-object and missing payloads never show anything
  const firePush = (jsonFn) => handlers.push({
    data: jsonFn === null ? undefined : { json: jsonFn },
    waitUntil: () => {}
  });
  const shownBefore = shown.length;
  firePush(() => { throw new Error('malformed JSON'); });
  check('push with malformed JSON never crashes and shows nothing', shown.length === shownBefore);
  firePush(() => 'junk');
  check('push with a non-object payload shows nothing', shown.length === shownBefore);
  firePush(null);
  check('push with no data shows nothing', shown.length === shownBefore);
  firePush(() => ({ title: 'A'.repeat(120), body: 'B'.repeat(300), tag: 'T'.repeat(100), icon: 'https://evil.example/icon.png', data: { url: 'https://evil.example/' } }));
  check('oversized/unsafe payload is capped and rewritten',
    last(shown).title.length === 80 && last(shown).opts.body.length === 200 &&
    last(shown).opts.icon === './icons/icon-192.png' && last(shown).opts.tag.length === 64 &&
    last(shown).opts.data.url === null);
  firePush(() => ({ title: 'Hi', body: 'Come back!', tag: 'arrow-out-daily', data: { url: './?daily=1' } }));
  check('valid payload keeps its same-scope click URL', last(shown).opts.data.url === SCOPE + '?daily=1');
  firePush(() => ({ body: 'x' }));
  check('body-only payload falls back to the game title', last(shown).title === 'Arrow Out!');

  // notificationclick: unsafe/missing URLs fall back to the app scope
  fireClick({ url: 'javascript:alert(1)' });
  check('click on javascript: URL opens the safe default (app scope)', last(opened) === SCOPE);
  fireClick({ url: 'https://evil.example/' });
  check('click on cross-origin URL opens the safe default', last(opened) === SCOPE);
  fireClick(undefined);
  check('click with no data opens the safe default without crashing', last(opened) === SCOPE);
  fireClick('junk-string');
  check('click with non-object data opens the safe default', last(opened) === SCOPE);
  fireClick({ url: './?daily=1' });
  check('click with a valid same-origin URL opens it resolved', last(opened) === SCOPE + '?daily=1');

  // Focus-first behavior when a matching window is already open
  const focused = [];
  selfMock.clients.matchAll = () => syncThen([{ url: SCOPE, focus: () => { focused.push(SCOPE); return syncThen(); } }]);
  fireClick({ url: './' });
  check('existing window is focused instead of opening a new one', focused.length === 1 && last(opened) === SCOPE + '?daily=1');
  selfMock.clients.matchAll = () => syncThen([{ url: SCOPE + 'index.html?daily=1', focus: () => { focused.push('current-game'); return syncThen(); } }]);
  fireClick({ url: './' });
  check('reminder focuses an existing index.html puzzle without resetting it', last(focused) === 'current-game');
}

console.log('# skins shop sanity');
{
  const ids = Object.keys(GC.SKINS);
  check('default skin exists and is free', !!GC.SKINS.default && GC.SKINS.default.price === 0);
  check('shop retains 16 legacy skins and adds Lightning', ids.length === 17, 'found ' + ids.length);
  let allOk = true, detail = '';
  for (const id of ids) {
    const s = GC.SKINS[id];
    const good = s &&
      typeof s.name === 'string' && s.name.length > 0 &&
      Number.isInteger(s.price) && s.price >= 0 && s.price <= 100000 &&
      Array.isArray(s.colors) && s.colors.length === 8 &&
      s.colors.every(c => /^#[0-9a-fA-F]{6}$/.test(c));
    if (!good) { allOk = false; detail = id; break; }
  }
  check('every skin has a name, sane price and 8 valid hex colors', allOk, detail);
  check('new skins are flagged for the shop badge', ['aurora', 'lava', 'toxic', 'carnival', 'rainbow'].every(id => GC.SKINS[id] && GC.SKINS[id].isNew === true));
}

if (failures) {
  console.error('\n' + failures + ' check(s) FAILED');
  process.exit(1);
}
console.log('\nAll CI checks passed');
