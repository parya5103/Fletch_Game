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
      skin: 'default',
      owned: { default: true },
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
        seenOnboarding: false
      }
    };
  }

  var save = defaultSave();
  var storageOk = true;

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
    var d = readSave(SAVE_KEY);
    if (d && d.v === 2) {
      save = normalizeSave(d);
      return;
    }
    var old = readSave(OLD_SAVE_KEY);
    if (old && old.v === 1) {
      save = normalizeSave(migrateFromV1(old));
      // Keep the legacy backup until its replacement is durably written.
      if (persist()) {
        try { localStorage.removeItem(OLD_SAVE_KEY); } catch (e) {}
      }
    }
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

    // owned skins: map of skinId -> true; the default skin is always owned
    if (!d.owned || typeof d.owned !== 'object' || Array.isArray(d.owned)) d.owned = {};
    for (var ok in d.owned) {
      if (Object.prototype.hasOwnProperty.call(d.owned, ok) && d.owned[ok] !== true) delete d.owned[ok];
    }
    d.owned.default = true;

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

  // Persist save data
  function persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
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

  // Reset all progress
  function resetAll() {
    save = defaultSave();
    persist();
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
    resetAll: resetAll,
    isStorageOk: isStorageOk,
    persist: persist,
    DESIGN_LEVELS: DESIGN_LEVELS
  };
})();

