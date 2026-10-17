'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
function source(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }
function harness(initial = {}, options = {}) {
  const data = { ...initial }, timers = new Map(), events = {}, dialogs = [], elements = {};
  let seq = 0;
  const store = {
    getItem(k) { if (options.unavailable) throw Error('storage unavailable'); return data[k] || null; },
    setItem(k, v) { if (options.unavailable || options.quota) throw Error('quota'); data[k] = String(v); },
    removeItem(k) { delete data[k]; }
  };
  const noop = () => {};
  const ui = new Proxy({ anyOpen: () => false, showWinDialog: () => dialogs.push('win'), showFailDialog: () => dialogs.push('fail') },
    { get: (obj, key) => obj[key] || noop });
  const render = new Proxy({ spawnFly: () => false, getCellSize: () => 10 }, { get: (obj, key) => obj[key] || noop });
  const document = { hidden: false, body: { classList: { contains: () => false } },
    getElementById: id => elements[id] || null, addEventListener: (name, cb) => { events[name] = cb; } };
  const box = vm.createContext({ Math, Date, Number, Set, console: { log: noop, warn: noop, error: noop },
    localStorage: store, document, window: { matchMedia: () => ({ matches: true }), addEventListener: noop },
    location: { search: '' }, navigator: {}, performance: { now: () => 1000 },
    setTimeout: (fn, ms) => { timers.set(++seq, { fn, ms }); return seq; },
    clearTimeout: id => timers.delete(id), setInterval: (fn, ms) => { timers.set(++seq, { fn, ms }); return seq; },
    clearInterval: id => timers.delete(id), UI: ui, Render: render, Audio: new Proxy({}, { get: () => noop }),
    Haptics: new Proxy({}, { get: () => noop }), PWA: new Proxy({}, { get: () => noop }), Bgfx: { init: noop }
  });
  vm.runInContext(source('js/game.js') + '\nglobalThis.GC = GameCore;', box);
  vm.runInContext(source('js/storage.js') + '\nglobalThis.ST = Storage;', box);
  // Expose closure entry points only inside this test sandbox.
  const main = source('js/main.js').replace('    init: init,', '    test: {tryRestore, saveCur, scheduleWin, setupEventListeners, handlePointerDown, adForHint},\n    init: init,');
  vm.runInContext(main + '\nglobalThis.G = Game;', box);
  return { box, GC: box.GC, ST: box.ST, G: box.G, data, ui, render, elements, events, timers, dialogs,
    flush(ms) { for (const [id, task] of [...timers]) if (task.ms === ms) { timers.delete(id); task.fn(); } } };
}
function occupancy(level) {
  const occ = new Int32Array(level.cols * level.rows).fill(-1);
  level.arrows.forEach((a, i) => a.cells.forEach(c => { if (a.alive) occ[c.y * level.cols + c.x] = i; }));
  return occ;
}
// Independent rules oracle: look at the live pieces' cells directly,
// without production occupancy, step ordering, blocker or hint code.
function blocker(level, i) {
  const a = level.arrows[i], h = a.cells.at(-1);
  let nearest = -1, distance = Infinity;
  level.arrows.forEach((b, j) => {
    if (i === j || !b.alive) return;
    for (const c of b.cells) {
      const d = a.dir === 0 && c.x === h.x ? h.y - c.y :
        a.dir === 1 && c.y === h.y ? c.x - h.x :
        a.dir === 2 && c.x === h.x ? c.y - h.y :
        a.dir === 3 && c.y === h.y ? h.x - c.x : -1;
      if (d > 0 && d < distance) { nearest = j; distance = d; }
    }
  });
  return nearest;
}
module.exports = { harness, occupancy, blocker, source, root };
