/**
 * Arrow Out! - Test Suite
 * Comprehensive tests for all game functionality
 */
'use strict';

const Tests = (function() {
  var results = [];
  var passed = 0;
  var failed = 0;

  function addResult(testName, success, message) {
    results.push({ name: testName, success: success, message: message });
    if (success) {
      passed++;
      console.log('✓ PASS: ' + testName);
    } else {
      failed++;
      console.error('✗ FAIL: ' + testName + ' - ' + message);
    }
  }

  function getResults() {
    return { passed: passed, failed: failed, results: results };
  }

  function reset() {
    results = [];
    passed = 0;
    failed = 0;
  }

  // Test GameCore module
  function testGameCore() {
    console.log('\n=== Testing GameCore Module ===');
    
    // Test level generation
    try {
      var level = GameCore.genLevel(1);
      addResult('GameCore.genLevel(1) generates valid level', 
        level && level.level === 1 && level.arrows.length > 0,
        'Level not generated correctly');
    } catch(e) {
      addResult('GameCore.genLevel(1) generates valid level', false, e.message);
    }
    
    // Test difficulty levels
    try {
      var easy = GameCore.getDifficultyLevel(10);
      var medium = GameCore.getDifficultyLevel(100);
      var hard = GameCore.getDifficultyLevel(300);
      var expert = GameCore.getDifficultyLevel(600);
      var master = GameCore.getDifficultyLevel(900);
      
      addResult('GameCore.getDifficultyLevel returns correct values',
        easy === 'easy' && medium === 'medium' && hard === 'hard' && expert === 'expert' && master === 'master',
        'Difficulty levels not correct');
    } catch(e) {
      addResult('GameCore.getDifficultyLevel returns correct values', false, e.message);
    }
    
    // Test star calculation
    try {
      var stars1 = GameCore.calcStars(0, 0); // Perfect
      var stars2 = GameCore.calcStars(1, 0); // 2 mistakes, no hints
      var stars3 = GameCore.calcStars(3, 1); // Too many mistakes
      
      addResult('GameCore.calcStars calculates correctly',
        stars1 === 3 && stars2 === 2 && stars3 === 1,
        'Star calculation incorrect');
    } catch(e) {
      addResult('GameCore.calcStars calculates correctly', false, e.message);
    }
    
    // Test daily challenge generation
    try {
      var date = new Date();
      var daily = GameCore.genDailyChallenge(date);
      addResult('GameCore.genDailyChallenge generates valid level',
        daily && daily.level === 'daily' && daily.arrows.length > 0,
        'Daily challenge not generated correctly');
    } catch(e) {
      addResult('GameCore.genDailyChallenge generates valid level', false, e.message);
    }
    
    // Test board validation
    try {
      var level = GameCore.genLevel(50);
      var isValid = GameCore.validateBoardSolution(level.cols, level.rows, level.arrows.slice());
      addResult('GameCore.validateBoardSolution validates correctly',
        isValid === true,
        'Board validation failed');
    } catch(e) {
      addResult('GameCore.validateBoardSolution validates correctly', false, e.message);
    }
    
    // Test hint arrow
    try {
      var level = GameCore.genLevel(25);
      var N = level.cols * level.rows;
      var occ = new Int32Array(N).fill(-1);
      for (var i = 0; i < level.arrows.length; i++) {
        occ[level.arrows[i].y * level.cols + level.arrows[i].x] = i;
      }
      var hint = GameCore.hintArrow(level.arrows, occ, level.cols, level.rows);
      var isValid = hint >= 0 && hint < level.arrows.length;
      var isRemovable = false;
      if (isValid) {
        var blocker = GameCore.rayBlocker(occ, level.arrows, level.cols, level.rows,
          level.arrows[hint].x, level.arrows[hint].y, level.arrows[hint].dir);
        isRemovable = blocker === -1;
      }
      addResult('GameCore.hintArrow finds valid removable arrow',
        isValid && isRemovable,
        isValid ? (isRemovable ? '' : 'Hint arrow is blocked') : 'Hint arrow not found');
    } catch(e) {
      addResult('GameCore.hintArrow finds valid removable arrow', false, e.message);
    }
  }

  // Test Storage module
  function testStorage() {
    console.log('\n=== Testing Storage Module ===');
    
    try {
      // Test default save
      var defaultSave = Storage.getSave();
      addResult('Storage.getSave returns valid object',
        defaultSave && defaultSave.v === 2 && defaultSave.unlocked === 1,
        'Default save not valid');
      
      // Test persistence
      var testSave = { v: 2, unlocked: 5, best: { 1: { stars: 3, plays: 1 } } };
      Storage.updateSave(testSave);
      var updated = Storage.getSave();
      addResult('Storage.updateSave persists data',
        updated.unlocked === 5 && updated.best[1] && updated.best[1].stars === 3,
        'Save persistence failed');
      
      // Test level best update
      Storage.updateLevelBest(1, 3, 1);
      var afterUpdate = Storage.getSave();
      addResult('Storage.updateLevelBest updates correctly',
        afterUpdate.best[1] && afterUpdate.best[1].stars === 3,
        'Level best update failed');
      
      // Test daily challenge update
      var today = new Date();
      Storage.updateDailyChallenge(today, 3);
      var afterDaily = Storage.getSave();
      addResult('Storage.updateDailyChallenge updates correctly',
        afterDaily.daily.completed === true && afterDaily.daily.stars === 3,
        'Daily challenge update failed');
      
      // Test hints and mistakes tracking
      Storage.updateHintsUsed(2);
      Storage.updateMistakes(3);
      var afterTracking = Storage.getSave();
      addResult('Storage tracks hints and mistakes',
        afterTracking.stats.hintsUsed === 2 && afterTracking.stats.mistakes === 3,
        'Tracking failed');
      
      // Reset
      Storage.resetAll();
      addResult('Storage.resetAll clears data',
        Storage.getSave().unlocked === 1,
        'Reset failed');
      
    } catch(e) {
      addResult('Storage module tests', false, e.message);
    }
  }

  // Test Audio module
  function testAudio() {
    console.log('\n=== Testing Audio Module ===');
    
    try {
      // Test audio enabled state
      var enabled = Audio.enabled;
      Audio.enabled = true;
      addResult('Audio.enabled can be set',
        Audio.enabled === true,
        'Audio enabled state not working');
      
      Audio.enabled = false;
      addResult('Audio.enabled can be disabled',
        Audio.enabled === false,
        'Audio disabled state not working');
      
      // Reset
      Audio.enabled = enabled;
      
      // Test unlock
      Audio.unlock();
      addResult('Audio.unlock runs without error', true, '');
      
    } catch(e) {
      addResult('Audio module tests', false, e.message);
    }
  }

  // Test Haptics module
  function testHaptics() {
    console.log('\n=== Testing Haptics Module ===');
    
    try {
      // Test haptics support check
      var supported = Haptics.isSupported();
      addResult('Haptics.isSupported returns boolean',
        typeof supported === 'boolean',
        'Haptics support check not working');
      
      // Test enabled state
      var enabled = Haptics.getEnabled();
      Haptics.setEnabled(true);
      addResult('Haptics.setEnabled works',
        Haptics.getEnabled() === true,
        'Haptics enabled state not working');
      
      Haptics.setEnabled(enabled);
      addResult('Haptics can be disabled',
        Haptics.getEnabled() === enabled,
        'Haptics disabled state not working');
      
    } catch(e) {
      addResult('Haptics module tests', false, e.message);
    }
  }

  // Test PWA module
  function testPWA() {
    console.log('\n=== Testing PWA Module ===');
    
    try {
      // Test standalone check
      var standalone = PWA.isStandalone();
      addResult('PWA.isStandalone returns boolean',
        typeof standalone === 'boolean',
        'Standalone check not working');
      
      // Test iOS check
      var isIOS = PWA.isIOS();
      addResult('PWA.isIOS returns boolean',
        typeof isIOS === 'boolean',
        'iOS check not working');
      
      // Test SW source
      var swSrc = PWA.SW_SRC;
      addResult('PWA.SW_SRC contains service worker code',
        swSrc && swSrc.length > 100,
        'Service worker source not available');
      
    } catch(e) {
      addResult('PWA module tests', false, e.message);
    }
  }

  // Test UI module
  function testUI() {
    console.log('\n=== Testing UI Module ===');
    
    try {
      // Test UI initialization
      addResult('UI module initialized',
        UI.REDUCED !== undefined,
        'UI module not initialized');
      
      // Test toast function
      UI.toast('Test toast');
      addResult('UI.toast runs without error', true, '');
      
      // Test dialog functions
      UI.openDlg('dlg-menu');
      addResult('UI.openDlg runs without error', true, '');
      
      UI.closeAll();
      addResult('UI.closeAll runs without error', true, '');
      
      // Test stars HTML
      var stars = UI.starsHTML(3, 3);
      addResult('UI.starsHTML generates correct HTML',
        stars && stars.includes('on') && stars.includes('\u2605'),
        'Stars HTML generation failed');
      
    } catch(e) {
      addResult('UI module tests', false, e.message);
    }
  }

  // Test Render module
  function testRender() {
    console.log('\n=== Testing Render Module ===');
    
    try {
      var canvas = document.getElementById('board');
      if (canvas) {
        Render.init(canvas);
        addResult('Render.init works with canvas', true, '');
        
        Render.fitCanvas();
        addResult('Render.fitCanvas runs without error', true, '');
        
        Render.ensureLoop();
        addResult('Render.ensureLoop runs without error', true, '');
        
        Render.needsRender();
        addResult('Render.needsRender runs without error', true, '');
      } else {
        addResult('Render module tests', false, 'Canvas element not found');
      }
      
    } catch(e) {
      addResult('Render module tests', false, e.message);
    }
  }

  // Run all tests
  function runAllTests() {
    reset();
    console.log('\n========== ARROW OUT! TEST SUITE ==========');
    
    testGameCore();
    testStorage();
    testAudio();
    testHaptics();
    testPWA();
    testUI();
    testRender();
    
    var final = getResults();
    console.log('\n========== TEST RESULTS ==========');
    console.log('Total: ' + (final.passed + final.failed));
    console.log('Passed: ' + final.passed);
    console.log('Failed: ' + final.failed);
    
    if (final.failed > 0) {
      console.log('\nFailed tests:');
      final.results.forEach(function(result) {
        if (!result.success) {
          console.log('  - ' + result.name + ': ' + result.message);
        }
      });
    }
    
    return final;
  }

  // Run tests when DOM is ready
  function init() {
    document.addEventListener('DOMContentLoaded', function() {
      // Wait a bit for modules to initialize
      setTimeout(function() {
        runAllTests();
      }, 1000);
    });
  }

  return {
    runAllTests: runAllTests,
    getResults: getResults,
    reset: reset,
    init: init
  };
})();

// Initialize tests
Tests.init();
