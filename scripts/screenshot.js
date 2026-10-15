#!/usr/bin/env node
/**
 * Arrow Out! - Screenshot generator + mobile regression checks (puppeteer)
 * Renders docs/screenshot-home.png and docs/screenshot-board.png
 * from the real game served over localhost (SW needs http://).
 * Also audits 320/360/390/430px viewports for:
 *   - horizontal overflow
 *   - literal "\uXXXX" escape text or mojibake in rendered text
 *   - broken/too-small menu buttons, non-scrollable menus
 *   - console errors / uncaught page errors
 */
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const net = require('net');
const path = require('path');
const puppeteer = require('puppeteer');

const PORT = 8080;
const ROOT = path.join(__dirname, '..');
const DOC = path.join(ROOT, 'docs');
const VIEWPORTS = [320, 360, 390, 430];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function canConnect() {
  return new Promise(res => {
    const s = net.connect({ port: PORT, host: '127.0.0.1' }, () => { s.destroy(); res(true); });
    s.on('error', () => res(false));
  });
}

async function waitForServer(tries) {
  for (let i = 0; i < tries; i++) {
    if (await canConnect()) return;
    await sleep(500);
  }
  throw new Error('http-server did not start on port ' + PORT);
}

// Audit the currently rendered page at the active viewport.
async function auditPage(page, label) {
  const r = await page.evaluate(() => {
    const doc = document.scrollingElement || document.documentElement;
    const overflowX = doc.scrollWidth - window.innerWidth;
    const text = (document.body && document.body.innerText) || '';
    const badText = text.indexOf('\\u') !== -1 ||
      text.indexOf('\u00c3') !== -1 ||   // A-tilde: mojibake marker
      text.indexOf('\u00c2') !== -1 ||   // A-circumflex: mojibake marker
      text.indexOf('\u00f0') !== -1 ||   // eth: broken 4-byte emoji marker
      text.indexOf('\ufffd') !== -1;      // replacement char
    // Every visible dialog menu must have usable buttons
    const dlg = document.getElementById('dlg-home');
    let btnOk = true;
    let btnCount = 0;
    if (dlg && dlg.classList.contains('show')) {
      const btns = dlg.querySelectorAll('.btn');
      btnCount = btns.length;
      for (let i = 0; i < btns.length; i++) {
        const b = btns[i];
        const cs = getComputedStyle(b);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        const rect = b.getBoundingClientRect();
        if (rect.width < 40 || rect.height < 40) { btnOk = false; }
      }
      if (btnCount < 5) { btnOk = false; }
    }
    // Menu must scroll when its content is taller than the viewport
    let menuScrollable = true;
    if (dlg && dlg.classList.contains('show')) {
      const cs = getComputedStyle(dlg);
      menuScrollable = cs.overflowY === 'auto' || cs.overflowY === 'scroll' ||
        dlg.scrollHeight <= window.innerHeight + 1;
    }
    return { overflowX, badText, btnOk, btnCount, menuScrollable };
  });
  const problems = [];
  if (r.overflowX > 1) problems.push('horizontal overflow: ' + r.overflowX + 'px');
  if (r.badText) problems.push('rendered text contains \\u escapes or mojibake');
  if (!r.btnOk) problems.push('menu buttons broken (' + r.btnCount + ' found)');
  if (!r.menuScrollable) problems.push('menu not scrollable');
  if (problems.length) {
    throw new Error('[' + label + '] ' + problems.join('; '));
  }
  console.log('[OK] ' + label + ': no overflow, text clean, buttons ok');
}


