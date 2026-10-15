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
