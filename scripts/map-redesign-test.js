/**
 * Automated verification suite for the integrated Magical World Map.
 * Run with: node scripts/map-redesign-test.js
 * Tests the pure map engine (chapters, geometry, node states) plus the
 * DOM integration flow against a lightweight DOM mock.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
require('../js/map.js');

const MapEngine = global.ArrowOutMap;
const MAP_SOURCE = fs.readFileSync(path.join(__dirname, '..', 'js', 'map.js'), 'utf8');
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log('[PASS] ' + name);
    passed++;
  } catch (err) {
    console.error('[FAIL] ' + name + ' -> ' + err.message);
    failed++;
  }
}

// 1. All 1,000 levels covered across 8 themed chapters without gaps or duplicates
test('All 1,000 levels covered across 8 themed chapters without gaps or duplicates', () => {
  assert.strictEqual(MapEngine.CHAPTERS.length, 8, 'Expected 8 chapters');
  const seen = new Set();
  for (const ch of MapEngine.CHAPTERS) {
    assert.strictEqual(ch.endLevel - ch.startLevel + 1, MapEngine.LEVELS_PER_CHAPTER);
    for (let lvl = ch.startLevel; lvl <= ch.endLevel; lvl++) {
      assert(!seen.has(lvl), 'Duplicate level ' + lvl);
      seen.add(lvl);
      assert.strictEqual(MapEngine.chapterForLevel(lvl).id, ch.id, 'Level ' + lvl + ' resolved to wrong chapter');
    }
  }
  assert.strictEqual(seen.size, 1000, 'Expected exactly 1,000 unique levels');
  assert.strictEqual(MapEngine.CHAPTERS[0].startLevel, 1);
  assert.strictEqual(MapEngine.CHAPTERS[7].endLevel, 1000);
});

// 2. Winding path coordinates remain within safe horizontal bounds on narrow and wide screens
test('Winding SVG path coordinates remain within safe horizontal bounds on 320px-768px screens', () => {
  for (const width of [320, 360, 412, 768]) {
    const ch = MapEngine.CHAPTERS[0];
    const pts = [];
    for (let i = 0; i < MapEngine.LEVELS_PER_CHAPTER; i++) {
      const p = MapEngine.nodePos(i, ch, width);
      assert(Number.isFinite(p.x) && Number.isFinite(p.y), 'Coordinates must be finite');
      assert(p.x >= 40 && p.x <= width - 40, `Node x=${p.x} out of bounds for width=${width}`);
      assert.strictEqual(p.y, MapEngine.TOP_PAD + i * MapEngine.NODE_SPACING);
      pts.push(p);
    }
    const svgPath = MapEngine.buildSvgPath(pts);
    assert(svgPath.startsWith('M '), 'SVG path must start with M command');
    assert(svgPath.includes(' C '), 'SVG path must contain cubic Bezier C segments');
    assert.strictEqual(MapEngine.buildSvgPath([]), '', 'Empty points must produce empty path');
  }
  assert(MapEngine.canvasHeight() >= MapEngine.TOP_PAD + 124 * MapEngine.NODE_SPACING);
});

// 3. Node states derive strictly from the real save format (arrowOut.v2)
test('Node states derive strictly from real save progression', () => {
  const save = { unlocked: 14, best: { 1: { stars: 3 }, 5: { stars: 1 } } };
  assert.strictEqual(MapEngine.nodeStateFor(15, save, 14), 'locked');
  assert.strictEqual(MapEngine.nodeStateFor(999, save, 14), 'locked');
  assert.strictEqual(MapEngine.nodeStateFor(14, save, 14), 'current');
  assert.strictEqual(MapEngine.nodeStateFor(1, save, 14), 'completed');
  assert.strictEqual(MapEngine.nodeStateFor(5, save, 14), 'completed');
  assert.strictEqual(MapEngine.nodeStateFor(7, save, 14), 'open');
  // A cleared focus level stays 'completed', never mis-shown as current
  assert.strictEqual(MapEngine.nodeStateFor(1, save, 1), 'completed');
  // Degenerate / hostile saves degrade safely (unlocked defaults to 1 -> locked)
  assert.strictEqual(MapEngine.nodeStateFor(3, {}, 1), 'locked');
  assert.strictEqual(MapEngine.nodeStateFor(3, { unlocked: 'junk' }, 'x'), 'locked');
  // Out-of-range levels clamp to 1000 (safe: never throws, never unlocks anything new)
  assert.strictEqual(MapEngine.nodeStateFor(2000, { unlocked: 1000 }, 1000), 'current');
});

// 4. Every level resolves to a named chapter zone
test('Level preview metadata deterministically covers levels 1 to 1,000', () => {
  for (let lvl = 1; lvl <= 1000; lvl++) {
    const zone = MapEngine.zoneNameFor(lvl);
    assert.strictEqual(typeof zone, 'string');
    assert(zone.length > 0, 'Level ' + lvl + ' has no zone name');
  }
  assert.strictEqual(MapEngine.zoneNameFor(1), MapEngine.CHAPTERS[0].landmarks[0]);
  assert.strictEqual(MapEngine.zoneNameFor(1000), MapEngine.CHAPTERS[7].landmarks[4]);
});

/* ===== 5. DOM integration flow against a lightweight DOM mock ===== */
function makeMockDom() {
  const elements = {};
  function makeEl(id) {
    const el = {
      id: id || '',
      children: [],
      style: {},
      attrs: {},
      textContent: '',
      hidden: false,
      disabled: false,
      value: '',
      scrollTop: 0,
      clientHeight: 480,
      clientWidth: 360,
      handlers: {},
      setAttribute(k, v) { this.attrs[k] = String(v); },
      appendChild(c) { this.children.push(c); return c; },
      addEventListener(ev, fn) { (this.handlers[ev] = this.handlers[ev] || []).push(fn); },
      classList: {
        _set: new Set(),
        add(c) { this._set.add(c); },
        remove(c) { this._set.delete(c); },
        contains(c) { return this._set.has(c); }
      },
      fire(ev) { (this.handlers[ev] || []).forEach(fn => fn({ key: '', target: this })); }
    };
    Object.defineProperty(el, 'firstChild', { get() { return this.children[0] || null; } });
    return el;
  }
  const ids = [
    'map-prev', 'map-next', 'map-jump', 'map-jump-go', 'map-viewport', 'map-canvas',
    'map-nodes', 'map-landmarks', 'map-preview', 'map-preview-close', 'map-preview-play',
    'map-preview-title', 'map-preview-chapter', 'map-preview-zone', 'map-preview-stars',
    'map-preview-info', 'map-chapter-num', 'map-chapter-name', 'map-chapter-sub',
    'map-progress-fill', 'map-progress-text', 'map-grid', 'map-path-outer',
    'map-path-inner', 'map-path-done', 'dlg-map'
  ];
  for (const id of ids) elements[id] = makeEl(id);
  elements['dlg-map'].classList.add('show');

  const calls = { loadLevel: [], closeAll: 0, openDlg: [], toast: [] };
  const documentMock = {
    getElementById(id) { return elements[id] || null; },
    createElement(tag) { return makeEl(''); },
    createElementNS(ns, tag) { return makeEl(''); }
  };
  const sandbox = {
    document: documentMock,
    Storage: { getSave: () => sandbox.save },
    UI: {
      closeAll: () => { calls.closeAll++; },
      openDlg: (id) => { calls.openDlg.push(id); },
      buildLevelGrid: () => {},
      toast: (m) => { calls.toast.push(m); }
    },
    Game: { loadLevel: (n) => { calls.loadLevel.push(n); } },
    Audio: { ui: () => {} },
    GameCore: { getDifficultyName: () => 'Easy' },
    window: { addEventListener: () => {} },
    setTimeout: (fn) => 0,
    clearTimeout: () => {},
    save: { unlocked: 14, cur: null, best: { 1: { stars: 3 }, 5: { stars: 2 } } },
    calls, elements
  };
  return sandbox;
}

