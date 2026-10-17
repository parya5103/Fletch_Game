'use strict';
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const { harness, occupancy, blocker } = require('./qa-harness');
const { GC, G } = harness();
const failures = [], tiers = {}, results = [];
let dailyPassed = 0;
function validate(level, seed) {
  const W = level.cols, H = level.rows;
  assert(Number.isInteger(W) && Number.isInteger(H) && W >= 4 && W <= 12 && W === H);
  assert(level.arrows.length >= 5 && level.arrows.length <= W * H / 2);
  const cells = new Set(), ids = new Set();
  for (const a of level.arrows) {
    assert(Number.isInteger(a.step) && a.step >= 0 && !ids.has(a.step)); ids.add(a.step);
    assert(Number.isInteger(a.dir) && a.dir >= 0 && a.dir < 4);
    assert(a.cells.length >= 2 && a.cells.length <= 16);
    a.cells.forEach((c, i) => {
      assert(Number.isInteger(c.x) && Number.isInteger(c.y) && c.x >= 0 && c.y >= 0 && c.x < W && c.y < H);
      const key = c.y * W + c.x;
      assert(!cells.has(key) && level.shape[key]); cells.add(key);
      if (i) assert.equal(Math.abs(c.x - a.cells[i - 1].x) + Math.abs(c.y - a.cells[i - 1].y), 1);
    });
    const h = a.cells.at(-1), p = a.cells.at(-2), [dx, dy] = GC.DIRS[a.dir];
    assert.equal(h.x - p.x, dx); assert.equal(h.y - p.y, dy);
  }
  assert(GC.validateBoardSolution(W, H, level.arrows));
  const count = level.arrows.length;
  for (let left = count; left > 0; left--) {
    const occ = occupancy(level), available = [];
    level.arrows.forEach((a, i) => {
      if (!a.alive) return;
      const expected = blocker(level, i);
      assert.equal(GC.pieceBlocker(occ, level.arrows, W, H, i), expected, `blocker for ${i}`);
      if (expected === -1) available.push(i);
    });
    assert(available.length, 'independent solver found a deadlock');
    assert(available.includes(GC.hintArrow(level.arrows, occ, W, H)), 'hint is not removable');
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    level.arrows[available[seed % available.length]].alive = false;
  }
  assert.equal(GC.hintArrow(level.arrows, occupancy(level), W, H), -1);
  return { count, coverage: cells.size / (W * H) };
}
const started = performance.now();
for (let n = 1; n <= GC.DESIGN_LEVELS; n++) {
  try {
    const start = performance.now(), level = GC.genLevel(n), generatedMs = performance.now() - start;
    assert.equal(level.level, n); assert.equal(level.cols, GC.levelConfig(n).grid);
    assert.equal(level.difficulty, n <= 50 ? 'easy' : n <= 200 ? 'medium' : n <= 500 ? 'hard' : n <= 800 ? 'expert' : 'master');
    const serialized = JSON.stringify(level);
    let metrics;
    // Three reproducible orders, with a fresh generation and determinism comparison each time.
    for (const seed of [1, 0x12345678, 0xdeadbeef]) {
      const replay = GC.genLevel(n); assert.equal(JSON.stringify(replay), serialized);
      metrics = validate(replay, seed ^ n);
    }
    G.loadLevel(n);
    assert.equal(JSON.stringify(G.getState().arrows), JSON.stringify(level.arrows));
    assert.deepEqual([...G.getState().occ], [...occupancy(level)]);
    const tier = tiers[level.difficulty] ||= { levels: 0, minArrows: Infinity, maxArrows: 0, minCoverage: 1 };
    tier.levels++; tier.minArrows = Math.min(tier.minArrows, metrics.count);
    tier.maxArrows = Math.max(tier.maxArrows, metrics.count); tier.minCoverage = Math.min(tier.minCoverage, metrics.coverage);
    results.push({ level: n, passed: true, arrows: metrics.count, grid: level.cols, generatedMs: +generatedMs.toFixed(2) });
  } catch (e) { failures.push({ level: n, error: e.message }); results.push({ level: n, passed: false, error: e.message }); }
}
for (let day = 0; day < 366; day++) {
  const date = new Date(Date.UTC(2026, 0, 1 + day));
  try {
    const level = GC.genDailyChallenge(date);
    assert.equal(JSON.stringify(level), JSON.stringify(GC.genDailyChallenge(date)));
    validate(level, day + 1); dailyPassed++;
  } catch (e) { failures.push({ daily: date.toISOString().slice(0, 10), error: e.message }); }
}
const summary = { campaignTested: GC.DESIGN_LEVELS, campaignPassed: results.filter(r => r.passed).length,
  repetitionsPerLevel: 3, dailyTested: 366, dailyPassed, failures, tiers,
  elapsedMs: Math.round(performance.now() - started), maxGenerationMs: Math.max(...results.map(r => r.generatedMs || 0)) };
console.log(JSON.stringify(summary, null, 2));
if (process.argv[2]) require('node:fs').writeFileSync(process.argv[2], JSON.stringify({ summary, results }, null, 2) + '\n');
process.exitCode = failures.length ? 1 : 0;
