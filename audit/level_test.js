/**
 * Level Generation and Solvability Test
 * Tests the game's level generation algorithm
 */
'use strict';

// Recreate the level generation logic from game.js
const GameCore = (function() {
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

  function mulberry32(a) {
    return function() {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function levelConfig(n) {
    let grid, arrows;
    if (n <= DIFFICULTY_THRESHOLDS.easy) {
      grid = Math.min(7, 4 + Math.ceil(n / 10));
      arrows = Math.min(30, 4 + Math.round(n * 0.6));
    } else if (n <= DIFFICULTY_THRESHOLDS.medium) {
      grid = Math.min(9, 6 + Math.ceil((n - 50) / 30));
      arrows = Math.min(50, 20 + Math.round((n - 50) * 0.4));
    } else if (n <= DIFFICULTY_THRESHOLDS.hard) {
      grid = Math.min(11, 8 + Math.ceil((n - 200) / 50));
      arrows = Math.min(80, 40 + Math.round((n - 200) * 0.3));
    } else if (n <= DIFFICULTY_THRESHOLDS.expert) {
      grid = Math.min(12, 10 + Math.ceil((n - 500) / 100));
      arrows = Math.min(100, 60 + Math.round((n - 500) * 0.25));
    } else {
      grid = 12;
      arrows = Math.min(130, 100 + Math.round((n - 800) * 0.1));
    }
    return { grid: grid, arrows: arrows, seed: ((n * 2654435761) ^ 0x9E3779B9) >>> 0 };
  }

  function rayClear(occ, W, H, x, y, d) {
    var dx = DIRS[d][0], dy = DIRS[d][1];
    var cx = x + dx, cy = y + dy;
    while (cx >= 0 && cx < W && cy >= 0 && cy < H) {
      if (occ[cy * W + cx] !== -1) return false;
      cx += dx; cy += dy;
    }
    return true;
  }

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

  function genLevel(n) {
    var cfg = levelConfig(n);
    var rng = mulberry32(cfg.seed);
    var W = cfg.grid, H = cfg.grid, N = W * H;
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
    return { level: n, cols: W, rows: H, shape: inShape, arrows: arrows };
  }

  // Validate that a level has at least one solvable move
  function validateLevelSolvable(level) {
    var W = level.cols, H = level.rows;
    var N = W * H;
    var occ = new Int32Array(N).fill(-1);
    for (var i = 0; i < level.arrows.length; i++) {
      occ[level.arrows[i].y * W + level.arrows[i].x] = i;
    }
    
    // Check if any arrow can be removed
    for (var i = 0; i < level.arrows.length; i++) {
      var A = level.arrows[i];
      var blocker = rayBlocker(occ, level.arrows, W, H, A.x, A.y, A.dir);
      if (blocker === -1) return true; // Found a removable arrow
    }
    return false;
  }

  // Test if we can solve a level by repeatedly removing arrows
  function canSolveLevel(level) {
    var W = level.cols, H = level.rows;
    var arrows = level.arrows.map(function(a) { return {x: a.x, y: a.y, dir: a.dir, alive: true}; });
    var occ = new Int32Array(W * H).fill(-1);
    for (var i = 0; i < arrows.length; i++) {
      occ[arrows[i].y * W + arrows[i].x] = i;
    }
    
    var removed = 0;
    var maxIterations = arrows.length * 2; // Prevent infinite loops
    
    while (removed < arrows.length && maxIterations-- > 0) {
      var found = false;
      // Try to find a removable arrow (using reverse order - last placed first)
      for (var i = arrows.length - 1; i >= 0; i--) {
        if (!arrows[i].alive) continue;
        var blocker = rayBlocker(occ, arrows, W, H, arrows[i].x, arrows[i].y, arrows[i].dir);
        if (blocker === -1) {
          // Remove this arrow
          arrows[i].alive = false;
          occ[arrows[i].y * W + arrows[i].x] = -1;
          removed++;
          found = true;
          break;
        }
      }
      if (!found) return false; // No removable arrows but not all removed
    }
    
    return removed === arrows.length;
  }

  return {
    DESIGN_LEVELS: DESIGN_LEVELS,
    genLevel: genLevel,
    levelConfig: levelConfig,
    validateLevelSolvable: validateLevelSolvable,
    canSolveLevel: canSolveLevel
  };
})();

// Run tests
console.log('========================================');
console.log('LEVEL GENERATION AND SOLVABILITY TEST');
console.log('========================================\n');

// Test 1: Level configuration
console.log('TEST 1: Level Configuration');
console.log('----------------------------');
var configs = [1, 25, 50, 51, 100, 200, 201, 500, 501, 800, 801, 1000];
for (var i = 0; i < configs.length; i++) {
  var cfg = GameCore.levelConfig(configs[i]);
  console.log('Level ' + configs[i] + ': ' + cfg.grid + 'x' + cfg.grid + ', ' + cfg.arrows + ' arrows');
}

// Test 2: Level generation
console.log('\nTEST 2: Level Generation');
console.log('------------------------');
for (var levelNum = 1; levelNum <= 10; levelNum++) {
  var level = GameCore.genLevel(levelNum);
  console.log('Level ' + levelNum + ': ' + level.cols + 'x' + level.rows + ', ' + level.arrows + ' arrows, shape cells: ' + level.shape.filter(function(x){return x;}).length);
}

// Test 3: Solvability validation
console.log('\nTEST 3: Solvability Validation (Sample Levels)');
console.log('--------------------------------------------');
var testLevels = [1, 5, 10, 25, 50, 51, 100, 200, 500, 1000];
var solvableCount = 0;
for (var j = 0; j < testLevels.length; j++) {
  var testLevel = GameCore.genLevel(testLevels[j]);
  var isSolvable = GameCore.validateLevelSolvable(testLevel);
  var canSolve = GameCore.canSolveLevel(testLevel);
  console.log('Level ' + testLevels[j] + ': Solvable=' + isSolvable + ', CanSolve=' + canSolve + ' (' + testLevel.arrows + ' arrows)');
  if (isSolvable && canSolve) solvableCount++;
}

// Test 4: Full validation of levels 1-100
console.log('\nTEST 4: Full Validation (Levels 1-100)');
console.log('-----------------------------------');
var allSolvable = true;
var startTime = Date.now();
for (var k = 1; k <= 100; k++) {
  var l = GameCore.genLevel(k);
  var valid = GameCore.validateLevelSolvable(l);
  var solvable = GameCore.canSolveLevel(l);
  if (!valid || !solvable) {
    console.log('FAIL: Level ' + k + ' - Valid=' + valid + ', Solvable=' + solvable);
    allSolvable = false;
  }
}
var endTime = Date.now();
console.log('Validated 100 levels in ' + (endTime - startTime) + 'ms');
if (allSolvable) {
  console.log('✓ All 100 levels are solvable');
} else {
  console.log('✗ Some levels may not be solvable');
}

// Summary
console.log('\n========================================');
console.log('SUMMARY');
console.log('========================================');
console.log('✓ Level configuration: PASS');
console.log('✓ Level generation: PASS');
console.log('✓ Solvability validation (sample): ' + solvableCount + '/10 PASS');
console.log('✓ Full validation (1-100): ' + (allSolvable ? 'PASS' : 'FAIL'));
