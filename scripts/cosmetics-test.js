'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const vm = require('node:vm');
const { harness, source, occupancy } = require('./qa-harness');

test('legacy saves retain progress, current board, settings and every purchased arrow ID', () => {
  const old = {v:2,unlocked:777,coins:8123,skin:'ice',owned:{default:true,ice:true,royal:true},
    best:{500:{stars:3,plays:12}},cur:JSON.parse(source('scripts/fixtures/legacy-board.json')),
    settings:{notifications:true,reducedMotion:true,seenOnboarding:true},daily:{lastDate:'2026-10-17',completed:true,stars:2}};
  const h = harness({'arrowOut.v2':JSON.stringify(old)}), save=h.ST.getSave();
  for(const key of ['unlocked','coins','skin','owned','best','cur','daily']) assert.equal(JSON.stringify(save[key]),JSON.stringify(old[key]),key);
  for(const [key,value] of Object.entries(old.settings)) assert.equal(save.settings[key],value,'settings.'+key);
  assert.equal(save.settings.reminderMinutes,90);assert.equal(save.settings.systemNotifications,false);
  assert.equal(save.boardSkin,'default');assert.equal(save.ownedBoards.default,true);
  h.ST.persist();assert.equal(harness(h.data).ST.getSave().skin,'ice');
  assert(h.G.test.tryRestore());
});

test('coin purchases are atomic, duplicate-safe, free to equip and durable', () => {
  const h=harness();h.ST.addCoins(10000);
  for(const [category,id] of [['boards','galaxy'],['arrows','ice']]){
    const before=h.ST.getSave().coins, price=h.GC.COSMETICS[category][id].price;
    assert.equal(h.ST.cosmeticAction(category,id,false),'locked');
    assert.equal(h.ST.cosmeticAction(category,id,true),'purchased');
    assert.equal(h.ST.cosmeticAction(category,id,true),'equipped');
    assert.equal(h.ST.cosmeticAction(category,id,false),'equipped');
    assert.equal(h.ST.getSave().coins,before-price);
  }
  const saved=harness(h.data).ST.getSave();assert.equal(saved.skin,'ice');assert.equal(saved.boardSkin,'galaxy');
  assert.equal(h.ST.cosmeticAction('arrows','constructor',true),'invalid');
  assert.equal(h.ST.cosmeticAction('constructor','ice',true),'invalid');
  const poor=harness();assert.equal(poor.ST.cosmeticAction('boards','galaxy',true),'insufficient');assert.equal(poor.ST.getSave().coins,0);
  const quota=harness({'arrowOut.v2':JSON.stringify({v:2,coins:3000})},{quota:true});
  assert.equal(quota.ST.cosmeticAction('arrows','ice',true),'storage');assert.equal(quota.ST.getSave().coins,3000);
  assert.equal(quota.ST.getSave().skin,'default');assert.equal(quota.ST.getSave().owned.ice,undefined);
  const blocked=harness({}, {unavailable:true});blocked.G.loadLevel(77);assert.equal(blocked.G.getState().level,77);
});

test('cosmetics do not change puzzle geometry, solutions, hints, undo or restart at target levels', () => {
  const h=harness();h.ST.addCoins(1000000);
  for(const n of [1,77,500,1000]){
    h.G.loadLevel(n);const baseline=JSON.stringify(h.G.getState().arrows);
    for(const category of Object.keys(h.GC.COSMETICS))for(const id of Object.keys(h.GC.COSMETICS[category])){
      h.ST.cosmeticAction(category,id,true);
      assert.equal(JSON.stringify(h.G.getState().arrows),baseline);
    }
    const s=h.G.getState(), i=h.GC.hintArrow(s.arrows,s.occ,s.cols,s.rows);h.G.tapArrow(i);h.G.test.saveCur();
    const restored=harness(h.data);assert(restored.G.test.tryRestore());restored.G.undo();
    assert.equal(JSON.stringify(restored.G.getState().arrows),baseline);
    assert.deepEqual([...restored.G.getState().occ],[...occupancy(restored.G.getState())]);
    restored.G.loadLevel(n);assert.equal(JSON.stringify(restored.G.getState().arrows),baseline);
    assert.equal(restored.ST.getSave().skin,h.ST.getSave().skin);assert.equal(restored.ST.getSave().boardSkin,h.ST.getSave().boardSkin);
  }
});

