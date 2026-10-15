#!/usr/bin/env node
/**
 * Arrow Out! - CI smoke tests (pure Node, zero dependencies)
 * Loads js/game.js in a vm sandbox and verifies the level generator
 * always produces valid, solvable boards with working hints.
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

function occFrom(W, H, arrows) {
  const occ = new Int32Array(W * H).fill(-1);
  for (let i = 0; i < arrows.length; i++) {
    if (arrows[i].alive) occ[arrows[i].y * W + arrows[i].x] = i;
  }
  return occ;
}

console.log('# genLevel sanity');
[1, 5, 10, 25, 50, 51, 60, 100, 200, 500, 1000].forEach(function (n) {
  const lv = GC.genLevel(n);
  const shapeOk = !!lv && !!lv.arrows && lv.arrows.length >= 1 &&
    lv.cols >= 4 && lv.cols <= 12 && lv.rows === lv.cols;
  const inBounds = shapeOk && lv.arrows.every(function (a) {
    return a.x >= 0 && a.x < lv.cols && a.y >= 0 && a.y < lv.rows &&
      a.dir >= 0 && a.dir <= 3 && a.alive === true;
  });
  const solvable = shapeOk && GC.validateBoardSolution(lv.cols, lv.rows, lv.arrows.slice());
  let hintOk = false;
  if (shapeOk) {
    const occ = occFrom(lv.cols, lv.rows, lv.arrows);
    const h = GC.hintArrow(lv.arrows, occ, lv.cols, lv.rows);
    hintOk = h >= 0 &&
      GC.rayBlocker(occ, lv.arrows, lv.cols, lv.rows,
        lv.arrows[h].x, lv.arrows[h].y, lv.arrows[h].dir) === -1;
  }
  check('level ' + n + ' board valid', shapeOk && inBounds,
    shapeOk ? JSON.stringify({ cols: lv.cols, arrows: lv.arrows.length }) : 'no board');
  check('level ' + n + ' solvable', solvable);
  check('level ' + n + ' hint points to a safe arrow', hintOk);
});

console.log('# genDailyChallenge determinism');
const d1 = GC.genDailyChallenge(new Date('2026-10-15T00:00:00.000Z'));
const d2 = GC.genDailyChallenge(new Date('2026-10-15T00:00:00.000Z'));
const sameArrows = d1.arrows.length === d2.arrows.length &&
  d1.arrows.every(function (a, i) {
    return a.x === d2.arrows[i].x && a.y === d2.arrows[i].y && a.dir === d2.arrows[i].dir;
  });
check('daily challenge is deterministic for a given date', sameArrows);
check('daily challenge is solvable',
  GC.validateBoardSolution(d1.cols, d1.rows, d1.arrows.slice()));

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
  if (!(c.grid >= 4 && c.grid <= 12 && c.arrows >= 1 && c.arrows <= 130 &&
        Number.isInteger(c.seed))) {
    boundsOk = false;
    detail = 'level ' + n + ' -> ' + JSON.stringify(c);
    break;
  }
}
check('grid 4-12 / arrows 1-130 / integer seed for all levels', boundsOk, detail);
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
    return a.x === r2.arrows[i].x && a.y === r2.arrows[i].y &&
      a.dir === r2.arrows[i].dir && a.c === r2.arrows[i].c &&
      a.step === r2.arrows[i].step;
  }));

console.log('# arrow directions');
let dirSet = new Set();
for (let n = 1; n <= 40; n++) GC.genLevel(n).arrows.forEach(function (a) { dirSet.add(a.dir); });
check('all four directions appear across early levels',
  [0, 1, 2, 3].every(function (d) { return dirSet.has(d); }),
  Array.from(dirSet).sort().join(','));

console.log('# full solvability (reverse-step removal)');
// Reverse placement guarantees that removing arrows in DESCENDING step
// order always clears the board: when arrow k is removed, exactly the
// arrows placed before it (steps 0..k-1) are still on the board, and
// arrow k's exit ray was verified clear against those at placement time.
let solveFail = '';
[1, 5, 10, 25, 50, 51, 60, 100, 200, 500, 1000].forEach(function (n) {
  const lv = GC.genLevel(n);
  const W = lv.cols, H = lv.rows;
  const occ = occFrom(W, H, lv.arrows);
  const order = lv.arrows.slice().sort(function (a, b) { return b.step - a.step; });
  order.forEach(function (a) {
    const bi = GC.rayBlocker(occ, lv.arrows, W, H, a.x, a.y, a.dir);
    if (bi !== -1 && !solveFail) solveFail = 'level ' + n + ' arrow step ' + a.step + ' blocked by step ' + lv.arrows[bi].step;
    a.alive = false;
    occ[a.y * W + a.x] = -1;
  });
});
check('every level fully clears by removing arrows in reverse placement order',
  !solveFail, solveFail);

if (failures) {
  console.error('\n' + failures + ' check(s) FAILED');
  process.exit(1);
}
console.log('\nAll CI checks passed');
