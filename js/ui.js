/**
 * Arrow Out! - UI Module
 * Handles all user interface elements, dialogs, and interactions
 */
'use strict';

const UI = (function() {
  var gameState = null;

  // Inline SVG icons (emoji-free - render on every device, no emoji font needed)
  function svgIcon(inner, size) {
    size = size || 16;
    return '<svg class="ic" width="' + size + '" height="' + size +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      inner + '</svg>';
  }
  var ICON = {
    coin: svgIcon('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/>'),
    flame: svgIcon('<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5Z"/>'),
    star: svgIcon('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'),
    trophy: svgIcon('<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>'),
    bulb: svgIcon('<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5a6 6 0 0 0-12 0c0 1.3.5 2.6 1.5 3.5.8.8 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>'),
    award: svgIcon('<circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>')
  };
  var REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function init() {
    // Set up reduced motion listener
    if (window.matchMedia) {
      window.matchMedia('(prefers-reduced-motion: reduce)').addListener(function(e) {
        REDUCED = e.matches;
      });
    }
  }

  function setGameState(state) {
    gameState = state;
  }

  function getGameState() {
    return gameState;
  }

  // DOM helpers
  function $(id) { return document.getElementById(id); }
  function on(el, ev, fn, opts) { 
    if (el) el.addEventListener(ev, fn, opts); 
  }

  function heartSVG(filled) {
    var color = filled ? '#ff5d8f' : '#3a4470';
    return '<svg viewBox="0 0 24 24" fill="' + color + '" aria-hidden="true"><path d="M12 21s-7.5-4.7-10-9.3C.6 8.6 2.6 5 6.1 5c2 0 3.4 1.1 4.4 2.6L12 9.5l1.5-1.9C14.5 6.1 15.9 5 17.9 5c3.5 0 5.5 3.6 4.1 6.7C19.5 16.3 12 21 12 21z"/></svg>';
  }

  function starSVG(filled) {
    var color = filled ? '#ffd43b' : '#3a4470';
    return '<svg viewBox="0 0 24 24" fill="' + color + '" aria-hidden="true"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>';
  }

  function starsHTML(stars, max) {
    max = max || 3;
    var h = '';
    for (var i = 1; i <= max; i++) {
      h += '<span class="' + (i <= stars ? 'on' : 'off') + '">\u2605</span>';
    }
    return h;
  }

  function starsText(stars, max) {
    max = max || 3;
    var t = '';
    for (var i = 1; i <= max; i++) {
      t += i <= stars ? '\u2605' : '\u2606';
    }
    return t;
  }

  // Update HUD
  function updateHUD(heartAnim) {
    if (!gameState) return;
    
    var hudLevel = $('hud-level');
    var hudLeft = $('hud-left');
    var hearts = $('hearts');
    
    if (hudLevel) {
      if (gameState.level === 'daily') {
        hudLevel.textContent = 'Arrow Out! \u00b7 Daily Challenge';
      } else {
        var difficulty = GameCore.getDifficultyName(gameState.level);
        hudLevel.textContent = 'Arrow Out! \u00b7 Level ' + gameState.level + ' (' + difficulty + ')';
      }
    }
    
    var left = aliveCount();
    if (hudLeft) {
      hudLeft.textContent = left + (left === 1 ? ' path to clear' : ' paths to clear');
    }
    
    // Progress bar: % of paths cleared this level
    var progressFill = $('progress-fill');
    if (progressFill && gameState.arrows.length) {
      var cleared = gameState.arrows.length - left;
      var pct = Math.round((cleared / gameState.arrows.length) * 100);
      progressFill.style.width = pct + '%';
      progressFill.setAttribute('aria-valuenow', pct);
    }
    
    if (hearts) {
      var h = '';
      for (var i = 0; i < GameCore.MAX_HEARTS; i++) {
        h += '<span class="' + (i < gameState.hearts ? '' : 'lost') + (heartAnim && i === gameState.hearts ? ' heart-pop' : '') + '">' + heartSVG(i < gameState.hearts) + '</span>';
      }
      hearts.innerHTML = h;
      hearts.setAttribute('aria-label', gameState.hearts + (gameState.hearts === 1 ? ' heart' : ' hearts') + ' remaining');
    }
    
    // Update action buttons
    var btnUndo = $('btn-undo');
    var btnHint = $('btn-hint');
    var btnRestart = $('btn-restart');
    
    if (btnUndo) btnUndo.disabled = gameState.over || gameState.failed || !gameState.undoIds.length;
    if (btnHint) btnHint.disabled = gameState.over || gameState.failed;
    if (btnRestart) btnRestart.disabled = gameState.over;
    
    updateHintBtn();
  }

  function aliveCount() {
    if (!gameState) return 0;
    var n = 0;
    for (var i = 0; i < gameState.arrows.length; i++) {
      if (gameState.arrows[i].alive) n++;
    }
    return n;
  }

  function updateHintBtn() {
    if (!gameState) return;
    
    var left = Math.max(0, GameCore.FREE_HINTS - gameState.hintsUsed);
    var b = $('hint-count');
    if (b) {
      b.textContent = left;
      b.style.display = left > 0 ? '' : 'none';
    }
    
    var btnHint = $('btn-hint');
    if (btnHint) {
      btnHint.setAttribute('aria-label', 'Show a hint (' + left + ' free left)');
    }
  }

  // Combo badge: shows from 3 consecutive clean launches
  function updateCombo(combo) {
    var badge = $('combo-badge');
    if (!badge) return;
    if (!(combo >= 3)) {
      badge.classList.remove('show');
      return;
    }
    badge.innerHTML = ICON.flame + ' x' + combo;
    if (badge.classList.contains('show')) {
      // re-trigger the pop animation
      badge.classList.remove('pop');
      void badge.offsetWidth;
      badge.classList.add('pop');
    } else {
      badge.classList.add('show');
    }
  }

  // Level intro banner ("Level 42 - Hard")
  function showLevelBanner() {
    if (!gameState) return;
    var banner = $('level-banner');
    if (!banner) return;
    // Boot sequence loads a level before the home hub appears - never float
    // the level banner over the main menu.
    if (document.body.classList.contains('at-home')) return;
    var label;
    if (gameState.level === 'daily') {
      label = 'Daily Challenge';
    } else {
      var isSpike = gameState.level > 10 && gameState.level % 10 === 0;
      label = 'Level ' + gameState.level + ' \u00b7 ' + GameCore.getDifficultyName(gameState.level) +
        (isSpike ? ' \u00b7 Spike' : '');
    }
    banner.textContent = label;
    banner.setAttribute('data-diff', gameState.level === 'daily' ? 'medium' : GameCore.getDifficultyLevel(gameState.level));
    banner.classList.remove('show');
    void banner.offsetWidth;
    banner.classList.add('show');
  }

  // Stall offer: reuses the rewarded-hint dialog with a friendlier title
  function showStallOffer() {
    var t = $('adhint-title');
    if (t) t.textContent = 'Stuck on this one?';
    var sub = document.querySelector('#dlg-adhint .card p');
    if (sub) sub.innerHTML = 'Stuck happens \u2014 watch a short ad and we\u2019ll point out a safe arrow for free.';
    openDlg('dlg-adhint');
  }

  // Restore the default rewarded-hint dialog title (after a stall offer reused it)
  function resetAdHint() {
    var t = $('adhint-title');
    if (t) t.textContent = 'Out of free hints';
    var sub = document.querySelector('#dlg-adhint .card p');
    if (sub) sub.innerHTML = 'You get <b>3 free hints</b> per level. Watch a short ad to reveal one more.';
  }

  // --- Shop (coins + cosmetic skins, all free - earned through play) ---
  function buildShopGrid() {
    var grid = $('shop-grid');
    if (!grid) return;
    grid.textContent = '';
    
    var save = Storage.getSave();
    var coinsEl = $('shop-coins');
    if (coinsEl) coinsEl.innerHTML = ICON.coin + ' ' + save.coins + ' coins';
    
    var skins = GameCore.SKINS;
    Object.keys(skins).forEach(function(id) {
      var skin = skins[id];
      var owned = !!save.owned[id];
      var equipped = save.skin === id;
      
      var item = document.createElement('div');
      item.className = 'skin-item' + (equipped ? ' equipped' : '');
      
      // Color dots preview
      var dots = '';
      for (var ci = 0; ci < skin.colors.length; ci++) {
        dots += '<span class="skin-dot" style="background:' + skin.colors[ci] + '"></span>';
      }
      
      item.innerHTML =
        '<div class="skin-name">' + (skin.isNew ? '<span style="color:#fbbf24;letter-spacing:0.5px;">NEW</span> &middot; ' : '') + skin.name + '</div>' +
        '<div class="skin-dots">' + dots + '</div>' +
        '<div class="skin-status">' +
          (equipped ? '\u2713 Equipped' : owned ? 'Owned' : skin.price + ' coins') +
        '</div>';
      
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn small' + (equipped ? '' : owned ? ' primary' : '');
      btn.textContent = equipped ? 'Equipped' : owned ? 'Equip' : (save.coins >= skin.price ? 'Buy' : 'Locked');
      btn.disabled = equipped;
      if (!equipped) {
        (function(sid, price, isOwned) {
          on(btn, 'click', function() {
            var s = Storage.getSave();
            if (isOwned) {
              s.skin = sid;
              Storage.updateSave(s);
              applySkinToRenderer();
              toast(skins[sid].name + ' equipped \u2713');
              Audio.ui();
              buildShopGrid();
              return;
            }
            if (Storage.spendCoins(price)) {
              s = Storage.getSave();
              s.owned[sid] = true;
              s.skin = sid;
              Storage.updateSave(s);
              applySkinToRenderer();
              toast(skins[sid].name + ' unlocked!');
              Audio.success();
              buildShopGrid();
            } else {
              toast('Not enough coins \u2014 win levels to earn more!');
              Audio.error();
            }
          });
        })(id, skin.price, owned);
      }
      item.appendChild(btn);
      grid.appendChild(item);
    });
  }

  function applySkinToRenderer() {
    var save = Storage.getSave();
    var skin = GameCore.SKINS[save.skin] || GameCore.SKINS.default;
    Render.setPalette(skin.colors);
  }

  // --- Daily login reward calendar ---
  function buildRewardCalendar(day) {
    var rewards = [15, 20, 30, 40, 50, 75, 100];
    var grid = $('reward-grid');
    if (!grid) return;
    grid.textContent = '';
    
    for (var d = 1; d <= 7; d++) {
      var cell = document.createElement('div');
      cell.className = 'reward-cell' +
        (d === day ? ' today' : d < day ? ' past' : '');
      cell.innerHTML =
        '<div class="reward-day">Day ' + d + '</div>' +
        '<div class="reward-amount">' + rewards[d - 1] + ' ' + ICON.coin + '</div>' +
        (d === day ? '<div class="reward-claim">Tap claim!</div>' :
          d < day ? '<div class="reward-done">\u2713</div>' : '');
      grid.appendChild(cell);
    }
    
    var btn = $('btn-reward-claim');
    if (btn) {
      btn.textContent = 'Claim ' + rewards[day - 1] + ' coins';
    }
  }

  // Dialog functions
  function openDlg(id) {
    var dlg = $(id);
    if (dlg) dlg.classList.add('show');
  }

  function closeAll() {
    var list = document.querySelectorAll('.overlay.show');
    for (var i = 0; i < list.length; i++) {
      list[i].classList.remove('show');
    }
  }

  function anyOpen() {
    return !!document.querySelector('.overlay.show');
  }

  // Toast notifications
  var toastTimer = 0;
  function toast(msg) {
    var t = $('toast');
    if (t) {
      t.textContent = msg;
      t.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function() { 
        if (t) t.classList.remove('show'); 
      }, 2200);
    }
  }

  // Level grid
  function buildLevelGrid() {
    var grid = $('lv-grid');
    if (!grid) return;
    
    grid.textContent = '';
    var max = Storage.DESIGN_LEVELS;
    var curBtn = null;
    var save = Storage.getSave();
    
    for (var n = 1; n <= max; n++) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'lv-btn' + (n === gameState.level ? ' cur' : '');
      
      var locked = n > save.unlocked;
      var best = save.best[n];
      
      var difficulty = GameCore.getDifficultyLevel(n);
      var diffClass = 'diff-' + difficulty;
      
      b.innerHTML = '<span class="lv-num">' + n + '</span><span class="lv-stars ' + diffClass + '" aria-hidden="true">' +
        (locked ? '\ud83d\udd12' : starsText(best ? best.stars : 0)) + '</span>';
      
      if (locked) {
        b.disabled = true;
        b.setAttribute('aria-label', 'Level ' + n + ' (locked)');
      } else {
        b.setAttribute('aria-label', 'Level ' + n + ', ' + (best ? best.stars : 0) + ' stars');
        (function(lv) {
          on(b, 'click', function() { 
            closeAll(); 
            Game.loadLevel(lv); 
          });
        })(n);
      }
      
      if (n === gameState.level) curBtn = b;
      grid.appendChild(b);
    }
    
    if (curBtn && curBtn.scrollIntoView) {
      try { curBtn.scrollIntoView({ block: 'center' }); } catch (e) {}
    }
  }

  // Stats
  function updateStats() {
    var save = Storage.getSave();
    var levels = 0, stars = 0, plays = 0;
    
    for (var k in save.best) {
      var b = save.best[k];
      if (b && b.stars) {
        levels++; 
        stars += b.stars; 
        plays += (b.plays || 0);
      }
    }
    
    var statCurrent = $('stat-current');
    var statLevels = $('stat-levels');
    var statStars = $('stat-stars');
    var statPlays = $('stat-plays');
    var statHints = $('stat-hints');
    var statMistakes = $('stat-mistakes');
    var statCoins = $('stat-coins');
    var statStreaks = $('stat-streaks');
    
    if (statCurrent) statCurrent.textContent = gameState ? gameState.level : '1';
    if (statLevels) statLevels.textContent = levels;
    if (statStars) statStars.textContent = stars + ' / ' + (levels * 3);
    if (statPlays) statPlays.textContent = plays;
    if (statHints) statHints.textContent = save.stats.hintsUsed;
    if (statMistakes) statMistakes.textContent = save.stats.mistakes;
    if (statCoins) statCoins.textContent = save.coins;
    if (statStreaks) statStreaks.textContent = save.streaks.current + ' (best: ' + save.streaks.best + ')';
  }

  // Settings
  function updateSettingsStatus() {
    var standalone = PWA.isStandalone();
    var swActive = PWA.swActive;
    var controlled = !!(navigator.serviceWorker && navigator.serviceWorker.controller);
    var canPrompt = PWA.canPrompt();
    var storageOk = Storage.isStorageOk();
    
    var stMode = $('st-mode');
    var stSw = $('st-sw');
    var stInstall = $('st-install');
    var stStorage = $('st-storage');
    var stVersion = $('st-version');
    
    if (stMode) stMode.innerHTML = standalone ? '<span class="ok">Installed app \u2713</span>' : 'Browser tab';
    if (stSw) stSw.innerHTML = controlled ? '<span class="ok">Active \u2713</span>' : (swActive ? 'Starting...' : '<span class="no">Not active</span>');
    if (stInstall) stInstall.innerHTML = canPrompt ? '<span class="ok">Available \u2713</span>' : 'Not available';
    if (stStorage) stStorage.innerHTML = storageOk ? '<span class="ok">Saving \u2713</span>' : '<span class="no">Unavailable</span>';
    if (stVersion) stVersion.textContent = PWA.VERSION || '--';
    updateNotifUI();
  }

  // Sync the settings dialog Notifications toggle + its status line.
  // The browser permission is reported honestly; the game stays fully
  // playable whatever the state.
  function updateNotifUI() {
    var save = Storage.getSave();
    var pref = !!(save.settings && save.settings.notifications);
    var chk = $('chk-notifs');
    if (chk) chk.checked = pref;
    var st = $('st-notif');
    if (st) {
      var perm = PWA.notifPermission();
      var txt;
      if (perm === 'unsupported') txt = 'Not supported here';
      else if (perm === 'denied') txt = 'Blocked in browser settings';
      else if (!pref) txt = 'Off';
      else {
        // Preference is on; refine once we know whether a push
        // subscription actually exists (subtle async, no flicker).
        txt = 'On \u2014 setup pending';
        if (typeof PWA.getPushSubscriptionJson === 'function') {
          PWA.getPushSubscriptionJson().then(function(sub) {
            if (sub) st.textContent = 'On \u2014 reminders active';
          });
        }
      }
      st.textContent = txt;
    }
  }

  // Achievements
  // Single source of truth for the achievement list. Completion is always
  // recomputed from live stats; save.achievements only remembers which
  // toasts were already shown.
  function achievementList(save) {
    return [
      { id: 'first-win', name: 'First Blood', desc: 'Complete your first level', icon: ICON.trophy, completed: save.stats.totalWins >= 1 },
      { id: 'ten-wins', name: 'Getting Good', desc: 'Complete 10 levels', icon: ICON.trophy, completed: save.stats.totalWins >= 10 },
      { id: 'fifty-wins', name: 'Arrow Master', desc: 'Complete 50 levels', icon: ICON.trophy, completed: save.stats.totalWins >= 50 },
      { id: 'hundred-wins', name: 'Arrow Legend', desc: 'Complete 100 levels', icon: ICON.trophy, completed: save.stats.totalWins >= 100 },
      { id: 'perfect-level', name: 'Flawless', desc: 'Get 3 stars on a level', icon: ICON.star, completed: Object.values(save.best).some(function(b) { return b.stars === 3; }) },
      { id: 'all-perfect', name: 'Perfectionist', desc: 'Get 3 stars on 10 levels', icon: ICON.star, completed: Object.values(save.best).filter(function(b) { return b.stars === 3; }).length >= 10 },
      { id: 'streak-5', name: 'Daily Habit', desc: '5-day streak', icon: ICON.flame, completed: save.streaks.best >= 5 },
      { id: 'streak-10', name: 'Dedicated', desc: '10-day streak', icon: ICON.flame, completed: save.streaks.best >= 10 },
      { id: 'no-hints', name: 'No Help Needed', desc: 'Complete 5 levels without hints', icon: ICON.bulb, completed: save.stats.totalWins >= 5 && save.stats.hintsUsed === 0 },
      { id: 'daily-complete', name: 'Daily Champion', desc: 'Complete a daily challenge', icon: ICON.award, completed: save.daily.completed }
    ];
  }

  // Toast once per achievement the moment it becomes completed (max one
  // toast per call to avoid message spam).
  function announceNewAchievements() {
    var save = Storage.getSave();
    if (!save.achievements || typeof save.achievements !== 'object') save.achievements = {};
    var fresh = [];
    achievementList(save).forEach(function(ach) {
      if (ach.completed && !save.achievements[ach.id]) {
        save.achievements[ach.id] = true;
        fresh.push(ach);
      }
    });
    if (fresh.length) {
      Storage.updateSave({ achievements: save.achievements });
      toast('Achievement unlocked: ' + fresh[0].name +
        (fresh.length > 1 ? ' (+' + (fresh.length - 1) + ' more)' : ''));
    }
  }

  function buildAchievementsGrid() {
    var grid = $('achievements-grid');
    if (!grid) return;
    
    grid.textContent = '';
    var save = Storage.getSave();
    var achievements = achievementList(save);
    
    achievements.forEach(function(ach) {
      // Built with createElement/textContent; user-influenced text can
      // never be interpreted as HTML here.
      var item = document.createElement('div');
      item.className = 'achievement-item' + (ach.completed ? ' completed' : '');
      
      var icon = document.createElement('span');
      icon.className = 'ach-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = ach.icon; // fixed inline SVG defined in code above
      
      var info = document.createElement('div');
      info.className = 'ach-info';
      var name = document.createElement('div');
      name.className = 'ach-name';
      name.textContent = ach.name;
      var desc = document.createElement('div');
      desc.className = 'ach-desc';
      desc.textContent = ach.desc;
      info.appendChild(name);
      info.appendChild(desc);
      
      item.appendChild(icon);
      item.appendChild(info);
      
      if (ach.completed) {
        var check = document.createElement('span');
        check.className = 'ach-check';
        check.setAttribute('aria-hidden', 'true');
        check.textContent = '\u2713';
        item.appendChild(check);
      }
      grid.appendChild(item);
    });
  }

  // Home screen

  // --- Central screen manager ---
  // Two top-level screens exist: the home hub and the gameplay board.
  // Overlays (levels, shop, settings, ...) stack above whichever
  // screen is active; closeAll() only ever closes overlays.
  function showScreen(name) {
    var home = $('dlg-home');
    if (name === 'home') {
      if (home) home.classList.add('show');
      document.body.classList.add('at-home');
      // Cancel any in-flight level banner so it never floats over the hub
      var lb = $('level-banner');
      if (lb) lb.classList.remove('show');
      try { Bgfx.resize(); Bgfx.start(); } catch (e) { /* bg is cosmetic */ }
    } else {
      if (home) home.classList.remove('show');
      document.body.classList.remove('at-home');
      try { Bgfx.stop(); } catch (e) { /* bg is cosmetic */ }
    }
  }

  function showHomeScreen() {
    closeAll();
    updateHUD();
    
    var save = Storage.getSave();
    var dlgHome = $('dlg-home');
    if (!dlgHome) return;
    
    // Update continue button
    var btnContinue = $('btn-continue');
    if (btnContinue) {
      if (save.cur) {
        btnContinue.textContent = 'Continue Level ' + (gameState ? gameState.level : save.cur.level);
        btnContinue.style.display = '';
      } else {
        btnContinue.textContent = 'Continue Level ' + Math.min(save.unlocked, Storage.DESIGN_LEVELS);
        btnContinue.style.display = save.unlocked > 1 ? '' : 'none';
      }
    }
    
    // Update progress
    var progressText = $('home-progress');
    if (progressText) {
      var levels = 0;
      for (var k in save.best) {
        if (save.best[k].stars) levels++;
      }
      progressText.textContent = levels + ' / ' + Storage.DESIGN_LEVELS + ' levels cleared \u00b7 ' + save.coins + ' coins';
    }
    
    // Update home stat tiles (levels / stars / streak)
    var statLevelsEl = $('home-stat-levels');
    var statStarsEl = $('home-stat-stars');
    var statStreakEl = $('home-stat-streak');
    if (statLevelsEl || statStarsEl || statStreakEl) {
      var cleared = 0, totalStars = 0;
      for (var kk in save.best) {
        if (save.best[kk] && save.best[kk].stars) {
          cleared++;
          totalStars += save.best[kk].stars;
        }
      }
      if (statLevelsEl) statLevelsEl.textContent = cleared;
      if (statStarsEl) statStarsEl.textContent = totalStars;
      if (statStreakEl) statStreakEl.textContent = save.streaks.current;
    }
    
    // Update daily challenge
    var dailyText = $('home-daily');
    if (dailyText) {
      var today = new Date();
      var dateStr = today.toISOString().slice(0, 10);
      var completed = save.daily.lastDate === dateStr && save.daily.completed;
      dailyText.textContent = completed ? 'Daily Challenge: Completed \u2713' : 'Daily Challenge: Available!';
    }
    
    // Install option only makes sense inside a browser tab
    var btnInstallHome = $('btn-install-home');
    if (btnInstallHome) {
      btnInstallHome.style.display = PWA.isStandalone() ? 'none' : '';
    }

    // "Play" starts the current level fresh; "Continue" resumes mid-level
    var btnPlayHome = $('btn-play-home');
    if (btnPlayHome) {
      var playLv = save.cur ? save.cur.level : Math.min(save.unlocked, Storage.DESIGN_LEVELS);
      btnPlayHome.textContent = 'Play \u00b7 Level ' + playLv;
    }

    showScreen('home');
  }

  // Win dialog
  function showWinDialog() {
    if (!gameState) return;
    
    var stars = GameCore.calcStars(gameState.wrong, gameState.hintsUsed);
    // Daily challenges have no "next" campaign level; treat them as complete
    var done = gameState.level === 'daily' || gameState.level >= Storage.DESIGN_LEVELS;
    
    var winTitle = $('win-title');
    var btnNext = $('btn-next');
    var winStars = $('win-stars');
    var winSub = $('win-sub');
    
    if (winTitle) winTitle.textContent = done ? 'Campaign Complete!' : 'Board Cleared!';
    if (btnNext) btnNext.style.display = done ? 'none' : '';
    if (winStars) winStars.innerHTML = starsHTML(stars);
    if (winSub) {
      var coinsLine = gameState.coinsEarned
        ? '<br><span class="coin-earn">+' + gameState.coinsEarned + ' coins ' + ICON.coin + '</span>'
        : '';
      winSub.innerHTML = done
        ? 'You cleared all ' + Storage.DESIGN_LEVELS + ' levels. Legend! \ud83c\udfc6<br>' +
          gameState.wrong + ' wrong tap' + (gameState.wrong === 1 ? '' : 's') + ' this run.' + coinsLine
        : gameState.wrong + ' wrong tap' + (gameState.wrong === 1 ? '' : 's') + ' \u00b7 ' +
          gameState.hintsUsed + ' hint' + (gameState.hintsUsed === 1 ? '' : 's') +
          (stars === 3 ? ' \u00b7 <span class="perfect">Perfect!</span>' : '') +
          coinsLine;
    }
    
    openDlg('dlg-win');
  }

  // Fail dialog
  function showFailDialog() {
    openDlg('dlg-fail');
  }

  // Wire up overlays
  function wireOverlays() {
    var ovs = document.querySelectorAll('.overlay');
    for (var i = 0; i < ovs.length; i++) {
      on(ovs[i], 'click', function(e) {
        if (e.target === e.currentTarget) closeAll();
      });
    }
    
    var cls = document.querySelectorAll('[data-close]');
    for (var k = 0; k < cls.length; k++) {
      on(cls[k], 'click', function() { 
        closeAll(); 
        Audio.back(); 
      });
    }
  }

  // Update sound button
  function updateSoundBtn() {
    var icOn = $('ic-sound-on');
    var icOff = $('ic-sound-off');
    var btnSound = $('btn-sound');
    var chkSound = $('chk-sound');
    
    if (icOn) icOn.style.display = Audio.enabled ? '' : 'none';
    if (icOff) icOff.style.display = Audio.enabled ? 'none' : '';
    if (btnSound) btnSound.setAttribute('aria-pressed', Audio.enabled ? 'true' : 'false');
    if (chkSound) chkSound.checked = Audio.enabled;
  }

  // Update vibration button
  function updateVibrationBtn() {
    var btnVibrate = $('btn-vibrate');
    var chkVibrate = $('chk-vibrate');
    var save = Storage.getSave();
    
    if (btnVibrate) btnVibrate.setAttribute('aria-pressed', save.vibration ? 'true' : 'false');
    if (chkVibrate) chkVibrate.checked = save.vibration;
  }

  // Update music toggle (settings dialog)
  function updateMusicBtn() {
    var chkMusic = $('chk-music');
    var save = Storage.getSave();
    if (chkMusic) chkMusic.checked = !!save.music;
  }

  // Update theme button
  function updateThemeBtn() {
    var btnTheme = $('btn-theme');
    var chkTheme = $('chk-theme');
    var save = Storage.getSave();
    
    if (btnTheme) {
      btnTheme.textContent = save.theme === 'dark' ? 'Dark Theme' : 'Light Theme';
      btnTheme.setAttribute('aria-pressed', save.theme === 'dark' ? 'true' : 'false');
    }
    if (chkTheme) chkTheme.checked = save.theme === 'dark';
  }

  // Theme management
  function setTheme(theme) {
    var save = Storage.getSave();
    save.theme = theme;
    Storage.updateSave(save);
    
    var body = document.body;
    if (body) {
      body.className = theme === 'dark' ? 'theme-dark' : 'theme-light';
    }
    
    updateThemeBtn();
  }

  function toggleTheme() {
    var save = Storage.getSave();
    setTheme(save.theme === 'dark' ? 'light' : 'dark');
  }

  // Initialize theme
  function initTheme() {
    var save = Storage.getSave();
    var body = document.body;
    if (body) {
      body.className = save.theme === 'dark' ? 'theme-dark' : 'theme-light';
    }
    updateThemeBtn();
  }

  // Initialize
  init();
  wireOverlays();
  initTheme();

  return {
    init: init,
    setGameState: setGameState,
    getGameState: getGameState,
    updateHUD: updateHUD,
    updateHintBtn: updateHintBtn,
    updateCombo: updateCombo,
    showLevelBanner: showLevelBanner,
    showStallOffer: showStallOffer,
    resetAdHint: resetAdHint,
    buildShopGrid: buildShopGrid,
    buildRewardCalendar: buildRewardCalendar,
    openDlg: openDlg,
    closeAll: closeAll,
    anyOpen: anyOpen,
    toast: toast,
    buildLevelGrid: buildLevelGrid,
    updateStats: updateStats,
    updateSettingsStatus: updateSettingsStatus,
    updateNotifUI: updateNotifUI,
    announceNewAchievements: announceNewAchievements,
    buildAchievementsGrid: buildAchievementsGrid,
    showHomeScreen: showHomeScreen,
    showScreen: showScreen,
    showWinDialog: showWinDialog,
    showFailDialog: showFailDialog,
    updateSoundBtn: updateSoundBtn,
    updateVibrationBtn: updateVibrationBtn,
    updateMusicBtn: updateMusicBtn,
    updateThemeBtn: updateThemeBtn,
    toggleTheme: toggleTheme,
    setTheme: setTheme,
    REDUCED: REDUCED
  };
})();



