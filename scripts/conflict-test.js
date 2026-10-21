/**
 * Arrow Out! - Cross-tab save conflict tests (P0, v4.3)
 * Run with: node scripts/conflict-test.js
 *
 * Every "tab" is an independent vm context running the real game + storage
 * modules against one SHARED localStorage data object - exactly the
 * situation of two browser tabs open on the same static GitHub Pages
 * game. The save format stays 'arrowOut.v2'; the only addition is a
 * numeric `rev` watermark used to detect foreign writes.
 *
 * Merge policy under test (js/storage.js):
 *   - progress: max/union everywhere (unlocked, coins, stats, streaks,
 *     best-per-level, claim maps, ownership)
 *   - daily/login: later date wins, same date unions results
 *   - preferences: baseline-diff rule (whoever changed it wins)
 *   - an in-progress board (cur) in the saving tab is never replaced
 */
'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const vm = require('node:vm');
const { source } = require('./qa-harness');

function makeTabs(n, initial) {
  const data = { ...(initial || {}) };
  const fail = { read: false, write: false };
  const store = {
    getItem(k) { if (fail.read) throw Error('storage unavailable'); return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
    setItem(k, v) { if (fail.write) throw Error('quota exceeded'); data[k] = String(v); },
    removeItem(k) { delete data[k]; }
  };
  const tabs = [];
  for (let i = 0; i < n; i++) {
    const box = vm.createContext({
      Math, Date, Number, Set, JSON,
      console: { log() {}, warn() {}, error() {} },
      localStorage: store, GameCore: undefined
    });
    vm.runInContext(source('js/game.js') + '\nglobalThis.GameCore = GameCore;', box);
    vm.runInContext(source('js/storage.js') + '\nglobalThis.ST = Storage;', box);
    tabs.push(box.ST);
  }
  return { tabs, data, store, fail };
}

const disk = data => (data['arrowOut.v2'] ? JSON.parse(data['arrowOut.v2']) : null);
const at = (save, n) => save.best[String(n)];

test('two tabs load the same save and both see identical progress', () => {
  const base = { v: 2, unlocked: 40, coins: 500, best: { '7': { stars: 3, plays: 2 } } };
  const { tabs } = makeTabs(2, { 'arrowOut.v2': JSON.stringify(base) });
  for (const ST of tabs) {
    const s = ST.getSave();
    assert.equal(s.unlocked, 40);
    assert.equal(s.coins, 500);
    assert.equal(s.best['7'].stars, 3);
    assert.equal(s.best['7'].plays, 2);
    assert.equal(s.rev, 0, 'old saves are normalized to revision 0');
  }
});

test('a stale tab cannot roll back newer progress written by another tab', () => {
  const { tabs, data } = makeTabs(2, { 'arrowOut.v2': JSON.stringify({ v: 2, unlocked: 10, coins: 100 }) });
  const [a, b] = tabs;
  // Tab A (the active one) beats levels and earns coins
  a.updateLevelBest(10, 3, 1);
  a.updateSave({ unlocked: 11 });
  a.addCoins(250);
  assert.equal(disk(data).unlocked, 11);
  // Tab B still holds its boot snapshot (unlocked 10, coins 100) and saves
  b.updateSave({ unlocked: 10 });
  const d = disk(data);
  assert.equal(d.unlocked, 11, 'newer unlocked level must survive the stale write');
  assert.equal(d.coins, 350, 'earned coins must survive the stale write');
  assert.equal(at(d, 10).stars, 3, 'stars earned in another tab must survive');
  // And the stale tab itself now sees the merged truth
  assert.equal(b.getSave().unlocked, 11);
});

test('near-simultaneous writes from two tabs keep the better result and every win', () => {
  const { tabs, data } = makeTabs(2, { 'arrowOut.v2': JSON.stringify({ v: 2, unlocked: 5, coins: 0 }) });
  const [a, b] = tabs;
  a.updateLevelBest(5, 2, 1);  // tab A clears level 5 with 2 stars
  b.updateLevelBest(5, 3, 1);  // tab B clears level 5 with 3 stars almost at once
  b.updateLevelBest(6, 1, 1);  // tab B also clears level 6
  const d = disk(data);
  assert.equal(at(d, 5).stars, 3, 'the better result per level wins');
  assert.equal(at(d, 6).stars, 1, 'progress from both tabs is kept');
  assert.equal(d.stats.totalWins, 2, 'no win is lost');
});

test('refresh/reload and normal single-tab gameplay keep working exactly as before', () => {
  const { tabs, data } = makeTabs(1);
  const ST = tabs[0];
  ST.updateSave({ unlocked: 3 });
  ST.addCoins(75);
  const first = disk(data);
  assert.ok(first.rev >= 1, 'writes carry a revision watermark');
  // "Reload": a brand-new tab reads exactly what the first tab wrote
  const re = makeTabs(1, data);
  const s2 = re.tabs[0].getSave();
  assert.equal(s2.unlocked, 3);
  assert.equal(s2.coins, 75);
  re.tabs[0].spendCoins(25);
  const after = disk(re.data);
  assert.equal(after.coins, 50);
  assert.ok(after.rev > first.rev, 'revision grows monotonically per write');
});

test('storage unavailable: boot and gameplay do not crash; persist reports failure honestly', () => {
  const { tabs, fail } = makeTabs(1);
  fail.read = true; fail.write = true;
  const ST = tabs[0];
  assert.equal(ST.getSave().unlocked, 1, 'fresh default save, no crash');
  assert.equal(ST.persist(), false, 'failure must not be reported as success');
  assert.equal(ST.isStorageOk(), false);
  assert.equal(ST.addCoins(50), 50, 'in-memory balance still works');
  assert.equal(ST.isStorageOk(), false, 'no false recovery without a real write');
});

test('quota failure keeps the last good save on disk and recovers on the next write', () => {
  const { tabs, data, fail } = makeTabs(1, { 'arrowOut.v2': JSON.stringify({ v: 2, coins: 3000 }) });
  const ST = tabs[0];
  assert.equal(ST.cosmeticAction('arrows', 'ice', true), 'purchased');
  const good = disk(data);
  fail.write = true;
  assert.equal(ST.addCoins(10), 1010, 'balance moves in memory');
  assert.equal(disk(data).coins, good.coins, 'disk keeps the last good save');
  assert.equal(ST.isStorageOk(), false, 'quota failure is visible');
  fail.write = false;
  assert.equal(ST.persist(), true);
  assert.equal(ST.isStorageOk(), true, 'a later successful write recovers the warning state');
  assert.equal(disk(data).coins, 1010, 'nothing was lost across the failure');
});

test('malformed on-disk data never blocks writes and is repaired by the next save', () => {
  const { tabs, data } = makeTabs(2, { 'arrowOut.v2': '{corrupt' });
  const [a, b] = tabs;
  assert.equal(a.getSave().unlocked, 1, 'corrupt save falls back to defaults (existing behavior)');
  a.updateSave({ unlocked: 2 });
  const d1 = disk(data);
  assert.equal(d1.unlocked, 2, 'the corrupt key is repaired by the first write');
  // The second tab (booted on the corrupt key) merges instead of clobbering
  b.updateSave({ unlocked: 1 });
  assert.equal(disk(data).unlocked, 2);
  assert.ok(disk(data).best !== undefined);
});

test('hostile or junk remote fields are sanitized during the merge, never copied', () => {
  const { tabs, data } = makeTabs(1, { 'arrowOut.v2': JSON.stringify({ v: 2, unlocked: 9, coins: 20 }) });
  const ST = tabs[0];
  // a foreign "write" full of junk alongside one real piece of progress
  data['arrowOut.v2'] = JSON.stringify({
    v: 2, unlocked: 12, coins: -50,
    best: { '0': { stars: 9, plays: -1 }, '5': { stars: 2 } },
    bonusClaimed: { '5': 'yes' }, stats: 'junk'
  });
  ST.updateSave({ unlocked: 10 });
  const d = disk(data);
  assert.equal(d.unlocked, 12, 'real remote progress is kept');
  assert.equal(d.coins, 20, 'local coins kept; negative remote clamped away');
  assert.equal(d.best['0'], undefined, 'invalid level keys dropped');
  assert.equal(d.best['5'].stars, 2, 'valid remote best kept');
  assert.equal(d.bonusClaimed['5'], undefined, 'junk claim values dropped');
  assert.equal(d.stats.totalWins, 0, 'junk stats repaired, not copied');
});

test('resetAll overwrites the shared save immediately (a reset must win)', () => {
  const { tabs, data } = makeTabs(1, { 'arrowOut.v2': JSON.stringify({ v: 2, unlocked: 400, coins: 900 }) });
  tabs[0].resetAll();
  const d = disk(data);
  assert.equal(d.unlocked, 1);
  assert.equal(d.coins, 0);
  assert.equal(d.best['7'], undefined);
  // a fresh tab boots into the reset save
  const re = makeTabs(1, data);
  assert.equal(re.tabs[0].getSave().unlocked, 1);
});

test('v1 migration still runs once and the migrated save carries a revision', () => {
  const v1 = { v: 1, unlocked: 5, best: { '1': { stars: 2, plays: 3 } }, sound: false };
  const { tabs, data } = makeTabs(1, { 'arrowOut.v1': JSON.stringify(v1) });
  const ST = tabs[0];
  const s = ST.getSave();
  assert.equal(s.v, 2);
  assert.equal(s.unlocked, 5);
  assert.equal(s.best['1'].stars, 2);
  assert.ok(s.rev >= 1, 'the migrated write bumped the revision');
  assert.equal(data['arrowOut.v1'], undefined, 'legacy key removed after the durable write');
  // a second tab sees the migrated v2 save, not the v1 backup
  const re = makeTabs(1, data);
  assert.equal(re.tabs[0].getSave().unlocked, 5);
  assert.equal(re.tabs[0].getSave().best['1'].plays, 3);
});

test('a one-time claim in one tab is never paid again in another tab (claimOnce)', () => {
  const { tabs, data } = makeTabs(2, { 'arrowOut.v2': JSON.stringify({ v: 2, coins: 0 }) });
  const [a, b] = tabs;
  assert.equal(a.claimOnce('bonusClaimed', 5), true, 'first tab claims and persists');
  assert.equal(b.claimOnce('bonusClaimed', 5), false, 'stale second tab: already claimed');
  assert.equal(b.claimOnce('bonusClaimed', 'daily'), true, 'a different key still claims');
  const d = disk(data);
  assert.equal(d.bonusClaimed['5'], true);
  assert.equal(d.bonusClaimed.daily, true);
  assert.equal(d.coins, 0, 'claims are markers; coins are granted by the caller');
});

test('daily challenge results from two tabs merge without losing either run', () => {
  const day = '2026-10-21';
  const { tabs, data } = makeTabs(2, { 'arrowOut.v2': JSON.stringify({ v: 2, coins: 0 }) });
  const [a, b] = tabs;
  a.updateDailyChallenge(new Date(day + 'T10:00:00Z'), 2); // tab A: 2 stars
  b.updateDailyChallenge(new Date(day + 'T18:00:00Z'), 3); // tab B, later: 3 stars
  const d = disk(data);
  assert.equal(d.daily.lastDate, day);
  assert.equal(d.daily.completed, true);
  assert.equal(d.daily.stars, 3, 'the better run is kept');
});

test('achievement markers from two tabs union - none are lost', () => {
  const { tabs, data } = makeTabs(2, { 'arrowOut.v2': JSON.stringify({ v: 2 }) });
  const [a, b] = tabs;
  a.updateSave({ achievements: { 'first-win': true } });
  b.updateSave({ achievements: { 'star-collector': true } });
  const d = disk(data);
  assert.equal(d.achievements['first-win'], true);
  assert.equal(d.achievements['star-collector'], true);
});

test('preference changes from another tab are adopted; local changes to untouched prefs survive', () => {
  const { tabs, data } = makeTabs(2, { 'arrowOut.v2': JSON.stringify({ v: 2, sound: true }) });
  const [a, b] = tabs;
  // the other tab turns sound off (differs from the shared baseline)
  a.updateSave({ sound: false });
  // this tab never touched sound: the merge adopts the remote change
  b.persist();
  assert.equal(b.getSave().sound, false);
  assert.equal(disk(data).sound, false);
  // this tab now changes music; the remote did not: the local change survives
  b.updateSave({ music: true });
  assert.equal(disk(data).music, true);
});

test('an in-progress board in the saving tab is never replaced by a merge', () => {
  const { tabs, data } = makeTabs(2, { 'arrowOut.v2': JSON.stringify({ v: 2, unlocked: 4 }) });
  const [a, b] = tabs;
  a.updateSave({ cur: { level: 4, cols: 7, rows: 7 } }); // tab A is mid-level
  b.updateSave({ unlocked: 5 });                          // tab B just beat level 4
  const d = disk(data);
  assert.equal(d.unlocked, 5, 'the other tab progress is kept');
  assert.ok(d.cur && d.cur.level === 4, 'the in-progress board survives the merge');
});

test('a save written by an older build (no rev field) is merged, never blindly overwritten', () => {
  const { tabs, data } = makeTabs(1, { 'arrowOut.v2': JSON.stringify({ v: 2, unlocked: 6, coins: 10 }) });
  const ST = tabs[0];
  // an old build (before rev existed) writes newer progress without a rev
  data['arrowOut.v2'] = JSON.stringify({ v: 2, unlocked: 8, coins: 500, best: { '8': { stars: 3, plays: 1 } } });
  ST.persist();
  const d = disk(data);
  assert.equal(d.unlocked, 8, 'the old build progress is kept');
  assert.equal(d.coins, 500);
  assert.equal(d.best['8'].stars, 3);
  assert.ok(d.rev >= 1, 'and the key is re-stamped with a revision watermark');
});

test('cosmetics bought in another tab survive a stale tab saving', () => {
  const { tabs, data } = makeTabs(2, { 'arrowOut.v2': JSON.stringify({ v: 2, coins: 4000 }) });
  const [a, b] = tabs;
  assert.equal(a.cosmeticAction('arrows', 'candy', true), 'purchased');
  assert.equal(a.cosmeticAction('boards', 'ice', true), 'purchased');
  // the stale tab (booted before those purchases) spends from its old snapshot
  b.spendCoins(500);
  const d = disk(data);
  assert.equal(d.owned.candy, true, 'purchase survives the stale write');
  assert.equal(d.ownedBoards.ice, true);
  assert.equal(d.skin, 'candy', 'equipped skin survives');
  assert.equal(d.boardSkin, 'ice', 'equipped board skin survives');
  assert.equal(d.coins, 3500, 'no earned coins lost to the merge (max rule)');
});
