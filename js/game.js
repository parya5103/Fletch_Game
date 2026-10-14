/**
 * Arrow Out! - Game Core Module
 * Handles game state, board logic, level generation, and validation
 */
'use strict';

const GameCore = (function() {
  // Configuration
  const DESIGN_LEVELS = 1000;
  const MAX_HEARTS = 3;
  const FREE_HINTS = 3;
  const PALETTE = ['#ff5d8f', '#ff9f43', '#ffd93d', '#4ade80', '#2dd4bf', '#38bdf8', '#818cf8', '#c084fc'];
  const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // up, right, down, left
  const DIFFICULTY_THRESHOLDS = {
    easy: 50,
    medium: 200,
    hard: 500,
    expert: 800,
    master: 1000
  };

  // Deterministic RNG
  function mulberry32(a) {
    return function() {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Level configuration based on difficulty
  function levelConfig(n) {
    let grid, arrows;
    
    // Easy: 5x5 to 7x7 boards
    if (n <= DIFFICULTY_THRESHOLDS.easy) {
      grid = Math.min(7, 4 + Math.ceil(n / 10));
      arrows = Math.min(30, 4 + Math.round(n * 0.6));
    }
    // Medium: 7x7 to 9x9 boards
    else if (n <= DIFFICULTY_THRESHOLDS.medium) {
      grid = Math.min(9, 6 + Math.ceil((n - DIFFICULTY_THRESHOLDS.easy) / 30));
      arrows = Math.min(50, 20 + Math.round((n - DIFFICULTY_THRESHOLDS.easy) * 0.4));
    }
    // Hard: 9x9 to 11x11 boards
    else if (n <= DIFFICULTY_THRESHOLDS.hard) {
      grid = Math.min(11, 8 + Math.ceil((n - DIFFICULTY_THRESHOLDS.medium) / 50));
      arrows = Math.min(80, 40 + Math.round((n - DIFFICULTY_THRESHOLDS.medium) * 0.3));
    }
    // Expert: 11x11 to 12x12 boards
    else if (n <= DIFFICULTY_THRESHOLDS.expert) {
      grid = Math.min(12, 10 + Math.ceil((n - DIFFICULTY_THRESHOLDS.hard) / 100));
      arrows = Math.min(100, 60 + Math.round((n - DIFFICULTY_THRESHOLDS.hard) * 0.25));
    }
    // Master: Full 12x12 boards with 100-130 arrows
    else {
      grid = 12;
      arrows = Math.min(130, 100 + Math.round((n - DIFFICULTY_THRESHOLDS.expert) * 0.1));
    }
    
    return { grid: grid, arrows: arrows, seed: ((n * 2654435761) ^ 0x9E3779B9) >>> 0 };
  }

  function getDifficultyLevel(n) {
    if (n <= DIFFICULTY_THRESHOLDS.easy) return 'easy';
    if (n <= DIFFICULTY_THRESHOLDS.medium) return 'medium';
    if (n <= DIFFICULTY_THRESHOLDS.hard) return 'hard';
    if (n <= DIFFICULTY_THRESHOLDS.expert) return 'expert';
    return 'master';
  }

  function getDifficultyName(n) {
    const difficulty = getDifficultyLevel(n);
    const names = {
      easy: 'Easy',
      medium: 'Medium',
      hard: 'Hard',
      expert: 'Expert',
      master: 'Master'
    };
    return names[difficulty] || 'Master';
  }

  // Check if ray from (x,y) in direction d is clear
  function rayClear(occ, W, H, x, y, d) {
    var dx = DIRS[d][0], dy = DIRS[d][1];
    var cx = x + dx, cy = y + dy;
    while (cx >= 0 && cx < W && cy >= 0 && cy < H) {
      if (occ[cy * W + cx] !== -1) return false;
      cx += dx; cy += dy;
    }
    return true;
  }

  // Find first blocking arrow
  function rayBlocker(occ, arrows, W, H, x, y, d) {
    var dx = DIRS[d][0], dy = DIRS[d][1];
    var cx = x + dx, cy = y + dy;
    while (cx >= 0 && cx < W && cy >= 0 && cy < H) {
      var ai = occ[cy * W + cx];
      if (ai !== -1 && arrows[ai].alive) return ai;
      cx += dx; cy += dy;
    }
    return -1;
  }

  // Generate a valid, solvable level
  function genLevel(n) {
    // Sanitize input: NaN/undefined must never reach level configuration,
    // otherwise config becomes NaN and recursion below never terminates.
    n = Math.floor(Number(n));
    if (!isFinite(n) || n < 1) n = 1;
    var cfg = levelConfig(n);
    cfg.grid = Math.max(4, Math.min(12, cfg.grid | 0));
    cfg.arrows = Math.max(1, Math.min(130, cfg.arrows | 0));
    var rng = mulberry32(cfg.seed);
    var W = cfg.grid, H = cfg.grid, N = W * H;

    // 1. Grow a soft blob shape
    var inShape = new Uint8Array(N);
    var targetCells = Math.min(N, Math.max(5, Math.round(cfg.arrows * 1.5)));
    inShape[((H / 2) | 0) * W + ((W / 2) | 0)] = 1;
    var cells = 1, guard = 0;
    while (cells < targetCells && guard++ < 2000) {
      var i = (rng() * N) | 0;
      if (inShape[i]) continue;
      var x = i % W, y = (i / W) | 0;
      var adj = (x > 0 && inShape[i - 1]) || (x < W - 1 && inShape[i + 1]) ||
                (y > 0 && inShape[i - W]) || (y < H - 1 && inShape[i + W]);
      if (adj) { inShape[i] = 1; cells++; }
    }
    var shapeCells = [];
    for (var s = 0; s < N; s++) if (inShape[s]) shapeCells.push(s);

    // 2. Reverse placement: each arrow's exit ray must be clear
    var arrows = [];
    var occ = new Int32Array(N).fill(-1);
    for (var step = 0; step < cfg.arrows; step++) {
      var best = -1, bestOpts = null, bestCount = 99;
      for (var sc = 0; sc < shapeCells.length; sc++) {
        var pick = shapeCells[sc];
        if (occ[pick] !== -1) continue;
        var px = pick % W, py = (pick / W) | 0;
        var good = [];
        for (var d = 0; d < 4; d++) if (rayClear(occ, W, H, px, py, d)) good.push(d);
        if (!good.length) continue;
        if (good.length < bestCount) { bestCount = good.length; best = pick; bestOpts = good; }
      }
      if (best === -1) break;
      var dir = bestOpts[(rng() * bestOpts.length) | 0];
      occ[best] = arrows.length;
      arrows.push({ 
        x: best % W, 
        y: (best / W) | 0, 
        dir: dir, 
        c: (rng() * PALETTE.length) | 0, 
        step: step, 
        alive: true 
      });
    }
    
    // 3. Validate the board has a solution
    if (!validateBoardSolution(W, H, arrows.slice())) {
      // If validation fails (should be rare with reverse placement), regenerate
      return genLevel(n);
    }
    
    return { level: n, cols: W, rows: H, shape: inShape, arrows: arrows, difficulty: getDifficultyLevel(n) };
  }

  // Validate that a board has at least one valid solution
  function validateBoardSolution(W, H, arrows) {
    // Create occupancy map
    var N = W * H;
    var occ = new Int32Array(N).fill(-1);
    for (var i = 0; i < arrows.length; i++) {
      if (arrows[i].alive) {
        occ[arrows[i].y * W + arrows[i].x] = i;
      }
    }
    
    // Try to find at least one removable arrow
    // If we can't find any, the board might be unsolvable
    // With reverse placement, this should always find at least one
    for (var i = 0; i < arrows.length; i++) {
      if (!arrows[i].alive) continue;
      var blocker = rayBlocker(occ, arrows, W, H, arrows[i].x, arrows[i].y, arrows[i].dir);
      if (blocker === -1) return true; // Found a removable arrow
    }
    
    return false; // No removable arrows found
  }

  // Find a guaranteed removable arrow (for hints)
  function hintArrow(arrows, occ, W, H) {
    for (var i = arrows.length - 1; i >= 0; i--) {
      if (arrows[i].alive) {
        var blocker = rayBlocker(occ, arrows, W, H, arrows[i].x, arrows[i].y, arrows[i].dir);
        if (blocker === -1) return i;
      }
    }
    return -1;
  }

  // Generate daily challenge level
  function genDailyChallenge(date) {
    // Use date to create a deterministic seed
    var dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    var seed = parseInt(dateStr) || Date.now();
    var rng = mulberry32(seed);
    
    // Daily challenge: medium difficulty, 8x8 board
    var W = 8, H = 8, N = W * H;
    var arrowsCount = 30 + ((seed % 20) | 0);
    
    // Grow shape
    var inShape = new Uint8Array(N);
    inShape[((H / 2) | 0) * W + ((W / 2) | 0)] = 1;
    var cells = 1, guard = 0;
    var targetCells = Math.min(N, Math.round(arrowsCount * 1.5));
    while (cells < targetCells && guard++ < 2000) {
      var i = (rng() * N) | 0;
      if (inShape[i]) continue;
      var x = i % W, y = (i / W) | 0;
      var adj = (x > 0 && inShape[i - 1]) || (x < W - 1 && inShape[i + 1]) ||
                (y > 0 && inShape[i - W]) || (y < H - 1 && inShape[i + W]);
      if (adj) { inShape[i] = 1; cells++; }
    }
    
    // Place arrows
    var arrows = [];
    var occ = new Int32Array(N).fill(-1);
    for (var step = 0; step < arrowsCount; step++) {
      var best = -1, bestOpts = null, bestCount = 99;
      for (var s = 0; s < N; s++) {
        if (!inShape[s] || occ[s] !== -1) continue;
        var px = s % W, py = (s / W) | 0;
        var good = [];
        for (var d = 0; d < 4; d++) if (rayClear(occ, W, H, px, py, d)) good.push(d);
        if (!good.length) continue;
        if (good.length < bestCount) { bestCount = good.length; best = s; bestOpts = good; }
      }
      if (best === -1) break;
      var dir = bestOpts[(rng() * bestOpts.length) | 0];
      occ[best] = arrows.length;
      arrows.push({ 
        x: best % W, 
        y: (best / W) | 0, 
        dir: dir, 
        c: (rng() * PALETTE.length) | 0, 
        step: step, 
        alive: true 
      });
    }
    
    return { 
      level: 'daily', 
      cols: W, 
      rows: H, 
      shape: inShape, 
      arrows: arrows,
      difficulty: 'medium',
      date: dateStr
    };
  }

  // Calculate stars based on performance
  function calcStars(wrong, hintsUsed) {
    if (wrong === 0 && hintsUsed === 0) return 3;
    if (wrong <= 2 && hintsUsed <= 1) return 2;
    return 1;
  }

  return {
    DESIGN_LEVELS: DESIGN_LEVELS,
    MAX_HEARTS: MAX_HEARTS,
    FREE_HINTS: FREE_HINTS,
    PALETTE: PALETTE,
    DIRS: DIRS,
    genLevel: genLevel,
    validateBoardSolution: validateBoardSolution,
    hintArrow: hintArrow,
    genDailyChallenge: genDailyChallenge,
    levelConfig: levelConfig,
    getDifficultyLevel: getDifficultyLevel,
    getDifficultyName: getDifficultyName,
    calcStars: calcStars,
    rayBlocker: rayBlocker
  };
})();

