/**
 * Arrow Out! - v4.2 commercial upgrade verification suite.
 * Run with: node scripts/commercial-test.js
 *
 * Verifies, against the real repository files:
 *  - the eight guardian worlds and their three-act cutscenes (js/story.js)
 *  - the world map chapters staying in sync with the story (js/map.js)
 *  - save migrations for winStreak, chestClaimed, starChestClaimed and
 *    storySeen (js/storage.js)
 *  - the win streak, Sanctuary chest and Royal Star Chest flows (js/main.js)
 *  - the hint double-tap guard and immediate heart persistence (js/main.js)
 *  - the service worker v43 bump with story.js precached (sw.js)
 *  - the PWA module version (js/pwa.js)
 *  - the commercial map and story DOM wiring (index.html)
 */

function makeAssert() {
  if (typeof require === 'function' && typeof process !== 'undefined' && process.versions && process.versions.node) {
    return require('assert');
  }
  return {
    ok: function (v, msg) { if (!v) throw new Error(msg || 'assertion failed'); },
    strictEqual: function (a, b, msg) {
      if (a !== b) throw new Error((msg || 'strictEqual failed') + ': expected ' + b + ', got ' + a);
    }
  };
}

function mockLocalStorage(seed) {
  var data = {};
  if (seed) data['arrowOut.v2'] = JSON.stringify(seed);
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
    setItem: function (k, v) { data[k] = String(v); },
    removeItem: function (k) { delete data[k]; }
  };
}

function evalStorage(src, ls) {
  return new Function('localStorage', 'GameCore', 'console', src + ';return Storage;')(
    ls,
    { COSMETICS: { boards: { default: {} } }, SKINS: { default: {} } },
    console
  );
}

function evalMain(src, e) {
  return new Function('window', 'document', 'Storage', 'Audio', 'Haptics', 'UI', 'Render', 'GameCore', 'Bgfx', 'navigator', 'location', 'performance', 'setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', src + ';return Game;')(
    e.window, e.document, e.Storage, e.Audio, e.Haptics, e.UI, e.Render, e.GameCore, e.Bgfx, e.navigator, e.location, e.performance, e.setTimeout, e.clearTimeout, e.requestAnimationFrame, e.cancelAnimationFrame
  );
}

function oldSaveFixture() {
  return {
    v: 2, unlocked: 1, best: {}, cur: null, sound: true, music: false,
    vibration: true, theme: 'dark', installHidden: false,
    stats: { totalPlays: 0, totalWins: 0, totalStars: 0, hintsUsed: 0, mistakes: 0 },
    achievements: {},
    daily: { lastDate: null, completed: false, stars: 0 },
    coins: 100,
    bonusClaimed: {},
    skin: 'default',
    owned: { default: true },
    boardSkin: 'default',
    ownedBoards: { default: true },
    loginRewards: { lastClaim: null, streak: 0 },
    streaks: { current: 0, best: 0, lastPlayDate: null },
    settings: { reducedMotion: false, notifications: false, reminderMinutes: 90, systemNotifications: false, notificationPrompted: false, seenOnboarding: true }
  };
}

var TEST_BOARD = {
  cols: 3, rows: 3,
  shape: [1, 1, 1, 1, 1, 1, 1, 1, 1],
  bonus: null,
  arrows: [
    { dir: 0, alive: true, cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }] },
    { dir: 0, alive: true, cells: [{ x: 2, y: 0 }, { x: 2, y: 1 }] }
  ]
};

