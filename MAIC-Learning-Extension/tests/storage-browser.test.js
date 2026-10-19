import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { Store } from '../src/core/storage.js';
import { extensionAPI, request, tabRequest } from '../src/core/messaging.js';
import { classifySender } from '../src/core/sender.js';
import { memoryLocal, CLASSROOM_URL } from './helpers.js';
test('single-writer storage avoids lost writes across multiple MAIC tabs and profiles', async () => {
  const local = memoryLocal(), store = new Store(local);
  const slide = { moduleId: 'a/b/c', slideNumber: 1, url: CLASSROOM_URL, content: 'real text', extractedAt: new Date().toISOString() };
  await Promise.all([store.transact(() => store.saveSlide('local:a', slide)), store.transact(() => store.saveSlide('local:b', { ...slide, content: 'other account' })), store.transact(() => store.saveSlide('local:a', { ...slide, slideNumber: 2 }))]);
  assert.equal((await store.data('local:a')).slides.length, 2); assert.equal((await store.data('local:b')).slides.length, 1);
  await store.personalNote('local:a', slide.moduleId, 1, 'my note'); await store.saveSlide('local:a', { ...slide, transcript: 'new narration' });
  assert.equal((await store.data('local:a')).slides[0].personalNote, 'my note');
  await store.deleteProfile('local:a'); assert.equal((await store.data('local:a')).slides.length, 0); assert.equal((await store.data('local:b')).slides.length, 1);
});
test('progress retains UI provenance, not synthetic completion from slide position', async () => {
  const store = new Store(memoryLocal());
  await store.saveObservation('x', { progress: { modules: { completed: 4, total: 15 }, sourceUrl: 'https://learning-feal.maic.chat/dashboard', scope: 'all-courses', observedAt: '2026-10-19T01:00:00Z' } });
  const { progress } = await store.data('x'); assert.equal(progress[0].value.modules.completed, 4);
  await store.saveSlide('x', { moduleId: 'a/b/c', slideNumber: 31, totalSlides: 31, content: 'last slide', url: CLASSROOM_URL });
  assert.equal((await store.data('x')).progress[0].value.modules.completed, 4);
});
test('Firefox Promise API and Chrome callback API normalize messaging and errors', async () => {
  const firefox = { browser: { runtime: { sendMessage: async () => ({ ok: true, result: 12 }) } } };
  assert.equal(await request(extensionAPI(firefox), 'HELLO'), 12);
  const calls = []; const chrome = { runtime: { lastError: null, getURL: value => value, onMessage: {}, sendMessage(message, callback) { calls.push(message); callback({ ok: true, result: 42 }); } }, storage: { local: { get(key, callback) { callback({}); }, set(value, callback) { callback(); }, remove(value, callback) { callback(); } } }, tabs: { query(query, callback) { callback([{ id: 8 }]); }, sendMessage(id, message, callback) { callback({ ok: true, result: { id, command: message.command } }); } } };
  const api = extensionAPI({ chrome }); assert.equal(await request(api, 'HELLO'), 42);
  assert.deepEqual(await tabRequest(api, 8, 'STOP'), { id: 8, command: 'STOP' }); assert.equal(calls[0].channel, 'maic-learning-v1');
  chrome.runtime.lastError = { message: 'No receiver' }; await assert.rejects(() => request(api, 'HELLO'), /No receiver/);
});
test('extension popup in a tab is classified as UI, not a MAIC content script', () => {
  const root = 'chrome-extension://self/';
  assert.equal(classifySender({ id: 'self', url: `${root}popup/popup.html`, tab: { id: 3 } }, 'self', root), 'ui');
  assert.equal(classifySender({ id: 'self', url: CLASSROOM_URL, tab: { id: 1 }, frameId: 0 }, 'self', root), 'content');
  assert.throws(() => classifySender({ id: 'other', url: CLASSROOM_URL, tab: { id: 1 } }, 'self', root));
  assert.throws(() => classifySender({ id: 'self', url: CLASSROOM_URL, tab: { id: 1 }, frameId: 9 }, 'self', root));
});
test('both MV3 builds have real local files, distinct background configurations and minimal hosts', () => {
  for (const browser of ['chrome', 'firefox']) {
    const root = new URL(`../dist/${browser}/`, import.meta.url), manifest = JSON.parse(readFileSync(new URL('manifest.json', root)));
    assert.equal(manifest.manifest_version, 3); assert.deepEqual(manifest.permissions, ['storage', 'activeTab']); assert.equal(manifest.host_permissions.length, 2);
    assert.ok(manifest.host_permissions.every(host => !host.includes('<all_urls>')));
    assert.ok(existsSync(new URL(manifest.action.default_popup, root)));
    for (const script of manifest.content_scripts[0].js) assert.ok(existsSync(new URL(script, root)));
    if (browser === 'chrome') { assert.equal(manifest.background.service_worker, 'background.js'); assert.equal(manifest.background.scripts, undefined); }
    else { assert.deepEqual(manifest.background.scripts, ['background.js']); assert.equal(manifest.background.service_worker, undefined); }
  }
});
