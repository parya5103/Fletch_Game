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
      streaks: {
        current: 0,
        best: 0,
        lastPlayDate: null
      },
      settings: {
        reducedMotion: false,
        notifications: true
      }
    };
  }

  var save = defaultSave();
  var storageOk = true;

  // Initialize storage
  function init() {
    try {
      // Try to load existing save
      var raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        var d = JSON.parse(raw);
        if (d && d.v === 2) {
          save = d;
          return;
        }
      }
      
      // Try to migrate from old version
      var oldRaw = localStorage.getItem(OLD_SAVE_KEY);
      if (oldRaw) {
        var old = JSON.parse(oldRaw);
        if (old && old.v === 1) {
          save = migrateFromV1(old);
          // Remove old save after migration
          try { localStorage.removeItem(OLD_SAVE_KEY); } catch(e) {}
          return;
        }
      }
    } catch (e) {
      storageOk = false;
      console.error('Storage error:', e);
    }
  }

  // Migrate from v1 to v2
  function migrateFromV1(old) {
    var newSave = defaultSave();
    
    // Migrate basic progress
    newSave.unlocked = Math.max(1, Math.min(old.unlocked || 1, DESIGN_LEVELS));
    newSave.best = old.best || {};
    
    // Migrate current game state
    newSave.cur = old.cur || null;
    
    // Migrate settings
    newSave.sound = old.sound !== false;
    newSave.installHidden = old.installHidden || false;
    
    // Handle old perfect flag
    if (old.perfect) {
      for (var pk in old.perfect) {
        if (!newSave.best[pk]) {
          newSave.best[pk] = { stars: 3, plays: 1 };
        }
      }
    }
    
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

  // Persist save data
  function persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch (e) {
      if (storageOk) {
        storageOk = false;
        console.error('Failed to save:', e);
      }
    }
  }

  // Get current save
  function getSave() {
    return save;
  }

  // Update save with new data
  function updateSave(newData) {
    for (var key in newData) {
      if (newData.hasOwnProperty(key) && save.hasOwnProperty(key)) {
        if (typeof newData[key] === 'object' && newData[key] !== null) {
          // Deep merge for objects
          for (var subKey in newData[key]) {
            if (newData[key].hasOwnProperty(subKey)) {
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
    
    // Update stats
    save.stats.totalPlays++;
    save.stats.totalWins++;
    save.stats.totalStars += stars;
    
    persist();
  }

  // Update daily challenge
  function updateDailyChallenge(date, stars) {
    var dateStr = date.toISOString().slice(0, 10);
    
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
    var today = new Date();
    var yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (save.streaks.lastPlayDate === yesterday.toISOString().slice(0, 10)) {
      save.streaks.current++;
    } else if (save.streaks.lastPlayDate !== dateStr) {
      save.streaks.current = 1;
    }
    
    save.streaks.best = Math.max(save.streaks.best, save.streaks.current);
    save.streaks.lastPlayDate = dateStr;
    
    persist();
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
    getSave: getSave,
    updateSave: updateSave,
    updateLevelBest: updateLevelBest,
    updateDailyChallenge: updateDailyChallenge,
    updateHintsUsed: updateHintsUsed,
    updateMistakes: updateMistakes,
    resetAll: resetAll,
    isStorageOk: isStorageOk,
    persist: persist,
    DESIGN_LEVELS: DESIGN_LEVELS
  };
})();