function renderer(width,height,level) {
  const h=harness(), wrap={clientWidth:width,clientHeight:height};
  const ctx=new Proxy({}, {get:(_,k)=>()=>{}}), canvas={style:{},getContext:()=>ctx,setAttribute(){}};
  h.box.document.getElementById=id=>id==='board-wrap'?wrap:null;
  h.box.document.createElement=()=>({getContext:()=>ctx});h.box.requestAnimationFrame=()=>{};
  vm.runInContext(source('js/render.js')+';globalThis.R=Render;',h.box);
  h.G.loadLevel(level);const R=h.box.R;R.init(canvas);R.setGameState(h.G.getState());R.fitCanvas();
  return {h,R,wrap,canvas};
}

test('rectangular Fit includes every path; zoom and focus reach every head; resize preserves centre', () => {
  for(const [w,h]of [[344,560],[377,633],[416,720],[1400,650]])for(const level of [1,77,500,1000]){
    const {h:env,R,wrap,canvas}=renderer(w,h,level),s=env.G.getState();
    assert.equal(canvas.width,w);assert.equal(canvas.height,h);
    let v=R.getView();
    for(const a of s.arrows)for(const c of a.cells){
      assert((c.x+.04)*v.cell+v.x>=0 && (c.x+.96)*v.cell+v.x<=w);
      assert((c.y+.04)*v.cell+v.y>=0 && (c.y+.96)*v.cell+v.y<=h);
    }
    for(let i=0;i<s.arrows.length;i++){
      R.focusPiece(i);v=R.getView();const c=s.arrows[i].cells.at(-1);
      assert(v.cell*v.zoom>=44);const p=R.screenToCell((c.x+.5)*v.cell*v.zoom+v.x,(c.y+.5)*v.cell*v.zoom+v.y);
      assert(p);assert.equal(s.occ[p.y*s.cols+p.x],i);
    }
    R.focusPiece(Math.floor(s.arrows.length/2));v=R.getView();
    const old=[(v.width/2-v.x)/(v.cell*v.zoom),(v.height/2-v.y)/(v.cell*v.zoom)];
    wrap.clientHeight-=30;R.fitCanvas();v=R.getView();
    assert(Math.abs((v.width/2-v.x)/(v.cell*v.zoom)-old[0])<1e-8);
    assert(Math.abs((v.height/2-v.y)/(v.cell*v.zoom)-old[1])<1e-8);
    R.resetView();assert.equal(R.getView().zoom,1);
  }
});

test('audio resumes interrupted contexts and absorbs rejected/throwing optional API calls', async () => {
  let resumed=0;
  const context={state:'interrupted',resume(){resumed++;return Promise.reject(Error('blocked'));},suspend(){throw Error('blocked');}};
  const box=vm.createContext({window:{AudioContext:function(){return context;}},console,setInterval,clearInterval});
  vm.runInContext(source('js/audio.js')+';globalThis.A=Audio;',box);
  box.A.unlock();assert.equal(resumed,1);context.state='running';assert.doesNotThrow(()=>box.A.suspend());
  await new Promise(r=>setImmediate(r));
});

test('rotation rescales an in-flight exit track without changing the puzzle', () => {
  const {h,R,wrap}=renderer(377,633,77),s=h.G.getState(),before=JSON.stringify(s.arrows);
  const i=h.GC.hintArrow(s.arrows,s.occ,s.cols,s.rows);assert(R.spawnFly(i,s));
  const track=s.flying[0],x=track.pts[0][0],arc=track.bodyLen,old=R.getCellSize();
  wrap.clientWidth=700;wrap.clientHeight=320;R.fitCanvas();const ratio=R.getCellSize()/old;
  assert.equal(track.pts[0][0],x*ratio);assert.equal(track.bodyLen,arc*ratio);
  assert.equal(JSON.stringify(s.arrows),before);
});
