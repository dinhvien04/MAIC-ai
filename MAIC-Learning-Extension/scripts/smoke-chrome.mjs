import puppeteer from 'puppeteer';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root = fileURLToPath(new URL('../', import.meta.url));
const classroom = await readFile(`${root}tests/fixtures/classroom.html`, 'utf8');
const dashboard = await readFile(`${root}tests/fixtures/dashboard.html`, 'utf8');
const browser = await puppeteer.launch({ headless: true, pipe: true, enableExtensions: [`${root}dist/chrome`], args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const checks = [], errors = [];
checks.push = function (...items) { console.log('PASS:', ...items); return Array.prototype.push.apply(this, items); };
try {
  const target = await browser.waitForTarget(target => target.type() === 'service_worker');
  const worker = await target.worker(); const extensionId = new URL(target.url()).hostname;
  const page = await browser.newPage(); page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true);
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.hostname === 'maic.chat') request.respond({ status: 200, contentType: 'text/html; charset=utf-8', body: classroom });
    else if (url.hostname === 'learning-feal.maic.chat') request.respond({ status: 200, contentType: 'text/html; charset=utf-8', body: dashboard });
    else request.abort(); // No request reaches the real MAIC account or any external server.
  });
  await page.goto('https://maic.chat/classroom/course/chapter/lesson');
  await page.evaluate(() => {
    const counter = document.querySelector('[data-slide-counter]');
    document.querySelector('#next').onclick = () => { counter.textContent = `${+counter.textContent.split('/')[0] + 1}/31`; document.querySelector('#prev').setAttribute('aria-disabled', 'false'); };
    document.querySelector('#prev').onclick = () => { counter.textContent = `${+counter.textContent.split('/')[0] - 1}/31`; };
    document.querySelector('#transcript-toggle').onclick = () => { document.querySelector('#transcript').hidden = false; };
  });
  const tabId = await worker.evaluate(async () => (await chrome.tabs.query({ url: 'https://maic.chat/*' }))[0].id);
  const send = async (command, args = {}) => {
    const reply = await worker.evaluate((tabId, command, args) => chrome.tabs.sendMessage(tabId, { channel: 'maic-learning-v1', type: 'COMMAND', command, args }), tabId, command, args);
    assert.equal(reply.ok, true, reply.error); return reply.result;
  };
  const waitConnected = async () => {
    for (let attempt = 0; attempt < 40; attempt++) {
      try { return await send('STATUS'); } catch { await new Promise(resolve => setTimeout(resolve, 100)); }
    }
    throw new Error('Content script did not connect.');
  };
  await waitConnected(); checks.push('MV3 worker + content script loaded');
  assert.equal((await send('STATUS')).mode, 'stopped'); checks.push('Inactive by default');
  assert.equal((await send('START')).mode, 'running');
  assert.ok(await page.$('[data-maic-extension]')); checks.push('Shadow DOM overlay mounted');
  assert.equal((await send('NEXT')).slide.slideNumber, 2);
  assert.equal((await send('PREVIOUS')).slide.slideNumber, 1); checks.push('User next/previous controls');
  assert.match((await send('TRANSCRIPT')).slide.transcript, /Welcome/);
  await send('NOTES'); checks.push('Transcript extraction + rule-based notes');
  await send('AUTO', { enabled: true });
  await send('PAUSE'); assert.equal(await page.$eval('#auto', element => element.checked), false);
  await send('RESUME'); checks.push('Auto toggling, pause and resume');
  const popupCreated = await worker.evaluate(() => chrome.tabs.create({ url: chrome.runtime.getURL('popup/popup.html'), active: false }));
  const popupTarget = await browser.waitForTarget(target => target.url() === `chrome-extension://${extensionId}/popup/popup.html`);
  const popup = await popupTarget.page(); popup.on('pageerror', error => errors.push(error.message));
  await popup.waitForFunction(() => document.querySelector('#badge')?.textContent === 'Đang hỗ trợ' || document.querySelector('#error')?.hidden === false, { timeout: 8000, polling: 100 });
  assert.equal(await popup.$eval('#error', element => element.hidden), true);
  assert.match(await popup.$eval('#preview', element => element.textContent), /Theory/); checks.push('Real popup communicates with active MAIC tab');
  await mkdir(`${root}artifacts`, { recursive: true });
  await popup.setViewport({ width: 380, height: 930, deviceScaleFactor: 1 });
  await popup.screenshot({ path: `${root}artifacts/popup-chrome.png`, fullPage: true });
  await worker.evaluate(id => chrome.tabs.remove(id), popupCreated.id);
  await page.reload(); assert.equal((await waitConnected()).mode, 'paused');
  const records = await worker.evaluate(() => chrome.storage.local.get(null));
  assert.ok(Object.values(records).some(value => value.recordType === 'slide' && value.summary)); checks.push('Notes survive reload; recovery stays paused');
  await page.goto('https://learning-feal.maic.chat/dashboard');
  let dashboardReady = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    try { const status = await send('START'); if (status.pageType === 'dashboard') { dashboardReady = true; break; } } catch { /* Wait for content initialization. */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(dashboardReady);
  const progressRecords = await worker.evaluate(() => chrome.storage.local.get(null));
  assert.ok(Object.values(progressRecords).some(value => value.recordType === 'progress' && value.value.modules?.completed === 1 && value.value.modules.total === 10)); checks.push('Official UI progress read on local dashboard fixture');
  await send('STOP'); assert.equal((await send('STATUS')).mode, 'stopped'); checks.push('Stop works independently of popup');
  assert.deepEqual(errors, []);
  const report = { browser: await browser.version(), checks, pageErrors: errors, network: 'All MAIC requests intercepted and fulfilled from local fixtures. No real account accessed.' };
  await writeFile(`${root}artifacts/chrome-smoke.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
