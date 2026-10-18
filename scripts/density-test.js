'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const vm = require('node:vm');
const { harness, occupancy, source } = require('./qa-harness');

test('count targets rise monotonically and dense tiers contain interlocking paths', () => {
  const { GC } = harness();
  let previous = 20;
  for (let n = 1; n <= 1000; n++) {
    const cfg = GC.levelConfig(n);
    assert(cfg.pieces >= previous && cfg.pieces <= previous + 2, `count discontinuity ${n}`);
    previous = cfg.pieces;
  }
  for (const [n, count] of [[1,20],[10,28],[50,50],[100,77],[200,130],[300,187],
    [500,300],[700,433],[800,500],[900,550],[1000,600]]) {
    const l = GC.genLevel(n), occ = occupancy(l);
    assert.equal(l.arrows.length, count);
    const blocked = l.arrows.filter((a,i) => GC.pieceBlocker(occ,l.arrows,l.cols,l.rows,i) >= 0).length;
    assert(blocked >= count * (n > 200 ? .7 : .5), `too many immediately free paths at ${n}`);
    const turns = l.arrows.filter(a => a.cells.some((c,i,cs) => i > 1 &&
      c.x-cs[i-1].x !== cs[i-1].x-cs[i-2].x));
    assert(turns.length > count / 3, `too few winding paths at ${n}`);
    assert(l.shape.reduce((sum,v)=>sum+v) / l.shape.length >= .6);
  }
});

test('600-piece removal, hint, undo, restart, persistence and final campaign completion', () => {
  const h = harness(); h.G.loadLevel(1000);
  const original = JSON.stringify(h.G.getState().arrows);
  for (let k = 0; k < 12; k++) {
    const s = h.G.getState(); h.G.test.doHint();
    assert.equal(h.GC.pieceBlocker(s.occ,s.arrows,s.cols,s.rows,s.hintIdx),-1);
    h.G.tapArrow(s.hintIdx);
  }
  h.G.test.saveCur();
  const restored = harness(h.data); assert(restored.G.test.tryRestore());
  assert.equal(restored.G.getState().arrows.filter(a=>a.alive).length,588);
  restored.G.undo();
  assert.equal(restored.G.getState().arrows.filter(a=>a.alive).length,589);
  assert.deepEqual([...restored.G.getState().occ],[...occupancy(restored.G.getState())]);
  restored.G.loadLevel(1000);
  assert.equal(JSON.stringify(restored.G.getState().arrows),original);
  const s = restored.G.getState();
  while (!s.over) restored.G.tapArrow(restored.GC.hintArrow(s.arrows,s.occ,s.cols,s.rows));
  assert.equal(restored.ST.getSave().unlocked,1000);
  assert.equal(restored.ST.getSave().best[1000].stars,3);
});

test('pre-density v2 board and player progress restore without regeneration or migration', () => {
  const cur = JSON.parse(source('scripts/fixtures/legacy-board.json'));
  const h = harness({'arrowOut.v2':JSON.stringify({v:2,unlocked:701,coins:321,
    best:{700:{stars:2,plays:4}},cur})});
  assert(h.G.test.tryRestore());
  assert.equal(JSON.stringify(h.G.getState().arrows),JSON.stringify(cur.arrows));
  assert.equal(h.ST.getSave().coins,321); assert.equal(h.ST.getSave().unlocked,701);
  assert.equal(h.ST.getSave().best[700].stars,2);
});

function renderer(width) {
  const h = harness(), calls = { static:0, screen:0, blits:0 };
  const context = name => new Proxy({}, { get: (_,k) => (...args) => {
    if (k === 'fill' || k === 'stroke') calls[name]++;
    if (k === 'drawImage') calls.blits++;
  }});
  const canvas = {style:{},getContext:()=>context('screen')};
  h.box.document.getElementById = id => id === 'board-wrap' ? ({clientWidth:width,clientHeight:width}) : null;
  h.box.document.createElement = () => ({getContext:()=>context('static')});
  h.box.requestAnimationFrame = () => {};
  h.box.window.devicePixelRatio = 3;
  vm.runInContext(source('js/render.js').replace('    init: init,','    testRender: render,\n    init: init,')+';globalThis.R=Render;',h.box);
  h.G.loadLevel(1000);
  const R=h.box.R; R.init(canvas); R.setGameState(h.G.getState()); R.fitCanvas();
  return {h,R,calls,canvas};
}
test('dense rendering caches stable arrows, culls offscreen paths and bounds canvas memory', () => {
  const {h,R,calls,canvas}=renderer(390);
  R.testRender(1000); const first=calls.static;
  assert(first>=600*5); R.testRender(1016); assert.equal(calls.static,first);
  assert.equal(canvas.width,780); assert.equal(canvas.height,780); // DPR capped at 2
  R.focusPiece(300); const before=calls.static; R.testRender(1032);
  assert(calls.static-before < first/4, 'zoomed draw should cull most paths');
  const stable=calls.static; R.testRender(1048); assert.equal(calls.static,stable);
  h.G.getState().arrows[300].alive=false; R.testRender(1064);
  assert(calls.static>stable, 'removed piece must invalidate cached layer');
  R.setPalette(['#ffffff']); R.testRender(1080); assert(calls.static>stable);
  assert.equal(canvas.width,780, 'zoom must not enlarge backing store');
});
test('every one of 600 arrows is individually selectable at 320px and 390px', () => {
  for (const width of [320,390]) {
    const {h,R}=renderer(width), s=h.G.getState();
    for (let i=0;i<s.arrows.length;i++) {
      R.focusPiece(i); const v=R.getView(), head=s.arrows[i].cells.at(-1);
      assert(v.cell*v.zoom>=44);
      const p=R.screenToCell((head.x+.5)*v.cell*v.zoom+v.x,(head.y+.5)*v.cell*v.zoom+v.y);
      assert(p); assert.equal(s.occ[p.y*s.cols+p.x],i);
    }
    assert.equal(R.screenToCell(-1,0),null); assert.equal(R.screenToCell(Infinity,0),null);
    R.pan(-1e6,-1e6); let v=R.getView(); assert.equal(v.x,v.width-s.cols*v.cell*v.zoom);
    R.pan(1e6,1e6); v=R.getView(); assert.equal(v.x,0);
    R.resetView(); assert.equal(R.getView().zoom,1);
  }
});
test('drag, pinch, cancel and secondary buttons never launch; a release taps once', () => {
  const h=harness(); h.elements.board={getContext:()=>({}),getBoundingClientRect:()=>({left:0,top:0}),addEventListener(){}};
  h.G.init();h.G.loadLevel(1000);const s=h.G.getState();
  const i=h.GC.hintArrow(s.arrows,s.occ,s.cols,s.rows),c=s.arrows[i].cells[0];
  const e={clientX:(c.x+.5)*10,clientY:(c.y+.5)*10,button:0,pointerId:1,preventDefault(){}};
  const t=h.G.test;
  t.gestureDown(e);t.gestureMove({...e,clientX:e.clientX+30});t.gestureUp(e);
  t.gestureDown(e);t.gestureDown({...e,pointerId:2});t.gestureUp({...e,pointerId:2});t.gestureUp(e);
  t.gestureDown(e);t.gestureCancel(e);t.gestureUp(e);
  t.gestureDown({...e,button:2});t.gestureUp({...e,button:2});
  assert.equal(s.hearts,3);assert.equal(s.undoIds.length,0);
  t.gestureDown(e);assert(s.arrows[i].alive);t.gestureUp(e);t.gestureUp(e);
  assert.equal(s.undoIds.length,1);assert.equal(s.arrows[i].alive,false);
});
