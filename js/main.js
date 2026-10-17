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
    Audio.unlock();
    Haptics.checkSupport();
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
      scheduleWin();
    }
    
    // Update UI
    UI.updateSoundBtn();
    UI.updateVibrationBtn();
    UI.updateSettingsStatus();
    UI.updateMusicBtn();
    applyMusic();
    applySkin();
    
    // Animated home-screen background (cosmetic - must never break boot)
    try { Bgfx.init(); } catch (e) {}
    
    // Show home screen initially
    UI.showHomeScreen();
    
    // PWA app-shortcut deep link (?daily=1): launch straight into today's
    // Daily Challenge. The daily login-reward dialog is skipped on this
    // boot (it stays claimable on the next normal start).
    if (/[?&]daily=1(&|$)/.test(location.search)) {
      loadDailyChallenge();
    } else {
      // Daily login reward (once per day)
      checkDailyReward();
    }

    // First-time onboarding: show the how-to-play card once, but never
    // on top of the daily reward dialog (it stacks fine afterwards).
    try {
      var sv = Storage.getSave();
      if (sv.settings && !sv.settings.seenOnboarding) {
        sv.settings.seenOnboarding = true;
        Storage.persist();
        var rewardDlg = document.getElementById('dlg-reward');
        if (!rewardDlg || !rewardDlg.classList.contains('show')) {
          UI.openDlg('dlg-howto');
        }
      }
    } catch (e) { /* onboarding is best-effort */ }
    
    // Ensure render loop is running
    Render.ensureLoop();

    // Timed bonus objective countdown (cheap 250ms tick, no-op without a bonus)
    setInterval(bonusTick, 250);
  }

  // Set up event listeners
  function setupEventListeners() {
    // Canvas input
    var canvasEl = document.getElementById('board');
    if (canvasEl) {
      if (window.PointerEvent) {
        on(canvasEl, 'pointerdown', gestureDown, { passive: false });
        on(canvasEl, 'pointermove', gestureMove, { passive: false });
        on(canvasEl, 'pointerup', gestureUp, { passive: false });
        on(canvasEl, 'pointercancel', gestureCancel);
        on(canvasEl, 'lostpointercapture', gestureCancel);
      } else {
        // Fallback for browsers without Pointer Events (older mobile WebViews)
        on(canvasEl, 'touchstart', function(e) { legacyTouch(e, gestureDown); }, { passive: false });
        on(canvasEl, 'touchmove', function(e) { legacyTouch(e, gestureMove); }, { passive: false });
        on(canvasEl, 'touchend', function(e) { legacyTouch(e, gestureUp); }, { passive: false });
        on(canvasEl, 'touchcancel', function(e) { legacyTouch(e, gestureCancel); }, { passive: false });
        on(canvasEl, 'mousedown', gestureDown, { passive: false });
        on(window, 'mousemove', gestureMove, { passive: false });
        on(window, 'mouseup', gestureUp, { passive: false });
      }
      on(canvasEl, 'wheel', function(e) {
        if (UI.anyOpen()) return;
        e.preventDefault();
        const r = canvasEl.getBoundingClientRect(), v = Render.getView();
        Render.zoomAt(v.zoom * Math.exp(-e.deltaY * 0.002), e.clientX - r.left, e.clientY - r.top);
      }, { passive: false });
      on($('btn-zoom-in'), 'click', function() {
        const v = Render.getView(); Render.zoomAt(Math.max(v.zoom * 1.5, 44 / v.cell));
      });
      on($('btn-zoom-out'), 'click', function() { Render.zoomAt(Render.getView().zoom / 1.5); });
      on($('btn-board-fit'), 'click', function() { Render.resetView(); });
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
      if (e.key === 'Escape' && !e.repeat && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey && UI.anyOpen()) {
        e.preventDefault();
        UI.closeAll();
      }
    });
  }

  // DOM helpers
  function $(id) { return document.getElementById(id); }
  function on(el, ev, fn, opts) { if (el) el.addEventListener(ev, fn, opts); }

  // Commit selection only on release. Drag, pinch, cancellation, and a
  // second finger suppress the entire gesture, so navigation costs no heart.
  const pointers = new Map();
  var gestureMoved = false, pinchDistance = 0, lastTouch = -Infinity;
  function legacyTouch(e, handler) {
    lastTouch = performance.now();
    e.preventDefault();
    for (const t of e.changedTouches) handler({ pointerId: t.identifier,
      pointerType: 'touch', clientX: t.clientX, clientY: t.clientY,
      button: 0, preventDefault: function() {} });
  }
  function gestureDown(e) {
    if (UI.anyOpen() || (e.button !== undefined && e.button !== 0) ||
        (!e.pointerType && performance.now() - lastTouch < 700) ||
        !Number.isFinite(e.clientX) || !Number.isFinite(e.clientY)) return;
    e.preventDefault();
    if (!pointers.size) gestureMoved = false;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY });
    if (canvas.setPointerCapture && e.pointerId !== undefined) {
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* legacy synthetic touch */ }
    }
    if (pointers.size > 1) { gestureMoved = true; pinchDistance = 0; }
  }
  function gestureMove(e) {
    const p = pointers.get(e.pointerId);
    if (!p || !Number.isFinite(e.clientX) || !Number.isFinite(e.clientY)) return;
    e.preventDefault();
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (Math.hypot(p.x - p.startX, p.y - p.startY) > 8) gestureMoved = true;
    if (pointers.size === 1 && gestureMoved) Render.pan(dx, dy);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const r = canvas.getBoundingClientRect();
      if (pinchDistance > 0) Render.zoomAt(Render.getView().zoom * distance / pinchDistance,
        (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
      pinchDistance = distance;
    }
  }
  function gestureUp(e) {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    pointers.delete(e.pointerId);
    if (Math.hypot(e.clientX - p.startX, e.clientY - p.startY) > 8) gestureMoved = true;
    if (!gestureMoved && !pointers.size) handlePointerDown(e);
    pinchDistance = 0;
  }
  function gestureCancel(e) {
    pointers.delete(e.pointerId); gestureMoved = true; pinchDistance = 0;
  }

  // Handle pointer/touch/mouse down on canvas
  var lastTap = { t: 0, idx: -1 };
  function pointerPos(e) {
    if (typeof e.clientX === 'number' && typeof e.clientY === 'number') {
      return { x: e.clientX, y: e.clientY };
    }
    var t = e.changedTouches && e.changedTouches[0];
    return t ? { x: t.clientX, y: t.clientY } : null;
  }
  function handlePointerDown(e) {
    if (!gameState || gameState.over || gameState.failed || !gameState.occ) return;
    if (UI.anyOpen() || (e.button !== undefined && e.button !== 0)) return;
    if (e.isPrimary === false) return; // ignore non-primary pointers
    e.preventDefault();

    var rect = canvas.getBoundingClientRect();
    if (!rect) return;
    var cellSize = Render.getCellSize();
    if (!(cellSize > 0)) return; // canvas not laid out yet

    var p = pointerPos(e);
    if (!p || !isFinite(p.x) || !isFinite(p.y)) return;
    var x = p.x - rect.left, y = p.y - rect.top;
    var point = Render.screenToCell(x, y);
    if (!point) return;
    var v = Render.getView();
    if (v.cell * v.zoom < 24) {
      Render.zoomAt(44 / v.cell, x, y);
      return;
    }
    var col = point.x, row = point.y;

    // Reject out-of-bounds grid coordinates
    if (col < 0 || row < 0 || col >= gameState.cols || row >= gameState.rows) return;

    var ai = gameState.occ[row * gameState.cols + col];
    var A = gameState.arrows[ai];
    if (ai === undefined || ai === -1 || !A || !A.alive) return;

    // Debounce double events on the same arrow
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
      applyMusic();
      if (Audio.enabled) Audio.ui();
    });
    
    on($('chk-sound'), 'change', function() {
      Audio.enabled = $('chk-sound').checked;
      UI.updateSoundBtn();
      applyMusic();
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
    
    // Background music toggle
    on($('chk-music'), 'change', function() {
      var save = Storage.getSave();
      save.music = !!$('chk-music').checked;
      Storage.persist();
      applyMusic();
      if (save.music) UI.toast('Music on \u266a');
    });
    
    // Daily reminders toggle. The browser permission prompt is only ever
    // triggered from this deliberate user action, never on page load.
    // Turning it ON subscribes this device to Web Push and auto-saves the
    // subscription to the developer's Supabase roster table (js/pwa.js),
    // so every player is done with one tap - no copy-paste.
    on($('chk-notifs'), 'change', function() {
      var save = Storage.getSave();
      if (!save.settings) save.settings = {};
      var want = $('chk-notifs').checked;
      save.settings.notifications = want;
      Storage.persist();
      UI.updateNotifUI();
      if (!want) {
        // Best-effort: the developer's send list forgets this device,
        // then the browser subscription itself is removed.
        PWA.getPushSubscriptionJson().then(function(json) {
          if (json) PWA.deletePushSubscription(json);
        });
        PWA.unsubscribePush().then(function() { UI.updateNotifUI(); });
        return;
      }
      var perm = PWA.notifPermission();
      if (perm === 'denied' || perm === 'unsupported') {
        // Permission was blocked in browser settings (or unavailable):
        // the preference is still saved, the game stays fully playable.
        UI.toast(perm === 'denied' ? 'Blocked in browser notification settings' : 'Notifications not supported here');
        return;
      }
      var after = function(state) {
        UI.updateNotifUI();
        if (state !== 'granted') {
          UI.toast(state === 'denied' ? 'Permission denied in browser' : 'Notifications not supported here');
          return;
        }
        PWA.subscribePush().then(function(json) {
          if (!json) {
            UI.toast('Push not available in this browser');
            return;
          }
          PWA.submitPushSubscription(json).then(function(ok) {
            UI.toast(ok
              ? 'Daily reminders on \u2014 see you soon!'
              : 'Could not save reminders \u2014 check your connection, then toggle off and on');
            UI.updateNotifUI();
          });
        });
      };
      if (perm === 'granted') after('granted');
      else PWA.requestNotifPermission().then(after);
    });
    
    // Share result (win dialog)
    on($('btn-share-win'), 'click', function() {
      Audio.ui();
      if (!gameState) return;
      var stars = GameCore.calcStars(gameState.wrong, gameState.hintsUsed);
      var what = gameState.level === 'daily'
        ? 'today\'s Daily Challenge'
        : 'Level ' + gameState.level;
      shareGame('I just cleared ' + what + ' in Arrow Out! ' + repeatStars(stars) + ' Think you can beat me?');
    });
    
    // Share the game (menu)
    on($('btn-share-menu'), 'click', function() {
      Audio.ui();
      shareGame('Arrow Out! \u2014 a free tap-away arrow puzzle with 1000 levels, daily challenges and achievements. Play it here:');
    });
    
    // Menu button
    on($('btn-menu'), 'click', function() {
      Audio.ui();
      var save = Storage.getSave();
      var btnPlay = $('btn-play');
      if (btnPlay) {
        var lv = gameState ? gameState.level : 1;
        btnPlay.textContent = lv === 'daily'
          ? 'Play \u00b7 Daily'
          : 'Play \u00b7 Level ' + (gameState && gameState.over ? Math.min(lv + 1, Storage.DESIGN_LEVELS) : lv);
      }
      UI.openDlg('dlg-menu');
    });
    
    // Play button
    on($('btn-play'), 'click', function() {
      UI.closeAll();
      Audio.ui();
      Audio.unlock();
      if (gameState && gameState.over) {
        nextLevel();
      } else if (gameState && gameState.failed) {
        reloadLevel();
      } else if (gameState && gameState.level) {
        // Paused mid-level: restart the level the player is actually on
        reloadLevel();
      } else {
        var save = Storage.getSave();
        loadLevel(Math.min(save.unlocked, Storage.DESIGN_LEVELS));
      }
    });
    
    // Continue button (home screen)
    on($('btn-continue'), 'click', function() {
      UI.closeAll();
      Audio.ui();
      UI.showScreen('game');
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
    on($('btn-levels-menu'), 'click', function() {
      Audio.ui();
      UI.buildLevelGrid();
      UI.openDlg('dlg-levels');
    });
    
    // Stats button (menu dialog uses a different id than the home screen)
    on($('btn-stats-menu'), 'click', function() {
      Audio.ui();
      UI.updateStats();
      UI.openDlg('dlg-stats');
    });
    on($('btn-stats-menu-2'), 'click', function() {
      Audio.ui();
      UI.closeAll();
      UI.updateStats();
      UI.openDlg('dlg-stats');
    });
    
    // Home screen buttons
    on($('btn-levels'), 'click', function() {
      Audio.ui();
      UI.closeAll();
      UI.buildLevelGrid();
      UI.openDlg('dlg-levels');
    });
    on($('btn-achievements'), 'click', function() {
      Audio.ui();
      UI.closeAll();
      UI.buildAchievementsGrid();
      UI.openDlg('dlg-achievements');
    });
    on($('btn-settings'), 'click', function() {
      Audio.ui();
      UI.closeAll();
      UI.updateSettingsStatus();
      UI.updateMusicBtn();
      UI.openDlg('dlg-settings');
    });
    on($('btn-daily'), 'click', function() {
      Audio.ui();
      Audio.unlock();
      UI.closeAll();
      loadDailyChallenge();
    });
    
    // Shop buttons (home + menu)
    on($('btn-shop'), 'click', function() {
      Audio.ui();
      UI.closeAll();
      UI.buildShopGrid();
      UI.openDlg('dlg-shop');
    });
    on($('btn-shop-menu'), 'click', function() {
      Audio.ui();
      UI.buildShopGrid();
      UI.openDlg('dlg-shop');
    });
    
    // Daily login reward claim
    on($('btn-reward-claim'), 'click', function() {
      claimDailyReward();
    });
    
    // Achievements button
    on($('btn-achievements-menu'), 'click', function() {
      Audio.ui();
      UI.buildAchievementsGrid();
      UI.openDlg('dlg-achievements');
    });
    
    // Daily challenge button
    on($('btn-daily-menu'), 'click', function() {
      Audio.ui();
      loadDailyChallenge();
    });
    
    // How to play button
    on($('btn-howto'), 'click', function() {
      Audio.ui();
      UI.openDlg('dlg-howto');
    });
    
    // Settings button
    on($('btn-settings-menu'), 'click', function() {
      Audio.ui();
      UI.updateSettingsStatus();
      UI.updateMusicBtn();
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
      reloadLevel();
      UI.toast('Level restarted');
    });
    
    // Win dialog buttons
    on($('btn-next'), 'click', function() {
      UI.closeAll();
      Audio.ui();
      nextLevel();
    });
    on($('btn-replay'), 'click', function() {
      UI.closeAll();
      Audio.ui();
      reloadLevel();
    });
    on($('btn-win-levels'), 'click', function() {
      Audio.ui();
      UI.closeAll();
      UI.buildLevelGrid();
      UI.openDlg('dlg-levels');
    });
    
    // Fail dialog buttons
    on($('btn-retry'), 'click', function() {
      UI.closeAll();
      Audio.ui();
      reloadLevel();
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
      PWA.getServiceWorkerSource().then(function(source) {
        if (!source) { UI.toast('Service worker unavailable — reconnect and try again'); return; }
        var done = function() { UI.toast('Service worker code copied'); };
        var fallbackCopy = function() {
          var ta = document.createElement('textarea');
          ta.value = source;
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
          navigator.clipboard.writeText(source).then(done, fallbackCopy);
        } else fallbackCopy();
      });
    });

    // Home button
    on($('btn-home'), 'click', function() {
      Audio.ui();
      UI.showHomeScreen();
    });

    // Home screen: fresh "Play" (restarts the current level from scratch)
    on($('btn-play-home'), 'click', function() {
      UI.closeAll();
      Audio.ui();
      Audio.unlock();
      var s = Storage.getSave();
      if (s.cur && s.cur.level === 'daily') loadDailyChallenge();
      else loadLevel(s.cur ? s.cur.level : Math.min(s.unlocked, Storage.DESIGN_LEVELS));
    });

    // Home screen: install app (same flow as the menu entry)
    on($('btn-install-home'), 'click', function() {
      Audio.ui();
      PWA.installAction();
    });

    // Pause menu: explicit resume button
    on($('btn-resume'), 'click', function() {
      Audio.ui();
      UI.closeAll();
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

  // Level navigation helpers (safe for both numeric levels and 'daily')
  function nextLevel() {
    if (!gameState) { loadLevel(1); return; }
    if (gameState.level === 'daily') { loadDailyChallenge(); return; }
    loadLevel(Math.min(gameState.level + 1, Storage.DESIGN_LEVELS));
  }
  function reloadLevel() {
    if (!gameState) { loadLevel(1); return; }
    if (gameState.level === 'daily') { loadDailyChallenge(); return; }
    loadLevel(gameState.level);
  }

  // Game state management
  function loadLevel(n) {
    lastTap = { t: 0, idx: -1 };
    UI.showScreen('game');
    // Sanitize level number so NaN/undefined can never reach level generation
    n = Math.floor(Number(n));
    if (!isFinite(n) || n < 1) n = 1;
    if (n > Storage.DESIGN_LEVELS) n = Storage.DESIGN_LEVELS;
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
      particles: [],
      combo: 0,
      coinsEarned: 0
    };
    gameState.bonus = makeBonus(L.bonus, n);

    rebuildOcc();

    // Update modules with new state
    Render.setGameState(gameState);
    UI.setGameState(gameState);

    Render.fitCanvas();
    Render.needsRender();
    Render.ensureLoop();
    UI.updateHUD();
    UI.showLevelBanner();
    resetStall();
    updateBonusBanner();
    saveCur();

    // Track level start
    Storage.getSave().stats.totalPlays++;
    Storage.persist();
  }

  function loadDailyChallenge() {
    lastTap = { t: 0, idx: -1 };
    UI.showScreen('game');
    var today = new Date();
    var L = GameCore.genDailyChallenge(today);
    
    gameState = {
      level: 'daily',
      date: L.date,
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
      particles: [],
      combo: 0,
      coinsEarned: 0
    };
    gameState.bonus = null;

    rebuildOcc();
    
    Render.setGameState(gameState);
    UI.setGameState(gameState);
    
    Render.fitCanvas();
    Render.needsRender();
    Render.ensureLoop();
    UI.updateHUD();
    UI.showLevelBanner();
    resetStall();
    updateBonusBanner();
    
    UI.closeAll();
    Storage.getSave().stats.totalPlays++;
    saveCur();
  }

  function rebuildOcc() {
    if (!gameState) return;
    var N = gameState.cols * gameState.rows;
    gameState.occ = new Int32Array(N).fill(-1);
    for (var i = 0; i < gameState.arrows.length; i++) {
      var A = gameState.arrows[i];
      if (!A.alive || !A.cells) continue;
      for (var k = 0; k < A.cells.length; k++) {
        gameState.occ[A.cells[k].y * gameState.cols + A.cells[k].x] = i;
      }
    }
  }

  function saveCur() {
    if (!gameState) return;
    
    var save = Storage.getSave();
    
    if (gameState.over || gameState.failed) {
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
        date: gameState.date || null,
        cols: gameState.cols,
        rows: gameState.rows,
        shapeIdx: shapeIdx,
        arrows: gameState.arrows,
        alive: alive,
        hearts: gameState.hearts,
        wrong: gameState.wrong,
        hintsUsed: gameState.hintsUsed,
        undoIds: gameState.undoIds.slice(-40),
        bonus: gameState.bonus ? {
          idx: gameState.bonus.idx,
          coins: gameState.bonus.coins,
          seconds: gameState.bonus.seconds,
          remainingMs: Math.max(0, gameState.bonus.deadline - performance.now()),
          active: gameState.bonus.active,
          granted: gameState.bonus.granted
        } : null
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

    // Reject the complete snapshot before publishing any state. Progress
    // and cosmetics stay intact when a damaged board needs a fresh start.
    if (!c || !(Number.isInteger(c.level) && c.level >= 1 && c.level <= Storage.DESIGN_LEVELS ||
        c.level === 'daily' && c.date === new Date().toISOString().slice(0, 10).replace(/-/g, '')) ||
        !Array.isArray(c.arrows) || !Array.isArray(c.alive) ||
        !Array.isArray(c.shapeIdx) || !Array.isArray(c.undoIds)) return false;
    if (!GameCore.validateBoardSolution(c.cols, c.rows, c.arrows) ||
        c.arrows.length !== c.alive.length ||
        !Number.isInteger(c.hearts) || c.hearts < 1 || c.hearts > GameCore.MAX_HEARTS ||
        !Number.isInteger(c.wrong) || c.wrong < 0 || c.wrong !== GameCore.MAX_HEARTS - c.hearts ||
        !Number.isInteger(c.hintsUsed) || c.hintsUsed < 0 || c.hintsUsed > 1000000 ||
        !c.alive.every(function(v) { return v === 0 || v === 1; })) return false;
    var N = c.cols * c.rows;
    if (c.shapeIdx.length > N || new Set(c.shapeIdx).size !== c.shapeIdx.length ||
        !c.shapeIdx.every(function(i) { return Number.isInteger(i) && i >= 0 && i < N; })) return false;
    var shape = new Uint8Array(N);
    c.shapeIdx.forEach(function(i) { shape[i] = 1; });
    if (c.undoIds.length > 100 || new Set(c.undoIds).size !== c.undoIds.length ||
        !c.undoIds.every(function(i) { return Number.isInteger(i) && i >= 0 && i < c.arrows.length && c.alive[i] === 0; })) return false;
    var restored = [];
    for (var a = 0; a < c.arrows.length; a++) {
      var A = c.arrows[a];
      if (!A.cells.every(function(cell) { return shape[cell.y * c.cols + cell.x] === 1; })) return false;
      restored.push({
        cells: A.cells.map(function(cell) { return { x: cell.x, y: cell.y }; }),
        dir: A.dir,
        c: Number.isInteger(A.c) && A.c >= 0 ? A.c % GameCore.PALETTE.length : 0,
        step: A.step,
        alive: c.alive[a] === 1
      });
    }

    gameState = {
      level: c.level,
      date: c.date || null,
      cols: c.cols,
      rows: c.rows,
      shape: shape,
      arrows: restored,
      occ: null,
      hearts: Math.min(GameCore.MAX_HEARTS, Math.max(0, c.hearts | 0)),
      wrong: c.wrong | 0,
      hintsUsed: c.hintsUsed | 0,
      undoIds: c.undoIds.slice(-40),
      over: false,
      failed: false,
      hintIdx: -1,
      shake: [],
      pop: [],
      flying: [],
      particles: [],
      combo: 0,
      coinsEarned: 0
    };

    gameState.failed = gameState.hearts <= 0;
    rebuildOcc();
    resetStall();

    // Restore remaining bonus time; legacy snapshots use their original
    // duration. Expired and already rewarded bonuses stay inactive.
    gameState.bonus = null;
    if (c.bonus && !c.bonus.granted && c.bonus.active !== false &&
        (c.bonus.remainingMs === undefined || Number.isFinite(c.bonus.remainingMs) && c.bonus.remainingMs > 0) &&
        Number.isInteger(c.bonus.idx) && c.bonus.idx >= 0 && c.bonus.idx < restored.length &&
        Number.isFinite(c.bonus.coins) && Number.isFinite(c.bonus.seconds) &&
        restored[c.bonus.idx].alive) {
      var bKey = (c.level === 'daily') ? 'daily' : c.level;
      var bSave = Storage.getSave();
      if (!bSave.bonusClaimed || !bSave.bonusClaimed[bKey]) {
        gameState.bonus = {
          idx: c.bonus.idx,
          coins: Math.min(60, Math.max(1, c.bonus.coins | 0)),
          seconds: Math.min(120, Math.max(10, c.bonus.seconds | 0)),
          active: true,
          granted: false,
          deadline: performance.now() + (c.bonus.remainingMs === undefined
            ? Math.min(120, Math.max(10, c.bonus.seconds | 0)) * 1000
            : Math.min(c.bonus.remainingMs, 120000))
        };
      }
    }
    updateBonusBanner();

    Render.setGameState(gameState);
    UI.setGameState(gameState);

    return true;
  }

  // --- Timed bonus objective (Candy Crush-style reward arrow) ---
  // Selected levels carry a golden bonus piece. Clear it before the
  // countdown ends to win bonus coins. The bonus NEVER changes puzzle
  // rules: the piece is an ordinary arrow, its status is cosmetic, and
  // an expired timer never costs hearts - only the bonus is lost.
  function makeBonus(spec, level) {
    if (!spec) return null;
    // The bonus index must always point at a real arrow of this board.
    if (typeof spec.idx !== 'number' || !isFinite(spec.idx) ||
        spec.idx < 0 || Math.floor(spec.idx) !== spec.idx) return null;
    var save = Storage.getSave();
    var key = (level === 'daily') ? 'daily' : level;
    if (save.bonusClaimed && save.bonusClaimed[key]) return null; // already rewarded once
    return {
      idx: spec.idx,
      coins: spec.coins,
      seconds: spec.seconds,
      active: true,
      granted: false,
      deadline: performance.now() + spec.seconds * 1000
    };
  }

  function updateBonusBanner() {
    var el = $('bonus-banner');
    var b = gameState && gameState.bonus;
    if (!el) return;
    if (!b || !b.active) {
      el.classList.remove('show');
      el.setAttribute('aria-hidden', 'true');
      return;
    }
    var coinsEl = $('bonus-coins');
    var timeEl = $('bonus-time');
    if (coinsEl) coinsEl.textContent = '+' + b.coins;
    if (timeEl) {
      var s = Math.max(0, Math.ceil((b.deadline - performance.now()) / 1000));
      timeEl.textContent = Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60);
    }
    el.classList.add('show');
    el.setAttribute('aria-hidden', 'false');
  }

  // Bonus tick: freezes while any dialog is open (pause) or the page is
  // hidden, so the countdown only runs during active play.
  function bonusTick() {
    var b = gameState && gameState.bonus;
    if (!b || !b.active || gameState.over || gameState.failed) return;
    var now = performance.now();
    if (b.last) {
      var elapsed = now - b.last;
      if (UI.anyOpen() || document.hidden) b.deadline += elapsed;
    }
    b.last = now;
    if (now >= b.deadline) {
      b.active = false;
      updateBonusBanner();
      UI.toast('Bonus time up \u2014 the golden arrow reward is gone');
    } else {
      updateBonusBanner();
    }
  }

  function maybeGrantBonus(i) {
    var b = gameState && gameState.bonus;
    if (!b || !b.active || b.granted || i !== b.idx) return;
    if (performance.now() > b.deadline) {
      b.active = false;
      updateBonusBanner();
      return;
    }
    b.granted = true;
    b.active = false;

    // Persist immediately: never grant the same level bonus twice,
    // even across refresh, replay or undo/redo.
    var save = Storage.getSave();
    if (!save.bonusClaimed) save.bonusClaimed = {};
    save.bonusClaimed[gameState.level === 'daily' ? 'daily' : gameState.level] = true;
    Storage.updateSave(save);
    Storage.addCoins(b.coins);

    Audio.success();
    if (!REDUCED) Render.spawnConfetti();
    UI.toast('Bonus +' + b.coins + ' coins claimed!');
    updateBonusBanner();
  }

  // --- Stall detection (trending pattern: offer a rewarded hint
  // exactly when the player is stuck, not on a fixed schedule) ---
  var stallTimer = 0;
  var STALL_DELAY = 14000; // ms without progress before offering help
  function resetStall() {
    clearTimeout(stallTimer);
    if (!gameState || gameState.over || gameState.failed) return;
    stallTimer = setTimeout(function() {
      if (!gameState || gameState.over || gameState.failed) return;
      if (UI.anyOpen()) { resetStall(); return; }
      UI.showStallOffer();
    }, STALL_DELAY);
  }
  function clearStall() {
    clearTimeout(stallTimer);
  }

  // Game moves
  function tapArrow(i) {
    if (!gameState || gameState.over || gameState.failed) return;

    var A = gameState.arrows[i];
    if (!A || !A.alive || !gameState.occ) return;
    var blocker = GameCore.pieceBlocker(gameState.occ, gameState.arrows, gameState.cols, gameState.rows, i);
    
    if (blocker === -1) {
      removeArrow(i);
    } else {
      if (blocker < 0) return;
      gameState.hearts--;
      gameState.wrong++;
      gameState.combo = 0;
      UI.updateCombo(0);
      gameState.shake[i] = performance.now();
      gameState.shake[blocker] = performance.now();
      resetStall();
      
      Audio.blocked();
      
      var save = Storage.getSave();
      if (save.vibration) Haptics.heavyTap();
      
      UI.updateHUD(true);
      Storage.updateMistakes(1);
      
      if (gameState.hearts <= 0) {
        gameState.failed = true;
        if (gameState.bonus) gameState.bonus.active = false;
        updateBonusBanner();
        clearStall();
        var save = Storage.getSave();
        save.cur = null;
        Storage.updateSave(save);
        var failedState = gameState;
        setTimeout(function() { 
          if (gameState !== failedState || !gameState.failed) return;
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

    var A = gameState.arrows[i];
    if (!A || !A.alive || A.exiting || !gameState.occ) return;

    // Snake exit: keep a marker while the exit animation runs so the
    // arrow can never be tapped, relaunched or undone mid-flight. The
    // renderer draws the moving snake from its own flying list.
    A.exiting = true;
    A.alive = false;
    for (var k = 0; k < A.cells.length; k++) {
      gameState.occ[A.cells[k].y * gameState.cols + A.cells[k].x] = -1;
    }
    gameState.undoIds.push(i);
    if (gameState.undoIds.length > 100) gameState.undoIds.shift();

    // Combo juice: consecutive clean launches raise the pop pitch
    gameState.combo++;
    Render.spawnBurst(i, gameState);
    var st = gameState;
    var flew = Render.spawnFly(i, st, function() { finishExit(st, i); });
    if (!flew) A.exiting = false; // canvas not laid out: finalize at once
    Audio.fly(A.dir, gameState.combo);
    UI.updateCombo(gameState.combo);
    resetStall();

    // Timed bonus: removing the special piece in time grants coins
    maybeGrantBonus(i);
    
    var save = Storage.getSave();
    if (save.vibration) Haptics.lightTap();
    
    if (gameState.hintIdx === i) gameState.hintIdx = -1;
    
    Render.needsRender();
    Render.ensureLoop();
    UI.updateHUD();
    saveCurSoon();
    
    // Level completion is checked after the exit animation finalizes
    scheduleWin();
  }

  // Win check that waits for snake exits: the level only completes once
  // the last exit animation has fully left the screen.
  function scheduleWin() {
    if (!gameState || gameState.over || gameState.failed) return;
    if (aliveCount() === 0 && gameState.flying.length === 0) onWin();
  }

  // Called by the renderer when one snake exit animation finishes.
  function finishExit(state, i) {
    if (!state || state !== gameState) return; // level changed meanwhile
    var A = gameState.arrows[i];
    if (A) A.exiting = false;
    scheduleWin();
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

    // Never restore an arrow while its old exit animation still runs
    var top = gameState.arrows[gameState.undoIds[gameState.undoIds.length - 1]];
    if (top && top.exiting) return;

    var i = gameState.undoIds.pop();
    var A = gameState.arrows[i];
    if (!A || A.alive || !gameState.occ) return;
    
    A.alive = true;
    for (var k = 0; k < A.cells.length; k++) {
      gameState.occ[A.cells[k].y * gameState.cols + A.cells[k].x] = i;
    }
    gameState.pop[i] = performance.now();
    resetStall();
    
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
      UI.resetAdHint();
      UI.openDlg('dlg-adhint');
      return;
    }
    doHint();
  }

  function doHint() {
    if (!gameState || gameState.over || gameState.failed) return;
    
    var h = GameCore.hintArrow(gameState.arrows, gameState.occ, gameState.cols, gameState.rows);
    if (h < 0) return;
    
    gameState.hintIdx = h;
    Render.focusPiece(h);
    gameState.hintsUsed++;
    resetStall();
    
    Audio.hint();
    var save = Storage.getSave();
    if (save.vibration) Haptics.hint();
    
    UI.updateHintBtn();
    Storage.updateHintsUsed(1);
    saveCurSoon();
    
    Render.needsRender();
    Render.ensureLoop();
  }

  var rewardedState = null;
  function adForHint() {
    if (!gameState || gameState.over || gameState.failed || rewardedState === gameState) return;
    var state = gameState;
    rewardedState = state;
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
          if (rewardedState === state) rewardedState = null;
          if (gameState !== state || state.over || state.failed) return;
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
      if (rewardedState !== state) return;
      rewardedState = null;
      if (ok && gameState === state && !state.over && !state.failed) {
        doHint();
        UI.toast('Hint unlocked \u2713');
      }
    });
  }

  function onWin() {
    if (!gameState) return;
    
    gameState.over = true;
    gameState.hintIdx = -1;
    if (gameState.bonus) gameState.bonus.active = false;
    updateBonusBanner();
    clearStall();
    UI.updateCombo(0);
    
    Audio.win();
    var save = Storage.getSave();
    if (save.vibration) Haptics.win();
    
    if (!REDUCED) Render.spawnConfetti();
    
    Render.needsRender();
    Render.ensureLoop();
    
    var stars = GameCore.calcStars(gameState.wrong, gameState.hintsUsed);
    var today = new Date();
    
    // Coins reward (free economy: earned through play, never purchased)
    var coinsEarned = stars * 10 + (gameState.level === 'daily' ? 25 : 0);
    gameState.coinsEarned = coinsEarned;
    Storage.addCoins(coinsEarned);
    
    // Update progress
    if (gameState.level !== 'daily') {
      // Storage.updateLevelBest owns save.best[level] (stars kept at max,
      // plays +1 per win). The old manual best-writer double-counted plays.
      
      if (gameState.level >= save.unlocked) {
        save.unlocked = Math.min(gameState.level + 1, Storage.DESIGN_LEVELS);
      }
      
      Storage.updateLevelBest(gameState.level, stars, 1);
    } else {
      var dailyDate = gameState.date;
      Storage.updateDailyChallenge(dailyDate ? new Date(dailyDate.slice(0, 4) + '-' + dailyDate.slice(4, 6) + '-' + dailyDate.slice(6, 8) + 'T00:00:00Z') : today, stars);
    }
    
    // In-game toast for achievements that just became completed
    // (each one is announced exactly once; no reward logic changes)
    UI.announceNewAchievements();
    
    save.cur = null;
    Storage.updateSave(save);
    
    var wonState = gameState;
    setTimeout(function() {
      if (gameState !== wonState || !gameState.over) return;
      UI.showWinDialog();
    }, REDUCED ? 200 : 900);
  }

  // --- Share helpers (Web Share API with clipboard fallback) ---
  function repeatStars(n) {
    n = Math.max(0, Math.min(3, n | 0));
    var s = '';
    for (var i = 0; i < n; i++) s += '\u2605';
    return s;
  }

  function shareGame(text) {
    var url = 'https://parya5103.github.io/Fletch_Game/';
    try { if (location && location.href) url = location.href; } catch (e) {}
    if (navigator.share) {
      navigator.share({ title: 'Arrow Out!', text: text, url: url }).then(function() {}, function() {});
      return;
    }
    var full = text + ' ' + url;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(full).then(function() {
        UI.toast('Copied \u2014 paste it anywhere \u2713');
      }, function() {
        UI.toast('Sharing not supported here');
      });
      return;
    }
    UI.toast('Sharing not supported here');
  }

  function applyMusic() {
    var save = Storage.getSave();
    if (save.music && Audio.enabled) Audio.startMusic();
    else Audio.stopMusic();
  }

  // Apply the equipped cosmetic skin to the renderer
  function applySkin() {
    var save = Storage.getSave();
    var skin = GameCore.SKINS[save.skin] || GameCore.SKINS.default;
    Render.setPalette(skin.colors);
  }

  // --- Daily login rewards (7-day coin calendar) ---
  var LOGIN_REWARDS = [15, 20, 30, 40, 50, 75, 100];

  function rewardDayFor(save, now) {
    var today = now.toISOString().slice(0, 10);
    var yest = new Date(now);
    yest.setDate(yest.getDate() - 1);
    var isConsecutive = save.loginRewards.lastClaim === yest.toISOString().slice(0, 10);
    return isConsecutive ? (save.loginRewards.streak % 7) + 1 : 1;
  }

  function checkDailyReward() {
    var save = Storage.getSave();
    var now = new Date();
    if (save.loginRewards.lastClaim === now.toISOString().slice(0, 10)) return;
    UI.buildRewardCalendar(rewardDayFor(save, now));
    UI.openDlg('dlg-reward');
  }

  function claimDailyReward() {
    var save = Storage.getSave();
    var now = new Date();
    var today = now.toISOString().slice(0, 10);
    if (save.loginRewards.lastClaim === today) { UI.closeAll(); UI.showHomeScreen(); return; }
    
    var yest = new Date(now);
    yest.setDate(yest.getDate() - 1);
    var streak = save.loginRewards.lastClaim === yest.toISOString().slice(0, 10)
      ? save.loginRewards.streak + 1 : 1;
    var day = ((streak - 1) % 7) + 1;
    var coins = LOGIN_REWARDS[day - 1];
    
    save.loginRewards.lastClaim = today;
    save.loginRewards.streak = streak;
    Storage.updateSave(save);
    Storage.addCoins(coins);
    
    Audio.success();
    if (Storage.getSave().vibration) Haptics.win();
    
    UI.closeAll();
    UI.toast('+' + coins + ' coins claimed! Day ' + day);
    UI.showHomeScreen();
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
