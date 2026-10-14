/**
 * Arrow Out! - UI Module
 * Handles all user interface elements, dialogs, and interactions
 */
'use strict';

const UI = (function() {
  var gameState = null;
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
      var difficulty = GameCore.getDifficultyName(gameState.level);
      hudLevel.textContent = 'Arrow Out! \u00b7 Level ' + gameState.level + ' (' + difficulty + ')';
    }
    
    var left = aliveCount();
    if (hudLeft) {
      hudLeft.textContent = left + (left === 1 ? ' arrow to clear' : ' arrows to clear');
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
    var statStreaks = $('stat-streaks');
    
    if (statCurrent) statCurrent.textContent = gameState ? gameState.level : '1';
    if (statLevels) statLevels.textContent = levels;
    if (statStars) statStars.textContent = stars + ' / ' + (levels * 3);
    if (statPlays) statPlays.textContent = plays;
    if (statHints) statHints.textContent = save.stats.hintsUsed;
    if (statMistakes) statMistakes.textContent = save.stats.mistakes;
    if (statStreaks) statStreaks.textContent = save.streaks.current + ' (best: ' + save.streaks.best + ')';
  }

  // Settings
  function updateSettingsStatus() {
    var standalone = PWA.isStandalone();
    var swActive = PWA.swActive;
    var canPrompt = PWA.canPrompt();
    var storageOk = Storage.isStorageOk();
    
    var stMode = $('st-mode');
    var stSw = $('st-sw');
    var stInstall = $('st-install');
    var stStorage = $('st-storage');
    
    if (stMode) stMode.innerHTML = standalone ? '<span class="ok">Installed app \u2713</span>' : 'Browser tab';
    if (stSw) stSw.innerHTML = swActive ? '<span class="ok">Active \u2713</span>' : '<span class="no">Not active</span>';
    if (stInstall) stInstall.innerHTML = canPrompt ? '<span class="ok">Available \u2713</span>' : 'Not available';
    if (stStorage) stStorage.innerHTML = storageOk ? '<span class="ok">Saving \u2713</span>' : '<span class="no">Unavailable</span>';
  }

  // Achievements
  function buildAchievementsGrid() {
    var grid = $('achievements-grid');
    if (!grid) return;
    
    grid.textContent = '';
    var save = Storage.getSave();
    
    var achievements = [
      { id: 'first-win', name: 'First Blood', desc: 'Complete your first level', icon: '\ud83c\udf89', completed: save.stats.totalWins >= 1 },
      { id: 'ten-wins', name: 'Getting Good', desc: 'Complete 10 levels', icon: '\ud83c\udf89', completed: save.stats.totalWins >= 10 },
      { id: 'fifty-wins', name: 'Arrow Master', desc: 'Complete 50 levels', icon: '\ud83c\udf89', completed: save.stats.totalWins >= 50 },
      { id: 'hundred-wins', name: 'Arrow Legend', desc: 'Complete 100 levels', icon: '\ud83c\udfc6', completed: save.stats.totalWins >= 100 },
      { id: 'perfect-level', name: 'Flawless', desc: 'Get 3 stars on a level', icon: '\u2605\u2605\u2605', completed: Object.values(save.best).some(function(b) { return b.stars === 3; }) },
      { id: 'all-perfect', name: 'Perfectionist', desc: 'Get 3 stars on 10 levels', icon: '\u2605\u2605\u2605', completed: Object.values(save.best).filter(function(b) { return b.stars === 3; }).length >= 10 },
      { id: 'streak-5', name: 'Daily Habit', desc: '5-day streak', icon: '\ud83d\udca6', completed: save.streaks.best >= 5 },
      { id: 'streak-10', name: 'Dedicated', desc: '10-day streak', icon: '\ud83d\udca6', completed: save.streaks.best >= 10 },
      { id: 'no-hints', name: 'No Help Needed', desc: 'Complete 5 levels without hints', icon: '\ud83d\udca1', completed: save.stats.totalWins >= 5 && save.stats.hintsUsed === 0 },
      { id: 'daily-complete', name: 'Daily Champion', desc: 'Complete a daily challenge', icon: '\ud83c\udf96', completed: save.daily.completed }
    ];
    
    achievements.forEach(function(ach) {
      var item = document.createElement('div');
      item.className = 'achievement-item' + (ach.completed ? ' completed' : '');
      item.innerHTML = '<span class="ach-icon" aria-hidden="true">' + ach.icon + '</span>' +
        '<div class="ach-info"><div class="ach-name">' + ach.name + '</div>' +
        '<div class="ach-desc">' + ach.desc + '</div></div>' +
        (ach.completed ? '<span class="ach-check" aria-hidden="true">\u2713</span>' : '');
      grid.appendChild(item);
    });
  }

  // Home screen
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
      progressText.textContent = levels + ' / ' + Storage.DESIGN_LEVELS + ' levels cleared';
    }
    
    // Update daily challenge
    var dailyText = $('home-daily');
    if (dailyText) {
      var today = new Date();
      var dateStr = today.toISOString().slice(0, 10);
      var completed = save.daily.lastDate === dateStr && save.daily.completed;
      dailyText.textContent = completed ? 'Daily Challenge: Completed \u2713' : 'Daily Challenge: Available!';
    }
    
    openDlg('dlg-home');
  }

  // Win dialog
  function showWinDialog() {
    if (!gameState) return;
    
    var stars = GameCore.calcStars(gameState.wrong, gameState.hintsUsed);
    var done = gameState.level >= Storage.DESIGN_LEVELS;
    
    var winTitle = $('win-title');
    var btnNext = $('btn-next');
    var winStars = $('win-stars');
    var winSub = $('win-sub');
    
    if (winTitle) winTitle.textContent = done ? 'Campaign Complete!' : 'Board Cleared!';
    if (btnNext) btnNext.style.display = done ? 'none' : '';
    if (winStars) winStars.innerHTML = starsHTML(stars);
    if (winSub) {
      winSub.innerHTML = done
        ? 'You cleared all ' + Storage.DESIGN_LEVELS + ' levels. Legend! \ud83c\udfc6<br>' +
          gameState.wrong + ' wrong tap' + (gameState.wrong === 1 ? '' : 's') + ' this run.'
        : gameState.wrong + ' wrong tap' + (gameState.wrong === 1 ? '' : 's') + ' \u00b7 ' +
          gameState.hintsUsed + ' hint' + (gameState.hintsUsed === 1 ? '' : 's') +
          (stars === 3 ? ' \u00b7 <span class="perfect">Perfect!</span>' : '');
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
        Audio.ui(); 
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
    openDlg: openDlg,
    closeAll: closeAll,
    anyOpen: anyOpen,
    toast: toast,
    buildLevelGrid: buildLevelGrid,
    updateStats: updateStats,
    updateSettingsStatus: updateSettingsStatus,
    buildAchievementsGrid: buildAchievementsGrid,
    showHomeScreen: showHomeScreen,
    showWinDialog: showWinDialog,
    showFailDialog: showFailDialog,
    updateSoundBtn: updateSoundBtn,
    updateVibrationBtn: updateVibrationBtn,
    updateThemeBtn: updateThemeBtn,
    toggleTheme: toggleTheme,
    setTheme: setTheme,
    REDUCED: REDUCED
  };
})();
