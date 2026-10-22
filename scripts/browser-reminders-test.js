#!/usr/bin/env node
'use strict';
// Shared Preview Chromium only. Synthetic local origin/data; no remote push/provider writes.
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const {execFileSync}=require('node:child_process'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=process.argv[2];assert(out);fs.mkdirSync(out,{recursive:true});
const report={checks:[],errors:[],externalRequests:[]};let browser,page,server,cdp,origin;
(async()=>{
  server=http.createServer((req,res)=>{
    const pathname=new URL(req.url,'http://localhost').pathname;
    const file=pathname.replace(/^\/Fletch_Game\//,'')||'index.html';
    if(!pathname.startsWith('/Fletch_Game/')||file.split('/').includes('..')){res.writeHead(404).end();return;}
    try{
      const data=fs.readFileSync(path.join(root,file));
      const type={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'}[path.extname(file)]||'application/octet-stream';
      res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'}).end(data);
    }catch{res.writeHead(404).end();}
  });
  await new Promise(r=>server.listen(0,'0.0.0.0',r));
  origin=`http://localhost:${server.address().port}`;const url=origin+'/Fletch_Game/index.html';
  browser=await chromium.connectOverCDP(execFileSync('coderabbit-agent-browser',['get','cdp-url'],{encoding:'utf8'}).trim());
  const context=browser.contexts()[0];page=await context.newPage();cdp=await context.newCDPSession(page);
  page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(15000);
  page.on('pageerror',e=>report.errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).origin!==origin)report.externalRequests.push(r.url());});
  await cdp.send('Browser.setPermission',{permission:{name:'notifications'},setting:'prompt',origin});
  await page.addInitScript(()=>{
    window.__qaNow=Number(sessionStorage.getItem('__qaReminderClock'))||Date.now();Date.now=()=>window.__qaNow;
    const original=ServiceWorkerRegistration.prototype.showNotification;
    window.__qaShows=0;
    ServiceWorkerRegistration.prototype.showNotification=function(...args){window.__qaShows++;return original.apply(this,args);};
  });
  await page.goto(url);await page.waitForFunction(()=>typeof Game!=='undefined'&&Game.getState()&&navigator.serviceWorker.controller);
  await page.evaluate(()=>{UI.closeAll();Storage.updateSave({unlocked:701,coins:12345,skin:'royal',owned:{royal:true},settings:{seenOnboarding:true}});Game.loadLevel(500);window.dispatchEvent(new Event('pagehide'));UI.showHomeScreen();});
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('arrowOut.v2')));
  const open=async()=>{await page.evaluate(()=>{UI.closeAll();UI.showHomeScreen();});await page.locator('#btn-settings').click();await page.locator('#btn-reminders').click();};
  for(const width of [320,390,1280]){
    await page.setViewportSize({width,height:width===1280?900:844});await open();
    assert(await page.locator('#dlg-reminders').isVisible());
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    const labels=await page.locator('#dlg-reminders input').evaluateAll(items=>items.every(e=>document.querySelector(`label[for="${e.id}"]`)));
    assert(labels);assert(await page.locator('#dlg-reminders .row').evaluateAll(rows=>rows.every(r=>r.getBoundingClientRect().height>=44)));
    await page.locator('#reminder-minutes').scrollIntoViewIfNeeded();
    await page.locator('#chk-notifs').check();await page.locator('#reminder-minutes').selectOption('90');
  }
  report.checks.push('real Home→Settings→reminder screen; labels, 44px rows and scrollable controls at320/390/1280px; preferences saved without enabling system permission');
  assert.equal(await page.evaluate(()=>Notification.permission),'default');
  // A dismissed permission prompt is simulated; native prompt/device UX is not certified.
  await page.evaluate(()=>{window.__qaPrompts=0;Notification.requestPermission=()=>{window.__qaPrompts++;return Promise.resolve('default');};});
  await page.locator('#btn-notif-permission').click();assert.equal(await page.evaluate(()=>window.__qaPrompts),1);
  await page.locator('#btn-notif-permission').click();assert.equal(await page.evaluate(()=>window.__qaPrompts),2);
  assert.equal(await page.locator('#btn-notif-permission').isDisabled(),false);assert.match(await page.locator('#reminder-permission').textContent(),/ask again/);
  await cdp.send('Browser.setPermission',{permission:{name:'notifications'},setting:'denied',origin});
  await page.evaluate(()=>Reminders.refreshUI());assert(await page.locator('#chk-system-notifs').isDisabled());
  assert.match(await page.locator('#reminder-status').textContent(),/blocked/);
  report.checks.push('real browser default/denied states; simulated dismissal can be asked again by the same explicit button; denied retains in-game fallback');
  await cdp.send('Browser.setPermission',{permission:{name:'notifications'},setting:'granted',origin});
  await page.evaluate(()=>Reminders.refreshUI());await page.locator('#chk-system-notifs').check();
  await page.setViewportSize({width:390,height:844});await page.locator('#reminder-status').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(out,'reminders-mobile-settings.png')});
  await page.locator('#btn-notif-test').click();
  await page.waitForFunction(()=>document.querySelector('#reminder-test-status').textContent.includes('handed'));
  const notifications=()=>page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();return (await r.getNotifications({tag:'arrow-out-local'})).length;});
  assert.equal(await notifications(),1);assert.equal(await page.evaluate(()=>window.__qaShows),1);
  await page.evaluate(()=>document.querySelector('#reminder-test-status').textContent='');
  await page.locator('#btn-notif-test').click();
  await page.waitForFunction(()=>document.querySelector('#reminder-test-status').textContent.startsWith('No notification sent'));
  assert.equal(await page.evaluate(()=>window.__qaShows),1);
  report.checks.push('CDP-granted permission: actual native worker showNotification resolves and getNotifications contains1; repeated test rate-limited; OS display not assessed');
  assert.equal(await page.evaluate(()=>{UI.closeAll();window.__qaNow+=90*60000;return Reminders.check();}),true);
  assert(await page.locator('#reminder-banner').isVisible());assert.equal(await page.evaluate(()=>window.__qaShows),1);
  await page.screenshot({path:path.join(out,'reminder-in-game.png')});
  await page.locator('#btn-reminder-dismiss').click();assert.equal(await page.locator('#reminder-banner').isVisible(),false);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});window.__qaNow+=90*60000;return Reminders.check();});
  assert.equal(await page.evaluate(()=>window.__qaShows),2);await page.evaluate(()=>Reminders.check());
  assert.equal(await page.evaluate(()=>window.__qaShows),2);assert.equal(await notifications(),1);
  report.checks.push('clock-advanced90-minute inactivity shows in-game banner without a system request; simulated hidden state hands one native system request, deduplicated on repeat');
  const pagesBefore=context.pages().length;
  const worker=context.serviceWorkers().find(w=>w.url()===origin+'/Fletch_Game/sw.js');assert(worker);
  // Dispatch the actual worker click listener with a browser-created notification.
  // waitUntil is captured because this synthetic event is not a trusted OS event.
  await worker.evaluate(async()=>{
    const notes=await self.registration.getNotifications({tag:'arrow-out-local'});if(!notes.length)throw Error('missing note');
    const event=new NotificationEvent('notificationclick',{notification:notes[0]});let pending;
    Object.defineProperty(event,'waitUntil',{value:p=>{pending=p;}});self.dispatchEvent(event);await pending;
  });
  assert.equal(context.pages().length,pagesBefore);assert.equal(page.url(),url);
  assert.equal(await page.evaluate(()=>Game.getState().level),500);
  report.checks.push('synthetic click dispatch executes actual worker handler: existing index.html puzzle focused, no new tab/navigation or reset; not a physical OS click');
  await page.evaluate(()=>{delete document.hidden;Reminders.setEnabled(false);});
  await page.waitForFunction(async()=>{const reg=await navigator.serviceWorker.getRegistration();return (await reg.getNotifications({tag:'arrow-out-local'})).length===0;});
  const shown=await page.evaluate(()=>window.__qaShows);await page.evaluate(()=>{window.__qaNow+=120*60000;return Reminders.check();});
  assert.equal(await page.evaluate(()=>window.__qaShows),shown);assert.equal(await page.locator('#reminder-banner').isVisible(),false);
  await page.evaluate(()=>sessionStorage.setItem('__qaReminderClock',String(window.__qaNow)));
  await page.reload();await page.waitForFunction(()=>typeof Game!=='undefined'&&Game.getState());
  const after=await page.evaluate(()=>Storage.getSave());
  for(const key of ['coins','unlocked','skin','owned','boardSkin','ownedBoards','best','cur','daily','stats'])assert.deepEqual(after[key],before[key],key);
  assert.equal(after.settings.notifications,false);assert.equal(after.settings.reminderMinutes,90);assert.equal(after.settings.seenOnboarding,true);
  report.checks.push('Off closes local notifications and stops overdue requests; reload preserves coins/unlocks/purchases/exact level500 snapshot and reminder preferences');
  await page.addInitScript(()=>{window.Notification=undefined;});await page.reload();await page.waitForFunction(()=>typeof Reminders!=='undefined');
  await page.evaluate(()=>{Reminders.setEnabled(true);window.__qaNow+=90*60000;return Reminders.check();});
  assert(await page.locator('#reminder-banner').isVisible());assert.match(await page.evaluate(()=>Reminders.status()),/unavailable/);
  report.checks.push('missing Notification API: app still starts and clock-advanced in-game fallback works');
  assert.deepEqual(report.externalRequests,[]);assert.deepEqual(report.errors,[]);report.passed=true;
})().catch(e=>{report.passed=false;report.error=e.stack;process.exitCode=1;}).finally(async()=>{
  fs.writeFileSync(path.join(out,'reminders-browser.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
  if(cdp&&origin)await cdp.send('Browser.setPermission',{permission:{name:'notifications'},setting:'prompt',origin}).catch(()=>{});
  if(cdp)await cdp.detach().catch(()=>{});if(page)await page.close().catch(()=>{});if(browser)await browser.close();if(server)server.close();
});
