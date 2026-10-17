'use strict';
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { test } = require('node:test');
const { harness, source, occupancy } = require('./qa-harness');
const clone = value => JSON.parse(JSON.stringify(value));

test('save migration commits v2 before deleting v1; corruption still permits migration', () => {
  const old = JSON.stringify({ v: 1, unlocked: 42, best: { 7: { stars: 3, plays: 4 } } });
  const h = harness({ 'arrowOut.v1': old, 'arrowOut.v2': '{broken' });
  assert.equal(h.ST.getSave().unlocked, 42);
  assert.equal(JSON.parse(h.data['arrowOut.v2']).best[7].stars, 3);
  assert.equal(h.data['arrowOut.v1'], undefined);
  h.ST.init(); assert.equal(h.ST.getSave().unlocked, 42);
  const failed = harness({ 'arrowOut.v1': old }, { quota: true });
  assert.equal(failed.data['arrowOut.v1'], old);
  assert.equal(failed.ST.getSave().unlocked, 42);
  assert.equal(failed.ST.isStorageOk(), false);
});
test('hostile save keys and inherited skin names preserve valid progress without prototype mutation', () => {
  const h = harness({ 'arrowOut.v2': JSON.stringify({ v: 2, unlocked: 42,
    best: { hasOwnProperty: 1, 7: { stars: 3, plays: 4 } }, owned: { hasOwnProperty: true },
    bonusClaimed: { hasOwnProperty: true }, skin: 'constructor' }) });
  assert.equal(h.ST.getSave().unlocked, 42); assert.equal(h.ST.getSave().best[7].stars, 3);
  assert.equal(h.ST.getSave().skin, 'default');
  h.ST.updateSave(JSON.parse('{"stats":{"__proto__":{"polluted":true}}}'));
  assert.equal(h.ST.getSave().stats.polluted, undefined);
  h.ST.addCoins(Infinity); assert.equal(h.ST.getSave().coins, 0);
  h.ST.addCoins(8); assert.equal(h.ST.spendCoins(Infinity), false);
  assert.equal(h.ST.spendCoins(-1), false); assert.equal(h.ST.getSave().coins, 8);
});
test('missing, incomplete and unavailable saves remain playable; valid saves round-trip', () => {
  for (const h of [harness(), harness({ 'arrowOut.v2': '{oops' }), harness({}, { unavailable: true }),
    harness({ 'arrowOut.v2': '{"v":2,"stats":null}' }),
    harness({ 'arrowOut.v2': '{"v":2,"coins":{"toString":1},"skin":{"toString":1}}' }),
    harness({ 'arrowOut.v1': '{"v":1,"best":"junk","perfect":{"7":true},"unlocked":{"toString":1}}' })]) {
    h.G.loadLevel(1); h.G.hint(); assert(h.G.getState().hintIdx >= 0);
  }
  const h = harness(); h.G.loadLevel(25); h.G.hint(); h.flush(250);
  const copy = harness(h.data); assert(copy.G.test.tryRestore());
  assert.equal(copy.G.getState().hintsUsed, 1);
  assert.equal(JSON.stringify(copy.G.getState().arrows), JSON.stringify(h.G.getState().arrows));
});
test('snapshot validation is atomic and rejects malformed geometry, references and bonus indices safely', () => {
  const h = harness(); h.G.loadLevel(5); const good = clone(h.ST.getSave().cur), state = h.G.getState();
  const mutations = [c => c.cols = 1.5, c => c.level = 1001, c => c.arrows[0] = null,
    c => c.arrows[0].dir = 8, c => c.arrows[0].cells[0].x = NaN,
    c => c.arrows[0].step = c.arrows[1].step, c => c.shapeIdx.push(-1),
    c => c.undoIds = [999], c => c.undoIds = [0, 0], c => c.hearts = 0,
    c => c.hintsUsed = -1, c => c.alive[0] = 'yes', c => c.arrows = [],
    c => c.arrows[0].cells[1] = c.arrows[0].cells[0]];
  for (const mutate of mutations) {
    const c = clone(good); mutate(c); h.ST.getSave().cur = c;
    assert.equal(h.G.test.tryRestore(), false); assert.equal(h.G.getState(), state);
  }
  const c = clone(good); c.bonus.idx = 0.5; h.ST.getSave().cur = c;
  assert(h.G.test.tryRestore()); assert.equal(h.G.getState().bonus, null);
});
test('exit, rapid duplicate activation, undo, restart and completion preserve occupancy and progression', () => {
  const h = harness(); h.G.loadLevel(1);
  const s = h.G.getState(), original = clone(s.arrows), id = h.GC.hintArrow(s.arrows, s.occ, s.cols, s.rows);
  h.G.tapArrow(id); h.G.tapArrow(id); assert.equal(s.undoIds.length, 1);
  assert.equal(s.arrows[id].alive, false); h.G.undo(); assert.equal(s.arrows[id].alive, true);
  assert.deepEqual([...s.occ], [...occupancy(s)]);
  h.G.loadLevel(1); assert.equal(JSON.stringify(h.G.getState().arrows), JSON.stringify(original));
  const current = h.G.getState();
  while (!current.over) h.G.tapArrow(h.GC.hintArrow(current.arrows, current.occ, current.cols, current.rows));
  assert.equal(h.ST.getSave().unlocked, 2); assert.equal(h.ST.getSave().best[1].stars, 3);
  const coins = h.ST.getSave().coins; h.G.test.scheduleWin(); assert.equal(h.ST.getSave().coins, coins);
  h.G.loadLevel(2); h.flush(200); assert.deepEqual(h.dialogs, []);
});
test('failure dialog cannot appear after restart; final in-flight save recovers completion', () => {
  const h = harness(); h.G.loadLevel(5); const s = h.G.getState();
  const blocked = s.arrows.findIndex((a, i) => h.GC.pieceBlocker(s.occ, s.arrows, s.cols, s.rows, i) >= 0);
  for (let i = 0; i < 3; i++) h.G.tapArrow(blocked);
  assert(s.failed); assert.equal(h.ST.getSave().cur, null);
  h.G.loadLevel(5); h.flush(150); assert.deepEqual(h.dialogs, []);
  const c = clone(h.ST.getSave().cur); c.alive.fill(0); c.undoIds = c.arrows.map((a, i) => i);
  h.ST.getSave().cur = c; assert(h.G.test.tryRestore()); h.G.test.scheduleWin();
  assert(h.G.getState().over); assert.equal(h.ST.getSave().unlocked, 6);
});
test('daily state persists for its own date and contributes a play', () => {
  const h = harness(); h.G.loadDailyChallenge(); assert.equal(h.ST.getSave().stats.totalPlays, 1);
  assert.equal(h.ST.getSave().cur.level, 'daily'); assert(h.G.test.tryRestore());
  h.ST.getSave().cur.date = '20000101'; assert.equal(h.G.test.tryRestore(), false);
});
test('repeated/modifier Escape is ignored; ordinary Escape closes dialogs', () => {
  const h = harness(); let closed = 0;
  h.ui.anyOpen = () => true; h.ui.closeAll = () => closed++;
  h.G.test.setupEventListeners();
  for (const modifier of ['repeat', 'ctrlKey', 'altKey', 'metaKey', 'shiftKey']) h.events.keydown({ key: 'Escape', [modifier]: true });
  assert.equal(closed, 0);
  let prevented = false; h.events.keydown({ key: 'Escape', preventDefault() { prevented = true; } });
  assert.equal(closed, 1); assert(prevented);
});
test('head corridor is the rule, invalid pieces never become hints, stale occupants are ignored', () => {
  const h = harness(), level = { cols: 4, rows: 4, arrows: [
    { cells: [{x:0,y:1},{x:1,y:1},{x:1,y:0}], dir:0, step:0, alive:true },
    { cells: [{x:0,y:0},{x:0,y:0}], dir:1, step:1, alive:false }
  ] };
  assert.equal(h.GC.pieceBlocker(occupancy(level),level.arrows,4,4,0),-1);
  const bad = [{ cells: [{x:0,y:0}], dir:9, alive:true }];
  assert.equal(h.GC.hintArrow(bad,new Int32Array(4).fill(-1),2,2),-1);
  assert.equal(h.GC.validateBoardSolution(2,2,bad),false);
  const p = {cells:[{x:0,y:1},{x:1,y:1}],dir:1,alive:true};
  const occ = new Int32Array(16).fill(-1); occ[6]=9; occ[7]=1;
  assert.equal(h.GC.pieceBlocker(occ,[p,null],4,4,0),-1);
});
test('audio inputs cannot schedule nonfinite or nonpositive AudioParams', () => {
  const calls = [], noop = () => {};
  function param() { return { setValueAtTime(v,t) { assert(Number.isFinite(v) && v>0 && Number.isFinite(t)); calls.push(v); },
    exponentialRampToValueAtTime(v,t) { assert(Number.isFinite(v) && v>0 && Number.isFinite(t)); calls.push(v); } }; }
  class AC { constructor(){ this.state='running';this.currentTime=0; }
    createOscillator(){ return {frequency:param(),connect:noop,start:noop,stop:noop}; }
    createGain(){ return {gain:param(),connect:noop}; } }
  const box = vm.createContext({window:{AudioContext:AC},console,setInterval:noop,clearInterval:noop});
  vm.runInContext(source('js/audio.js').replace('    play: playSound,','    testTone: tone,\n    play: playSound,')+'\nglobalThis.A=Audio;',box);
  for (const v of [NaN,Infinity,0,-1]) { const before=calls.length; box.A.testTone(v,440,.2,'sine',.1,0); assert.equal(calls.length,before); }
  for (const v of [NaN,Infinity,0,-1]) { box.A.testTone(440,440,v,'sine',.1,0); box.A.testTone(440,440,.2,'sine',v,0); }
  assert.equal(calls.length,0); box.A.testTone(440,880,.2,'sine',.1,0); assert(calls.length>0);
  for (const v of [NaN,Infinity,0,-1,3]) box.A.fly(v,2);
});
test('zero viewport and invalid pixel ratio do not produce invalid canvas dimensions', () => {
  const h = harness(), wrap={clientWidth:0,clientHeight:0}, canvas={style:{},getContext:()=>({setTransform(){}})};
  h.box.document.getElementById=()=>wrap; h.box.document.createElement=()=>({getContext:()=>({})}); h.box.requestAnimationFrame=()=>{};
  vm.runInContext(source('js/render.js')+'\nglobalThis.R=Render;',h.box);
  h.box.R.init(canvas); h.box.R.setGameState({cols:9});h.box.R.fitCanvas(); assert.equal(h.box.R.getCellSize(),0);
  wrap.clientWidth=100;wrap.clientHeight=80;h.box.window.devicePixelRatio=Infinity;h.box.R.fitCanvas();
  assert.equal(canvas.width,80);assert(Number.isFinite(h.box.R.getCellSize()));
});

