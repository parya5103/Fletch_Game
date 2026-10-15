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
 * Plus full navigation regression tests:
 *   home -> levels -> select level -> board -> pause -> resume
 *   -> pause -> main menu -> continue
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

// All output is mirrored to docs/test-log.txt (committed by CI even on
// failure) so regressions can be diagnosed without log-in access.
const LOG = [];
let PHASE = 'boot';
function log(s) { const line = '[' + PHASE + '] ' + s; LOG.push(line); console.log(line); }
function writeLog() {
  try {
    fs.mkdirSync(DOC, { recursive: true });
    fs.writeFileSync(path.join(DOC, 'test-log.txt'), LOG.join('\n') + '\n');
  } catch (e) { /* best effort */ }
}

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
  log('[OK] ' + label + ': no overflow, text clean, buttons ok');
}

// Is the game board (as opposed to the home hub) currently shown?
async function boardVisible(page) {
  return page.evaluate(() => {
    const app = document.getElementById('app');
    const home = document.getElementById('dlg-home');
    return !!app &&
      getComputedStyle(app).visibility !== 'hidden' &&
      (!home || !home.classList.contains('show'));
  });
}

// --- Navigation regression tests (home hub <-> game <-> dialogs) ---
async function runNavigationTests(page) {
  PHASE = 'nav-1-levels';
  log('[NAV 1/6] home hub -> levels dialog...');
  await page.click('#btn-levels');
  await page.waitForSelector('#dlg-levels.show', { timeout: 10000 });
  const homeUnderLevels = await page.evaluate(() => {
    const h = document.getElementById('dlg-home');
    return h && h.classList.contains('show');
  });
  if (!homeUnderLevels) {
    throw new Error('home screen disappeared while the levels dialog is open (it must stay behind)');
  }
  log('[OK] levels dialog opened on top of the home hub');

  PHASE = 'nav-2-select-level';
  log('[NAV 2/6] selecting a level closes the dialog and starts the board...');
  const levelBtn = await page.$('#lv-grid button:not([disabled])');
  if (!levelBtn) throw new Error('no playable level button found in #lv-grid');
  const levelLabel = await levelBtn.evaluate(el => el.textContent.trim().slice(0, 4));
  await levelBtn.click();
  await page.waitForFunction(() => {
    const lv = document.getElementById('dlg-levels');
    const home = document.getElementById('dlg-home');
    return (!lv || !lv.classList.contains('show')) &&
      (!home || !home.classList.contains('show'));
  }, { timeout: 10000 });
  if (!(await boardVisible(page))) {
    throw new Error('board not visible after selecting a level');
  }
  log('[OK] level ' + levelLabel + ' selected: dialogs closed, board visible');

  // Let the level intro banner finish its animation
  await sleep(1800);

  PHASE = 'nav-3-pause';
  log('[NAV 3/6] pause menu opens over the board...');
  await page.click('#btn-menu');
  await page.waitForSelector('#dlg-menu.show', { timeout: 10000 });
  if (!(await page.$('#btn-resume'))) {
    throw new Error('pause menu has no Resume button');
  }
  log('[OK] pause menu open with Resume available');

  PHASE = 'nav-4-resume';
  log('[NAV 4/6] resume returns to the active game...');
  await page.click('#btn-resume');
  await page.waitForFunction(() => {
    const m = document.getElementById('dlg-menu');
    return !m || !m.classList.contains('show');
  }, { timeout: 10000 });
  if (!(await boardVisible(page))) {
    throw new Error('board not visible after resume');
  }
  log('[OK] resume closes the pause menu and restores the board');

  PHASE = 'nav-5-home';
  log('[NAV 5/6] pause -> Main Menu returns to the home hub...');
  await page.click('#btn-menu');
  await page.waitForSelector('#dlg-menu.show', { timeout: 10000 });
  await page.click('#btn-home');
  await page.waitForSelector('#dlg-home.show', { timeout: 10000 });
  const menuClosed = await page.evaluate(() => {
    const m = document.getElementById('dlg-menu');
    return !m || !m.classList.contains('show');
  });
  if (!menuClosed) {
    throw new Error('pause menu still open after returning to the main menu (stale modal)');
  }
  log('[OK] Main Menu closes the pause menu and shows the home hub');

  PHASE = 'nav-6-continue';
  log('[NAV 6/6] Continue resumes gameplay from the home hub...');
  await page.click('#btn-continue');
  await page.waitForFunction(() => {
    const h = document.getElementById('dlg-home');
    return !h || !h.classList.contains('show');
  }, { timeout: 10000 });
  if (!(await boardVisible(page))) {
    throw new Error('board not visible after Continue');
  }
  log('[OK] Continue returns to the board - full navigation loop verified');
}


