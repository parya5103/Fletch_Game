/**
 * Arrow Out! - Complete 1000-Level Validation Script
 * Uses standalone implementation matching the production game.js logic
 * Tests ALL 1000 levels for solvability
 */
'use strict';

// Standalone implementation of the game core logic
// This matches the EXACT logic from js/game.js
const GameCoreValidator = (function() {
  const DESIGN_LEVELS = 1000;
  const PALETTE = ['#ff5d8f', '#ff9f43', '#ffd93d', '#4ade80', '#2dd4bf', '#38bdf8', '#818cf8', '#c084fc'];
  const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // up, right, down, left
  const DIFFICULTY_THRESHOLDS = {
    easy: 50,
    medium: 200,
    hard: 500,
    expert: 800,
    master: 1000
  };

  // Deterministic RNG - EXACT same implementation as production
  function mulberry32(a) {
    return function() {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Level configuration - EXACT same as production
  function levelConfig(n) {
    let grid, arrows;
    if (n <= DIFFICULTY_THRESHOLDS.easy) {
      grid = Math.min(7, 4 + Math.ceil(n / 10));
      arrows = Math.min(30, 4 + Math.round(n * 0.6));
    } else if (n <= DIFFICULTY_THRESHOLDS.medium) {
      grid = Math.min(9, 6 + Math.ceil((n - DIFFICULTY_THRESHOLDS.easy) / 30));
      arrows = Math.min(50, 20 + Math.round((n - DIFFICULTY_THRESHOLDS.easy) * 0.4));
    } else if (n <= DIFFICULTY_THRESHOLDS.hard) {
      grid = Math.min(11, 8 + Math.ceil((n - DIFFICULTY_THRESHOLDS.medium) / 50));
      arrows = Math.min(80, 40 + Math.round((n - DIFFICULTY_THRESHOLDS.medium) * 0.3));
    } else if (n <= DIFFICULTY_THRESHOLDS.expert) {
      grid = Math.min(12, 10 + Math.ceil((n - DIFFICULTY_THRESHOLDS.hard) / 100));
      arrows = Math.min(100, 60 + Math.round((n - DIFFICULTY_THRESHOLDS.hard) * 0.25));
    } else {
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

  // Ray casting - EXACT same as production
  function rayClear(occ, W, H, x, y, d) {
    var dx = DIRS[d][0], dy = DIRS[d][1];
    var cx = x + dx, cy = y + dy;
    while (cx >= 0 && cx < W && cy >= 0 && cy < H) {
      if (occ[cy * W + cx] !== -1) return false;
      cx += dx; cy += dy;
    }
    return true;
  }

  // Find first blocking arrow - EXACT same as production
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

  // Generate a level - EXACT same as production
  function genLevel(n) {
    var cfg = levelConfig(n);
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
    
    return { level: n, cols: W, rows: H, shape: inShape, arrows: arrows, difficulty: getDifficultyLevel(n) };
  }

  // Validate board solution - EXACT same as production
  function validateBoardSolution(W, H, arrows) {
    var N = W * H;
    var occ = new Int32Array(N).fill(-1);
    for (var i = 0; i < arrows.length; i++) {
      if (arrows[i].alive) {
        occ[arrows[i].y * W + arrows[i].x] = i;
      }
    }
    
    for (var i = 0; i < arrows.length; i++) {
      if (!arrows[i].alive) continue;
      var blocker = rayBlocker(occ, arrows, W, H, arrows[i].x, arrows[i].y, arrows[i].dir);
      if (blocker === -1) return true;
    }
    
    return false;
  }

  return {
    DESIGN_LEVELS: DESIGN_LEVELS,
    genLevel: genLevel,
    levelConfig: levelConfig,
    validateBoardSolution: validateBoardSolution,
    getDifficultyLevel: getDifficultyLevel,
    rayBlocker: rayBlocker
  };
})();

// Track results
const results = {
  total: 1000,
  passed: 0,
  failed: 0,
  errors: [],
  startTime: Date.now()
};

// Full solver using the exact same logic as the game
function simulateFullSolution(level) {
  const W = level.cols;
  const H = level.rows;
  const N = W * H;
  
  // Deep copy arrows
  const arrows = level.arrows.map(a => ({ ...a }));
  const occ = new Int32Array(N).fill(-1);
  
  // Build occupancy map
  for (let i = 0; i < arrows.length; i++) {
    occ[arrows[i].y * W + arrows[i].x] = i;
  }
  
  let removed = 0;
  const maxIterations = arrows.length * 10;
  let iterations = 0;
  
  while (removed < arrows.length && iterations++ < maxIterations) {
    let found = false;
    
    // Try from last placed to first (most constrained first)
    for (let i = arrows.length - 1; i >= 0; i--) {
      if (!arrows[i].alive) continue;
      
      const blocker = GameCoreValidator.rayBlocker(occ, arrows, W, H, arrows[i].x, arrows[i].y, arrows[i].dir);
      
      if (blocker === -1) {
        arrows[i].alive = false;
        occ[arrows[i].y * W + arrows[i].x] = -1;
        removed++;
        found = true;
        break;
      }
    }
    
    if (!found) {
      return {
        solvable: false,
        removed: removed,
        remaining: arrows.length - removed,
        message: `Stuck with ${arrows.length - removed} arrows remaining`
      };
    }
  }
  
  return {
    solvable: removed === arrows.length,
    removed: removed,
    remaining: 0,
    message: 'Fully solved'
  };
}

// Validate a single level
function validateLevel(levelNum) {
  try {
    const level = GameCoreValidator.genLevel(levelNum);
    
    if (!level || !level.arrows || level.arrows.length === 0) {
      return {
        level: levelNum,
        passed: false,
        error: 'Level generation failed',
        arrows: 0
      };
    }
    
    const isValid = GameCoreValidator.validateBoardSolution(level.cols, level.rows, level.arrows.slice());
    const solution = simulateFullSolution(level);
    
    const passed = isValid && solution.solvable;
    
    if (!passed) {
      results.errors.push({
        level: levelNum,
        isValid: isValid,
        solvable: solution.solvable,
        removed: solution.removed,
        remaining: solution.remaining,
        message: solution.message,
        arrows: level.arrows.length,
        grid: `${level.cols}x${level.rows}`
      });
    }
    
    return {
      level: levelNum,
      passed: passed,
      arrows: level.arrows.length,
      grid: `${level.cols}x${level.rows}`,
      isValid: isValid,
      solvable: solution.solvable
    };
  } catch (e) {
    results.errors.push({
      level: levelNum,
      error: e.message,
      stack: e.stack
    });
    return {
      level: levelNum,
      passed: false,
      error: e.message,
      arrows: 0
    };
  }
}

// Run validation for all 1000 levels
console.log('========================================');
console.log('ARROW OUT! - 1000 LEVEL VALIDATION');
console.log('========================================\n');

const fs = require('fs');
const path = require('path');

// Process in batches
const BATCH_SIZE = 100;

async function runValidation() {
  for (let batchStart = 1; batchStart <= 1000; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, 1000);
    
    console.log(`Validating levels ${batchStart}-${batchEnd}...`);
    
    for (let levelNum = batchStart; levelNum <= batchEnd; levelNum++) {
      const result = validateLevel(levelNum);
      
      if (result.passed) {
        results.passed++;
      } else {
        results.failed++;
        if (results.errors.length <= 10) {
          console.log(`  ✗ Level ${result.level} FAILED: ${result.error || 'Validation failed'}`);
        }
      }
      
      if (levelNum % 50 === 0) {
        process.stdout.write(`\rProgress: ${levelNum}/1000 (${((levelNum/1000)*100).toFixed(1)}%)`);
      }
    }
    
    console.log(`\n  Batch ${batchStart}-${batchEnd}: ${batchEnd - batchStart + 1} levels processed`);
  }
  
  const endTime = Date.now();
  const duration = endTime - results.startTime;
  
  console.log('\n========================================');
  console.log('VALIDATION RESULTS');
  console.log('========================================');
  console.log(`Total levels: ${results.total}`);
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Time: ${duration}ms`);
  console.log(`Average time per level: ${(duration / results.total).toFixed(2)}ms`);
  
  if (results.errors.length > 0) {
    console.log(`\n${results.errors.length} errors found:`);
    results.errors.slice(0, 20).forEach(err => {
      console.log(`  Level ${err.level}: ${err.message || err.error}`);
    });
    if (results.errors.length > 20) {
      console.log(`  ... and ${results.errors.length - 20} more errors`);
    }
  } else {
    console.log('\n✓ All 1000 levels are validated as solvable!');
  }
  
  // Save results
  const resultsDir = path.join(__dirname, 'results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }
  
  const resultsPath = path.join(resultsDir, '1000_level_validation_results.json');
  fs.writeFileSync(resultsPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    results: results,
    errors: results.errors
  }, null, 2));
  
  console.log(`\nResults saved to: ${resultsPath}`);
  
  const summaryPath = path.join(__dirname, '1000_level_validation_summary.txt');
  const summary = [
    'ARROW OUT! - 1000 LEVEL VALIDATION SUMMARY',
    '==========================================',
    `Date: ${new Date().toISOString()}`,
    `Total levels: ${results.total}`,
    `Passed: ${results.passed}`,
    `Failed: ${results.failed}`,
    `Success rate: ${results.passed > 0 ? ((results.passed / results.total) * 100).toFixed(2) : 0}%`,
    `Time: ${duration}ms`,
    `Average per level: ${(duration / results.total).toFixed(2)}ms`,
    results.errors.length > 0 ? `\nErrors: ${results.errors.length}` : '\n✓ All levels passed!',
    `\nFull results: ${resultsPath}`
  ].join('\n');
  
  fs.writeFileSync(summaryPath, summary);
  console.log(`Summary saved to: ${summaryPath}`);
  
  return results;
}

runValidation().then(finalResults => {
  console.log('\n✓ Validation complete!');
  process.exit(finalResults.failed > 0 ? 1 : 0);
}).catch(err => {
  console.error('Validation error:', err);
  process.exit(1);
});
