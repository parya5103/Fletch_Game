#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {execFileSync}=require('node:child_process'),{chromium}=require('playwright');
const output=process.argv[2];assert(output);fs.mkdirSync(output,{recursive:true});
let browser,cdp;const report={cpuThrottle:4,checks:[]};
(async()=>{
  browser=await chromium.connectOverCDP(execFileSync('coderabbit-agent-browser',['get','cdp-url'],{encoding:'utf8'}).trim());
  const context=browser.contexts()[0],page=context.pages().find(p=>p.url().startsWith('http://localhost:8000/'));assert(page);
  await page.setViewportSize({width:393,height:873});
  cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  await page.evaluate(()=>{UI.closeAll();Game.loadLevel(1000);Render.fitCanvas();});
  const original=await page.evaluate(()=>JSON.stringify(Game.getState().arrows));
  for(const id of ['default','ice','ember','lightning','cyber','royal']){
    const result=await page.evaluate(async id=>{
      Render.setSkin(GameCore.SKINS[id]);Render.focusPiece(300);
      const times=[],raf=requestAnimationFrame;
      window.requestAnimationFrame=fn=>raf.call(window,t=>{const begin=performance.now();try{fn(t);}finally{if(fn.name==='frame')times.push(performance.now()-begin);}});
      try{for(const board of Object.keys(GameCore.COSMETICS.boards)){
        Render.setBoardSkin(board);
        for(let i=0;i<8;i++){Render.pan(i%2?12:-12,0);await new Promise(r=>requestAnimationFrame(r));}
      }}finally{window.requestAnimationFrame=raf;}
      times.sort((a,b)=>a-b);return {id,samples:times.length,p95:times[Math.floor(times.length*.95)],max:times.at(-1)};
    },id);
    assert(result.samples>=35);assert(result.p95<33,`${id}: ${result.p95}ms`);report.checks.push(result);
    assert.equal(await page.evaluate(()=>JSON.stringify(Game.getState().arrows)),original);
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  const motion=await page.evaluate(()=>{const s=Game.getState();s.particles=[];Render.spawnConfetti();Render.spawnBurst(0,s);return s.particles.length;});assert.equal(motion,0);
  await page.emulateMedia({reducedMotion:'no-preference'});
  report.checks.push('all 30 board/featured-arrow combinations leave puzzle geometry unchanged; reduced motion suppresses particles');
  await page.evaluate(()=>{Game.loadLevel(77);Render.setSkin(GameCore.SKINS.ice);Render.setBoardSkin('galaxy');Render.focusPiece(30);document.querySelector('#level-banner').classList.remove('show');});
  await page.screenshot({path:path.join(output,'chromium-premium-level77.png')});report.passed=true;
})().catch(e=>{report.passed=false;report.error=e.stack;process.exitCode=1;}).finally(async()=>{
  if(cdp)await cdp.send('Emulation.setCPUThrottlingRate',{rate:1}).catch(()=>{});
  fs.writeFileSync(path.join(output,'skin-performance.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));if(browser)await browser.close();
});
