#!/usr/bin/env node
'use strict';
// An isolated local release server exercises the real v33 -> current worker update.
// No live provider writes, cache clearing, or player data deletion during update.
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),output=process.argv[2];assert(output);
fs.mkdirSync(output,{recursive:true});
const base='978961aeeb0be9ac31f34dc874f8f5c98e0a07a4';
let current=false,browser,page,server;
const report={checks:[],errors:[]};
(async()=>{
  const old=new Map();
  server=http.createServer((req,res)=>{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=pathname.replace(/^\/Fletch_Game\//,'')||'index.html';
    if(!pathname.startsWith('/Fletch_Game/')||file.split('/').includes('..')){res.writeHead(404).end();return;}
    try{
      if(!current&&!old.has(file))old.set(file,execFileSync('git',['show',`${base}:${file}`],{cwd:root,stdio:['ignore','pipe','ignore']}));
      const data=current?fs.readFileSync(path.join(root,file)):old.get(file);
      const type={'.html':'text/html','.js':'application/javascript','.css':'text/css','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'}[path.extname(file)]||'application/octet-stream';
      res.writeHead(200,{'Content-Type':type,'Cache-Control':'public, max-age=600'}).end(data);
    }catch{res.writeHead(404).end();}
  });
  await new Promise(r=>server.listen(0,'0.0.0.0',r));
  const url=`http://localhost:${server.address().port}/Fletch_Game/`;
  browser=await chromium.connectOverCDP(execFileSync('coderabbit-agent-browser',['get','cdp-url'],{encoding:'utf8'}).trim());
  const context=browser.contexts()[0];page=await context.newPage();
  page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(url);await page.waitForFunction(()=>typeof Game!=='undefined'&&Game.getState());
  assert.equal(await page.evaluate(()=>PWA.VERSION),'v33');
  await page.evaluate(()=>{UI.closeAll();Storage.updateSave({coins:9001,unlocked:701,skin:'royal',owned:{royal:true},best:{700:{stars:3,plays:9}},settings:{seenOnboarding:true}});Game.loadLevel(77);Game.hint();window.dispatchEvent(new Event('pagehide'));UI.showHomeScreen();});
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('arrowOut.v2')));
  current=true;
  assert(await page.evaluate(()=>PWA.checkForUpdates()));
  await page.waitForFunction(async()=> (await caches.keys()).includes('arrow-out-v34') && document.querySelector('#update-banner').classList.contains('show'));
  await page.locator('#btn-update-reload').click();
  await page.waitForFunction(()=>typeof PWA!=='undefined' && PWA.VERSION==='v34' && typeof Game!=='undefined' && Game.getState());
  const after=await page.evaluate(()=>Storage.getSave());
  for(const key of ['coins','unlocked','skin','owned','best','cur','settings','daily','stats'])assert.deepEqual(after[key],before[key],key);
  assert.equal(after.boardSkin,'default');assert.equal(after.ownedBoards.default,true);
  assert.equal(await page.evaluate(()=>fetch('js/render.js').then(r=>r.text()).then(t=>t.includes('view.width'))),true);
  assert.equal(await page.evaluate(()=>caches.has('arrow-out-v33')),false);
  report.checks.push('v33 worker and returning save -> v34 using update banner; 10-minute HTTP cache bypassed; old worker cache removed; all existing progress/settings/cosmetics/snapshot retained without clearing data');
  await page.evaluate(()=>UI.closeAll());await page.locator('#btn-continue').click();
  await page.screenshot({path:path.join(output,'chromium-updated-save.png')});
  // No optional browser APIs and inaccessible localStorage: core still playable.
  await page.close();page=await context.newPage();
  page.on('pageerror',e=>report.errors.push(e.message));
  await page.addInitScript(()=>{
    Object.defineProperty(navigator,'serviceWorker',{value:undefined,configurable:true});
    // Feature-detection uses "in", so remove the inherited API as well.
    delete navigator.serviceWorker;delete Object.getPrototypeOf(navigator).serviceWorker;
    window.AudioContext=undefined;window.webkitAudioContext=undefined;window.Notification=undefined;window.PushManager=undefined;
    Object.defineProperty(navigator,'vibrate',{value:undefined,configurable:true});
    Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError');},configurable:true});
  });
  await page.goto(url);await page.waitForFunction(()=>typeof Game!=='undefined'&&Game.getState());
  await page.evaluate(()=>{UI.closeAll();Game.loadLevel(77);Game.hint();Game.tapArrow(Game.getState().hintIdx);});
  assert.equal(await page.evaluate(()=>Game.getState().undoIds.length),1);
  assert.equal(await page.evaluate(()=>Storage.isStorageOk()),false);
  report.checks.push('missing audio/vibration/notifications/service-worker APIs plus blocked localStorage: startup, hint and removal work');
  assert.deepEqual(report.errors,[]);report.passed=true;
})().catch(e=>{report.passed=false;report.error=e.stack;process.exitCode=1;}).finally(async()=>{
  fs.writeFileSync(path.join(output,'update-fallback.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
  if(page)await page.close().catch(()=>{});if(browser)await browser.close();if(server)server.close();
});
