import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { Store } from '../src/core/storage.js';
export const CLASSROOM_URL = 'https://maic.chat/classroom/course/chapter/lesson';
export const fixture = name => readFileSync(new URL(`./fixtures/${name}.html`, import.meta.url), 'utf8');
export function dom(name = 'classroom', url = CLASSROOM_URL) { return new JSDOM(fixture(name), { url, pretendToBeVisual: true }); }
export function memoryLocal() {
  const values = {};
  return { values, async get(key) { return structuredClone(key === null ? values : { [key]: values[key] }); },
    async set(items) { Object.assign(values, structuredClone(items)); }, async remove(keys) { for (const key of Array.isArray(keys) ? keys : [keys]) delete values[key]; } };
}
export function mockAPI() {
  const local = memoryLocal(), store = new Store(local), listeners = new Set();
  const calls = [];
  const api = { storage: { local }, runtime: { onMessage: { addListener: fn => listeners.add(fn), removeListener: fn => listeners.delete(fn) },
    async sendMessage(message) {
      calls.push(message);
      try {
        const tab = await store.get('tab:1', { mode: 'stopped', profile: 'local:default', manualProfile: 'local:default' });
        let result;
        if (message.type === 'HELLO') result = { tab, preferences: { fastMode: true, autoCapture: true } };
        else if (message.type === 'TAB_STATUS') result = await store.patchTab(1, message.status);
        else if (message.type === 'SAVE_SLIDE') {
          if (tab.mode === 'stopped' && message.purpose !== 'review') throw new Error('Stopped');
          result = await store.saveSlide(tab.profile, message.slide, { notes: message.notes });
        } else if (message.type === 'SAVE_OBSERVATION') await store.saveObservation(tab.profile, message.observation);
        else if (message.type === 'GET_REVIEW_DATA') result = { ...await store.data(tab.profile), profile: tab.profile };
        else if (message.type === 'SAVE_REVIEW') {
          if (tab.profile !== message.profile) throw new Error('Profile changed');
          result = await store.saveReview(tab.profile, message.review);
          await store.patchTab(1, { review: { ...result, item: message.item } });
        }
        return { ok: true, result };
      } catch (error) { return { ok: false, error: error.message }; }
    } } };
  return { api, local, store, calls, listeners };
}
export function wirePlayer(doc, { delayed = false } = {}) {
  let clicks = 0;
  const turn = delta => {
    clicks++;
    if (delayed) return;
    const counter = doc.querySelector('[data-slide-counter]');
    counter.textContent = `${+counter.textContent.split('/')[0] + delta}/31`;
    doc.querySelector('#prev').setAttribute('aria-disabled', 'false');
  };
  doc.querySelector('#next').addEventListener('click', () => turn(1));
  doc.querySelector('#prev').addEventListener('click', () => turn(-1));
  doc.querySelector('#transcript-toggle').addEventListener('click', () => { doc.querySelector('#transcript').hidden = false; });
  return { get clicks() { return clicks; } };
}
