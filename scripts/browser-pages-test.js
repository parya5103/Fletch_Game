#!/usr/bin/env node
// QA-only Playwright attaches to the existing shared Preview Chromium.
// All GitHub requests are fulfilled locally; this test never submits an issue.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const root = path.resolve(__dirname,'..');
const out = process.argv[2];
assert(out, 'Usage: NODE_PATH=<QA node_modules> node scripts/browser-pages-test.js <output-dir>');
fs.mkdirSync(out,{recursive:true});
const report = { checks: [], errors: [], intercepted: [] };
let browser, page, server, cdp;
(async () => {
  server = http.createServer((req,res) => {
    const file = new URL(req.url,'http://localhost').pathname.slice(1) || 'index.html';
    if (file.split('/').includes('..')) { res.writeHead(404).end(); return; }
    try {
      const type = {'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'}[path.extname(file)] || 'application/octet-stream';
      const data = fs.readFileSync(path.join(root,file));
      res.writeHead(200, {'Content-Type':type,'Cache-Control':'no-store'}).end(data);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(r => server.listen(0,'0.0.0.0',r));
  const origin = `http://localhost:${server.address().port}/`;
  browser = await chromium.connectOverCDP(execFileSync('coderabbit-agent-browser',['get','cdp-url'],{encoding:'utf8'}).trim());
  const context = browser.contexts()[0]; page = await context.newPage();
  page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(15000);
  page.on('pageerror', e=>report.errors.push(e.message));
  const popups=[];page.on('popup', p=>popups.push(p));
  await page.route('https://github.com/**', async route => {
    const req = route.request(), url = new URL(req.url());
    report.intercepted.push({ method:req.method(), pathname:url.pathname, title:url.searchParams.get('title'),body:url.searchParams.get('body'),referer:req.headers().referer || null });
    await route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Local GitHub navigation stub</title><h1>Intercepted locally; no request sent to GitHub</h1>'});
  });
  for (const width of [320,390,1280]) {
    await page.setViewportSize({width,height:width===1280?900:844});
    for (const file of ['about.html','contact.html','privacy.html']) {
      await page.goto(origin+file);
      assert.equal(await page.locator('main').count(),1);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth), `${file} width${width}`);
      assert.equal(await page.locator('a[href="index.html"]').count(),1);
    }
  }
  report.checks.push('About/Contact/Privacy: main landmark, game return links, no horizontal overflow at 320/390/1280px');
  await page.setViewportSize({width:390,height:844});
  await page.goto(origin+'contact.html');
  assert.equal(await page.locator('input').count(),1);
  await page.locator('button[type=submit]').click();
  assert.equal(await page.evaluate(()=>document.activeElement.id),'f-subject');
  for(const id of ['subject','message']) {
    assert.equal(await page.locator('#f-'+id).getAttribute('aria-invalid'),'true');
    const described = await page.locator('#f-'+id).getAttribute('aria-describedby');
    assert(await page.locator('#'+described).isVisible());
  }
  await page.locator('#f-subject').fill('  ');await page.locator('#f-message').fill('\n ');
  await page.locator('button[type=submit]').click();
  assert.equal(await page.evaluate(()=>document.activeElement.id),'f-subject');
  assert.equal(report.intercepted.length,0);
  report.checks.push('empty/whitespace validation focuses Subject; both errors visible and associated with aria-invalid; no outbound navigation');
  const title='A & B? #100% + 🏹', body='<script>alert("x")</script>\n日本語 & body=other #';
  await page.locator('#f-subject').fill(title);await page.locator('#f-message').fill(body);
  await page.locator('#f-message').press('Tab');
  assert.equal(await page.evaluate(()=>document.activeElement.tagName),'BUTTON');
  await page.keyboard.press('Enter');
  assert.match(await page.locator('#form-status').textContent(),/Nothing has been sent/);
  assert.equal(await page.locator('#f-subject').getAttribute('aria-invalid'),null);
  assert.equal(report.intercepted.length,0);assert.equal(popups.length,0);
  const link=new URL(await page.locator('#fallback-link').getAttribute('href'));
  assert.equal(link.searchParams.get('title'),'[Contact] '+title);assert.equal(link.searchParams.get('body'),body);
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:path.join(out,'contact-mobile-warning.png')});
  await page.locator('#fallback-link').scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(out,'contact-mobile-draft.png')});
  fs.writeFileSync(path.join(out,'contact-accessibility.txt'),await page.locator('main').ariaSnapshot());
  await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'fallback-link');
  assert.equal(await page.locator('#fallback-link').evaluate(e=>getComputedStyle(e).outlineStyle),'solid');
  await page.keyboard.press('Enter');await page.waitForURL('https://github.com/**');
  assert.equal(popups.length,0);assert.equal(report.intercepted.length,1);assert.equal(report.intercepted[0].referer,null);
  assert.equal(report.intercepted[0].method,'GET');
  report.checks.push('keyboard-only prepare/open: Unicode and delimiters preserved; local draft makes no request; explicit same-tab GET intercepted before network; no popup/opener/referrer');
  await page.goto(origin+'contact.html');
  await page.locator('#f-subject').fill('subject');await page.locator('#f-message').fill('message');
  await page.locator('button[type=submit]').click();await page.locator('#f-message').fill('changed');
  assert.equal(await page.locator('#fallback').isVisible(),false);
  await page.locator('#f-message').fill('🏹'.repeat(650));await page.locator('button[type=submit]').click();
  assert.equal(await page.evaluate(()=>document.activeElement.id),'f-message');
  assert.match(await page.locator('#ferr-message').textContent(),/too long/);
  assert.equal(await page.locator('#fallback').isVisible(),false);
  report.checks.push('editing invalidates stale link; large encoded Unicode URL rejected with focused visible Message error');
  cdp=await context.newCDPSession(page);
  await cdp.send('Emulation.setScriptExecutionDisabled',{value:true});
  await page.goto(origin+'contact.html');
  assert.match(await page.locator('noscript').textContent(),/URL immediately/);
  assert.equal(await page.locator('#contact-form').getAttribute('novalidate'),null);
  await page.locator('button[type=submit]').click();
  assert.equal(page.url(),origin+'contact.html');assert.equal(report.intercepted.length,1);
  await page.locator('#f-subject').fill(title);await page.locator('#f-message').fill(body);
  await page.locator('button[type=submit]').click();await page.waitForURL('https://github.com/**');
  assert.equal(report.intercepted.length,2);assert.equal(report.intercepted[1].method,'GET');
  assert.equal(report.intercepted[1].title,title);assert.equal(report.intercepted[1].body,body.replace(/\n/g,'\r\n'));
  assert.equal(report.intercepted[1].referer,null);assert.equal(popups.length,0);
  await cdp.send('Emulation.setScriptExecutionDisabled',{value:false});await cdp.detach();cdp=null;
  report.checks.push('actual scripts-disabled browser: native required fields block empty submit; valid same-tab title/body GET intercepted locally with exact Unicode/delimiter content and no referrer');
  for (const section of ['.site-links','#dlg-settings']) {
    for (const file of ['about.html','contact.html','privacy.html']) {
      await page.goto(origin);await page.waitForFunction(()=>typeof Game!=='undefined'&&Game.getState());
      await page.evaluate(()=>{UI.closeAll();UI.showHomeScreen();});
      if(section==='#dlg-settings') await page.locator('#btn-settings').click();
      const a=page.locator(section+` a[href="${file}"]`);
      assert(await a.isVisible());await a.click();await page.waitForURL(origin+file);
      assert.equal(await page.locator('h1').count(),1);
      await page.locator('a[href="index.html"]').click();await page.waitForURL(origin+'index.html');
    }
  }
  report.checks.push('all six visible Home/Settings links navigate to the correct page; public return links navigate to game');
  assert.deepEqual(report.errors,[]);report.passed=true;
})().catch(e=>{report.passed=false;report.error=e.stack;process.exitCode=1;}).finally(async()=>{
  fs.writeFileSync(path.join(out,'pages-browser.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
  if(cdp){await cdp.send('Emulation.setScriptExecutionDisabled',{value:false}).catch(()=>{});await cdp.detach().catch(()=>{});}
  if(page)await page.close().catch(()=>{});if(browser)await browser.close();if(server)server.close();
});
