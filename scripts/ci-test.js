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

if (failures) {
  console.error('\n' + failures + ' check(s) FAILED');
  process.exit(1);
}
console.log('\nAll CI checks passed');