function makeEnv(storageSrc, mainSrc, fixture) {
  var ls = mockLocalStorage(fixture);
  var Storage = evalStorage(storageSrc, ls);
  var PERF = { t: 1000 };
  var LEVEL = { spec: JSON.parse(JSON.stringify(TEST_BOARD)), blocker: -1 };
  var UI = { toasts: [], toast: function (m) { UI.toasts.push(m); }, anyOpen: function () { return false; } };
  var uiNoops = ['init', 'setGameState', 'showScreen', 'showHomeScreen', 'updateHUD', 'updateCombo', 'showLevelBanner', 'updateBonusBanner', 'showStallOffer', 'openDlg', 'closeAll', 'resetAdHint', 'showWinDialog', 'showFailDialog', 'announceNewAchievements', 'updateHintBtn', 'updateSoundBtn', 'updateVibrationBtn', 'updateSettingsStatus', 'updateMusicBtn', 'buildLevelGrid', 'toggleTheme', 'setTheme'];
  for (var u = 0; u < uiNoops.length; u++) UI[uiNoops[u]] = function () {};
  var Audio = { enabled: true };
  var audioNoops = ['unlock', 'ui', 'hint', 'blocked', 'fly', 'win', 'success', 'undo', 'suspend', 'resume', 'startMusic', 'stopMusic', 'error'];
  for (var a = 0; a < audioNoops.length; a++) Audio[audioNoops[a]] = function () {};
  var Haptics = {};
  var hapticNoops = ['checkSupport', 'lightTap', 'mediumTap', 'heavyTap', 'win', 'hint'];
  for (var hh = 0; hh < hapticNoops.length; hh++) Haptics[hapticNoops[hh]] = function () {};
  var Render = { spawnFly: function () { return false; } };
  var renderNoops = ['init', 'setGameState', 'fitCanvas', 'needsRender', 'ensureLoop', 'focusPiece', 'spawnBurst', 'spawnConfetti', 'getView', 'zoomAt', 'resetView', 'screenToCell', 'getCellSize', 'pan', 'setSkin', 'setBoardSkin'];
  for (var r = 0; r < renderNoops.length; r++) Render[renderNoops[r]] = function () {};
  var GameCore = {
    MAX_HEARTS: 3,
    FREE_HINTS: 3,
    SKINS: { default: {} },
    COSMETICS: { boards: { default: {} } },
    genLevel: function () { return JSON.parse(JSON.stringify(LEVEL.spec)); },
    genDailyChallenge: function () { throw new Error('daily challenge not used in this suite'); },
    pieceBlocker: function () { return LEVEL.blocker; },
    hintArrow: function () { return 0; },
    calcStars: function (w, h) { return (w === 0 && h === 0) ? 3 : (w <= 1 ? 2 : 1); },
    validateBoardSolution: function () { return true; }
  };
  var env = {
    window: { matchMedia: function () { return { matches: false }; }, addEventListener: function () {} },
    document: { getElementById: function () { return null; }, addEventListener: function () {}, hidden: false },
    navigator: {},
    location: { search: '', href: 'https://example.test/' },
    performance: { now: function () { return PERF.t; } },
    setTimeout: function () { return 1; },
    clearTimeout: function () {},
    requestAnimationFrame: function () { return 1; },
    cancelAnimationFrame: function () {}
  };
  env.ls = ls;
  env.Storage = Storage;
  env.UI = UI;
  env.PERF = PERF;
  env.LEVEL = LEVEL;
  env.Audio = Audio;
  env.Haptics = Haptics;
  env.Render = Render;
  env.GameCore = GameCore;
  env.Bgfx = { init: function () {} };
  env.Game = evalMain(mainSrc, env);
  return env;
}

