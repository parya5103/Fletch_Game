/**
 * Arrow Out! - Complete 1000-Level Validation Script
 * Tests ALL 1000 levels for solvability using actual production code
 * This validates the EXACT same code path as the live game
 */
'use strict';

// Load the ACTUAL production game.js module
// We need to read it from the filesystem since we're running in Node
const fs = require('fs');
const path = require('path');

// Read the actual game.js file
const gameJsPath = path.join(__dirname, '../js/game.js');
const gameJsCode = fs.readFileSync(gameJsPath, 'utf8');

// Create a minimal DOM-like environment for the game module
const createMockDOM = () => {
  const mock = {
    document: {
      createElement: (tag) => ({
        tagName: tag,
        width: 0,
        height: 0,
        getContext: () => ({
          fillStyle: '',
          beginPath: () => {},
          moveTo: () => {},
          lineTo: () => {},
          closePath: () => {},
          fill: () => {},
          save: () => {},
          restore: () => {},
          translate: () => {},
          arcTo: () => {},
          roundRect: undefined
        }),
        toDataURL: () => 'data:image/png;base64,'
      }),
      querySelector: () => null,
      createElementNS: () => ({}),
      head: {
        appendChild: () => {},
        querySelector: () => null
      },
      body: {}
    },
    window: {
      matchMedia: () => ({ matches: false }),
      navigator: {
        userAgent: 'Node.js',
        platform: 'Linux',
        standalone: false,
        maxTouchPoints: 0
      },
      location: {
        href: 'http://localhost/',
        protocol: 'http:',
        hostname: 'localhost'
      },
      clients: {
        openWindow: () => {}
      }
    },
    CanvasRenderingContext2D: function() {}
  };
  
  global.document = mock.document;
  global.window = mock.window;
  // navigator is read-only in Node, so we need to define it differently
  delete global.navigator;
  Object.defineProperty(global, 'navigator', { value: mock.window.navigator, writable: true, configurable: true });
  global.location = mock.window.location;
  global.CanvasRenderingContext2D = mock.CanvasRenderingContext2D;
};

createMockDOM();

// Now eval the game.js code to get the actual GameCore module
// This ensures we're testing the EXACT same code as production
try {
  eval(gameJsCode);
} catch (e) {
  console.error('Error loading game.js:', e.message);
  process.exit(1);
}

console.log('========================================');
console.log('ARROW OUT! - 1000 LEVEL VALIDATION');
console.log('========================================\n');

// Track results
const results = {
  total: 1000,
  passed: 0,
  failed: 0,
  errors: [],
  startTime: Date.now()
};

// Enhanced solver that uses the actual game movement logic
// This simulates the exact same removal logic as the game
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
  const maxIterations = arrows.length * 10; // Prevent infinite loops
  let iterations = 0;
  
  while (removed < arrows.length && iterations++ < maxIterations) {
    let found = false;
    
    // Try all arrows in order (the game uses reverse order for hints)
    // But for validation, we need to find ANY valid sequence
    // We'll try from last placed to first (most constrained)
    for (let i = arrows.length - 1; i >= 0; i--) {
      if (!arrows[i].alive) continue;
      
      // Use the ACTUAL rayBlocker function from GameCore
      const blocker = GameCore.rayBlocker(occ, arrows, W, H, arrows[i].x, arrows[i].y, arrows[i].dir);
      
      if (blocker === -1) {
        // This arrow can be removed
        arrows[i].alive = false;
        occ[arrows[i].y * W + arrows[i].x] = -1;
        removed++;
        found = true;
        break; // Restart search after removal
      }
    }
    
    if (!found) {
      // No removable arrows but board not empty - unsolvable!
      return {
        solvable: false,
        removed: removed,
        remaining: arrows.length - removed,
        message: `Stuck with ${arrows.length - removed} arrows remaining`
      };
    }
  }
  
  if (removed === arrows.length) {
    return { solvable: true, removed: removed, remaining: 0, message: 'Fully solved' };
  } else {
    return {
      solvable: false,
      removed: removed,
      remaining: arrows.length - removed,
      message: `Incomplete: ${maxIterations} iterations exceeded`
    };
  }
}

// Validate a single level
function validateLevel(levelNum) {
  try {
    // Generate the level using the ACTUAL production generator
    const level = GameCore.genLevel(levelNum);
    
    // First, check that the level was generated
    if (!level || !level.arrows || level.arrows.length === 0) {
      return {
        level: levelNum,
        passed: false,
        error: 'Level generation failed',
        arrows: 0
      };
    }
    
    // Validate using the actual game's validateBoardSolution function
    const isValid = GameCore.validateBoardSolution(level.cols, level.rows, level.arrows.slice());
    
    // Also run our full simulation
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
      solvable: solution.solvable,
      removed: solution.removed
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
console.log('Starting validation of all 1000 levels...\n');

// Process in batches to avoid memory issues
const BATCH_SIZE = 100;
let batchStart = 1;

async function runValidation() {
  for (let batchStart = 1; batchStart <= 1000; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, 1000);
    const batchSize = batchEnd - batchStart + 1;
    
    console.log(`Validating levels ${batchStart}-${batchEnd}...`);
    
    // Process batch
    for (let levelNum = batchStart; levelNum <= batchEnd; levelNum++) {
      const result = validateLevel(levelNum);
      
      if (result.passed) {
        results.passed++;
      } else {
        results.failed++;
        if (results.errors.length <= 10) { // Only show first 10 errors
          console.log(`  ✗ Level ${result.level} FAILED: ${result.error || 'Validation failed'}`);
        }
      }
      
      // Progress indicator
      if (levelNum % 50 === 0) {
        process.stdout.write(`\rProgress: ${levelNum}/1000 (${((levelNum/1000)*100).toFixed(1)}%)`);
      }
    }
    
    console.log(`\nBatch ${batchStart}-${batchEnd}: ${batchSize - (batchEnd - batchStart + 1 - results.passed + (batchStart - 1))} passed`);
  }
  
  // Final results
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
  const resultsPath = path.join(__dirname, '1000_level_validation_results.json');
  fs.writeFileSync(resultsPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    results: results,
    errors: results.errors
  }, null, 2));
  
  console.log(`\nResults saved to: ${resultsPath}`);
  
  // Also save a summary
  const summaryPath = path.join(__dirname, '1000_level_validation_summary.txt');
  const summary = [
    'ARROW OUT! - 1000 LEVEL VALIDATION SUMMARY',
    '==========================================',
    `Total levels: ${results.total}`,
    `Passed: ${results.passed}`,
    `Failed: ${results.failed}`,
    `Time: ${duration}ms`,
    `Average per level: ${(duration / results.total).toFixed(2)}ms`,
    results.errors.length > 0 ? `\nErrors: ${results.errors.length}` : '\n✓ All levels passed!',
    `\nFull results: ${resultsPath}`
  ].join('\n');
  
  fs.writeFileSync(summaryPath, summary);
  console.log(`Summary saved to: ${summaryPath}`);
  
  return results;
}

// Run the validation
runValidation().then(finalResults => {
  console.log('\n✓ Validation complete!');
  process.exit(finalResults.failed > 0 ? 1 : 0);
}).catch(err => {
  console.error('Validation error:', err);
  process.exit(1);
});
