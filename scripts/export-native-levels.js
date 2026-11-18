#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'js/game.js'), 'utf8') + '\n;globalThis.__ArrowOutGameCore = GameCore;';
const context = vm.createContext({});
vm.runInContext(source, context, { filename: 'js/game.js', timeout: 15000 });
const core = context.__ArrowOutGameCore;
if (!core || typeof core.genLevel !== 'function' || core.DESIGN_LEVELS !== 1000) throw new Error('Arrow Out campaign generator API not found');
const outDir = path.join(root, 'native/cocos/Resources/levels');
fs.mkdirSync(outDir, { recursive: true });
for (let levelNo = 1; levelNo <= core.DESIGN_LEVELS; levelNo++) {
  const level = core.genLevel(levelNo);
  if (!core.validateBoardSolution(level.cols, level.rows, level.arrows)) throw new Error('Unsolvable campaign level ' + levelNo);
  const payload = {
    level: level.level, cols: level.cols, rows: level.rows,
    shape: Array.from(level.shape || []),
    arrows: level.arrows.map(a => ({ step: a.step, dir: a.dir, c: a.c, alive: true, cells: a.cells.map(c => ({ x: c.x, y: c.y })) }))
  };
  if (!Number.isInteger(payload.cols) || payload.cols < 4 || !Array.isArray(payload.arrows) || payload.arrows.length < 5) {
    throw new Error('Invalid generated campaign level ' + levelNo);
  }
  fs.writeFileSync(path.join(outDir, 'level-' + levelNo + '.json'), JSON.stringify(payload));
}
console.log('Exported ' + core.DESIGN_LEVELS + ' deterministic campaign levels to native/cocos/Resources/levels');
