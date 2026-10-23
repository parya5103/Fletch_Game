/**
 * Arrow Out! - Storage Module
 * Handles all data persistence, save migration, and versioning
 */
'use strict';

const Storage = (function() {
  const SAVE_KEY = 'arrowOut.v2';
  const OLD_SAVE_KEY = 'arrowOut.v1';
  const DESIGN_LEVELS = 1000;

  // Default save data structure
  function defaultSave() {
    return {
      v: 2,
      rev: 0,
      unlocked: 1,
      best: {},
      cur: null,
      sound: true,
      music: false,
      vibration: true,
      theme: 'dark',
      installHidden: false,
      stats: {
        totalPlays: 0,
        totalWins: 0,
        totalStars: 0,
        hintsUsed: 0,
        mistakes: 0
      },
      achievements: {},
      daily: {
        lastDate: null,
        completed: false,
        stars: 0
      },
      coins: 0,
      bonusClaimed: {},
      winStreak: { current: 0, best: 0 },
      chestClaimed: {},
      starChestClaimed: {},
      storySeen: {},
      skin: 'default',
      owned: { default: true },
      boardSkin: 'default',
      ownedBoards: { default: true },
      loginRewards: {
        lastClaim: null,
        streak: 0
      },
      streaks: {
        current: 0,
        best: 0,
        lastPlayDate: null
      },
      settings: {
        reducedMotion: false,
        notifications: false,
        reminderMinutes: 90,
        systemNotifications: false,
        notificationPrompted: false,
        pushReminders: false,
        seenOnboarding: false
      }
    };
  }

  var save = defaultSave();
  var storageOk = true;
  // Cross-tab conflict tracking (P0): the exact raw save string and the
  // revision this tab last observed in localStorage, plus a snapshot of
  // the user-facing preferences as this tab loaded them.
  var lastSyncedRaw = null;
  var lastSyncedRev = 0;
  var prefBaseline = null;

  // Initialize storage
  function readSave(key) {
    var raw;
    try { raw = localStorage.getItem(key); }
    catch (e) { storageOk = false; return null; }
    if (!raw) return null;
    try { return JSON.parse(raw); }
    catch (e) { return null; } // damaged v2 must not hide a valid v1 backup
  }

  function init() {
    try { lastSyncedRaw = localStorage.getItem(SAVE_KEY); } catch (e) {}
    var d = readSave(SAVE_KEY);
    if (d && d.v === 2) {
      save = normalizeSave(d);
      lastSyncedRev = save.rev || 0;
      capturePrefBaseline();
      return;
    }
    var old = readSave(OLD_SAVE_KEY);
    if (old && old.v === 1) {
      save = normalizeSave(migrateFromV1(old));
      capturePrefBaseline();
      // Keep the legacy backup until its replacement is durably written.
      if (persist()) {
        try { localStorage.removeItem(OLD_SAVE_KEY); } catch (e) {}
      }
      return;
    }
    capturePrefBaseline();
  }

  // Migrate from v1 to v2
  function migrateFromV1(old) {
    var newSave = defaultSave();
    
    // Migrate basic progress
    newSave.unlocked = toInt(old.unlocked, 1, DESIGN_LEVELS, 1);
    newSave.best = old.best && typeof old.best === 'object' && !Array.isArray(old.best) ? old.best : {};
    
    // Migrate current game state
    newSave.cur = old.cur || null;
    
    // Migrate settings
    newSave.sound = old.sound !== false;
    newSave.installHidden = old.installHidden || false;
    
    // Handle old perfect flag
    if (old.perfect) {
      for (var pk in old.perfect) {
        if (/^[1-9][0-9]*$/.test(pk) && Number(pk) <= DESIGN_LEVELS && !newSave.best[pk]) {
          newSave.best[pk] = { stars: 3, plays: 1 };
        }
      }
    }
    
    newSave = sanitizeSave(newSave);

    // Calculate stats from migrated data
    var levels = 0, stars = 0, plays = 0;
    for (var k in newSave.best) {
      var b = newSave.best[k];
      if (b && b.stars) {
        levels++;
        stars += b.stars;
        plays += (b.plays || 0);
      }
    }
    newSave.stats = {
      totalPlays: plays,
      totalWins: levels,
      totalStars: stars,
      hintsUsed: 0,
      mistakes: 0
    };
    
    return newSave;
  }

  // --- Save sanitation (security/robustness pass) ---
  // localStorage is client-side storage: a user CAN edit their own coins,
  // progress or stats. This pass does NOT make the save cheat-proof; it
  // only protects the game from crashing or misbehaving on malformed,
  // outdated or hand-edited data. Valid progress is never deleted; bad
  // values are clamped or reset to safe defaults.
  function toInt(v, min, max, dflt) {
    var n = (typeof v === 'number' || typeof v === 'string') ? Math.floor(Number(v)) : dflt;
    if (!isFinite(n)) n = dflt;
    return Math.max(min, Math.min(max, n));
  }

  function toBool(v, dflt) {
    return typeof v === 'boolean' ? v : dflt;
  }

  function toDateString(v) {
    return (v === null || typeof v === 'string') ? v : null;
  }

  function sanitizeSave(d) {
    d.v = 2;
    // Revision counter for cross-tab conflict detection (P0). Older saves
    // without it are treated as revision 0 and get one on the next write.
    d.rev = Math.max(0, toInt(d.rev, 0, 1000000000, 0));
    d.unlocked = toInt(d.unlocked, 1, DESIGN_LEVELS, 1);
    d.coins = Math.max(0, toInt(d.coins, 0, 1000000, 0));

    d.sound = toBool(d.sound, true);
    d.music = toBool(d.music, false);
    d.vibration = toBool(d.vibration, true);
    d.installHidden = toBool(d.installHidden, false);
    d.theme = (d.theme === 'light') ? 'light' : 'dark';

    // best: keep only entries keyed by a real level number with a sane
    // { stars, plays } shape. Junk keys are dropped; valid keys are clamped.
    if (!d.best || typeof d.best !== 'object' || Array.isArray(d.best)) d.best = {};
    var best = {};
    for (var bk in d.best) {
      if (!Object.prototype.hasOwnProperty.call(d.best, bk)) continue;
      var b = d.best[bk];
      if (b && typeof b === 'object' && !Array.isArray(b)) {
        var lv = Math.floor(Number(bk));
        if (isFinite(lv) && lv >= 1 && lv <= DESIGN_LEVELS && !Object.prototype.hasOwnProperty.call(best, String(lv))) {
          best[String(lv)] = {
            stars: toInt(b.stars, 0, 3, 0),
            plays: toInt(b.plays, 0, 1000000, 0)
          };
        }
      }
    }
    d.best = best;

    // The saved board snapshot must be a plain object or null;
    // tryRestore() validates its contents in depth before use.
    d.cur = (d.cur && typeof d.cur === 'object' && !Array.isArray(d.cur)) ? d.cur : null;

    if (!d.stats || typeof d.stats !== 'object' || Array.isArray(d.stats)) d.stats = defaultSave().stats;
    d.stats.totalPlays = Math.max(0, toInt(d.stats.totalPlays, 0, 10000000, 0));
    d.stats.totalWins = Math.max(0, toInt(d.stats.totalWins, 0, 10000000, 0));
    d.stats.totalStars = Math.max(0, toInt(d.stats.totalStars, 0, 10000000, 0));
    d.stats.hintsUsed = Math.max(0, toInt(d.stats.hintsUsed, 0, 10000000, 0));
    d.stats.mistakes = Math.max(0, toInt(d.stats.mistakes, 0, 10000000, 0));

    // achievements just records which achievement toasts were already shown
    if (!d.achievements || typeof d.achievements !== 'object' || Array.isArray(d.achievements)) d.achievements = {};

    if (!d.daily || typeof d.daily !== 'object' || Array.isArray(d.daily)) d.daily = defaultSave().daily;
    d.daily.lastDate = toDateString(d.daily.lastDate);
    d.daily.completed = toBool(d.daily.completed, false);
    d.daily.stars = toInt(d.daily.stars, 0, 3, 0);

    // bonusClaimed: map of levelKey -> true; drop non-boolean junk entries
    if (!d.bonusClaimed || typeof d.bonusClaimed !== 'object' || Array.isArray(d.bonusClaimed)) d.bonusClaimed = {};
    for (var ck in d.bonusClaimed) {
      if (Object.prototype.hasOwnProperty.call(d.bonusClaimed, ck) && d.bonusClaimed[ck] !== true) delete d.bonusClaimed[ck];
    }

    // winStreak: consecutive campaign wins (reset on fail), never negative
    if (!d.winStreak || typeof d.winStreak !== 'object' || Array.isArray(d.winStreak)) d.winStreak = defaultSave().winStreak;
    d.winStreak.current = Math.max(0, toInt(d.winStreak.current, 0, 100000, 0));
    d.winStreak.best = Math.max(0, toInt(d.winStreak.best, 0, 100000, 0));

    // claim maps keep only === true values, like bonusClaimed
    if (!d.chestClaimed || typeof d.chestClaimed !== 'object' || Array.isArray(d.chestClaimed)) d.chestClaimed = {};
    for (var hcK in d.chestClaimed) {
      if (Object.prototype.hasOwnProperty.call(d.chestClaimed, hcK) && d.chestClaimed[hcK] !== true) delete d.chestClaimed[hcK];
    }
    if (!d.starChestClaimed || typeof d.starChestClaimed !== 'object' || Array.isArray(d.starChestClaimed)) d.starChestClaimed = {};
    for (var scK in d.starChestClaimed) {
      if (Object.prototype.hasOwnProperty.call(d.starChestClaimed, scK) && d.starChestClaimed[scK] !== true) delete d.starChestClaimed[scK];
    }
    if (!d.storySeen || typeof d.storySeen !== 'object' || Array.isArray(d.storySeen)) d.storySeen = {};
    for (var ssK in d.storySeen) {
      if (Object.prototype.hasOwnProperty.call(d.storySeen, ssK) && d.storySeen[ssK] !== true) delete d.storySeen[ssK];
    }

    // owned skins: map of skinId -> true; the default skin is always owned
    if (!d.owned || typeof d.owned !== 'object' || Array.isArray(d.owned)) d.owned = {};
    for (var ok in d.owned) {
      if (Object.prototype.hasOwnProperty.call(d.owned, ok) && d.owned[ok] !== true) delete d.owned[ok];
    }
    d.owned.default = true;
    if (!d.ownedBoards || typeof d.ownedBoards !== 'object' || Array.isArray(d.ownedBoards)) d.ownedBoards = {};
    Object.keys(d.ownedBoards).forEach(function(id) { if (d.ownedBoards[id] !== true) delete d.ownedBoards[id]; });
    d.ownedBoards.default = true;
    if (typeof d.boardSkin !== 'string' || !Object.prototype.hasOwnProperty.call(GameCore.COSMETICS.boards, d.boardSkin) ||
        d.ownedBoards[d.boardSkin] !== true) d.boardSkin = 'default';

    if (!d.loginRewards || typeof d.loginRewards !== 'object' || Array.isArray(d.loginRewards)) d.loginRewards = defaultSave().loginRewards;
    d.loginRewards.lastClaim = toDateString(d.loginRewards.lastClaim);
    d.loginRewards.streak = Math.max(0, toInt(d.loginRewards.streak, 0, 100000, 0));

    if (!d.streaks || typeof d.streaks !== 'object' || Array.isArray(d.streaks)) d.streaks = defaultSave().streaks;
    d.streaks.current = Math.max(0, toInt(d.streaks.current, 0, 100000, 0));
    d.streaks.best = Math.max(0, toInt(d.streaks.best, 0, 100000, 0));
    d.streaks.lastPlayDate = toDateString(d.streaks.lastPlayDate);

    if (!d.settings || typeof d.settings !== 'object' || Array.isArray(d.settings)) d.settings = defaultSave().settings;
    d.settings.reducedMotion = toBool(d.settings.reducedMotion, false);
    d.settings.notifications = toBool(d.settings.notifications, false);
    d.settings.reminderMinutes = [60, 90, 120].includes(d.settings.reminderMinutes) ? d.settings.reminderMinutes : 90;
    d.settings.systemNotifications = toBool(d.settings.systemNotifications, false);
    d.settings.notificationPrompted = toBool(d.settings.notificationPrompted, false);
    d.settings.pushReminders = toBool(d.settings.pushReminders, false);
    d.settings.seenOnboarding = toBool(d.settings.seenOnboarding, false);

    return d;
  }

  // Fill in any fields missing from older saves so new features
  // (coins, skins, login rewards) work for existing players too
  function normalizeSave(d) {
    var fresh = defaultSave();
    if (!d) return fresh;
    // Sanitize FIRST: junk-typed fields (e.g. stats: 'junk') must be
    // repaired before the fill-in loop below, which writes into nested
    // objects and would throw on primitives under 'use strict'.
    d = sanitizeSave(d);
    for (var key in fresh) {
      if (typeof d[key] === 'undefined') {
        d[key] = fresh[key];
      } else if (fresh[key] && typeof fresh[key] === 'object' && !Array.isArray(fresh[key])) {
        for (var sub in fresh[key]) {
          if (typeof d[key][sub] === 'undefined') d[key][sub] = fresh[key][sub];
        }
      }
    }
    if (!d.owned || !d.owned.default) {
      if (!d.owned) d.owned = {};
      d.owned.default = true;
    }
    if (typeof d.skin !== 'string' || typeof GameCore === 'undefined' || !GameCore.SKINS ||
        !Object.prototype.hasOwnProperty.call(GameCore.SKINS, d.skin) || d.owned[d.skin] !== true) d.skin = 'default';
    return d;
  }

  // Snapshot the user-facing preferences exactly as this tab loaded them,
  // so a cross-tab merge can tell "the other tab changed this" apart from
  // "this is the value I started with".
  function capturePrefBaseline() {
    prefBaseline = {
      sound: save.sound, music: save.music, vibration: save.vibration,
      theme: save.theme, installHidden: save.installHidden,
      skin: save.skin, boardSkin: save.boardSkin,
      settings: JSON.parse(JSON.stringify(save.settings))
    };
  }

  // Merge a snapshot written by another tab into our save (P0). Every rule
  // is progress-preserving: numeric progress keeps the larger value,
  // claim/ownership maps union, per-level bests keep the better result.
  // A stale tab can never roll back newer progress this way.
  function mergeRemote(remote) {
    if (!remote || typeof remote !== 'object') return;
    try { remote = normalizeSave(remote); } catch (e) { return; }
    if (!remote || typeof remote !== 'object') return;

    save.unlocked = Math.max(save.unlocked, remote.unlocked);
    save.coins = Math.max(save.coins, remote.coins);

    // Per-level best: keep the better result (stars first, then plays)
    for (var bk in remote.best) {
      if (!Object.prototype.hasOwnProperty.call(remote.best, bk)) continue;
      var rb = remote.best[bk];
      var lb = save.best[bk];
      if (!lb) save.best[bk] = rb;
      else if (rb.stars > lb.stars || (rb.stars === lb.stars && rb.plays > lb.plays)) save.best[bk] = rb;
    }

    // Stats and play streaks: keep the larger counters, the later date
    save.stats.totalPlays = Math.max(save.stats.totalPlays, remote.stats.totalPlays);
    save.stats.totalWins = Math.max(save.stats.totalWins, remote.stats.totalWins);
    save.stats.totalStars = Math.max(save.stats.totalStars, remote.stats.totalStars);
    save.stats.hintsUsed = Math.max(save.stats.hintsUsed, remote.stats.hintsUsed);
    save.stats.mistakes = Math.max(save.stats.mistakes, remote.stats.mistakes);
    save.streaks.current = Math.max(save.streaks.current, remote.streaks.current);
    save.streaks.best = Math.max(save.streaks.best, remote.streaks.best);
    if (!save.streaks.lastPlayDate ||
        (remote.streaks.lastPlayDate && remote.streaks.lastPlayDate > save.streaks.lastPlayDate)) {
      save.streaks.lastPlayDate = remote.streaks.lastPlayDate;
    }

    // One-time claim markers and shown-achievement markers: union (true wins)
    ['achievements', 'bonusClaimed', 'chestClaimed', 'starChestClaimed', 'storySeen'].forEach(function(mapName) {
      if (!save[mapName] || typeof save[mapName] !== 'object') save[mapName] = {};
      for (var mk in remote[mapName]) {
        if (Object.prototype.hasOwnProperty.call(remote[mapName], mk) && remote[mapName][mk] === true) {
          save[mapName][mk] = true;
        }
      }
    });

    // Cosmetic ownership: union - purchases made in another tab are kept
    ['owned', 'ownedBoards'].forEach(function(mapName) {
      if (!save[mapName] || typeof save[mapName] !== 'object') save[mapName] = {};
      for (var ok2 in remote[mapName]) {
        if (Object.prototype.hasOwnProperty.call(remote[mapName], ok2) && remote[mapName][ok2] === true) {
          save[mapName][ok2] = true;
        }
      }
    });

    // Daily: the later date wins outright; the same date unions results
    if (remote.daily.lastDate && (!save.daily.lastDate || remote.daily.lastDate > save.daily.lastDate)) {
      save.daily = JSON.parse(JSON.stringify(remote.daily));
    } else if (remote.daily.lastDate && remote.daily.lastDate === save.daily.lastDate) {
      save.daily.completed = save.daily.completed || remote.daily.completed;
      save.daily.stars = Math.max(save.daily.stars, remote.daily.stars);
    }

    // Login rewards: the later claim date wins; the same date keeps the longer streak
    if (remote.loginRewards.lastClaim &&
        (!save.loginRewards.lastClaim || remote.loginRewards.lastClaim > save.loginRewards.lastClaim)) {
      save.loginRewards = JSON.parse(JSON.stringify(remote.loginRewards));
    } else if (remote.loginRewards.lastClaim && remote.loginRewards.lastClaim === save.loginRewards.lastClaim) {
      save.loginRewards.streak = Math.max(save.loginRewards.streak, remote.loginRewards.streak);
    }

    // Preferences and equipped cosmetics: keep whichever side actually
    // changed the value since this tab loaded (baseline diff). If both
    // tabs changed it, the remote write wins. These are pure preferences;
    // no progress can be lost either way.
    if (prefBaseline) {
      save.sound = prefPick(save.sound, remote.sound, prefBaseline.sound);
      save.music = prefPick(save.music, remote.music, prefBaseline.music);
      save.vibration = prefPick(save.vibration, remote.vibration, prefBaseline.vibration);
      save.theme = prefPick(save.theme, remote.theme, prefBaseline.theme);
      save.installHidden = prefPick(save.installHidden, remote.installHidden, prefBaseline.installHidden);
      save.skin = prefPick(save.skin, remote.skin, prefBaseline.skin);
      save.boardSkin = prefPick(save.boardSkin, remote.boardSkin, prefBaseline.boardSkin);
      for (var sk in prefBaseline.settings) {
        if (Object.prototype.hasOwnProperty.call(prefBaseline.settings, sk)) {
          save.settings[sk] = prefPick(save.settings[sk], remote.settings[sk], prefBaseline.settings[sk]);
        }
      }
    }

    // A board in progress in this tab is never replaced; otherwise adopt
    // the remote snapshot so a restore on reload is not lost.
    if (!(save.cur && typeof save.cur === 'object')) {
      save.cur = remote.cur || null;
    }

    save.rev = Math.max(save.rev || 0, remote.rev || 0);
  }

  function prefPick(local, remote, base) {
    if (remote === base) return local; // remote did not change it -> keep ours
    return remote;                     // remote changed it -> take theirs
  }

  // Read the on-disk save and merge it if another tab has written since
  // our last sync. Safe against corrupt JSON (merge skipped; our own
  // write then repairs the key) and a missing key (nothing to merge).
  function mergeFromDisk() {
    var raw = null;
    try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { return; }
    if (raw === lastSyncedRaw) return; // nobody else wrote since our last sync
    if (!raw) return;                  // no remote save yet
    var remote = null;
    try { remote = JSON.parse(raw); } catch (e) { return; }
    mergeRemote(remote);
  }

  // Write our save exactly as it is, no merge step. For persist() after
  // its merge pass, and for callers that intentionally overwrite (reset).
  function writeNow() {
    try {
      var out = JSON.stringify(save);
      localStorage.setItem(SAVE_KEY, out);
      lastSyncedRaw = out;
      lastSyncedRev = save.rev || 0;
      storageOk = true;
      return true;
    } catch (e) {
      if (storageOk) {
        storageOk = false;
        console.error('Failed to save:', e);
      }
      return false;
    }
  }

  // Persist save data. Before overwriting, merge any progress written by
  // another tab since our last sync, so a stale tab can never roll back
  // newer progress (P0: stale-tab save overwrite prevention).
  function persist() {
    try { mergeFromDisk(); } catch (e) { /* merging must never block a save */ }
    save.rev = (save.rev || 0) + 1;
    return writeNow();
  }

  // Get current save
  function getSave() {
    return save;
  }

  // Update save with new data
  function updateSave(newData) {
    for (var key in newData) {
      if (Object.prototype.hasOwnProperty.call(newData, key) && Object.prototype.hasOwnProperty.call(save, key)) {
        if (typeof newData[key] === 'object' && newData[key] !== null) {
          // Deep merge for objects. If the stored slot is not mergeable
          // (e.g. null), start from a fresh object instead of crashing.
          if (!save[key] || typeof save[key] !== 'object') save[key] = {};
          for (var subKey in newData[key]) {
            if (subKey !== '__proto__' && subKey !== 'constructor' && subKey !== 'prototype' &&
                Object.prototype.hasOwnProperty.call(newData[key], subKey)) {
              save[key][subKey] = newData[key][subKey];
            }
          }
        } else {
          save[key] = newData[key];
        }
      }
    }
    persist();
  }

  // Update level best
  function updateLevelBest(level, stars, plays) {
    if (!save.best[level]) {
      save.best[level] = { stars: 0, plays: 0 };
    }
    
    // Only update if we got more stars
    if (stars > save.best[level].stars) {
      save.best[level].stars = stars;
    }
    
    save.best[level].plays += plays || 1;
    
    // Update stats (totalPlays counts level starts in loadLevel, not wins)
    save.stats.totalWins++;
    save.stats.totalStars += stars;
    
    persist();
  }

  // Update daily challenge
  function updateDailyChallenge(date, stars) {
    var dateStr = date.toISOString().slice(0, 10);

    // A daily win counts as a completed level for stats/achievements
    save.stats.totalWins++;
    save.stats.totalStars += stars;
    
    if (save.daily.lastDate !== dateStr) {
      // New day, reset daily
      save.daily = {
        lastDate: dateStr,
        completed: false,
        stars: 0
      };
    }
    
    save.daily.completed = true;
    save.daily.stars = Math.max(save.daily.stars, stars);
    
    // Update streaks
    var yesterday = new Date(date);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    
    if (save.streaks.lastPlayDate === yesterday.toISOString().slice(0, 10)) {
      save.streaks.current++;
    } else if (save.streaks.lastPlayDate !== dateStr) {
      save.streaks.current = 1;
    }
    
    save.streaks.best = Math.max(save.streaks.best, save.streaks.current);
    save.streaks.lastPlayDate = dateStr;
    
    persist();
  }

  // Coins economy
  function addCoins(n) {
    n = toInt(n, 0, 1000000, 0);
    save.coins = Math.min(1000000, save.coins + n);
    persist();
    return save.coins;
  }

  function spendCoins(n) {
    n = Math.floor(Number(n));
    if (!Number.isFinite(n) || n < 0) return false;
    if (save.coins < n) return false;
    save.coins -= n;
    persist();
    return true;
  }

  // One synchronous write commits coins, ownership and equipment together.
  // Re-check current ownership on every invocation, including stale/double taps.
  function cosmeticAction(category, id, purchase) {
    if (!Object.prototype.hasOwnProperty.call(GameCore.COSMETICS, category)) return 'invalid';
    var catalog = GameCore.COSMETICS[category];
    if (!catalog || !Object.prototype.hasOwnProperty.call(catalog, id)) return 'invalid';
    var item = catalog[id], ownedKey = category === 'boards' ? 'ownedBoards' : 'owned';
    var equippedKey = category === 'boards' ? 'boardSkin' : 'skin';
    var owned = save[ownedKey][id] === true;
    if (!owned && !purchase) return 'locked';
    if (!owned && (item.currency !== 'coins' || !Number.isInteger(item.price) || item.price < 0)) return 'invalid';
    if (!owned && save.coins < item.price) return 'insufficient';
    var before = { coins: save.coins, equipped: save[equippedKey] };
    if (!owned) { save.coins -= item.price; save[ownedKey][id] = true; }
    save[equippedKey] = id;
    if (!persist()) {
      save.coins = before.coins; save[equippedKey] = before.equipped;
      if (!owned) delete save[ownedKey][id];
      return 'storage';
    }
    return owned ? 'equipped' : 'purchased';
  }

  // One-time claim guard with cross-tab safety (P0/P1): sync from disk
  // first so a claim made in another tab is honored, then claim the key
  // only if it is still free. Returns true only when THIS call claimed it
  // and the claim was durably written.
  function claimOnce(mapName, key) {
    if (!mapName || key === undefined || key === null) return false;
    key = String(key);
    try { mergeFromDisk(); } catch (e) {}
    if (!save[mapName] || typeof save[mapName] !== 'object') save[mapName] = {};
    if (save[mapName][key] === true) return false;
    save[mapName][key] = true;
    return writeNow();
  }

  // Update hints used
  function updateHintsUsed(count) {
    save.stats.hintsUsed += count;
    persist();
  }

  // Update mistakes
  function updateMistakes(count) {
    save.stats.mistakes += count;
    persist();
  }

  // Reset all progress. Intentionally bypasses the merge: a reset must
  // win. (Known limit: a tab that was already open can resurrect merged
  // progress with its next save - documented, accepted for a reset action.)
  function resetAll() {
    save = defaultSave();
    writeNow();
  }

  // Check if storage is available
  function isStorageOk() {
    return storageOk;
  }

  // Initialize on load
  init();

  return {
    init: init,
    getSave: getSave,
    updateSave: updateSave,
    updateLevelBest: updateLevelBest,
    updateDailyChallenge: updateDailyChallenge,
    updateHintsUsed: updateHintsUsed,
    updateMistakes: updateMistakes,
    addCoins: addCoins,
    spendCoins: spendCoins,
    cosmeticAction: cosmeticAction,
    resetAll: resetAll,
    claimOnce: claimOnce,
    isStorageOk: isStorageOk,
    persist: persist,
    DESIGN_LEVELS: DESIGN_LEVELS
  };
})();