// --- PWA / service worker / offline regression tests ---
async function runPwaTests(page) {
  // 1. Update-flow UI hooks must exist and expose the current version
  const uiHooks = await page.evaluate(() => ({
    hasBanner: !!document.getElementById('update-banner'),
    hasReloadBtn: !!document.getElementById('btn-update-reload'),
    hasVersionRow: !!document.getElementById('st-version'),
    pwaApi: typeof window.PWA === 'object',
    version: window.PWA ? window.PWA.VERSION : null,
    checkForUpdates: window.PWA ? typeof window.PWA.checkForUpdates : 'missing'
  }));
  if (!uiHooks.hasBanner || !uiHooks.hasReloadBtn || !uiHooks.hasVersionRow ||
      !uiHooks.pwaApi || uiHooks.checkForUpdates !== 'function' || !uiHooks.version) {
    throw new Error('PWA update flow incomplete: ' + JSON.stringify(uiHooks));
  }
  console.log('[OK] PWA v' + uiHooks.version + ': update banner + version row + checkForUpdates present');

  // 2. Manifest must be a real same-origin file with the fields Android needs
  const manifest = await page.evaluate(async () => {
    const link = document.querySelector('link[rel="manifest"]');
    if (!link) throw new Error('no manifest link');
    const res = await fetch(link.href);
    if (!res.ok) throw new Error('manifest fetch failed: ' + res.status);
    return res.json();
  });
  if (!manifest.name || manifest.display !== 'standalone' || !Array.isArray(manifest.icons)) {
    throw new Error('manifest missing required fields: ' + JSON.stringify(manifest).slice(0, 200));
  }
  const sizes = manifest.icons.map(i => i.sizes).join(' ');
  if (!sizes.includes('192') || !sizes.includes('512')) {
    throw new Error('manifest icons must include 192 and 512: ' + sizes);
  }
  console.log('[OK] manifest valid: ' + manifest.name + ', display=' + manifest.display + ', icons=' + sizes);

  // 3. Service worker must register, activate and control the page
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, { timeout: 15000 });
  const swInfo = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    const keys = await caches.keys();
    return {
      script: reg && reg.active ? reg.active.scriptURL : null,
      caches: keys
    };
  });
  if (!swInfo.script || !swInfo.script.endsWith('sw.js')) {
    throw new Error('service worker not active: ' + swInfo.script);
  }
  const own = swInfo.caches.filter(k => k.startsWith('arrow-out-'));
  const foreign = swInfo.caches.filter(k => !k.startsWith('arrow-out-'));
  if (own.length < 1) throw new Error('no arrow-out-* cache found');
  if (foreign.length > 0) throw new Error('unexpected non-game caches: ' + foreign.join(','));
  console.log('[OK] service worker active, game caches: ' + own.join(', '));

  // 4. Cache cleanup must be SCOPED: caches of other apps on this origin
  //    must survive an Arrow Out! service worker (re)install.
  await page.evaluate(async () => {
    const c = await caches.open('foreign-test-app-v1');
    await c.put('/', new Response('foreign'));
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) await reg.unregister();
  });
  await sleep(300);
  await page.reload({ waitUntil: 'load', timeout: 30000 });
  await page.waitForSelector('#dlg-home.show', { timeout: 15000 });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, { timeout: 15000 });
  const scoped = await page.evaluate(async () => {
    const survived = await caches.has('foreign-test-app-v1');
    const keys = await caches.keys();
    await caches.delete('foreign-test-app-v1');
    return { survived, keys };
  });
  if (!scoped.survived) {
    throw new Error('service worker deleted a foreign cache (cleanup must be scoped to arrow-out-*): ' + scoped.keys.join(', '));
  }
  console.log('[OK] cache cleanup is scoped: foreign cache survived Arrow Out! (re)install');

  // 5. Offline: reload with the network cut off - the game must still boot
  await page.setOfflineMode(true);
  try {
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#dlg-home.show', { timeout: 15000 });
    const offlineOk = await page.evaluate(() => ({
      online: navigator.onLine,
      title: document.title,
      hud: !!document.getElementById('hud')
    }));
    if (offlineOk.online !== false || !offlineOk.hud || offlineOk.title.indexOf('Arrow Out') === -1) {
      throw new Error('offline boot looks broken: ' + JSON.stringify(offlineOk));
    }
    console.log('[OK] offline: game boots fully from the service worker cache');
  } finally {
    await page.setOfflineMode(false);
  }
}
async function main() {
  fs.mkdirSync(DOC, { recursive: true });
  const server = spawn('npx', ['http-server', '.', '-p', String(PORT), '--silent'],
    { cwd: ROOT, stdio: 'ignore' });
  let browser = null;
  const pageErrors = [];
  try {
    await waitForServer(60);
    browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    page.on('pageerror', e => pageErrors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') pageErrors.push('console: ' + m.text()); });

    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.goto('http://127.0.0.1:' + PORT + '/', { waitUntil: 'load', timeout: 30000 });
    await page.waitForSelector('#dlg-home.show', { timeout: 15000 });

    // Claim the daily login reward if it auto-opened on top of the home screen
    const rewardDlg = await page.$('#dlg-reward.show');
    if (rewardDlg) {
      const claimBtn = await page.$('#btn-reward-claim');
      if (claimBtn) {
        await claimBtn.click();
        await sleep(600);
      }
    }

    // Dismiss the install banner if headless Chrome fired beforeinstallprompt
    const banner = await page.$('#install-banner');
    if (banner) {
      const visible = await banner.evaluate(el => el.offsetHeight > 0 &&
        getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden');
      if (visible) {
        const close = await page.$('#btn-banner-close');
        if (close) await close.click();
        else await banner.evaluate(el => { el.style.display = 'none'; });
      }
    }
    await sleep(500);

    // Mobile viewport audit at 320 / 360 / 390 / 430 px
    for (const w of VIEWPORTS) {
      await page.setViewport({ width: w, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      await sleep(300);
      await auditPage(page, w + 'px home');
    }

    // Back to 390 for the screenshots
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await sleep(300);
    await page.screenshot({ path: path.join(DOC, 'screenshot-home.png') });
    console.log('wrote docs/screenshot-home.png');

    // Continue into the game board
    await page.click('#btn-continue');
    await page.waitForFunction(() => {
      const d = document.getElementById('dlg-home');
      return !d || !d.classList.contains('show');
    }, { timeout: 15000 });
    // Let the level intro banner finish its animation
    await sleep(1800);
    await auditPage(page, 'board');
    await page.screenshot({ path: path.join(DOC, 'screenshot-board.png') });
    console.log('wrote docs/screenshot-board.png');
    await runPwaTests(page);

    if (pageErrors.length) {
      throw new Error('console/page errors detected:\n  ' + pageErrors.join('\n  '));
    }
    console.log('[OK] no console errors');
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.kill('SIGTERM');
  }
}

main().catch(err => { console.error(err); process.exit(1); });