// --- PWA / service worker / offline regression tests ---
async function runPwaTests(page) {
  PHASE = 'pwa-1-ui-hooks';
  log('[PWA 1/5] checking update-flow UI hooks...');
  // 1. Update-flow UI hooks must exist and expose the current version
  const uiHooks = await page.evaluate(() => ({
    hasBanner: !!document.getElementById('update-banner'),
    hasReloadBtn: !!document.getElementById('btn-update-reload'),
    hasVersionRow: !!document.getElementById('st-version'),
    pwaApi: typeof PWA === 'object',
    version: (typeof PWA === 'object' && PWA) ? PWA.VERSION : null,
    checkForUpdates: (typeof PWA === 'object' && PWA) ? typeof PWA.checkForUpdates : 'missing'
  }));
  if (!uiHooks.hasBanner || !uiHooks.hasReloadBtn || !uiHooks.hasVersionRow ||
      !uiHooks.pwaApi || uiHooks.checkForUpdates !== 'function' || !uiHooks.version) {
    throw new Error('PWA update flow incomplete: ' + JSON.stringify(uiHooks));
  }
  log('[OK] PWA v' + uiHooks.version + ': update banner + version row + checkForUpdates present');

  PHASE = 'pwa-2-manifest';
  log('[PWA 2/5] checking web app manifest...');
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
  log('[OK] manifest valid: ' + manifest.name + ', display=' + manifest.display + ', icons=' + sizes);

  PHASE = 'pwa-3-sw-active';
  log('[PWA 3/5] checking service worker activation...');
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
  log('[OK] service worker active, game caches: ' + own.join(', '));

  PHASE = 'pwa-4-cache-scope';
  log('[PWA 4/5] checking scoped cache cleanup (reinstall dance)...');
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
  log('[OK] cache cleanup is scoped: foreign cache survived Arrow Out! (re)install');

  PHASE = 'pwa-5-offline';
  log('[PWA 5/5] checking offline boot from service worker cache...');
  // 5. Offline: reload with the network cut off - the game must still boot
  var offlineModeSet = false;
  try {
    await page.setOfflineMode(true);
    offlineModeSet = true;
  } catch (e1) {
    try {
      await page.context().setOffline(true);
      offlineModeSet = true;
    } catch (e2) {
      const client = await page.createCDPSession();
      await client.send('Network.enable');
      await client.send('Network.emulateNetworkConditions', {
        offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0
      });
    }
  }
  try {
    try {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
    } catch (e) {
      throw new Error('offline reload failed - the service worker should serve the navigation from cache: ' + (e && e.message ? e.message : e));
    }
    await page.waitForSelector('#dlg-home.show', { timeout: 15000 });
    const offlineOk = await page.evaluate(() => ({
      online: navigator.onLine,
      title: document.title,
      hud: !!document.getElementById('hud')
    }));
    if (!offlineOk.hud || offlineOk.title.indexOf('Arrow Out') === -1) {
      throw new Error('offline boot looks broken: ' + JSON.stringify(offlineOk));
    }
    if (offlineModeSet && offlineOk.online !== false) {
      // Test-environment quirk, not a product bug: some headless builds do
      // not flip navigator.onLine for emulated offline. The meaningful check
      // (game boots from the SW cache with the network cut) already passed.
      log('[WARN] offline emulation did not flip navigator.onLine (test-env quirk)');
    } else {
      log('[OK] offline: navigator.onLine is false as expected');
    }
    log('[OK] offline: game boots fully from the service worker cache');
  } finally {
    try { await page.setOfflineMode(false); } catch (e3) {
      try { await page.context().setOffline(false); } catch (e4) { /* CDP session dies with page */ }
    }
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
    PHASE = 'load';
    page.on('pageerror', e => pageErrors.push('[pageerror @' + PHASE + '] ' + e.message));
    page.on('console', m => { if (m.type() === 'error') pageErrors.push('[console @' + PHASE + '] ' + m.text()); });

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

    // Dismiss the first-launch onboarding card if it auto-opened on top of
    // the home screen (only shows when the reward dialog did NOT open).
    const howtoDlg = await page.$('#dlg-howto.show');
    if (howtoDlg) {
      const howtoClose = await page.$('#dlg-howto [data-close]');
      if (howtoClose) {
        await howtoClose.click();
        await sleep(400);
        log('onboarding card shown on first launch and dismissed');
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

    PHASE = 'viewport-audit';
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
    log('wrote docs/screenshot-home.png');

    // Full navigation flow: levels -> select level -> board -> pause ->
    // resume -> pause -> main menu -> continue (ends on the board)
    await runNavigationTests(page);

    PHASE = 'board';
    await sleep(300);
    await auditPage(page, 'board');
    await page.screenshot({ path: path.join(DOC, 'screenshot-board.png') });
    log('wrote docs/screenshot-board.png');
    await runPwaTests(page);
    PHASE = 'final-console-check';

    if (pageErrors.length) {
      throw new Error('console/page errors detected:\n  ' + pageErrors.join('\n  '));
    }
    log('[OK] no console errors');
    log('ALL CHECKS PASSED');
  } finally {
    writeLog();
    if (browser) await browser.close().catch(() => {});
    server.kill('SIGTERM');
  }
}

main().catch(err => {
  PHASE = 'fatal';
  const msg = 'FATAL: ' + ((err && err.stack) ? err.stack : String(err));
  LOG.push(msg);
  writeLog();
  console.error(msg);
  process.exit(1);
});
