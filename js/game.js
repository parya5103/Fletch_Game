/**
 * Arrow Out! - Game Core Module
 * Handles game state, board logic, level generation, and validation
 *
 * Piece model (v3): every arrow is a WINDING PATH of grid cells
 * (cells = connected orthogonal corridor, tail -> head). The piece exits
 * the board along `dir` with its whole body; the arrowhead is drawn at
 * the head cell pointing `dir`, so visuals always match movement.
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
    galaxy:  { name: 'Galaxy Vibes',  price: 500, colors: ['#c084fc', '#a855f7', '#8b5cf6', '#e879f9', '#7c3aed', '#d946ef', '#6366f1', '#f0abfc'] },
    ember:   { name: 'Ember Glow',    price: 600, isNew: true, colors: ['#ff4d00', '#ff6b35', '#ff9f1c', '#ffd60a', '#e63946', '#d62828', '#ff7b00', '#ffba08'] },
    ice:     { name: 'Ice Frost',     price: 700, isNew: true, colors: ['#d0f4ff', '#a8e0ff', '#79c8ff', '#bde0fe', '#e0f7ff', '#99e2f5', '#c4e5ff', '#8ecae6'] },
    cyber:   { name: 'Cyber Neon',   price: 800, isNew: true, colors: ['#39ff14', '#00ff9f', '#00fff7', '#f3ff00', '#ff00e6', '#00ffcc', '#76ff03', '#ff40ff'] },
    mono:    { name: 'Mono Slate',    price: 900, isNew: true, colors: ['#f8f9fa', '#dee2e6', '#adb5bd', '#6c757d', '#495057', '#ced4da', '#868e96', '#343a40'] }
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
  // Every level paints its active-cell mask (the board silhouette) with
  // one of these families; winding arrow paths then fill the mask.
  // Family choice is a pure function of the level number, so each level
  // reproduces the exact same puzzle on every replay.
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
  // Boards are sized for the dense maze look from level 1: bigger grids
  // than v2, high mask fill, and long winding paths everywhere. Difficulty
  // ramps through board size, path length and piece count; a spike level
  // every 10th level is followed by an easier breather.
  function levelConfig(n) {
    let grid, pieces;

    // Onboarding (1-10): 9x9 to 10x10 boards, dense maze fill from level 1
    if (n <= 10) {
      grid = Math.min(10, 9 + Math.ceil((n - 5) / 5));
      pieces = Math.min(24, 16 + Math.round((n - 1) * 1.2));
    }
    // Easy: 9x9 to 11x11 boards
    else if (n <= DIFFICULTY_THRESHOLDS.easy) {
      grid = Math.min(11, 9 + Math.ceil((n - 10) / 8));
      pieces = Math.min(28, 17 + Math.round((n - 10) * 0.3));
    }
    // Medium: 9x9 to 10x10 boards
    else if (n <= DIFFICULTY_THRESHOLDS.medium) {
      grid = Math.min(10, 9 + Math.ceil((n - DIFFICULTY_THRESHOLDS.easy) / 76));
      pieces = Math.min(26, 18 + Math.round((n - DIFFICULTY_THRESHOLDS.easy) * 0.053));
    }
    // Hard: 10x10 to 11x11 boards
    else if (n <= DIFFICULTY_THRESHOLDS.hard) {
      grid = Math.min(11, 10 + Math.ceil((n - DIFFICULTY_THRESHOLDS.medium) / 101));
      pieces = Math.min(30, 22 + Math.round((n - DIFFICULTY_THRESHOLDS.medium) * 0.027));
    }
    // Expert: 11x11 to 12x12 boards
    else if (n <= DIFFICULTY_THRESHOLDS.expert) {
      grid = Math.min(12, 11 + Math.ceil((n - DIFFICULTY_THRESHOLDS.hard) / 101));
      pieces = Math.min(34, 26 + Math.round((n - DIFFICULTY_THRESHOLDS.hard) * 0.027));
    }
    // Master: full 12x12 boards, dense maze fill
    else {
      grid = 12;
      pieces = Math.min(36, 30 + Math.round((n - DIFFICULTY_THRESHOLDS.expert) * 0.03));
    }

    // Roller-coaster overlay: spike every 10th level, breather right after
    if (n > 10) {
      var mod = n % 10;
      if (mod === 0) {
        // Spike level: more paths, one grid size up when possible
        pieces = Math.min(36, Math.round(pieces * 1.15) + 1);
        grid = Math.min(12, grid + 1);
      } else if (mod === 1) {
        // Breather level right after the spike
        pieces = Math.max(5, Math.round(pieces * 0.8));
      }
    }

    grid = Math.max(4, Math.min(12, grid | 0));
    pieces = Math.max(4, Math.min(36, pieces | 0));
    return { grid: grid, pieces: pieces, seed: ((n * 2654435761) ^ 0x9E3779B9) >>> 0 };
  }

  // Target winding-path length (cells per arrow) per difficulty tier.
  // Long, snaking corridors with multiple 90-degree turns are the core
  // visual identity of the game - even level 1 paths run 6+ cells.
  function targetLenFor(n) {
    if (n <= DIFFICULTY_THRESHOLDS.easy) return 7;
    if (n <= DIFFICULTY_THRESHOLDS.medium) return 8;
    if (n <= DIFFICULTY_THRESHOLDS.hard) return 9;
    if (n <= DIFFICULTY_THRESHOLDS.expert) return 10;
    return 11;
  }

  // Board mask fill fraction: how much of the grid the puzzle silhouette
  // covers. Levels 1-50 are noticeably denser (more arrows on screen);
  // 51+ keeps the original curve.
  function fillFracFor(n) {
    var lvl = Math.max(1, Math.floor(Number(n)) || 1);
    if (lvl <= 50) return Math.min(0.88, 0.80 + (lvl - 1) * 0.002);
    return 0.72 + Math.min(0.16, (lvl - 1) * 0.0002);
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

  // ===== Movement rules (multi-cell pieces) =====
  // A piece exits like a snake: it travels its own winding path and then
  // slides straight out from its HEAD cell along the arrowhead direction.
  // It is blocked only if another alive piece sits strictly ahead of the
  // head cell along that direction (the head's exit corridor). Straight
  // projections of winding body cells are never travelled, so they can
  // never block the exit (no false blocking).

  // Which exit directions are open for a cell during generation,
  // considering only cells already taken by earlier pieces (occS > 0).
  function cellDirs(occS, W, H, x, y) {
    var good = [];
    for (var d = 0; d < 4; d++) {
      var dx = DIRS[d][0], dy = DIRS[d][1];
      var cx = x + dx, cy = y + dy, ok = true;
      while (cx >= 0 && cx < W && cy >= 0 && cy < H) {
        if (occS[cy * W + cx]) { ok = false; break; }
        cx += dx; cy += dy;
      }
      if (ok) good.push(d);
    }
    return good;
  }

  // First blocking piece id for piece index pi, or -1 when it can exit.
  // The piece exits like a snake: the head leads along `dir` out of the
  // head cell while the body follows the piece's own winding path (its
  // own cells are vacated at launch and travel with it). Only cells
  // STRICTLY AHEAD of the head cell along `dir` are ever swept, so only
  // that exit ray can be blocked - a piece sitting in the straight
  // projection of some body segment does not block anything.
  function pieceBlocker(occ, pieces, W, H, pi) {
    var P = pieces[pi];
    if (!P || !P.alive || !P.cells || !P.cells.length) return -1;
    var d = P.dir, dx = DIRS[d][0], dy = DIRS[d][1];
    var head = P.cells[P.cells.length - 1];
    var cx = head.x + dx, cy = head.y + dy;
    while (cx >= 0 && cx < W && cy >= 0 && cy < H) {
      var bi = occ[cy * W + cx];
      if (bi !== -1 && bi !== pi && pieces[bi] && pieces[bi].alive) return bi;
      cx += dx; cy += dy;
    }
    return -1;
  }

  // ===== Layout-family shape builders (board silhouettes) =====
  // Each builder paints a distinctive mask of active cells on the W x H
  // grid. Every builder ends with a shared "top-up" that grows the mask
  // blob-style so the level can always fit its target cell count.
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
      // 2-4 separated full-row / full-column regions
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

    // Shared top-up: grow blob-style from existing cells until the mask
    // reaches the target size (no-op when a family already filled it).
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
  // affect movement, collision, or validation. Applied per piece via its
  // seed cell, so neighboring paths share a region color.
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
    // blob / clusters / dense: broad diagonal gradient bands sweeping the
    // board corner to corner (red -> orange -> ... -> purple like the
    // reference), so each region reads as one color zone, not confetti
    return function(x, y, rng) {
      var span = Math.max(1, (W + H - 2) / 8);
      var bucket = Math.min(7, Math.floor((x + y) / span));
      return (bucket + (rng() < 0.12 ? 1 : 0)) % 8;
    };
  }

  // Direction from cell a to orthogonal neighbor b, or -1
  function dirFrom(a, b) {
    if (b.x === a.x + 1 && b.y === a.y) return 1;
    if (b.x === a.x - 1 && b.y === a.y) return 3;
    if (b.x === a.x && b.y === a.y + 1) return 2;
    if (b.x === a.x && b.y === a.y - 1) return 0;
    return -1;
  }

  // Grow one winding orthogonal path from (sx, sy). Every added cell keeps
  // at least one exit direction valid for the WHOLE piece (intersection
  // of per-cell open directions), so the finished piece can always leave
  // the board cleanly against the pieces placed before it.
  function growPiece(W, H, mask, occS, rng, sx, sy, targetLen) {
    var dirsOK = cellDirs(occS, W, H, sx, sy);
    if (!dirsOK.length) return null;
    var used = new Uint8Array(W * H);
    used[sy * W + sx] = 1;
    var cs = [{ x: sx, y: sy }];
    var len = 1;
    var guard = 0;
    while (len < targetLen && guard++ < 300) {
      var cands = [];
      for (var e = 0; e < 2; e++) {
        var end = cs[e === 0 ? 0 : len - 1];
        var out = -1;
        var otherOut = -1; // out-direction of the end NOT being extended
        if (len >= 2) {
          if (e === 0) {
            out = dirFrom(cs[1], cs[0]);
            otherOut = dirFrom(cs[len - 2], cs[len - 1]);
          } else {
            out = dirFrom(cs[len - 2], cs[len - 1]);
            otherOut = dirFrom(cs[1], cs[0]);
          }
        }
        for (var d = 0; d < 4; d++) {
          var nx = end.x + DIRS[d][0], ny = end.y + DIRS[d][1];
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          var ni = ny * W + nx;
          if (!mask[ni] || occS[ni] || used[ni]) continue;
          var inter = [];
          var cd = cellDirs(occS, W, H, nx, ny);
          for (var q = 0; q < cd.length; q++) {
            if (dirsOK.indexOf(cd[q]) !== -1) inter.push(cd[q]);
          }
          if (!inter.length) continue;
          // Alignment invariant: the extended end now points out along d.
          // Keep at least one end's out-direction inside the (shrinking)
          // legal exit set, so the finished piece ALWAYS has an end whose
          // segment leads straight into a legal exit direction - the
          // arrowhead can then sit at the real head pointing exactly
          // where the piece exits (no sideways/backwards heads).
          if (inter.indexOf(d) === -1 &&
              !(otherOut !== -1 && inter.indexOf(otherOut) !== -1)) continue;
          cands.push({ e: e, x: nx, y: ny, inter: inter, straight: out !== -1 && d === out });
        }
      }
      if (!cands.length) break;
      var pick = null;
      if (rng() < 0.45) {
        // prefer continuing the current run (long corridors with bends)
        var straightCands = [];
        for (var sc = 0; sc < cands.length; sc++) {
          if (cands[sc].straight) straightCands.push(cands[sc]);
        }
        if (straightCands.length) pick = straightCands[(rng() * straightCands.length) | 0];
      }
      if (!pick) pick = cands[(rng() * cands.length) | 0];
      if (pick.e === 0) cs.unshift({ x: pick.x, y: pick.y });
      else cs.push({ x: pick.x, y: pick.y });
      used[pick.y * W + pick.x] = 1;
      dirsOK = pick.inter;
      len++;
    }
    return { cells: cs, dirsOK: dirsOK };
  }

  // Pick the piece's exit direction and orient the path so the head end
  // leads naturally into the arrowhead. The returned direction ALWAYS
  // matches the out-direction of whichever end becomes the head, so the
  // arrowhead tip, the final path segment and the legal exit direction
  // are consistent for every generated piece.
  function chooseDir(cells, dirsOK, W, H, rng) {
    var n = cells.length;
    var headOut = n >= 2 ? dirFrom(cells[n - 2], cells[n - 1]) : -1;
    var tailOut = n >= 2 ? dirFrom(cells[1], cells[0]) : -1;
    var headOK = headOut !== -1 && dirsOK.indexOf(headOut) !== -1;
    var tailOK = tailOut !== -1 && dirsOK.indexOf(tailOut) !== -1;
    // Prefer the current head end (80%): variety, but always aligned.
    if (headOK && (!tailOK || rng() < 0.8)) return headOut;
    // Otherwise the tail end leads: flip the path so it becomes the head.
    if (tailOK) {
      cells.reverse(); // tail becomes the arrowhead end
      return tailOut;
    }
    // 20% case where the head was fine but the tail was not an option:
    // keep the head - a consistent arrowhead beats variety.
    if (headOK) return headOut;
    // No end leads into a legal exit. growPiece's alignment invariant
    // makes this unreachable for real pieces (>= 2 cells); kept only as
    // a safe fallback so the piece can still exit legally.
    var hx = cells[n - 1].x, hy = cells[n - 1].y;
    var best = dirsOK[0], bestD = 99;
    for (var k = 0; k < dirsOK.length; k++) {
      var d = dirsOK[k];
      var dist = d === 0 ? hy : d === 1 ? (W - 1 - hx) : d === 2 ? (H - 1 - hy) : hx;
      if (dist < bestD || (dist === bestD && rng() < 0.5)) { bestD = dist; best = d; }
    }
    return best;
  }

  // Carve winding pieces into the mask. Pieces are placed one by one;
  // each new piece can always exit cleanly against the pieces placed
  // BEFORE it, so removing pieces in REVERSE placement order always
  // solves the board (the solvability invariant).
  function carve(W, H, mask, rng, cfgPieces, baseLen, colorFn) {
    var N = W * H;
    var occS = new Uint8Array(N);
    var freeCount = 0;
    for (var s = 0; s < N; s++) if (mask[s]) freeCount++;
    var arrows = [];
    var maxPieces = cfgPieces + Math.max(4, Math.ceil(cfgPieces * 0.5));
    var attempts = 0;
    while (arrows.length < maxPieces && attempts++ < maxPieces * 30) {
      if (arrows.length >= cfgPieces && freeCount < 2) break;
      if (freeCount < 1) break;
      // Seed bias: sample free cells and pick the one closest to the board
      // center. Carving center-out keeps later pieces near the edges where
      // their exit rays stay clear, so far fewer mask cells end up in
      // uncarvable pockets (denser boards, reference look).
      var seed = -1, tries = 0, bestD = Infinity;
      var cxx = (W - 1) / 2, cyy = (H - 1) / 2;
      while (tries++ < 24) {
        var r = (rng() * N) | 0;
        if (!mask[r] || occS[r]) continue;
        var ddx = (r % W) - cxx, ddy = ((r / W) | 0) - cyy;
        var dd = ddx * ddx + ddy * ddy + rng() * 2;
        if (dd < bestD) { bestD = dd; seed = r; }
      }
      if (seed === -1) {
        for (var s2 = 0; s2 < N; s2++) {
          if (mask[s2] && !occS[s2]) { seed = s2; break; }
        }
      }
      if (seed === -1) break;
      var sx = seed % W, sy = (seed / W) | 0;
      var tl = baseLen;
      var jitter = rng();
      // bias long: most pieces at or above the tier target so the board
      // reads as long snaking corridors, not scattered short stubs
      if (jitter < 0.20) tl += 2;
      else if (jitter < 0.45) tl += 1;
      else if (jitter > 0.88) tl -= 1;
      tl = Math.max(3, Math.min(16, tl));
      var g = growPiece(W, H, mask, occS, rng, sx, sy, tl);
      if (!g || g.cells.length < 2) continue; // never place single-cell pieces
      var c = colorFn(g.cells[0].x, g.cells[0].y, rng);
      var d = chooseDir(g.cells, g.dirsOK, W, H, rng);
      for (var q = 0; q < g.cells.length; q++) {
        occS[g.cells[q].y * W + g.cells[q].x] = 1;
        freeCount--;
      }
      arrows.push({ cells: g.cells, dir: d, c: c, step: arrows.length, alive: true });
    }
    return arrows;
  }

  // Generate a valid, solvable level
  function genLevel(n) {
    // Sanitize input: NaN/undefined must never reach level configuration.
    n = Math.floor(Number(n));
    if (!isFinite(n) || n < 1) n = 1;
    var cfg = levelConfig(n);
    cfg.grid = Math.max(4, Math.min(12, cfg.grid | 0));
    cfg.pieces = Math.max(2, Math.min(36, cfg.pieces | 0));
    var rng = mulberry32(cfg.seed);
    var W = cfg.grid, H = cfg.grid, N = W * H;
    var family = familyOf(n);
    var baseLen = targetLenFor(n);

    // 1. Paint the board silhouette: dense fill so the carved maze of
    // winding paths covers most of the grid (reference look)
    var targetCells = Math.min(N, Math.max(24, Math.round(N * fillFracFor(n))));
    var inShape = buildShape(family, W, H, rng, targetCells);

    // 2. Carve the winding arrow paths (reverse placement order)
    var arrows = carve(W, H, inShape, rng, cfg.pieces, baseLen, makeColorFn(family, W, H));

    // Defense in depth: if a family ever yields an empty board, fall back
    // to the classic blob shape once (never triggers in practice).
    if (!arrows.length) {
      rng = mulberry32(cfg.seed ^ 0xBEEF);
      inShape = buildShape('blob', W, H, rng, Math.max(8, cfg.pieces * baseLen));
      arrows = carve(W, H, inShape, rng, cfg.pieces, baseLen, makeColorFn('blob', W, H));
    }

    // 3. Validate: disjoint cells + guaranteed full solution
    if (!validateBoardSolution(W, H, arrows)) {
      // Should be impossible with reverse placement; rebuild defensively.
      rng = mulberry32((cfg.seed ^ 0xBEEF) >>> 0);
      inShape = buildShape('blob', W, H, rng, Math.min(N, cfg.pieces * baseLen + 4));
      arrows = carve(W, H, inShape, rng, cfg.pieces, baseLen, makeColorFn('blob', W, H));
    }

    return {
      level: n,
      cols: W,
      rows: H,
      shape: inShape,
      arrows: arrows,
      difficulty: getDifficultyLevel(n),
      family: family,
      bonus: levelBonus(n, arrows)
    };
  }

  // Validate that a board has a valid solution: pieces must not overlap,
  // and removing them in DESCENDING placement (step) order must clear
  // every piece without ever being blocked.
  function validateBoardSolution(W, H, arrows) {
    if (!arrows || !arrows.length) return false;
    var N = W * H;
    var occ = new Int32Array(N).fill(-1);
    for (var i = 0; i < arrows.length; i++) {
      var cs = arrows[i].cells;
      if (!cs || !cs.length) return false;
      for (var k = 0; k < cs.length; k++) {
        var x = cs[k].x, y = cs[k].y;
        if (x < 0 || y < 0 || x >= W || y >= H) return false;
        var idx = y * W + x;
        if (occ[idx] !== -1) return false; // overlapping pieces = invalid
        occ[idx] = i;
      }
    }
    // Removal in descending step order: when piece k leaves, exactly the
    // pieces placed before it (lower steps) are still on the board, which
    // is the set its exit was verified against at placement time. A piece
    // never blocks ITSELF (its own cells travel with it), so its own
    // entries in occ are ignored while sweeping the exit corridor.
    var order = [];
    for (var j = 0; j < arrows.length; j++) order.push(j);
    order.sort(function (a, b) { return arrows[b].step - arrows[a].step; });
    for (var o = 0; o < order.length; o++) {
      var pi = order[o];
      var P = arrows[pi];
      var d = P.dir, dx = DIRS[d][0], dy = DIRS[d][1];
      var blocked = false;
      for (var c2 = 0; c2 < P.cells.length && !blocked; c2++) {
        var cx = P.cells[c2].x + dx, cy = P.cells[c2].y + dy;
        while (cx >= 0 && cx < W && cy >= 0 && cy < H) {
          if (occ[cy * W + cx] !== -1 && occ[cy * W + cx] !== pi) { blocked = true; break; }
          cx += dx; cy += dy;
        }
      }
      if (blocked) return false;
      for (var c3 = 0; c3 < P.cells.length; c3++) {
        occ[P.cells[c3].y * W + P.cells[c3].x] = -1;
      }
    }
    return true;
  }

  // Find a guaranteed removable piece (for hints): the highest-step alive
  // piece that can exit right now.
  function hintArrow(arrows, occ, W, H) {
    for (var i = arrows.length - 1; i >= 0; i--) {
      var P = arrows[i];
      if (!P || !P.alive) continue;
      if (pieceBlocker(occ, arrows, W, H, i) === -1) return i;
    }
    return -1;
  }

  // Timed bonus objective (Candy Crush-style): appears on occasional
  // levels. The special piece is the LAST placed one, which is always
  // removable immediately - achievable but the player must act fast.
  function levelBonus(n, arrows) {
    n = Math.floor(Number(n));
    if (!isFinite(n) || n < 1 || n % 10 !== 5 || !arrows || arrows.length < 3) return null;
    var coins = n <= 100 ? 25 : (n <= 500 ? 40 : 60);
    var seconds = n <= 50 ? 30 : (n <= 200 ? 40 : 50);
    var idx = 0, bestStep = -1;
    for (var i = 0; i < arrows.length; i++) {
      if (arrows[i].step > bestStep) { bestStep = arrows[i].step; idx = i; }
    }
    return { idx: idx, coins: coins, seconds: seconds };
  }

  // Generate daily challenge level
  function genDailyChallenge(date) {
    // Use date to create a deterministic seed
    var dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    var seed = parseInt(dateStr) || Date.now();
    var rng = mulberry32(seed);

    // Daily challenge: medium difficulty, 8x8 board, rotating family,
    // same dense maze look as the main levels
    var W = 8, H = 8, N = W * H;
    var family = FAMILIES[seed % FAMILIES.length];
    var piecesCount = 12 + (seed % 5);
    var baseLen = 6;
    var targetCells = Math.min(N, Math.max(36, Math.round(N * 0.75)));
    var inShape = buildShape(family, W, H, rng, targetCells);
    var arrows = carve(W, H, inShape, rng, piecesCount, baseLen, makeColorFn(family, W, H));

    if (!arrows.length) {
      rng = mulberry32(seed ^ 0xBEEF);
      inShape = buildShape('blob', W, H, rng, 40);
      arrows = carve(W, H, inShape, rng, piecesCount, baseLen, makeColorFn('blob', W, H));
    }

    return {
      level: 'daily',
      cols: W,
      rows: H,
      shape: inShape,
      arrows: arrows,
      difficulty: 'medium',
      family: family,
      bonus: null,
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
    levelConfig: levelConfig,
    getDifficultyLevel: getDifficultyLevel,
    getDifficultyName: getDifficultyName,
    genLevel: genLevel,
    genDailyChallenge: genDailyChallenge,
    validateBoardSolution: validateBoardSolution,
    hintArrow: hintArrow,
    pieceBlocker: pieceBlocker,
    levelBonus: levelBonus,
    calcStars: calcStars
  };
})();
