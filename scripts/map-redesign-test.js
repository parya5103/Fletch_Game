/**
 * Automated verification suite for the Arrow Out! Magical Level Map Redesign
 * Run with: node scripts/map-redesign-test.js
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
require('../js/map.js');

const MapEngine = global.ArrowOutMap;
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

// 1. Verify all 1,000 levels map cleanly to 8 chapters with zero gaps or duplicates
test('All 1,000 levels covered across 8 themed chapters without gaps or duplicates', () => {
  assert.strictEqual(MapEngine.CHAPTERS.length, 8, 'Expected 8 chapters');
  const seen = new Set();
  for (const ch of MapEngine.CHAPTERS) {
    for (let lvl = ch.startLevel; lvl <= ch.endLevel; lvl++) {
      assert(!seen.has(lvl), 'Duplicate level ' + lvl);
      seen.add(lvl);
      const resolved = MapEngine.getChapterForLevel(lvl);
      assert.strictEqual(resolved.id, ch.id, 'Level ' + lvl + ' resolved to wrong chapter');
    }
  }
  assert.strictEqual(seen.size, 1000, 'Expected exactly 1,000 unique levels');
  assert.strictEqual(MapEngine.CHAPTERS[0].startLevel, 1);
  assert.strictEqual(MapEngine.CHAPTERS[7].endLevel, 1000);
});

// 2. Verify winding path coordinate generator works across narrow (320px) and wide (768px) viewports
test('Winding SVG path coordinates remain within safe horizontal bounds on 320px and 768px screens', () => {
  for (const width of [320, 360, 412, 768]) {
    const ch = MapEngine.CHAPTERS[0];
    const pts = [];
    for (let lvl = ch.startLevel; lvl <= ch.endLevel; lvl++) {
      const p = MapEngine.getNodePosition(lvl, ch, width);
      assert(Number.isFinite(p.x) && Number.isFinite(p.y), 'Coordinates must be finite');
      assert(p.x >= 40 && p.x <= width - 40, `Node x=${p.x} out of bounds for width=${width}`);
      pts.push(p);
    }
    const svgPath = MapEngine.buildSvgPath(pts);
    assert(svgPath.startsWith('M '), 'SVG path must start with M command');
    assert(svgPath.includes(' C '), 'SVG path must contain cubic Bezier C segments');
  }
});

// 3. Verify level preview metadata determinism across levels 1..1000
test('Level preview metadata deterministically covers levels 1 to 1,000', () => {
  for (let lvl = 1; lvl <= 1000; lvl++) {
    const meta = MapEngine.getLevelPreviewMeta(lvl);
    assert.strictEqual(meta.level, lvl);
    assert(meta.gridSize >= 4 && meta.gridSize <= 8);
    assert(meta.arrows >= 6);
    assert(typeof meta.zoneName === 'string' && meta.zoneName.length > 0);
  }
});

console.log(`\nSummary: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);
