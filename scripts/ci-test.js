#!/usr/bin/env node
/**
 * Arrow Out! - CI smoke tests (pure Node, zero dependencies)
 * Loads js/game.js in a vm sandbox and verifies the level generator
 * always produces valid, solvable winding-path boards with working
 * hints, deterministic layouts and a sound timed-bonus spec.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'game.js'), 'utf8');
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(src + '\n;globalThis.__GC = GameCore;', sandbox, { filename: 'js/game.js' });
const GC = sandbox.__GC;

if (!GC || typeof GC.genLevel !== 'function') {
  console.error('FAIL - GameCore did not load');
  process.exit(1);
}

let failures = 0;
function check(name, cond, detail) {
  if (cond) {
    console.log('  ok - ' + name);
  } else {
    failures++;
    console.error('  FAIL - ' + name + (detail ? ' :: ' + detail : ''));
  }
}

// Occupancy map from winding pieces (cell -> piece index), as gameplay uses.
function occFrom(W, H, arrows) {
  const occ = new Int32Array(W * H).fill(-1);
  for (let i = 0; i < arrows.length; i++) {
    if (!arrows[i].alive) continue;
    for (const c of arrows[i].cells) occ[c.y * W + c.x] = i;
  }
  return occ;
}

// A valid winding piece: >=2 cells, contiguous orthogonal path, in bounds.
function pieceValid(a, W, H) {
  if (!a || !Array.isArray(a.cells) || a.cells.length < 2) return false;
  if (!(a.dir >= 0 && a.dir <= 3) || a.alive !== true) return false;
  for (let k = 0; k < a.cells.length; k++) {
    const c = a.cells[k];
    if (typeof c.x !== 'number' || typeof c.y !== 'number' ||
        c.x < 0 || c.x >= W || c.y < 0 || c.y >= H) return false;
    if (k > 0) {
      const p = a.cells[k - 1];
      if (Math.abs(c.x - p.x) + Math.abs(c.y - p.y) !== 1) return false;
    }
  }
  return true;
}

// Number of 90-degree turns in a piece's path.
function bends(a) {
  let b = 0;
  for (let k = 2; k < a.cells.length; k++) {
    const c0 = a.cells[k - 2], c1 = a.cells[k - 1], c2 = a.cells[k];
    if (c1.x - c0.x !== c2.x - c1.x || c1.y - c0.y !== c2.y - c1.y) b++;
  }
  return b;
}

console.log('# genLevel sanity');
[1, 2, 5, 7, 10, 15, 20, 25, 50, 51, 60, 100, 200, 500, 1000].forEach(function (n) {
  const lv = GC.genLevel(n);
  const shapeOk = !!lv && !!lv.arrows && lv.arrows.length >= 3 &&
    lv.cols >= 4 && lv.cols <= 12 && lv.rows === lv.cols;
  let detail = shapeOk ? JSON.stringify({ cols: lv.cols, pieces: lv.arrows.length }) : 'no board';
  const piecesOk = shapeOk && lv.arrows.every(function (a) { return pieceValid(a, lv.cols, lv.rows); });
  // unique steps + no cell shared by two pieces
  let noOverlap = shapeOk;
  if (shapeOk) {
    const seen = new Int32Array(lv.cols * lv.rows).fill(-1);
    const steps = new Set();
    for (let i = 0; i < lv.arrows.length; i++) {
      if (steps.has(lv.arrows[i].step)) noOverlap = false;
      steps.add(lv.arrows[i].step);
      for (const c of lv.arrows[i].cells) {
        if (seen[c.y * lv.cols + c.x] !== -1) noOverlap = false;
        seen[c.y * lv.cols + c.x] = i;
      }
    }
  }
  const solvable = shapeOk && GC.validateBoardSolution(lv.cols, lv.rows, lv.arrows.slice());
  let hintOk = false;
  if (shapeOk) {
    const occ = occFrom(lv.cols, lv.rows, lv.arrows);
    const h = GC.hintArrow(lv.arrows, occ, lv.cols, lv.rows);
    hintOk = h >= 0 && GC.pieceBlocker(occ, lv.arrows, lv.cols, lv.rows, h) === -1;
  }
  check('level ' + n + ' board valid', shapeOk && piecesOk && noOverlap, detail);
  check('level ' + n + ' solvable', solvable);
  check('level ' + n + ' hint points to a safe piece', hintOk);
});

console.log('# genDailyChallenge determinism');
const d1 = GC.genDailyChallenge(new Date('2026-10-15T00:00:00.000Z'));
const d2 = GC.genDailyChallenge(new Date('2026-10-15T00:00:00.000Z'));
const sameArrows = d1.arrows.length === d2.arrows.length &&
  d1.arrows.every(function (a, i) {
    return a.dir === d2.arrows[i].dir && a.c === d2.arrows[i].c &&
      JSON.stringify(a.cells) === JSON.stringify(d2.arrows[i].cells);
  });
check('daily challenge is deterministic for a given date', sameArrows);
check('daily challenge is solvable',
  GC.validateBoardSolution(d1.cols, d1.rows, d1.arrows.slice()));
check('daily challenge has no bonus objective', d1.bonus === null);

console.log('# calcStars');
check('3 stars (0 wrong, 0 hints)', GC.calcStars(0, 0) === 3);
check('2 stars (<=2 wrong, <=1 hint)',
  GC.calcStars(1, 0) === 2 && GC.calcStars(2, 1) === 2 && GC.calcStars(0, 1) === 2);
check('1 star otherwise',
  GC.calcStars(0, 2) === 1 && GC.calcStars(3, 0) === 1 && GC.calcStars(9, 9) === 1);

console.log('# levelConfig bounds');
let boundsOk = true;
let detail = '';
for (let n = 1; n <= 1000; n += 7) {
  const c = GC.levelConfig(n);
  if (!(c.grid >= 4 && c.grid <= 12 && c.pieces >= 2 && c.pieces <= 36 &&
        Number.isInteger(c.seed))) {
    boundsOk = false;
    detail = 'level ' + n + ' -> ' + JSON.stringify(c);
    break;
  }
}
check('grid 4-12 / pieces 2-36 / integer seed for all levels', boundsOk, detail);
check('DESIGN_LEVELS is 1000', GC.DESIGN_LEVELS === 1000);

console.log('# difficulty tiers');
check('levels 1-50 map to Easy',
  GC.getDifficultyName(1) === 'Easy' && GC.getDifficultyName(50) === 'Easy');
check('levels 51-200 map to Medium',
  GC.getDifficultyName(51) === 'Medium' && GC.getDifficultyName(200) === 'Medium');
check('levels 201-500 map to Hard',
  GC.getDifficultyName(201) === 'Hard' && GC.getDifficultyName(500) === 'Hard');
check('levels 501-800 map to Expert',
  GC.getDifficultyName(501) === 'Expert' && GC.getDifficultyName(800) === 'Expert');
check('levels 801-1000 map to Master',
  GC.getDifficultyName(801) === 'Master' && GC.getDifficultyName(1000) === 'Master');
check('getDifficultyLevel returns valid tier keys', [1, 60, 300, 600, 900].every(function (n) {
  return ['easy', 'medium', 'hard', 'expert', 'master'].indexOf(GC.getDifficultyLevel(n)) !== -1;
}));

console.log('# layout families');
check('FAMILIES exposes 8 unique layout families',
  Array.isArray(GC.FAMILIES) && GC.FAMILIES.length === 8 &&
  Array.from(new Set(GC.FAMILIES)).length === 8,
  JSON.stringify(GC.FAMILIES));
check('familyOf rotates families by level number',
  typeof GC.familyOf === 'function' &&
  GC.familyOf(1) === 'clusters' && GC.familyOf(2) === 'maze' &&
  GC.familyOf(3) === 'spiral' && GC.familyOf(8) === 'blob');
check('milestone levels use the ring family',
  GC.familyOf(50) === 'ring' && GC.familyOf(100) === 'ring' &&
  GC.genLevel(50).family === 'ring');
let famSet = new Set();
for (let n = 11; n <= 50; n++) famSet.add(GC.genLevel(n).family);
check('all 8 layout families appear across levels 11-50',
  GC.FAMILIES.every(function (f) { return famSet.has(f); }),
  Array.from(famSet).sort().join(','));

console.log('# level determinism');
const r1 = GC.genLevel(37);
const r2 = GC.genLevel(37);
check('level 37 reproduces the identical board on replay',
  r1.cols === r2.cols && r1.family === r2.family &&
  r1.arrows.length === r2.arrows.length &&
  r1.arrows.every(function (a, i) {
    return a.dir === r2.arrows[i].dir && a.c === r2.arrows[i].c &&
      a.step === r2.arrows[i].step &&
      JSON.stringify(a.cells) === JSON.stringify(r2.arrows[i].cells);
  }));

console.log('# winding path quality (levels 1-20)');
// The winding design must be visible from level 1: no single-cell pieces,
// every early level carries at least one piece with a 90-degree bend,
// and a healthy number of paths to clear.
let windingFail = '';
for (let n = 1; n <= 20; n++) {
  const lv = GC.genLevel(n);
  const minLen = Math.min.apply(null, lv.arrows.map(function (a) { return a.cells.length; }));
  const bendPieces = lv.arrows.filter(function (a) { return bends(a) > 0; }).length;
  if (minLen < 2) { windingFail = 'level ' + n + ' has a single-cell piece'; break; }
  if (bendPieces < 1) { windingFail = 'level ' + n + ' has no winding (bent) piece'; break; }
  if (lv.arrows.length < 3) { windingFail = 'level ' + n + ' has only ' + lv.arrows.length + ' pieces'; break; }
}
check('every level 1-20 uses multi-cell winding paths with bends', !windingFail, windingFail);

console.log('# arrow directions');
let dirSet = new Set();
for (let n = 1; n <= 20; n++) GC.genLevel(n).arrows.forEach(function (a) { dirSet.add(a.dir); });
check('all four directions appear across early levels',
  [0, 1, 2, 3].every(function (d) { return dirSet.has(d); }),
  Array.from(dirSet).sort().join(','));

console.log('# timed bonus objective');
// Bonus levels are every n % 10 === 5. The bonus piece is the LAST placed
// (highest step), which can always exit immediately, so the objective is
// achievable within the countdown. Non-bonus levels carry no bonus.
[5, 15, 25].forEach(function (n) {
  const lv = GC.genLevel(n);
  const b = lv.bonus;
  const ok = !!b && Number.isInteger(b.idx) && b.idx >= 0 && b.idx < lv.arrows.length &&
    b.coins >= 25 && b.coins <= 60 && b.seconds >= 30 && b.seconds <= 50;
  check('level ' + n + ' carries a valid bonus spec', ok, JSON.stringify(b || null));
  if (ok) {
    const maxStep = Math.max.apply(null, lv.arrows.map(function (a) { return a.step; }));
    const occ = occFrom(lv.cols, lv.rows, lv.arrows);
    check('level ' + n + ' bonus piece is the last placed and exits immediately',
      lv.arrows[b.idx].step === maxStep &&
      GC.pieceBlocker(occ, lv.arrows, lv.cols, lv.rows, b.idx) === -1);
  }
});
check('level 7 carries no bonus objective', GC.genLevel(7).bonus === null);
check('daily challenge carries no bonus objective', GC.genDailyChallenge(new Date('2026-10-15T00:00:00.000Z')).bonus === null);

console.log('# full solvability (reverse-step removal)');
// Reverse placement guarantees that removing pieces in DESCENDING step
// order always clears the board: when piece k is removed, exactly the
// pieces placed before it (steps 0..k-1) are still on the board, and
// piece k's exit corridor was verified clear against those at placement
// time. Swept over every level 1-120 plus late samples.
let solveFail = '';
const sweepList = [];
for (let n = 1; n <= 120; n++) sweepList.push(n);
[200, 500, 501, 777, 999, 1000].forEach(function (n) { sweepList.push(n); });
sweepList.forEach(function (n) {
  const lv = GC.genLevel(n);
  if (!GC.validateBoardSolution(lv.cols, lv.rows, lv.arrows.slice())) {
    if (!solveFail) solveFail = 'validator rejected level ' + n;
  }
  const W = lv.cols, H = lv.rows;
  const occ = occFrom(W, H, lv.arrows);
  const order = lv.arrows.map(function (a, i) { return i; })
    .sort(function (x, y) { return lv.arrows[y].step - lv.arrows[x].step; });
  order.forEach(function (pi) {
    const bi = GC.pieceBlocker(occ, lv.arrows, W, H, pi);
    if (bi !== -1 && !solveFail) {
      solveFail = 'level ' + n + ' piece step ' + lv.arrows[pi].step + ' blocked by step ' + lv.arrows[bi].step;
    }
    lv.arrows[pi].alive = false;
    for (const c of lv.arrows[pi].cells) occ[c.y * W + c.x] = -1;
  });
});
check('every level fully clears by removing pieces in reverse placement order',
  !solveFail, solveFail);

if (failures) {
  console.error('\n' + failures + ' check(s) FAILED');
  process.exit(1);
}
console.log('\nAll CI checks passed');
