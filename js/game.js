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
  // Cosmetic arrow skins (same 8 slots as PALETTE so any board maps 1:1)
  const SKINS = {
    default: { name: 'Classic Neon', price: 0, colors: PALETTE.slice() },
    candy:   { name: 'Candy Pop',     price: 120, colors: ['#ff6b9d', '#ffb3c6', '#ffd93d', '#ff8fab', '#a2d2ff', '#bde0fe', '#cdb4db', '#ffafcc'] },
    sunset:  { name: 'Sunset Heat',   price: 200, colors: ['#ff4d6d', '#ff7b54', '#ffa62b', '#ffd93d', '#ff9a8b', '#ff6b6b', '#f76b8a', '#f8961e'] },
    ocean:   { name: 'Deep Ocean',    price: 200, colors: ['#00d4ff', '#00b4d8', '#48cae4', '#90e0ef', '#0077b6', '#0096c7', '#62d0ff', '#ade8f4'] },
    forest:  { name: 'Forest Mint',  price: 300, colors: ['#4ade80', '#22c55e', '#86efac', '#16a34a', '#34d399', '#a7f3d0', '#10b981', '#6ee7b7'] },
    royal:   { name: 'Royal Gold',    price: 400, colors: ['#ffd700', '#ffb300', '#ffe066', '#f59e0b', '#d4af37', '#fff3b0', '#eab308', '#fde047'] },
    galaxy:  { name: 'Galaxy Vibes',  price: 500, colors: ['#c084fc', '#a855f7', '#8b5cf6', '#e879f9', '#7c3aed', '#d946ef', '#6366f1', '#f0abfc'] }
  };
  const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // up, right, down, left
  const DIFFICULTY_THRESHOLDS = {
    easy: 50,
    medium: 200,
    hard: 500,
    expert: 800,
    master: 1000
  };

  // ===== Layout families =====
  // Every level paints its active-cell mask with one of these families so
  // boards differ in SHAPE, not just colors. Family choice is a pure
  // function of the level number; everything else is driven by the level
  // seed, so each level reproduces the exact same puzzle on every replay.
  const FAMILIES = ['blob', 'clusters', 'maze', 'spiral', 'branch', 'bands', 'dense', 'ring'];

  function familyOf(n) {
    n = Math.floor(Number(n)) || 0;
    if (n > 0 && n % 50 === 0) return 'ring'; // milestone layouts stand out
    return FAMILIES[n % FAMILIES.length];
  }

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
  // Uses a "roller-coaster" curve like trending tap-away games:
  // a very easy 10-level onboarding, then a gradual ramp with a spike
  // level every 10 (n % 10 === 0) followed by an easier breather level.
  function levelConfig(n) {
    let grid, arrows;

    // Onboarding (1-10): tiny boards, near-instant wins
    if (n <= 10) {
      grid = Math.min(6, 3 + Math.ceil(n / 3));
      arrows = 3 + Math.round((n - 1) * 0.9);
    }
    // Easy: 5x5 to 7x7 boards
    else if (n <= DIFFICULTY_THRESHOLDS.easy) {
      grid = Math.min(7, 5 + Math.ceil((n - 10) / 14));
      arrows = Math.min(30, 10 + Math.round((n - 10) * 0.55));
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

    // Roller-coaster overlay: spike every 10th level, breather right after
    if (n > 10) {
      var mod = n % 10;
      if (mod === 0) {
        // Spike level: denser board, one grid size up when possible
        arrows = Math.min(130, Math.round(arrows * 1.18) + 2);
        grid = Math.min(12, grid + 1);
      } else if (mod === 1) {
        // Breather level right after the spike
        arrows = Math.max(4, Math.round(arrows * 0.75));
      }
    }

    grid = Math.max(4, Math.min(12, grid | 0));
    arrows = Math.max(1, Math.min(130, arrows | 0));
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

  // ===== Layout-family shape builders =====
  // Each builder paints a distinctive mask of active cells on the W x H
  // grid. Every builder ends with a shared "top-up" that grows the mask
  // blob-style so the level can always fit its target arrow count.
  function buildShape(family, W, H, rng, targetCells) {
    var N = W * H;
    var inShape = new Uint8Array(N);
    var cells = 0;
    targetCells = Math.min(N, Math.max(5, targetCells));

    function put(x, y) {
      if (x < 0 || y < 0 || x >= W || y >= H) return false;
      var i = y * W + x;
      if (inShape[i]) return false;
      inShape[i] = 1;
      cells++;
      return true;
    }

    if (family === 'dense') {
      // Near-full grid with a few punched holes
      for (var di = 0; di < N; di++) inShape[di] = 1;
      cells = N;
      var holes = Math.round(N * (0.06 + rng() * 0.08));
      var dguard = 0;
      while (holes > 0 && dguard++ < 400) {
        var hi = (rng() * N) | 0;
        if (inShape[hi]) { inShape[hi] = 0; cells--; holes--; }
      }
    } else if (family === 'bands') {
      // 2-4 separated full-row / full-column color regions
      var horizontal = rng() < 0.5;
      var bandCount = 2 + ((rng() * 3) | 0);
      var axis = horizontal ? H : W;
      var slot = Math.max(1, Math.floor(axis / bandCount));
      for (var b = 0; b < bandCount; b++) {
        var start = b * slot;
        var end = (b === bandCount - 1) ? axis : Math.min(axis, start + Math.max(1, slot - 1));
        for (var k = start; k < end; k++) {
          if (horizontal) { for (var bx = 0; bx < W; bx++) put(bx, k); }
          else { for (var by = 0; by < H; by++) put(k, by); }
        }
      }
    } else if (family === 'ring') {
      // Concentric hollow square rings around the center + center cluster
      var rcx = (W - 1) / 2, rcy = (H - 1) / 2;
      var maxR = Math.floor(Math.min(W, H) / 2);
      for (var rr = 1; rr <= maxR; rr += 2) {
        for (var ry = 0; ry < H; ry++) {
          for (var rx = 0; rx < W; rx++) {
            var dist = Math.round(Math.max(Math.abs(rx - rcx), Math.abs(ry - rcy)));
            if (dist === rr && rng() < 0.94) put(rx, ry);
          }
        }
      }
      put(Math.floor(rcx), Math.floor(rcy));
      if (W > 3 && H > 3) { put(Math.floor(rcx) + 1, Math.floor(rcy)); put(Math.floor(rcx), Math.floor(rcy) + 1); }
    } else if (family === 'spiral') {
      // Square spiral arm winding outward from the center
      var sx = (W / 2) | 0, sy = (H / 2) | 0;
      var sdir = (rng() * 4) | 0;
      var segLen = 1, segLeft = 1;
      put(sx, sy);
      var sguard = 0;
      while (cells < targetCells && sguard++ < 800) {
        var nx = sx + DIRS[sdir][0], ny = sy + DIRS[sdir][1];
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) break;
        sx = nx; sy = ny;
        put(sx, sy);
        segLeft--;
        if (segLeft === 0) { sdir = (sdir + 1) % 4; segLen++; segLeft = segLen; }
      }
    } else if (family === 'maze') {
      // Winding one-cell corridor with direction persistence
      var mx = (W / 2) | 0, my = (H / 2) | 0;
      var md = (rng() * 4) | 0;
      put(mx, my);
      var mguard = 0;
      while (cells < targetCells && mguard++ < 2000) {
        if (rng() < 0.72) {
          var nx2 = mx + DIRS[md][0], ny2 = my + DIRS[md][1];
          if (nx2 >= 0 && ny2 >= 0 && nx2 < W && ny2 < H) { mx = nx2; my = ny2; put(mx, my); }
          else md = (md + 1 + ((rng() * 3) | 0)) % 4;
        } else {
          md = (rng() < 0.5 ? (md + 1) : (md + 3)) % 4;
        }
      }
    } else if (family === 'clusters') {
      // 2-4 compact seed clusters grown a little
      var K = 2 + ((rng() * 3) | 0);
      var want = Math.max(2, Math.floor(targetCells / K));
      for (var c = 0; c < K; c++) {
        var cx = 1 + ((rng() * (W - 2)) | 0), cy = 1 + ((rng() * (H - 2)) | 0);
        put(cx, cy);
        var grown = 0, cguard = 0;
        while (grown < want && cguard++ < 300) {
          var ax = cx + ((rng() * 3) | 0) - 1, ay = cy + ((rng() * 3) | 0) - 1;
          if (put(ax, ay)) grown++;
        }
      }
    } else if (family === 'branch') {
      // Branching tree grown from the center with a living frontier
      var frontier = [];
      var fxx = (W / 2) | 0, fyy = (H / 2) | 0;
      put(fxx, fyy);
      frontier.push([fxx, fyy]);
      var bguard = 0;
      while (cells < targetCells && bguard++ < 2000) {
        if (!frontier.length) {
          // Reseed from a random already-active cell
          var reseed = (rng() * N) | 0;
          if (!inShape[reseed]) continue;
          frontier.push([reseed % W, (reseed / W) | 0]);
          continue;
        }
        var fi = (rng() * frontier.length) | 0;
        var fc = frontier[fi];
        var fd = (rng() * 4) | 0;
        var fx = fc[0] + DIRS[fd][0], fy = fc[1] + DIRS[fd][1];
        if (fx >= 0 && fy >= 0 && fx < W && fy < H && !inShape[fy * W + fx]) {
          put(fx, fy);
          frontier.push([fx, fy]);
          if (rng() < 0.35) frontier.splice(fi, 1);
        } else {
          frontier.splice(fi, 1);
        }
      }
    } else {
      // 'blob' (default): the classic soft adjacent growth
      put((W / 2) | 0, (H / 2) | 0);
      var guard = 0;
      while (cells < targetCells && guard++ < 2000) {
        var i = (rng() * N) | 0;
        if (inShape[i]) continue;
        var x = i % W, y = (i / W) | 0;
        var adj = (x > 0 && inShape[i - 1]) || (x < W - 1 && inShape[i + 1]) || (y > 0 && inShape[i - W]) || (y < H - 1 && inShape[i + W]);
        if (adj) { inShape[i] = 1; cells++; }
      }
    }

    // Shared top-up: grow blob-style from existing cells until the mask can
    // fit the target arrow count (no-op when a family already filled it).
    var tguard = 0;
    while (cells < targetCells && tguard++ < 3000) {
      var ti = (rng() * N) | 0;
      if (inShape[ti]) continue;
      var tx = ti % W, ty = (ti / W) | 0;
      var tadj = (tx > 0 && inShape[ti - 1]) || (tx < W - 1 && inShape[ti + 1]) ||
                 (ty > 0 && inShape[ti - W]) || (ty < H - 1 && inShape[ti + W]);
      if (tadj) { inShape[ti] = 1; cells++; }
    }
    return inShape;
  }

  // Deterministic per-family color assignment so boards read as colorful
  // regions instead of confetti noise. Purely cosmetic: colors never
  // affect movement, collision, or validation.
  function makeColorFn(family, W, H) {
    if (family === 'bands') {
      return function(x, y, rng) {
        var band = Math.min(3, Math.floor((y / H) * 4));
        return (band * 2 + (x > (W - 1) / 2 ? 1 : 0) + (rng() < 0.2 ? 1 : 0)) % 8;
      };
    }
    if (family === 'spiral' || family === 'ring' || family === 'branch' || family === 'maze') {
      return function(x, y, rng) {
        var cx = (W - 1) / 2, cy = (H - 1) / 2;
        var dist = Math.max(Math.abs(x - cx), Math.abs(y - cy));
        var bucket = Math.min(7, Math.floor(dist / Math.max(1, Math.max(W, H) / 8)));
        return (bucket + (rng() < 0.2 ? 1 : 0)) % 8;
      };
    }
    // blob / clusters / dense: coarse spatial color blocks
    return function(x, y, rng) {
      return (((x >> 1) + (y >> 1) * 3 + (rng() < 0.2 ? 1 : 0)) % 8);
    };
  }

  // Reverse placement: each arrow's exit ray is clear at the moment it is
  // placed, so removing arrows in REVERSE placement order always solves
  // the board. Cells with the fewest clear exits are placed first, which
  // packs exit-lane constraints into the puzzle.
  function placeArrows(W, H, inShape, count, rng, colorFn) {
    var shapeCells = [];
    for (var s = 0; s < W * H; s++) if (inShape[s]) shapeCells.push(s);
    var arrows = [];
    var occ = new Int32Array(W * H).fill(-1);
    for (var step = 0; step < count; step++) {
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
      var ax = best % W, ay = (best / W) | 0;
      occ[best] = arrows.length;
      arrows.push({ 
        x: ax, 
        y: ay, 
        dir: dir, 
        c: colorFn(ax, ay, rng), 
        step: step, 
        alive: true 
      });
    }
    return arrows;
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
    var family = familyOf(n);

    // 1. Paint the layout-family shape mask
    var targetCells = Math.min(N, Math.max(5, Math.round(cfg.arrows * 1.5)));
    var inShape = buildShape(family, W, H, rng, targetCells);

    // 2. Reverse placement: each arrow's exit ray must be clear
    var arrows = placeArrows(W, H, inShape, cfg.arrows, rng, makeColorFn(family, W, H));

    // Defense in depth: if a family ever yields an empty board, fall back
    // to the classic blob shape once (never triggers in practice).
    if (!arrows.length) {
      rng = mulberry32(cfg.seed ^ 0xBEEF);
      inShape = buildShape('blob', W, H, rng, targetCells);
      arrows = placeArrows(W, H, inShape, cfg.arrows, rng, makeColorFn('blob', W, H));
    }
    
    // 3. Validate the board has a solution
    if (!validateBoardSolution(W, H, arrows.slice())) {
      // If validation fails (should be rare with reverse placement), regenerate
      return genLevel(n);
    }
    
    return { level: n, cols: W, rows: H, shape: inShape, arrows: arrows, difficulty: getDifficultyLevel(n), family: family };
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
    
    // Daily challenge: medium difficulty, 8x8 board, rotating family
    var W = 8, H = 8, N = W * H;
    var arrowsCount = 30 + ((seed % 20) | 0);
    var family = FAMILIES[seed % FAMILIES.length];
    var targetCells = Math.min(N, Math.max(5, Math.round(arrowsCount * 1.5)));
    var inShape = buildShape(family, W, H, rng, targetCells);
    var arrows = placeArrows(W, H, inShape, arrowsCount, rng, makeColorFn(family, W, H));
    
    return { 
      level: 'daily', 
      cols: W, 
      rows: H, 
      shape: inShape, 
      arrows: arrows,
      difficulty: 'medium',
      family: family,
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
    SKINS: SKINS,
    DIRS: DIRS,
    FAMILIES: FAMILIES.slice(),
    familyOf: familyOf,
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
