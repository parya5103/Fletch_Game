/**
 * Arrow Out! - Main Game Module
 * Orchestrates all game functionality
 */
'use strict';

// Initialize all modules
const Game = (function() {
  var gameState = null;
  var canvas = null;
  var ctx = null;
  var saveTimer = 0;
  var REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // Initialize the game
  function init() {
    // Initialize modules
    Storage.init();
    Audio.unlock();
    Haptics.checkSupport();
    PWA.buildManifest();
    PWA.registerSW();
    UI.init();
    
    // Set up canvas
    canvas = document.getElementById('board');
    if (canvas) {
      ctx = canvas.getContext('2d');
      Render.init(canvas);
    }
    
    // Set up event listeners
    setupEventListeners();
    
    // Initialize game state
    var restored = tryRestore();
    if (!restored) {
      var save = Storage.getSave();
      loadLevel(Math.min(save.unlocked, Storage.DESIGN_LEVELS));
    } else {
      Render.fitCanvas();
      UI.updateHUD();
      saveCur();
    }
    
    // Update UI
    UI.updateSoundBtn();
    UI.updateVibrationBtn();
    UI.updateSettingsStatus();
    
    // Show home screen initially
    UI.showHomeScreen();
    
    // Ensure render loop is running
    Render.ensureLoop();
  }

  // Set up event listeners
  function setupEventListeners() {
    // Canvas input
    var canvasEl = document.getElementById('board');
    if (canvasEl) {
      on(canvasEl, 'pointerdown', handlePointerDown, { passive: false });
      on(canvasEl, 'contextmenu', function(e) { e.preventDefault(); });
      on(canvasEl, 'dblclick', function(e) { e.preventDefault(); });
    }
    
    // Window events
    on(window, 'resize', onResize);
    on(window, 'orientationchange', onResize);
    
    if (window.visualViewport) {
      on(window.visualViewport, 'resize', onResize);
    }
    
    if ('ResizeObserver' in window) {
      var boardWrap = document.getElementById('board-wrap');
      if (boardWrap) {
        new ResizeObserver(onResize).observe(boardWrap);
      }
    }
    
    // Visibility change
    on(document, 'visibilitychange', function() {
      if (document.hidden) {
        saveCur();
        Audio.suspend();
      } else {
        Audio.resume();
        Render.needsRender();
        Render.ensureLoop();
      }
    });
    
    // Page hide
    on(window, 'pagehide', function() { saveCur(); });
    
    // Button wiring
    wireButtons();
    
    // Keyboard
    on(document, 'keydown', function(e) { 
      if (e.key === 'Escape' && UI.anyOpen()) UI.closeAll(); 
    });
  }

  // DOM helpers
  function $(id) { return document.getElementById(id); }
  function on(el, ev, fn, opts) { if (el) el.addEventListener(ev, fn, opts); }

  // Handle pointer down on canvas
  var lastTap = { t: 0, idx: -1 };
  function handlePointerDown(e) {
    if (!gameState || gameState.over || gameState.failed || !e.isPrimary) return;
    e.preventDefault();
    
    var rect = canvas.getBoundingClientRect();
    var x = e.clientX - rect.left, y = e.clientY - rect.top;
    var col = Math.floor(x / Render.view.cell), row = Math.floor(y / Render.view.cell);
    
    if (col < 0 || row < 0 || col >= gameState.cols || row >= gameState.rows) return;
    
    var ai = gameState.occ[row * gameState.cols + col];
    if (ai === -1 || !gameState.arrows[ai].alive) return;
    
    var now = performance.now();
    if (ai === lastTap.idx && now - lastTap.t < 160) return;
    lastTap = { t: now, idx: ai };
    
    Audio.unlock();
    tapArrow(ai);
  }

  // Wire up buttons
  function wireButtons() {
    // Sound toggle
    on($('btn-sound'), 'click', function() {
      Audio.enabled = !Audio.enabled;
      UI.updateSoundBtn();
      if (Audio.enabled) Audio.ui();
    });
    
    on($('chk-sound'), 'change', function() {
      Audio.enabled = $('chk-sound').checked;
      UI.updateSoundBtn();
    });
    
    // Vibration toggle
    on($('btn-vibrate'), 'click', function() {
      var save = Storage.getSave();
      save.vibration = !save.vibration;
      Storage.updateSave(save);
      UI.updateVibrationBtn();
      if (save.vibration) Haptics.lightTap();
    });
    
    on($('chk-vibrate'), 'change', function() {
      var save = Storage.getSave();
      save.vibration = $('chk-vibrate').checked;
      Storage.updateSave(save);
      UI.updateVibrationBtn();
    });
    
    // Theme toggle
    on($('btn-theme'), 'click', function() {
      UI.toggleTheme();
      if (Storage.getSave().theme === 'dark') {
        Audio.ui();
      }
    });
    
    on($('chk-theme'), 'change', function() {
      UI.setTheme($('chk-theme').checked ? 'dark' : 'light');
    });
    
    // Menu button
    on($('btn-menu'), 'click', function() {
      Audio.ui();
      var save = Storage.getSave();
      var btnPlay = $('btn-play');
      if (btnPlay) {
        btnPlay.textContent = 'Play \u00b7 Level ' + (gameState && gameState.over ? Math.min(gameState.level + 1, Storage.DESIGN_LEVELS) : (gameState ? gameState.level : 1));
      }
      UI.openDlg('dlg-menu');
    });
    
    // Play button
    on($('btn-play'), 'click', function() {
      UI.closeAll();
      Audio.ui();
      Audio.unlock();
      if (gameState && gameState.over) {
        loadLevel(Math.min(gameState.level + 1, Storage.DESIGN_LEVELS));
      } else if (gameState && gameState.failed) {
        loadLevel(gameState.level);
      } else {
        var save = Storage.getSave();
        loadLevel(Math.min(save.unlocked, Storage.DESIGN_LEVELS));
      }
    });
    
    // Continue button (home screen)
    on($('btn-continue'), 'click', function() {
      UI.closeAll();
      Audio.ui();
      var save = Storage.getSave();
      if (save.cur) {
        var restored = tryRestore();
        if (!restored) {
          loadLevel(Math.min(save.unlocked, Storage.DESIGN_LEVELS));
        }
      } else {
        loadLevel(Math.min(save.unlocked, Storage.DESIGN_LEVELS));
      }
    });
    
    // Levels button
    on($('btn-levels'), 'click', function() {
      Audio.ui();
      UI.buildLevelGrid();
      UI.openDlg('dlg-levels');
    });
    
    // Stats button
    on($('btn-stats-menu'), 'click', function() {
      Audio.ui();
      UI.updateStats();
      UI.openDlg('dlg-stats');
    });
    
    // Achievements button
    on($('btn-achievements'), 'click', function() {
      Audio.ui();
      UI.buildAchievementsGrid();
      UI.openDlg('dlg-achievements');
    });
    
    // Daily challenge button
    on($('btn-daily'), 'click', function() {
      Audio.ui();
      loadDailyChallenge();
    });
    
    // How to play button
    on($('btn-howto'), 'click', function() {
      Audio.ui();
      UI.openDlg('dlg-howto');
    });
    
    // Settings button
    on($('btn-settings'), 'click', function() {
      Audio.ui();
      UI.updateSettingsStatus();
      UI.openDlg('dlg-settings');
    });
    
    // Install button
    on($('btn-install-menu'), 'click', function() {
      Audio.ui();
      PWA.installAction();
    });
    
    // Game action buttons
    on($('btn-undo'), 'click', function() { undo(); });
    on($('btn-hint'), 'click', function() { hint(); });
    on($('btn-restart'), 'click', function() {
      if (gameState && gameState.over) return;
      Audio.ui();
      loadLevel(gameState.level);
      UI.toast('Level restarted');
    });
    
    // Win dialog buttons
    on($('btn-next'), 'click', function() {
      UI.closeAll();
      Audio.ui();
      loadLevel(Math.min(gameState.level + 1, Storage.DESIGN_LEVELS));
    });
    on($('btn-replay'), 'click', function() {
      UI.closeAll();
      Audio.ui();
      loadLevel(gameState.level);
    });
    on($('btn-win-levels'), 'click', function() {
      Audio.ui();
      UI.buildLevelGrid();
      UI.openDlg('dlg-levels');
    });
    
    // Fail dialog buttons
    on($('btn-retry'), 'click', function() {
      UI.closeAll();
      Audio.ui();
      loadLevel(gameState.level);
    });
    on($('btn-fail-levels'), 'click', function() {
      Audio.ui();
      UI.buildLevelGrid();
      UI.openDlg('dlg-levels');
    });
    
    // Ad hint buttons
    on($('btn-adhint-watch'), 'click', function() { adForHint(); });
    on($('btn-adhint-close'), 'click', function() { Audio.ui(); UI.closeAll(); });
    
    // Reset button
    var resetArmed = false, resetTimer = 0;
    on($('btn-reset'), 'click', function() {
      if (!resetArmed) {
        resetArmed = true;
        var btnReset = $('btn-reset');
        if (btnReset) btnReset.textContent = 'Tap again to confirm';
        clearTimeout(resetTimer);
        resetTimer = setTimeout(function() { 
          resetArmed = false; 
          var btnReset = $('btn-reset');
          if (btnReset) btnReset.textContent = 'Reset all progress';
        }, 2600);
        return;
      }
      clearTimeout(resetTimer);
      resetArmed = false;
      var btnReset = $('btn-reset');
      if (btnReset) btnReset.textContent = 'Reset all progress';
      Storage.resetAll();
      UI.closeAll();
      loadLevel(1);
      UI.toast('Progress reset');
    });
    
    // Copy service worker button
    on($('btn-copy-sw'), 'click', function() {
      var done = function() { UI.toast('Service worker code copied'); };
      var fallbackCopy = function() {
        var ta = document.createElement('textarea');
        ta.value = PWA.SW_SRC;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { 
          document.execCommand('copy'); 
          done(); 
        } catch (e) { 
          UI.toast('Copy failed \u2014 select the code manually'); 
        }
        document.body.removeChild(ta);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(PWA.SW_SRC).then(done, fallbackCopy);
      } else fallbackCopy();
    });
    
    // Home button
    on($('btn-home'), 'click', function() {
      Audio.ui();
      UI.showHomeScreen();
    });
  }

  // Resize handler
  var resizeTimer = 0;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function() {
      Render.fitCanvas();
    }, 80);
  }

  // Game state management
  function loadLevel(n) {
    var L = GameCore.genLevel(n);
    
    gameState = {
      level: n,
      cols: L.cols,
      rows: L.rows,
      shape: L.shape,
      arrows: L.arrows,
      occ: null,
      hearts: GameCore.MAX_HEARTS,
      wrong: 0,
      hintsUsed: 0,
      undoIds: [],
      over: false,
      failed: false,
      hintIdx: -1,
      shake: [],
      pop: [],
      flying: [],
      particles: []
    };
    
    rebuildOcc();
    
    // Update modules with new state
    Render.setGameState(gameState);
    UI.setGameState(gameState);
    
    Render.fitCanvas();
    Render.needsRender();
    Render.ensureLoop();
    UI.updateHUD();
    saveCur();
    
    // Track level start
    Storage.getSave().stats.totalPlays++;
    Storage.persist();
  }

  function loadDailyChallenge() {
    var today = new Date();
    var L = GameCore.genDailyChallenge(today);
    
    gameState = {
      level: 'daily',
      cols: L.cols,
      rows: L.rows,
      shape: L.shape,
      arrows: L.arrows,
      occ: null,
      hearts: GameCore.MAX_HEARTS,
      wrong: 0,
      hintsUsed: 0,
      undoIds: [],
      over: false,
      failed: false,
      hintIdx: -1,
      shake: [],
      pop: [],
      flying: [],
      particles: []
    };
    
    rebuildOcc();
    
    Render.setGameState(gameState);
    UI.setGameState(gameState);
    
    Render.fitCanvas();
    Render.needsRender();
    Render.ensureLoop();
    UI.updateHUD();
    
    UI.closeAll();
  }

  function rebuildOcc() {
    if (!gameState) return;
    var N = gameState.cols * gameState.rows;
    gameState.occ = new Int32Array(N).fill(-1);
    for (var i = 0; i < gameState.arrows.length; i++) {
      if (gameState.arrows[i].alive) {
        gameState.occ[gameState.arrows[i].y * gameState.cols + gameState.arrows[i].x] = i;
      }
    }
  }

  function saveCur() {
    if (!gameState) return;
    
    var save = Storage.getSave();
    
    if (gameState.over) {
      save.cur = null;
    } else {
      var alive = [];
      for (var i = 0; i < gameState.arrows.length; i++) {
        alive.push(gameState.arrows[i].alive ? 1 : 0);
      }
      var shapeIdx = [];
      for (var s = 0; s < gameState.shape.length; s++) {
        if (gameState.shape[s]) shapeIdx.push(s);
      }
      save.cur = {
        level: gameState.level,
        cols: gameState.cols,
        rows: gameState.rows,
        shapeIdx: shapeIdx,
        arrows: gameState.arrows,
        alive: alive,
        hearts: gameState.hearts,
        wrong: gameState.wrong,
        hintsUsed: gameState.hintsUsed,
        undoIds: gameState.undoIds.slice(-40)
      };
    }
    
    Storage.updateSave(save);
  }

  function saveCurSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveCur, 250);
  }

  function tryRestore() {
    var save = Storage.getSave();
    var c = save.cur;
    
    if (!c || typeof c.level !== 'number' || !Array.isArray(c.arrows)) return false;
    if (c.arrows.length !== c.alive.length) return false;
    if ((c.hearts | 0) <= 0) return false;
    
    var N = c.cols * c.rows;
    if (N > 400) return false;
    
    gameState = {
      level: c.level,
      cols: c.cols,
      rows: c.rows,
      shape: new Uint8Array(N),
      arrows: [],
      occ: null,
      hearts: Math.min(GameCore.MAX_HEARTS, Math.max(0, c.hearts | 0)),
      wrong: c.wrong | 0,
      hintsUsed: c.hintsUsed | 0,
      undoIds: Array.isArray(c.undoIds) ? c.undoIds.slice(-40) : [],
      over: false,
      failed: false,
      hintIdx: -1,
      shake: [],
      pop: [],
      flying: [],
      particles: []
    };
    
    for (var i = 0; i < c.shapeIdx.length; i++) {
      var idx = c.shapeIdx[i];
      if (idx < 0 || idx >= N) return false;
      gameState.shape[idx] = 1;
    }
    
    for (var a = 0; a < c.arrows.length; a++) {
      var A = c.arrows[a];
      if (!A || A.x < 0 || A.x >= c.cols || A.y < 0 || A.y >= c.rows) return false;
      gameState.arrows.push({ 
        x: A.x, 
        y: A.y, 
        dir: A.dir & 3, 
        c: A.c % GameCore.PALETTE.length, 
        step: A.step | 0, 
        alive: !!c.alive[a] 
      });
    }
    
    gameState.failed = gameState.hearts <= 0;
    rebuildOcc();
    
    Render.setGameState(gameState);
    UI.setGameState(gameState);
    
    return true;
  }

  // Game moves
  function tapArrow(i) {
    if (!gameState || gameState.over || gameState.failed) return;
    
    var A = gameState.arrows[i];
    var blocker = GameCore.rayBlocker(gameState.occ, gameState.arrows, gameState.cols, gameState.rows, A.x, A.y, A.dir);
    
    if (blocker === -1) {
      removeArrow(i);
    } else {
      gameState.hearts--;
      gameState.wrong++;
      gameState.shake[i] = performance.now();
      gameState.shake[blocker] = performance.now();
      
      Audio.blocked();
      
      var save = Storage.getSave();
      if (save.vibration) Haptics.heavyTap();
      
      UI.updateHUD(true);
      Storage.updateMistakes(1);
      
      if (gameState.hearts <= 0) {
        gameState.failed = true;
        var save = Storage.getSave();
        save.cur = null;
        Storage.updateSave(save);
        setTimeout(function() { 
          UI.showFailDialog(); 
        }, REDUCED ? 150 : 500);
      } else if (gameState.wrong === 1) {
        UI.toast('Blocked! Clear the arrow in its path first.');
      }
      
      Render.needsRender();
      Render.ensureLoop();
      saveCurSoon();
    }
  }

  function removeArrow(i) {
    if (!gameState) return;
    
    gameState.arrows[i].alive = false;
    gameState.occ[gameState.arrows[i].y * gameState.cols + gameState.arrows[i].x] = -1;
    gameState.undoIds.push(i);
    if (gameState.undoIds.length > 100) gameState.undoIds.shift();
    
    Render.spawnFly(i, gameState);
    Audio.fly(gameState.arrows[i].dir);
    
    var save = Storage.getSave();
    if (save.vibration) Haptics.lightTap();
    
    if (gameState.hintIdx === i) gameState.hintIdx = -1;
    
    Render.needsRender();
    Render.ensureLoop();
    UI.updateHUD();
    saveCurSoon();
    
    if (aliveCount() === 0) onWin();
  }

  function aliveCount() {
    if (!gameState) return 0;
    var n = 0;
    for (var i = 0; i < gameState.arrows.length; i++) {
      if (gameState.arrows[i].alive) n++;
    }
    return n;
  }

  function undo() {
    if (!gameState || gameState.over || gameState.failed || !gameState.undoIds.length) return;
    
    var i = gameState.undoIds.pop();
    var A = gameState.arrows[i];
    if (A.alive) return;
    
    A.alive = true;
    gameState.occ[A.y * gameState.cols + A.x] = i;
    gameState.pop[i] = performance.now();
    
    Audio.undo();
    var save = Storage.getSave();
    if (save.vibration) Haptics.mediumTap();
    
    Render.needsRender();
    Render.ensureLoop();
    UI.updateHUD();
    saveCurSoon();
  }

  function hint() {
    if (!gameState || gameState.over || gameState.failed) return;
    
    if (gameState.hintsUsed >= GameCore.FREE_HINTS) {
      Audio.ui();
      UI.openDlg('dlg-adhint');
      return;
    }
    doHint();
  }

  function doHint() {
    if (!gameState) return;
    
    var h = GameCore.hintArrow(gameState.arrows, gameState.occ, gameState.cols, gameState.rows);
    if (h < 0) return;
    
    gameState.hintIdx = h;
    gameState.hintsUsed++;
    
    Audio.hint();
    var save = Storage.getSave();
    if (save.vibration) Haptics.hint();
    
    UI.updateHintBtn();
    Storage.updateHintsUsed(1);
    
    Render.needsRender();
    Render.ensureLoop();
  }

  function adForHint() {
    UI.closeAll();
    Audio.ui();
    Audio.unlock();
    
    // In demo mode, just give a hint after a delay
    if (!Ads.enabled || !Ads.provider || !Ads.provider.requestRewarded) {
      UI.openDlg('dlg-ad');
      var t = 5, el = document.getElementById('ad-count');
      if (el) {
        el.textContent = 'Demo ad \u2014 hint in ' + t + 's\u2026';
      }
      var iv = setInterval(function() {
        t--;
        if (t <= 0) {
          clearInterval(iv);
          UI.closeAll();
          doHint();
          UI.toast('Hint unlocked \u2713');
        } else if (el) {
          el.textContent = 'Demo ad \u2014 hint in ' + t + 's\u2026';
        }
      }, 1000);
      return;
    }
    
    Ads.requestRewarded(function(ok) {
      if (ok) {
        doHint();
        UI.toast('Hint unlocked \u2713');
      }
    });
  }

  function onWin() {
    if (!gameState) return;
    
    gameState.over = true;
    gameState.hintIdx = -1;
    
    Audio.win();
    var save = Storage.getSave();
    if (save.vibration) Haptics.win();
    
    if (!REDUCED) Render.spawnConfetti();
    
    Render.needsRender();
    Render.ensureLoop();
    
    var stars = GameCore.calcStars(gameState.wrong, gameState.hintsUsed);
    var today = new Date();
    
    // Update progress
    if (gameState.level !== 'daily') {
      var prev = save.best[gameState.level];
      save.best[gameState.level] = {
        stars: Math.max(prev ? prev.stars : 0, stars),
        plays: (prev ? prev.plays : 0) + 1
      };
      
      if (gameState.level >= save.unlocked) {
        save.unlocked = Math.min(gameState.level + 1, Storage.DESIGN_LEVELS);
      }
      
      Storage.updateLevelBest(gameState.level, stars, 1);
    } else {
      Storage.updateDailyChallenge(today, stars);
    }
    
    save.cur = null;
    Storage.updateSave(save);
    
    setTimeout(function() {
      UI.showWinDialog();
    }, REDUCED ? 200 : 900);
  }

  // Advertising (placeholder)
  var Ads = {
    enabled: false,
    provider: null,
    init: function() {},
    showBanner: function() {
      var el = document.getElementById('ad-slot');
      if (!this.enabled || !this.provider || !this.provider.showBanner) {
        if (el) el.classList.remove('visible');
        return false;
      }
      if (el) el.classList.add('visible');
      this.provider.showBanner(el);
      return true;
    },
    requestRewarded: function(onReward) {
      if (this.enabled && this.provider && this.provider.requestRewarded) {
        this.provider.requestRewarded(onReward);
      } else {
        onReward(true);
      }
    }
  };

  // Start the game
  return {
    init: init,
    loadLevel: loadLevel,
    loadDailyChallenge: loadDailyChallenge,
    tapArrow: tapArrow,
    undo: undo,
    hint: hint,
    getState: function() { return gameState; },
    Ads: Ads
  };
})();

// Start the game when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  Game.init();
});
