#!/usr/bin/env node
/**
 * Arrow Out! - Screenshot generator (puppeteer)
 * Renders docs/screenshot-home.png and docs/screenshot-board.png
 * from the real game served over localhost (SW needs http://).
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

async function main() {
  fs.mkdirSync(DOC, { recursive: true });
  const server = spawn('npx', ['http-server', '.', '-p', String(PORT), '--silent'],
    { cwd: ROOT, stdio: 'ignore' });
  let browser = null;
  try {
    await waitForServer(60);
    browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage();
    await page.setViewport({
      width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true
    });
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
    await page.screenshot({ path: path.join(DOC, 'screenshot-board.png') });
    console.log('wrote docs/screenshot-board.png');
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.kill('SIGTERM');
  }
}

main().catch(err => { console.error(err); process.exit(1); });
