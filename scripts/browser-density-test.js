#!/usr/bin/env node
'use strict';
// Uses the existing shared Preview Chromium via CDP; never launches a browser.
// Run: node scripts/browser-density-test.js http://localhost:8000/ <output-dir>
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const url = process.argv[2] || 'http://localhost:8000/';
const output = process.argv[3];
assert(output, 'Pass an output directory for screenshots and measurements');
fs.mkdirSync(output, {recursive:true});
const endpoint = execFileSync('coderabbit-agent-browser',['get','cdp-url'],{encoding:'utf8'}).trim();
const socket = new WebSocket(endpoint), pending = new Map();
let sequence=0, session;
const report={browser:'shared Chromium',cpuThrottle:4,viewports:[],checks:[]};
socket.addEventListener('message', event => {
  const m=JSON.parse(event.data), p=pending.get(m.id);
  if(p){pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}
});
function send(method,params={},target=session){return new Promise((resolve,reject)=>{
  const id=++sequence;pending.set(id,{resolve,reject});
  socket.send(JSON.stringify({id,method,params,...(target?{sessionId:target}:{})}));
});}
async function evaluate(expression){
  const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
  if(r.exceptionDetails)throw Error(r.exceptionDetails.text+': '+r.exceptionDetails.exception?.description);
  return r.result.value;
}
async function ready(){
  for(let i=0;i<100;i++){
    try {if(await evaluate('typeof Game !== "undefined" && !!Game.getState() && typeof Render.getView === "function"'))return;}catch{}
    await new Promise(r=>setTimeout(r,100));
  }
  throw Error('app readiness timed out');
}
async function frame(){await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');}
async function touch(type,points){await send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([x,y,id=1])=>({x,y,id,radiusX:4,radiusY:4,force:1}))});}
async function screenshot(name){
  const shot=await send('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync(path.join(output,name),Buffer.from(shot.data,'base64'));
}
(async()=>{
  await new Promise((r,j)=>{socket.addEventListener('open',r,{once:true});socket.addEventListener('error',j,{once:true});});
  const targets=await send('Target.getTargets',{},null);
  const target=targets.targetInfos.find(t=>t.type==='page'&&t.url.startsWith(url));
  assert(target,'Open the app in the shared browser before running');
  session=(await send('Target.attachToTarget',{targetId:target.targetId,flatten:true},null)).sessionId;
  await send('Page.enable');await send('Network.enable');
  // Reload current source, including when a prior run cached an earlier edit.
  await evaluate(`Promise.all([navigator.serviceWorker.getRegistrations().then(rs=>Promise.all(rs.map(r=>r.unregister()))),caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('arrow-out-')).map(k=>caches.delete(k))))])`);
  await send('Page.reload',{ignoreCache:true});await ready();
  await evaluate('navigator.serviceWorker.ready');
  for(let i=0;i<50&&!await evaluate('!!navigator.serviceWorker.controller');i++)await new Promise(r=>setTimeout(r,100));
  assert(await evaluate('!!navigator.serviceWorker.controller'));
  await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
  await evaluate(`UI.closeAll(); document.querySelector('[aria-label="Dismiss install banner"]')?.click();`);
  for(const width of [320,390]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:width===320?568:844,deviceScaleFactor:2,mobile:true});
    await evaluate('UI.closeAll();Game.loadLevel(1000);Render.fitCanvas();');await frame();
    const metrics=await evaluate(`(()=>{const c=document.getElementById('board'),r=c.getBoundingClientRect();return {width:innerWidth,overflow:document.documentElement.scrollWidth-innerWidth,arrows:Game.getState().arrows.length,backing:c.width,side:r.width};})()`);
    assert.equal(metrics.arrows,600);assert.equal(metrics.overflow,0);assert(metrics.backing<=width*2);
    report.viewports.push(metrics);
    const p=await evaluate(`(()=>{const r=document.getElementById('board').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2];})()`);
    await touch('touchStart',[p]);await touch('touchEnd',[]);await frame();
    assert(await evaluate('Render.getView().cell*Render.getView().zoom>=43.99'));
    assert.equal(await evaluate('Game.getState().undoIds.length'),0,'overview tap must only zoom');
    await touch('touchStart',[p]);await touch('touchMove',[[p[0]+60,p[1]+20]]);await touch('touchEnd',[]);
    assert.equal(await evaluate('Game.getState().hearts'),3);
    assert.equal(await evaluate('Game.getState().undoIds.length'),0);
    await touch('touchStart',[[p[0]-30,p[1],1],[p[0]+30,p[1],2]]);
    await touch('touchMove',[[p[0]-45,p[1],1],[p[0]+45,p[1],2]]);
    await touch('touchMove',[[p[0]-60,p[1],1],[p[0]+60,p[1],2]]);
    await touch('touchEnd',[]);assert.equal(await evaluate('Game.getState().undoIds.length'),0);
    const head=await evaluate(`(()=>{Game.hint();const s=Game.getState(),a=s.arrows[s.hintIdx],h=a.cells.at(-1),v=Render.getView(),r=document.getElementById('board').getBoundingClientRect();return [r.left+(h.x+.5)*v.cell*v.zoom+v.x,r.top+(h.y+.5)*v.cell*v.zoom+v.y];})()`);
    await touch('touchStart',[head]);await touch('touchEnd',[]);await frame();
    assert.equal(await evaluate('Game.getState().undoIds.length'),1,'native touch removes highlighted arrow');
    assert.equal(await evaluate('Game.getState().hearts'),3);
    await evaluate('Render.resetView()');await frame();
  }
  report.checks.push('native touch overview zoom, drag, pinch, hint focus and removal at 320px and 390px');
  await send('Emulation.setDeviceMetricsOverride',{width:844,height:390,deviceScaleFactor:2,mobile:true});
  await evaluate('Render.fitCanvas()');await frame();
  assert(await evaluate('Render.getView().side>0 && document.documentElement.scrollWidth===innerWidth'));
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
  await evaluate('Render.fitCanvas()');await frame();
  report.checks.push('portrait/landscape camera resize keeps a valid viewport');
  await send('Emulation.setCPUThrottlingRate',{rate:4});
  for(const n of [1,300,1000]){
    const timing=await evaluate(`(()=>{const t=performance.now();Game.loadLevel(${n});return performance.now()-t;})()`);
    await frame();
    const perf=await evaluate(`(async()=>{
      const times=[],gaps=[],raf=requestAnimationFrame;let last=0;
      window.requestAnimationFrame=function(fn){return raf.call(window,function(t){const start=performance.now();try{fn(t);}finally{if(fn.name==='frame')times.push(performance.now()-start);}});};
      try {Game.hint();for(let i=0;i<120;i++)await new Promise(resolve=>requestAnimationFrame(t=>{if(last)gaps.push(t-last);last=t;resolve();}));}
      finally {window.requestAnimationFrame=raf;}
      times.sort((a,b)=>a-b);gaps.sort((a,b)=>a-b);
      return {samples:times.length,renderP95:times[Math.floor(times.length*.95)],renderMax:times.at(-1),frameGapP95:gaps[Math.floor(gaps.length*.95)]};
    })()`);
    assert(perf.samples>=100);assert(perf.renderP95<33,`render budget at ${n}: ${perf.renderP95}`);
    report.checks.push({level:n,controllerLoadMs:timing,...perf});
    await evaluate('Game.getState().hintIdx=-1;Render.resetView();Render.ensureLoop();');await frame();
    await screenshot(`level-${n}-overview.png`);
    if(n===1000){
      await evaluate('Render.focusPiece(300)');await frame();await screenshot('level-1000-detail.png');
      const navigation=await evaluate(`(async()=>{
        const times=[],raf=requestAnimationFrame;
        window.requestAnimationFrame=fn=>raf.call(window,t=>{const start=performance.now();try{fn(t);}finally{if(fn.name==='frame')times.push(performance.now()-start);}});
        try {for(let i=0;i<60;i++){Render.pan(i%2?12:-12,0);await new Promise(r=>requestAnimationFrame(r));}}
        finally {window.requestAnimationFrame=raf;}
        times.sort((a,b)=>a-b);return {samples:times.length,panRenderP95:times[Math.floor(times.length*.95)],panRenderMax:times.at(-1)};
      })()`);
      assert(navigation.panRenderP95<33);report.checks.push(navigation);
    }
  }
  await send('Emulation.setCPUThrottlingRate',{rate:1});
  // Persistence, worker control and genuine offline navigation/assets.
  await evaluate('window.dispatchEvent(new Event("pagehide"))');
  const before=await evaluate('JSON.stringify(Storage.getSave().cur)');
  await send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
  await send('Page.reload');await ready();
  assert.equal(await evaluate('Game.getState().arrows.length'),600);
  assert.equal(await evaluate('JSON.stringify(Storage.getSave().cur)'),before);
  assert(await evaluate(`Promise.all(['js/game.js','js/render.js','css/styles.css','manifest.webmanifest'].map(p=>fetch(p).then(r=>r.ok))).then(rs=>rs.every(Boolean))`));
  await evaluate('UI.closeAll();Game.loadDailyChallenge();');await frame();
  assert.equal(await evaluate('Game.getState().level'),'daily');
  report.checks.push('offline reload restores dense snapshot exactly; all core assets cached; daily loads offline');
  await send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
  await evaluate('UI.closeAll();Game.loadLevel(1)');await frame();
  report.passed=true;
})().catch(e=>{report.passed=false;report.error=e.stack;process.exitCode=1;}).finally(async()=>{
  if(session){
    await send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1}).catch(()=>{});
    await send('Emulation.setCPUThrottlingRate',{rate:1}).catch(()=>{});
  }
  fs.writeFileSync(path.join(output,'browser-validation.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));socket.close();
});
