#!/usr/bin/env node
'use strict';
// Optional QA tooling only; never shipped/loaded by the game.
// NODE_PATH=<external Playwright install>/node_modules node scripts/browser-upgrade-test.js <chromium|firefox|webkit> <url> <output-dir>
// Chromium attaches to the shared Preview browser, never launches a separate one.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const pw = require('playwright');
const [engine='chromium',url='http://localhost:8000/',output] = process.argv.slice(2);
assert(output,'Output directory required'); fs.mkdirSync(output,{recursive:true});
let browser,context,page,savedProfile;
const report={engine,checks:[],viewports:[],errors:[]};
async function ready(){await page.waitForFunction(()=>typeof Game!=='undefined' && Game.getState() && Render.getView().cell>0);}
async function frame(){await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
async function shot(name){await page.screenshot({path:path.join(output,`${engine}-${name}.png`)});}
(async()=>{
  browser=engine==='chromium'?await pw.chromium.connectOverCDP(execFileSync('coderabbit-agent-browser',['get','cdp-url'],{encoding:'utf8'}).trim()):await pw[engine].launch({headless:true});
  report.version=browser.version();
  context=engine==='chromium'?browser.contexts()[0]:await browser.newContext({hasTouch:true});
  page=engine==='chromium'?context.pages().find(p=>p.url().startsWith(url)):await context.newPage();
  assert(page,'Open the app in Preview first');
  await page.addInitScript(()=>{
    const Base=window.AudioContext||window.webkitAudioContext;
    window.__qaAudio=[];window.__qaTones=0;
    if(Base)window.AudioContext=new Proxy(Base,{construct(target,args){const c=Reflect.construct(target,args);window.__qaAudio.push(c);return c;}});
    if(window.OscillatorNode){const start=OscillatorNode.prototype.start;OscillatorNode.prototype.start=function(...args){window.__qaTones++;return start.apply(this,args);};}
  });
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')console.log('Browser console:',m.text());});
  await page.goto(url);await ready();
  savedProfile=await page.evaluate(()=>localStorage.getItem('arrowOut.v2'));
  // QA profile only: evict an earlier development build, retaining local saves.
  await page.evaluate(async()=>{
    if('serviceWorker' in navigator)await Promise.all((await navigator.serviceWorker.getRegistrations()).map(r=>r.unregister()));
    if('caches' in window)await Promise.all((await caches.keys()).filter(k=>k.startsWith('arrow-out-')).map(k=>caches.delete(k)));
  });
  await page.reload();await ready();
  await page.evaluate(()=>{UI.closeAll();Storage.updateSave({installHidden:true,settings:{seenOnboarding:true}});});
  for(const [width,height]of [[360,800],[393,873],[432,960],[1440,900]]){
    await page.setViewportSize({width,height});
    for(const n of [1,77,500,1000]){
      await page.evaluate(n=>{UI.closeAll();Game.loadLevel(n);Render.fitCanvas();},n);await frame();
      const metrics=await page.evaluate(()=>{
        const v=Render.getView(),s=Game.getState(),rect=document.querySelector('#board').getBoundingClientRect();
        const tools=document.querySelector('#board-tools').getBoundingClientRect(),footer=document.querySelector('footer').getBoundingClientRect();
        let clipped=0;
        for(const a of s.arrows)for(const c of a.cells)if((c.x+.03)*v.cell+v.x<0 || (c.y+.03)*v.cell+v.y<0 || (c.x+.97)*v.cell+v.x>v.width+.01 || (c.y+.97)*v.cell+v.y>v.height+.01)clipped++;
        return {level:s.level,width:innerWidth,height:innerHeight,viewport:[v.width,v.height],arrows:s.arrows.length,clipped,overflow:document.documentElement.scrollWidth-innerWidth,clearControls:rect.top>=tools.bottom && rect.bottom<=footer.top};
      });
      assert.equal(metrics.clipped,0);assert.equal(metrics.overflow,0);assert(metrics.clearControls);report.viewports.push(metrics);
      const hits=await page.evaluate(()=>{
        const s=Game.getState();let hits=0;
        s.arrows.forEach((a,i)=>{Render.focusPiece(i);const v=Render.getView(),h=a.cells[a.cells.length-1];const p=Render.screenToCell((h.x+.5)*v.cell*v.zoom+v.x,(h.y+.5)*v.cell*v.zoom+v.y);if(p && s.occ[p.y*s.cols+p.x]===i)hits++;});Render.resetView();return hits;
      });assert.equal(hits,metrics.arrows);
      if(width===393 && [77,1000].includes(n)){
        await frame();await page.evaluate(()=>document.querySelector('#level-banner').classList.remove('show'));await shot(`level-${n}-fit`);
        await page.locator('#btn-zoom-in').click();await frame();await shot(`level-${n}-zoom`);
        assert(await page.evaluate(()=>Render.getView().cell*Render.getView().zoom>=43.99));
        await page.locator('#btn-zoom-out').click();await page.locator('#btn-board-fit').click();assert.equal(await page.evaluate(()=>Render.getView().zoom),1);
      }
    }
  }
  report.checks.push('16 level/viewport combinations: complete Fit, no overlap/overflow, every arrow reachable after focus, Fit/+/- controls');
  await page.setViewportSize({width:393,height:873});
  await page.evaluate(()=>{UI.closeAll();Game.loadLevel(77);Game.hint();});await frame();
  const head=await page.evaluate(()=>{const s=Game.getState(),h=s.arrows[s.hintIdx].cells.at(-1),v=Render.getView(),r=document.querySelector('#board').getBoundingClientRect();return {x:r.left+(h.x+.5)*v.cell*v.zoom+v.x,y:r.top+(h.y+.5)*v.cell*v.zoom+v.y};});
  if(engine==='chromium')await page.mouse.click(head.x,head.y);else await page.touchscreen.tap(head.x,head.y);
  assert.equal(await page.evaluate(()=>Game.getState().undoIds.length),1);
  await page.waitForFunction(()=>Game.getState().flying.length===0);
  await page.locator('#btn-undo').click();assert.equal(await page.evaluate(()=>Game.getState().undoIds.length),0);
  report.checks.push(engine==='chromium'?'native mouse selects focused arrow, Undo restores':'native touch selects focused arrow, Undo restores');
  await page.waitForFunction(()=>window.__qaAudio.some(c=>c.state==='running'));
  await page.locator('#btn-menu').click();assert(await page.evaluate(()=>window.__qaTones>0));
  await page.evaluate(()=>UI.closeAll());
  report.checks.push('Web Audio context running after user interaction and oscillator playback scheduled (audible output not assessed)');
  // Sample all 5 board surfaces and all 17 arrows using actual production rendering.
  await page.evaluate(()=>{const s=Storage.getSave();s.owned={default:true};s.ownedBoards={default:true};Storage.updateSave({coins:0,skin:'default',boardSkin:'default'});UI.buildShopGrid();UI.openDlg('dlg-shop');});
  for(const category of ['boards','arrows']){
    await page.locator('#shop-tab-'+category).click();
    const ids=await page.evaluate(category=>Object.keys(GameCore.COSMETICS[category]),category);
    for(const id of ids){
      await page.locator(`[data-skin="${id}"] button`).first().click();
      assert((await page.locator('#shop-preview-label').textContent()).startsWith('Previewing:'));
    }
    await page.locator('#dlg-shop .card').evaluate(el=>{el.scrollTop=0;});
    await shot(`shop-${category}`);
  }
  const unique=await page.evaluate(()=>{
    const canvas=document.createElement('canvas');canvas.width=360;canvas.height=192;
    return new Set(['default','ice','ember','lightning','cyber','royal'].map(id=>{Render.drawPreview(canvas,GameCore.SKINS[id]);return canvas.toDataURL();})).size;
  });assert.equal(unique,6);
  assert.equal(await page.evaluate(()=>Storage.getSave().coins),0);
  assert.equal(await page.evaluate(()=>Storage.getSave().skin),'default');
  await page.locator('[data-skin="lightning"] button').last().click();
  assert((await page.locator('#toast').textContent()).includes('Not enough coins'));
  await page.evaluate(()=>{Storage.addCoins(10000);UI.buildShopGrid();});
  const price=await page.evaluate(()=>GameCore.SKINS.ice.price);
  await page.evaluate(()=>{const b=document.querySelector('[data-skin="ice"] button:last-child');b.click();b.click();});
  assert.equal(await page.evaluate(()=>Storage.getSave().coins),10000-price);
  await page.locator('#shop-tab-boards').click();await page.locator('[data-skin="galaxy"] button').last().click();
  const before=await page.evaluate(()=>({coins:Storage.getSave().coins,skin:Storage.getSave().skin,boardSkin:Storage.getSave().boardSkin}));
  assert.equal(before.skin,'ice');assert.equal(before.boardSkin,'galaxy');
  await page.evaluate(()=>{UI.closeAll();Game.loadLevel(500);window.dispatchEvent(new Event('pagehide'));});
  await page.reload();await ready();
  assert.deepEqual(await page.evaluate(()=>({coins:Storage.getSave().coins,skin:Storage.getSave().skin,boardSkin:Storage.getSave().boardSkin})),before);
  await page.evaluate(()=>UI.closeAll());
  await page.locator('#btn-continue').click();
  assert.equal(await page.evaluate(()=>Game.getState().level),500);
  await page.evaluate(()=>{Game.hint();const s=Game.getState();Game.tapArrow(s.hintIdx);});
  await page.waitForFunction(()=>Game.getState().flying.length===0);
  await page.locator('#btn-undo').click();
  await page.locator('#btn-restart').click();
  await page.evaluate(()=>Game.loadLevel(501));
  assert.equal(await page.evaluate(()=>Storage.getSave().skin),'ice');assert.equal(await page.evaluate(()=>Storage.getSave().boardSkin),'galaxy');
  report.checks.push('all 22 previews; six distinct arrow renders; preview does not equip/spend; insufficient coins; duplicate buy; persistence through reload/Continue/Undo/restart/next level');
  await page.evaluate(()=>Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(Error('Service worker ready timed out')),10000))]));
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
  const snapshot=await page.evaluate(()=>JSON.stringify(Storage.getSave().cur));
  await context.setOffline(true);await page.reload();await ready();
  assert.equal(await page.evaluate(()=>JSON.stringify(Storage.getSave().cur)),snapshot);
  assert(await page.evaluate(()=>Promise.all(['js/render.js','css/styles.css','manifest.webmanifest'].map(p=>fetch(p).then(r=>r.ok))).then(rs=>rs.every(Boolean))));
  await page.evaluate(()=>{UI.closeAll();Game.loadDailyChallenge();});assert.equal(await page.evaluate(()=>Game.getState().level),'daily');
  await context.setOffline(false);report.checks.push('worker-controlled offline reload, saved puzzle preserved, renderer/CSS/manifest cached, daily playable offline');
  assert.deepEqual(report.errors,[]);report.passed=true;
})().catch(e=>{report.passed=false;report.error=e.stack;process.exitCode=1;}).finally(async()=>{
  if(context)await context.setOffline(false).catch(()=>{});
  if(page && savedProfile!==undefined)await page.evaluate(value=>{if(value===null)localStorage.removeItem('arrowOut.v2');else localStorage.setItem('arrowOut.v2',value);},savedProfile).catch(()=>{});
  fs.writeFileSync(path.join(output,`${engine}-upgrade.json`),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
  if(browser)await browser.close();
});