test('service worker assets exist and failed precache cannot activate; cache isolation and offline response types', async () => {
  const fs=require('node:fs'), path=require('node:path'), {root}=require('./qa-harness');
  const sw=source('sw.js'); assert(sw.trim().length>0);
  const handlers={}, entries=new Map(), deleted=[], writes=[];
  let activate=0, network=true, missing=null;
  const scope='https://example.test/Fletch_Game/';
  const cache={match:async key=>entries.get(String(key)), put:async (key,resp)=>{writes.push(String(key));entries.set(String(key),resp);},add:async ()=>{}};
  class Req { constructor(url, opts){this.url=new URL(url,scope).href;this.cache=opts.cache;} }
  const box=vm.createContext({URL,Request:Req,Response,console,
    self:{location:{origin:'https://example.test'},registration:{scope},clients:{claim:async()=>{}},
      addEventListener:(n,fn)=>handlers[n]=fn,skipWaiting:()=>{activate++;}},
    caches:{open:async()=>cache, keys:async()=>['other-app','arrow-out-v31','arrow-out-v32'],delete:async k=>deleted.push(k)},
    fetch:async req=>{if(!network)throw Error('offline');return new Response('asset',{status:req.url?.endsWith(missing)&&missing?404:200});}
  });
  vm.runInContext(sw+'\nglobalThis.assets=CORE_ASSETS.concat(EXTRA_ASSETS);',box);
  for(const asset of box.assets) assert(fs.statSync(path.join(root,asset==='./'?'index.html':asset)).size>0,asset);
  for(const icon of JSON.parse(source('manifest.webmanifest')).icons) assert(fs.statSync(path.join(root,icon.src)).size>0);
  let pending; const event={waitUntil:p=>pending=p};
  missing='js/main.js'; handlers.install(event);await assert.rejects(pending,/precache failed/);assert.equal(activate,0);
  missing=null;handlers.install(event);await pending;assert.equal(activate,1);
  handlers.activate(event);await pending;assert.deepEqual(deleted,['arrow-out-v31']);
  entries.clear();entries.set(scope+'index.html',new Response('<html>game</html>'));
  entries.set(scope+'js/game.js',new Response('CURRENT_JS'));
  async function request(file,mode='cors'){
    let response;handlers.fetch({request:{method:'GET',url:scope+file,mode},respondWith:p=>response=p,waitUntil(){}});return response;
  }
  network=false; assert.equal(await (await request('js/game.js?v=old')).text(),'CURRENT_JS');
  assert.equal((await request('js/missing.js')).type,'error');
  assert.equal(await (await request('unknown','navigate')).text(),'<html>game</html>');
  network=true; const before=writes.length;await request('arbitrary?many=1');assert.equal(writes.length,before);
  box.caches.open=async()=>{throw Error('cache unavailable');};
  assert.equal(await (await request('js/main.js')).text(),'asset');
});
test('reading push status never subscribes; explicit subscribe does', async () => {
  let subscriptions=0;const noop=()=>{};
  const registration={pushManager:{getSubscription:async()=>null,subscribe:async()=>{subscriptions++;return {endpoint:'synthetic'};}}};
  const box=vm.createContext({console,Uint8Array,Promise,URL,atob,Storage:{getSave:()=>({})},
    document:{getElementById:()=>null,addEventListener:noop,querySelector:()=>null},
    navigator:{serviceWorker:{ready:Promise.resolve(registration),register:async()=>registration},userAgent:''},
    window:{PushManager:function(){},Notification:{permission:'granted'},addEventListener:noop,matchMedia:()=>({matches:false})},
    Notification:{permission:'granted'},location:{protocol:'https:',hostname:'example.test'},setTimeout:noop});
  vm.runInContext(source('js/pwa.js')+'\nglobalThis.P=PWA;',box);
  assert.equal(await box.P.getPushSubscriptionJson(),null);assert.equal(subscriptions,0);
  assert(await box.P.subscribePush());assert.equal(subscriptions,1);
  box.fetch=async()=>new Response('',{status:200});assert.equal(await box.P.getServiceWorkerSource(),null);
  box.fetch=async()=>new Response('not found',{status:404});assert.equal(await box.P.getServiceWorkerSource(),null);
  box.fetch=async()=>new Response(source('sw.js'));assert.equal(await box.P.getServiceWorkerSource(),source('sw.js'));
});