test('Map opens on the current chapter, virtualizes nodes, and launches levels through the original game', () => {
  const sb = makeMockDom();
  const run = new Function('window', 'document', 'Storage', 'UI', 'Game', 'Audio', 'GameCore',
    'setTimeout', 'clearTimeout',
    MAP_SOURCE + '\nreturn ArrowOutMap;')(sb.window, sb.document, sb.Storage, sb.UI, sb.Game, sb.Audio, sb.GameCore, sb.setTimeout, sb.clearTimeout);
  assert.strictEqual(typeof run.open, 'function');

  run.open();
  assert(sb.calls.openDlg.includes('dlg-map'), 'Map dialog must open');
  assert.strictEqual(sb.elements['map-chapter-name'].textContent, 'Enchanted Meadow');
  assert.strictEqual(sb.elements['map-progress-text'].textContent, '2 / 125 cleared');
  assert(sb.elements['map-path-outer'].attrs.d.startsWith('M '), 'Road path must be drawn');
  // Virtualization: only the scroll window (+buffer) is mounted, never 125 nodes
  assert.ok(sb.elements['map-nodes'].children.length > 0 && sb.elements['map-nodes'].children.length < 60,
    'Mounted node count should be windowed, got ' + sb.elements['map-nodes'].children.length);

  const nodes = sb.elements['map-nodes'].children;
  const byLevel = {};
  for (const n of nodes) byLevel[n.children[0].textContent] = n;
  assert.strictEqual(byLevel['1'].className.includes('node-completed'), true, 'Level 1 must be completed');
  assert.strictEqual(byLevel['14'].className.includes('node-current'), true, 'Level 14 must be current');
  assert.strictEqual(byLevel['15'].className.includes('node-locked'), true, 'Level 15 must be locked');

  // Locked tap: no launch, toast guidance, locked preview
  byLevel['15'].fire('click');
  assert.strictEqual(sb.calls.loadLevel.length, 0, 'Locked level must not launch');
  assert.ok(sb.calls.toast.length > 0);
  assert.strictEqual(sb.elements['map-preview-play'].disabled, true);
  assert.strictEqual(sb.elements['map-preview'].hidden, false);

  // Open level: first tap selects + previews, second tap launches via Game.loadLevel
  byLevel['7'].fire('click');
  assert.strictEqual(sb.elements['map-preview-title'].textContent, 'Level 7');
  assert.strictEqual(sb.elements['map-preview'].hidden, false);
  assert.strictEqual(sb.calls.loadLevel.length, 0);
  byLevel['7'].fire('click');
  assert.deepStrictEqual(sb.calls.loadLevel, [7], 'Selected level must launch through Game.loadLevel');
  assert.ok(sb.calls.closeAll >= 1, 'Dialogs must close before launching');

  // Play button also launches the selected level
  sb.elements['map-preview-play'].fire('click'); // selected reset to 0 after launch -> no-op
  assert.strictEqual(sb.calls.loadLevel.length, 1);
  byLevel['9'].fire('click');
  sb.elements['map-preview-play'].fire('click');
  assert.deepStrictEqual(sb.calls.loadLevel, [7, 9], 'Play button must launch selected level');

  // Progress reflects real save: complete level 14, reopen -> 3 cleared, current moves on
  sb.save.best[14] = { stars: 1 };
  sb.save.unlocked = 15;
  run.open();
  assert.strictEqual(sb.elements['map-progress-text'].textContent, '3 / 125 cleared');
  const nodes2 = sb.elements['map-nodes'].children;
  const byLevel2 = {};
  for (const n of nodes2) byLevel2[n.children[0].textContent] = n;
  assert.strictEqual(byLevel2['14'].className.includes('node-completed'), true);
  assert.strictEqual(byLevel2['15'].className.includes('node-current'), true);

  // Chapter navigation bounded 1..8 and jump to any level
  sb.elements['map-jump'].value = '382';
  sb.elements['map-jump-go'].fire('click');
  assert.strictEqual(sb.elements['map-chapter-name'].textContent, 'Moonlit Ruins');
  assert.strictEqual(sb.elements['map-preview-zone'].textContent, 'Collapsed Aqueduct');
  assert.strictEqual(sb.elements['map-prev'].disabled, false);
  assert.strictEqual(sb.elements['map-next'].disabled, false);
  sb.elements['map-jump'].value = '1000';
  sb.elements['map-jump-go'].fire('click');
  assert.strictEqual(sb.elements['map-chapter-name'].textContent, 'Eternal Eclipse');
  assert.strictEqual(sb.elements['map-next'].disabled, true);
  sb.elements['map-jump'].value = '1';
  sb.elements['map-jump-go'].fire('click');
  assert.strictEqual(sb.elements['map-prev'].disabled, true);

  // Grid-view cross link keeps the classic level grid reachable
  sb.elements['map-grid'].fire('click');
  assert.ok(sb.calls.closeAll >= 2);
});

console.log(`\nSummary: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