function runAll(deps) {
  var assert = makeAssert();
  var results = [];
  function test(name, fn) {
    try { fn(); results.push({ name: name, pass: true, error: null }); }
    catch (e) { results.push({ name: name, pass: false, error: (e && e.message) ? e.message : String(e) }); }
  }
  var Story = deps.Story;
  var MapEngine = deps.MapEngine;

  test('Eight guardian worlds cover levels 1-1000 with contiguous ranges', function () {
    assert.ok(Story, 'story module missing');
    var W = Story.WORLDS;
    assert.strictEqual(W.length, 8, 'world count');
    for (var i = 0; i < W.length; i++) {
      var w = W[i];
      assert.strictEqual(w.id, 'w' + (i + 1), 'world id at index ' + i);
      assert.strictEqual(w.start, i * 125 + 1, 'world start at index ' + i);
      assert.strictEqual(w.end, (i + 1) * 125, 'world end at index ' + i);
      assert.ok(w.guardian && w.title && w.epithet && w.biome, 'world metadata at index ' + i);
      assert.ok(w.palette && w.palette.sky && w.palette.road, 'world palette at index ' + i);
      assert.strictEqual(w.story.length, 3, 'act count at index ' + i);
      for (var k = 0; k < 3; k++) {
        assert.ok(typeof w.story[k] === 'string' && w.story[k].length > 20, 'act text at ' + i + ',' + k);
      }
    }
    for (var lvl = 1; lvl <= 1000; lvl++) {
      assert.strictEqual(Story.worldForLevel(lvl).id, 'w' + (Math.floor((lvl - 1) / 125) + 1), 'worldForLevel at ' + lvl);
    }
  });

  test('Guardian portraits are distinct inline SVGs', function () {
    var seen = {};
    for (var i = 1; i <= 8; i++) {
      var p = Story.portraitFor('w' + i);
      assert.ok(p.indexOf('<svg') === 0, 'portrait w' + i + ' starts with svg tag');
      assert.ok(p.indexOf('viewBox') !== -1, 'portrait w' + i + ' has viewBox');
      assert.ok(p.length > 200, 'portrait w' + i + ' is a real drawing');
      assert.ok(!seen[p], 'portrait w' + i + ' is distinct');
      seen[p] = true;
    }
  });

  test('worldStars counts only stars earned inside the world', function () {
    var save = { best: {} };
    for (var l = 1; l <= 5; l++) save.best[l] = { stars: 3 };
    save.best[200] = { stars: 3 };
    assert.strictEqual(Story.worldStars(save, Story.WORLDS[0]), 15, 'w1 star total');
    assert.strictEqual(Story.worldStars(save, Story.WORLDS[1]), 3, 'w2 star total');
    assert.strictEqual(Story.worldStars(save, Story.WORLDS[7]), 0, 'w8 star total');
    assert.strictEqual(Story.worldStars(null, Story.WORLDS[0]), 0, 'null save');
  });

  test('Royal Star Chest unlocks at 15 stars, once per world', function () {
    var b14 = { best: {} };
    for (var l = 1; l <= 4; l++) b14.best[l] = { stars: 3 };
    b14.best[5] = { stars: 2 };
    var b15 = { best: {} };
    for (var l2 = 1; l2 <= 5; l2++) b15.best[l2] = { stars: 3 };
    assert.ok(!Story.starChestReady(b14, Story.WORLDS[0]), '14 stars is not enough');
    assert.ok(Story.starChestReady(b15, Story.WORLDS[0]), '15 stars unlocks');
    assert.ok(!Story.starChestReady({ best: b15.best, starChestClaimed: { w1: true } }, Story.WORLDS[0]), 'already claimed');
    assert.ok(!Story.starChestReady(null, Story.WORLDS[0]), 'null save');
  });

  test('pendingWorld returns the first unlocked world the player has not seen', function () {
    assert.strictEqual(Story.pendingWorld({ unlocked: 1, storySeen: {} }).id, 'w1', 'fresh player sees w1');
    assert.strictEqual(Story.pendingWorld({ unlocked: 1, storySeen: { w1: true } }), null, 'w1 seen');
    assert.strictEqual(Story.pendingWorld({ unlocked: 130, storySeen: { w1: true } }).id, 'w2', 'w2 reached');
    assert.strictEqual(Story.pendingWorld({ unlocked: 130, storySeen: { w1: true, w2: true } }), null, 'w1 and w2 seen');
    var seenAll = {};
    for (var i = 1; i <= 8; i++) seenAll['w' + i] = true;
    assert.strictEqual(Story.pendingWorld({ unlocked: 1000, storySeen: seenAll }), null, 'everything seen');
    assert.strictEqual(Story.pendingWorld(null), null, 'null save');
  });

  test('markSeen persists through Storage exactly once per world', function () {
    var save = { storySeen: {} };
    var calls = 0;
    var prev = globalThis.Storage;
    globalThis.Storage = { getSave: function () { return save; }, updateSave: function () { calls++; } };
    try {
      assert.ok(!Story.hasSeen(save, 'w1'), 'not seen before');
      Story.markSeen('w1');
      assert.ok(Story.hasSeen(save, 'w1'), 'seen after markSeen');
      Story.markSeen('w1');
      assert.strictEqual(calls, 1, 'updateSave called exactly once');
      assert.strictEqual(save.storySeen.w1, true, 'marker written');
    } finally {
      if (prev === undefined) delete globalThis.Storage;
      else globalThis.Storage = prev;
    }
  });

  test('Map chapters stay in sync with the story worlds', function () {
    assert.ok(MapEngine, 'map module missing');
    var CH = MapEngine.CHAPTERS;
    assert.strictEqual(CH.length, 8, 'chapter count');
    for (var i = 0; i < 8; i++) {
      var w = Story.WORLDS[i];
      var ch = CH[i];
      assert.strictEqual(ch.id, i + 1, 'chapter id at index ' + i);
      assert.strictEqual(ch.name, w.title, 'chapter name at index ' + i);
      assert.strictEqual(ch.guardian, w.guardian, 'chapter guardian at index ' + i);
      assert.strictEqual(ch.biome, w.biome, 'chapter biome at index ' + i);
      assert.strictEqual(ch.startLevel, w.start, 'chapter start at index ' + i);
      assert.strictEqual(ch.endLevel, w.end, 'chapter end at index ' + i);
    }
    assert.strictEqual(MapEngine.zoneNameFor(1000), 'Sovereign Arrow Castle', 'final landmark');
    assert.strictEqual(typeof MapEngine.stopAmbient, 'function', 'ambient stop export');
  });

  test('Old v2 saves auto-fill the commercial keys and keep progress', function () {
    var fx = oldSaveFixture();
    fx.unlocked = 7;
    fx.best['1'] = { stars: 2, plays: 3 };
    var env = makeEnv(deps.storageSrc, deps.mainSrc, fx);
    var s = env.Storage.getSave();
    assert.strictEqual(s.unlocked, 7, 'progress kept');
    assert.strictEqual(s.best['1'].stars, 2, 'best kept');
    assert.strictEqual(s.coins, 100, 'coins kept');
    assert.ok(s.winStreak && s.winStreak.current === 0 && s.winStreak.best === 0, 'winStreak filled');
    assert.ok(s.chestClaimed && typeof s.chestClaimed === 'object', 'chestClaimed filled');
    assert.ok(s.starChestClaimed && typeof s.starChestClaimed === 'object', 'starChestClaimed filled');
    assert.ok(s.storySeen && typeof s.storySeen === 'object', 'storySeen filled');
  });

  test('Junk saves are repaired: winStreak clamped, claim maps filtered', function () {
    var fx = oldSaveFixture();
    fx.winStreak = { current: -5, best: 'x' };
    fx.chestClaimed = { '25': 'yes', '26': true };
    fx.starChestClaimed = { w1: true, w2: 1 };
    fx.storySeen = { w1: 0, w3: true };
    var s = makeEnv(deps.storageSrc, deps.mainSrc, fx).Storage.getSave();
    assert.strictEqual(s.winStreak.current, 0, 'negative streak clamped');
    assert.strictEqual(s.winStreak.best, 0, 'junk best repaired');
    assert.strictEqual(s.chestClaimed['26'], true, 'valid chest marker kept');
    assert.ok(!s.chestClaimed['25'], 'junk chest marker dropped');
    assert.strictEqual(s.starChestClaimed.w1, true, 'valid star chest marker kept');
    assert.ok(!s.starChestClaimed.w2, 'junk star chest marker dropped');
    assert.strictEqual(s.storySeen.w3, true, 'valid story marker kept');
    assert.ok(!s.storySeen.w1, 'junk story marker dropped');
    var fx2 = oldSaveFixture();
    fx2.winStreak = 'junk';
    var s2 = makeEnv(deps.storageSrc, deps.mainSrc, fx2).Storage.getSave();
    assert.ok(s2.winStreak && s2.winStreak.current === 0 && s2.winStreak.best === 0, 'string winStreak reset');
  });

  test('winStreak round-trips through localStorage', function () {
    var env = makeEnv(deps.storageSrc, deps.mainSrc, oldSaveFixture());
    env.Storage.updateSave({ winStreak: { current: 7, best: 9 } });
    var raw = JSON.parse(env.ls.getItem('arrowOut.v2'));
    assert.strictEqual(raw.winStreak.current, 7, 'current persisted');
    assert.strictEqual(raw.winStreak.best, 9, 'best persisted');
  });

  test('A fast hint double-tap never consumes two hints', function () {
    var env = makeEnv(deps.storageSrc, deps.mainSrc, oldSaveFixture());
    env.Game.loadLevel(1);
    env.Game.hint();
    assert.strictEqual(env.Game.getState().hintsUsed, 1, 'first hint granted');
    env.Game.hint();
    assert.strictEqual(env.Game.getState().hintsUsed, 1, 'second tap inside 350ms is ignored');
    env.PERF.t += 400;
    env.Game.hint();
    assert.strictEqual(env.Game.getState().hintsUsed, 2, 'hint after the gap granted');
    assert.strictEqual(env.Storage.getSave().stats.hintsUsed, 2, 'stats persisted');
  });

  test('A blocked tap persists the lost heart immediately', function () {
    var env = makeEnv(deps.storageSrc, deps.mainSrc, oldSaveFixture());
    env.Game.loadLevel(1);
    env.LEVEL.blocker = 1;
    env.Game.tapArrow(0);
    var raw = JSON.parse(env.ls.getItem('arrowOut.v2'));
    assert.ok(raw.cur, 'cur persisted immediately');
    assert.strictEqual(raw.cur.hearts, 2, 'lost heart written');
    assert.strictEqual(raw.cur.alive[0], 1, 'blocked arrow still alive');
  });

  test('A failed level resets the consecutive-win streak', function () {
    var fx = oldSaveFixture();
    fx.winStreak = { current: 5, best: 6 };
    var env = makeEnv(deps.storageSrc, deps.mainSrc, fx);
    env.Game.loadLevel(1);
    env.LEVEL.blocker = 1;
    for (var t = 0; t < 3; t++) {
      env.Game.tapArrow(0);
      env.PERF.t += 400;
    }
    assert.ok(env.Game.getState().failed, 'level failed');
    var s = env.Storage.getSave();
    assert.strictEqual(s.winStreak.current, 0, 'streak reset');
    assert.strictEqual(s.winStreak.best, 6, 'best kept');
    assert.strictEqual(s.cur, null, 'failed level cleared');
  });

  test('Consecutive wins build the streak and its best', function () {
    var env = makeEnv(deps.storageSrc, deps.mainSrc, oldSaveFixture());
    env.Game.loadLevel(1);
    env.Game.tapArrow(0);
    env.Game.tapArrow(1);
    var s = env.Storage.getSave();
    assert.strictEqual(s.winStreak.current, 1, 'streak after first win');
    assert.strictEqual(s.winStreak.best, 1, 'best after first win');
    assert.strictEqual(s.coins, 130, 'win coins');
    assert.strictEqual(s.unlocked, 2, 'level 2 unlocked');
    env.Game.loadLevel(1);
    env.Game.tapArrow(0);
    env.Game.tapArrow(1);
    var s2 = env.Storage.getSave();
    assert.strictEqual(s2.winStreak.current, 2, 'streak after second win');
    assert.strictEqual(s2.winStreak.best, 2, 'best after second win');
    assert.strictEqual(s2.coins, 160, 'second win coins');
  });

  test('Sanctuary chests on boss levels are granted exactly once', function () {
    var env = makeEnv(deps.storageSrc, deps.mainSrc, oldSaveFixture());
    env.Game.loadLevel(25);
    env.Game.tapArrow(0);
    env.Game.tapArrow(1);
    var s = env.Storage.getSave();
    assert.strictEqual(s.chestClaimed['25'], true, 'boss chest marked');
    assert.strictEqual(s.coins, 180, 'win plus chest coins');
    env.Game.loadLevel(25);
    env.Game.tapArrow(0);
    env.Game.tapArrow(1);
    var s2 = env.Storage.getSave();
    assert.strictEqual(s2.coins, 210, 'replay grants no second chest');
    var chestToasts = 0;
    for (var i = 0; i < env.UI.toasts.length; i++) {
      if (env.UI.toasts[i].indexOf('Sanctuary') !== -1) chestToasts++;
    }
    assert.strictEqual(chestToasts, 1, 'exactly one chest toast');
  });

  test('The Royal Star Chest claim is guarded and one-time', function () {
    var env = makeEnv(deps.storageSrc, deps.mainSrc, oldSaveFixture());
    env.Game.loadLevel(1);
    assert.strictEqual(env.Game.claimStarChest(1), false, 'locked without stars');
    var asked = false;
    for (var i = 0; i < env.UI.toasts.length; i++) {
      if (env.UI.toasts[i].indexOf('Earn 15 stars') !== -1) asked = true;
    }
    assert.ok(asked, 'requirement toast shown');
    var s = env.Storage.getSave();
    s.best = {};
    for (var l = 1; l <= 5; l++) s.best[l] = { stars: 3 };
    assert.strictEqual(env.Game.claimStarChest(1), true, 'claim at 15 stars');
    assert.strictEqual(env.Storage.getSave().coins, 200, 'reward coins');
    assert.strictEqual(env.Storage.getSave().starChestClaimed.w1, true, 'claim marked');
    assert.strictEqual(env.Game.claimStarChest(1), false, 'one-time claim');
    assert.strictEqual(env.Storage.getSave().coins, 200, 'no double reward');
    assert.strictEqual(env.Game.claimStarChest(0), false, 'chapter 0 rejected');
    assert.strictEqual(env.Game.claimStarChest(9), false, 'chapter 9 rejected');
    assert.strictEqual(env.Game.claimStarChest('w2'), false, 'string id rejected');
    assert.strictEqual(env.Game.claimStarChest(NaN), false, 'NaN rejected');
  });

  test('Service worker bumped to arrow-out-v43 with story.js precached', function () {
    assert.ok(deps.swSrc.indexOf('arrow-out-v43') !== -1, 'v43 cache name present');
    assert.strictEqual(deps.swSrc.indexOf('arrow-out-v42'), -1, 'v42 cache name gone');
    assert.ok(deps.swSrc.indexOf("'./js/story.js'") !== -1, 'story.js precached');
    assert.ok(deps.swSrc.indexOf("'./js/map.js'") !== -1, 'map.js precached');
  });

  test('PWA module reports v43', function () {
    assert.ok(deps.pwaSrc.indexOf("'v43'") !== -1, 'v43 reported');
    assert.strictEqual(deps.pwaSrc.indexOf("'v42'"), -1, 'v42 gone');
  });

  test('index.html wires the commercial map and story DOM', function () {
    var ids = ['map-guardian', 'map-worlds', 'map-ambient-canvas', 'map-avatar', 'map-continue', 'map-story', 'map-chest', 'dlg-story', 'story-continue', 'story-skip'];
    for (var i = 0; i < ids.length; i++) {
      assert.ok(deps.indexSrc.indexOf('id="' + ids[i] + '"') !== -1, 'missing id ' + ids[i]);
    }
    assert.ok(deps.indexSrc.indexOf('js/story.js') < deps.indexSrc.indexOf('js/map.js'), 'story.js loads before map.js');
  });

  var passed = 0;
  var failures = [];
  for (var f = 0; f < results.length; f++) {
    if (results[f].pass) passed++;
    else failures.push(results[f]);
  }
  return { total: results.length, passed: passed, failures: failures };
}

if (typeof require === 'function' && typeof module !== 'undefined' && typeof process !== 'undefined' && process.versions && process.versions.node) {
  (function () {
    var path = require('path');
    var fs = require('fs');
    require(path.join(__dirname, '..', 'js', 'story.js'));
    require(path.join(__dirname, '..', 'js', 'map.js'));
    function read(rel) { return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8'); }
    var deps = {
      storageSrc: read('js/storage.js'),
      mainSrc: read('js/main.js'),
      swSrc: read('sw.js'),
      pwaSrc: read('js/pwa.js'),
      indexSrc: read('index.html'),
      Story: globalThis.ArrowOutStory,
      MapEngine: globalThis.ArrowOutMap
    };
    var res = runAll(deps);
    for (var i = 0; i < res.failures.length; i++) {
      console.log('[FAIL] ' + res.failures[i].name + ' -> ' + res.failures[i].error);
    }
    console.log('[commercial] ' + res.passed + '/' + res.total + ' commercial tests passed');
    if (res.failures.length > 0) process.exit(1);
  })();
}