test('bonus expiry survives restore and rewarded hint callbacks belong to their original level', () => {
  const h=harness();h.G.loadLevel(5);const s=h.G.getState();
  s.bonus.active=false;h.G.test.saveCur();assert(h.G.test.tryRestore());assert.equal(h.G.getState().bonus,null);
  h.G.loadLevel(5);h.G.getState().bonus.deadline=1600;h.G.test.saveCur();assert(h.G.test.tryRestore());
  assert.equal(h.G.getState().bonus.deadline,1600);
  h.G.test.adForHint();h.G.test.adForHint();
  assert.equal([...h.timers.values()].filter(t=>t.ms===1000).length,1);
  const callback=[...h.timers.values()].find(t=>t.ms===1000).fn;
  h.G.loadLevel(6);for(let i=0;i<5;i++)callback();assert.equal(h.G.getState().hintsUsed,0);
});

test('pointer input rejects invalid coordinates, secondary buttons, multitouch and modal background taps', () => {
  const h=harness();h.elements.board={getContext:()=>({}),getBoundingClientRect:()=>({left:0,top:0}),addEventListener(){}};
  h.G.init();h.G.loadLevel(1);const s=h.G.getState();
  const i=h.GC.hintArrow(s.arrows,s.occ,s.cols,s.rows),c=s.arrows[i].cells[0];
  const event={clientX:(c.x+.5)*10,clientY:(c.y+.5)*10,button:0,isPrimary:true,preventDefault(){}};
  for(const invalid of [{clientX:NaN},{clientY:Infinity},{clientX:-1},{button:2},{isPrimary:false}]) h.G.test.handlePointerDown({...event,...invalid});
  h.ui.anyOpen=()=>true;h.G.test.handlePointerDown(event);assert(s.arrows[i].alive);
  h.ui.anyOpen=()=>false;h.G.test.handlePointerDown(event);h.G.test.handlePointerDown(event);
  assert.equal(s.arrows[i].alive,false);assert.equal(s.undoIds.length,1);
});
