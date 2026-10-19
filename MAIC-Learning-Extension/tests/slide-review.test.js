import test from 'node:test';
import assert from 'node:assert/strict';
import { SlideReview, DEFAULT_REVIEW_INTERVAL } from '../src/core/slide-review.js';
import { Store } from '../src/core/storage.js';
import { memoryLocal, CLASSROOM_URL, dom, mockAPI, wirePlayer } from './helpers.js';
import { Assistant } from './.generated/assistant.mjs';

class Clock {
  now = 0; nextId = 1; jobs = new Map(); maxPending = 0;
  set = (callback, delay) => {
    const id = this.nextId++; this.jobs.set(id, { callback, at: this.now + delay });
    this.maxPending = Math.max(this.maxPending, this.jobs.size); return id;
  };
  clear = id => this.jobs.delete(id);
  advance(duration) {
    const end = this.now + duration;
    for (let iterations = 0; iterations < 100000; iterations++) {
      const next = [...this.jobs.entries()].filter(([, job]) => job.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      this.now = next[1].at; this.jobs.delete(next[0]); next[1].callback();
    }
    this.now = end;
  }
}
function slides(total = 3) {
  return Array.from({ length: total }, (_, index) => ({ moduleId: 'course/chapter/lesson', moduleTitle: 'Introduction', slideNumber: index + 1,
    totalSlides: total, content: `Nội dung trang ${index + 1}`, transcript: `Lời giảng trang ${index + 1}`, url: CLASSROOM_URL }));
}
function setup(items = slides()) {
  const clock = new Clock(), changes = [];
  const review = new SlideReview({ now: () => clock.now, setTimer: clock.set, clearTimer: clock.clear, onUpdate: (state, persist) => changes.push({ state, persist }) });
  const start = options => review.start(items, { moduleId: items[0].moduleId, slideNumber: 1, ...options });
  return { clock, review, changes, start };
}
test('review defaults to 3000ms and auto-next updates only the local viewer', () => {
  const { review, clock, start } = setup(); assert.equal(DEFAULT_REVIEW_INTERVAL, 3000); start();
  clock.advance(2999); assert.equal(review.current().slideNumber, 1); assert.equal(review.snapshot().remainingMs, 1);
  clock.advance(1); assert.equal(review.current().slideNumber, 2); assert.equal(review.snapshot().mode, 'reviewing');
  clock.advance(1000); assert.equal(review.snapshot().remainingMs, 2000);
});
test('pause immediately cancels timer; resume preserves the remaining delay', () => {
  const { review, clock, start } = setup(); start(); clock.advance(900); review.pause();
  assert.equal(clock.jobs.size, 0); assert.equal(review.snapshot().remainingMs, 2100);
  clock.advance(50000); assert.equal(review.current().slideNumber, 1);
  review.resume(); clock.advance(2099); assert.equal(review.current().slideNumber, 1);
  clock.advance(1); assert.equal(review.current().slideNumber, 2);
});
test('stop cancels all pending tasks without removing cached content', () => {
  const { review, clock, start } = setup(); start(); review.stop(); clock.advance(100000);
  assert.equal(clock.jobs.size, 0); assert.equal(review.snapshot().mode, 'stopped'); assert.equal(review.current().slideNumber, 1);
});
test('last slide stops review without exceeding total', () => {
  const { review, clock, start } = setup(slides(2)); start(); clock.advance(3000);
  assert.equal(review.snapshot().mode, 'completed'); assert.equal(review.current().slideNumber, 2); assert.equal(clock.jobs.size, 0);
  clock.advance(100000); assert.equal(review.current().slideNumber, 2);
});
test('missing next content blocks rather than skipping or opening the live lesson', () => {
  const items = slides(3), { review, clock, start } = setup([items[0], items[2]]);
  start(); clock.advance(3000); assert.equal(review.snapshot().mode, 'blocked'); assert.equal(review.snapshot().missingSlide, 2);
  assert.equal(review.current().slideNumber, 1); assert.equal(clock.jobs.size, 0); assert.match(review.snapshot().reason, /tự mở/);
  review.resume(); assert.equal(review.snapshot().mode, 'blocked');
  review.resume(items); clock.advance(3000); assert.equal(review.current().slideNumber, 2);
});
for (const label of ['单选题', '多选题', 'Quiz', 'Assessment', 'Final Exam']) {
  test(`review pauses on saved ${label} without answering or continuing`, () => {
    const items = slides(); items[1].content = label;
    const { review, clock, start } = setup(items); start(); clock.advance(3000);
    assert.equal(review.snapshot().mode, 'paused'); assert.equal(review.current().slideNumber, 2); assert.equal(clock.jobs.size, 0);
    review.resume(); clock.advance(20000); assert.equal(review.snapshot().mode, 'paused'); assert.equal(review.current().slideNumber, 2);
  });
}
test('restore checkpoint preserves cursor and interval but waits for explicit resume', () => {
  const first = setup(); first.start(); first.clock.advance(3500); first.review.pause();
  const saved = first.review.snapshot(); first.review.cancel();
  const restored = setup(); restored.review.restore({ ...saved, mode: 'reviewing' }, slides());
  assert.equal(restored.review.snapshot().mode, 'paused'); assert.equal(restored.review.current().slideNumber, 2); assert.equal(restored.clock.jobs.size, 0);
  restored.review.resume(); restored.clock.advance(2500); assert.equal(restored.review.current().slideNumber, 3);
});
test('repeated start/resume and interval changes never create duplicate timers', () => {
  const { review, clock, start } = setup(slides(10)); start(); start(); review.resume(); review.resume();
  review.setInterval(1000); review.setInterval(2000); assert.equal(clock.jobs.size, 1);
  clock.advance(2000); assert.equal(review.current().slideNumber, 2); assert.equal(clock.maxPending, 1);
  review.pause(); review.setInterval(5000); assert.equal(clock.jobs.size, 0); review.resume(); assert.equal(clock.jobs.size, 1);
  review.stop(); assert.equal(clock.jobs.size, 0);
});
test('invalid interval does not replace a running timer', () => {
  const { review, clock, start } = setup(); start();
  for (const value of [0, -1, NaN, Infinity, 3600001]) assert.throws(() => review.setInterval(value));
  assert.equal(clock.jobs.size, 1); assert.equal(review.snapshot().intervalMs, 3000); review.stop();
});
test('review checkpoint storage leaves notes, official progress and module metadata unchanged', async () => {
  const local = memoryLocal(), store = new Store(local);
  await store.saveSlide('local:a', { ...slides()[0], personalNote: 'original' });
  await store.personalNote('local:a', 'course/chapter/lesson', 1, 'Keep this note');
  await store.saveObservation('local:a', { modules: [{ id: 'verified', officialStatus: 'completed' }], progress: { modules: { completed: 1, total: 10 }, sourceUrl: 'https://learning-feal.maic.chat/dashboard', scope: 'all-courses' } });
  const before = structuredClone(local.values), { review, start } = setup(); start();
  await store.saveReview('local:a', review.snapshot()); review.stop();
  const after = { ...local.values }; delete after['review:local:a']; assert.deepEqual(after, before);
  assert.equal((await store.data('local:b')).review, null); assert.equal((await store.data('local:a')).slides[0].personalNote, 'Keep this note');
});
test('review commands never click MAIC, change 自动/audio, or change official completion', async () => {
  const environment = dom(), mock = mockAPI(), player = wirePlayer(environment.window.document);
  const doc = environment.window.document; doc.querySelector('#auto').checked = true;
  const assistant = new Assistant(doc, mock.api);
  try {
    await assistant.init();
    await mock.store.saveSlide(assistant.profile, { ...slides()[0], totalSlides: 31 });
    await assistant.command('REVIEW_START', { moduleId: 'course/chapter/lesson' });
    await assistant.command('REVIEW_INTERVAL', { intervalMs: 1000 });
    await assistant.command('REVIEW_PAUSE'); await assistant.command('REVIEW_RESUME'); await assistant.command('REVIEW_STOP');
    assert.equal(player.clicks, 0); assert.equal(doc.querySelector('#auto').checked, true);
    assert.equal(doc.querySelector('[data-slide-counter]').textContent, '1/31'); assert.equal(assistant.state.mode, 'stopped');
    assert.equal(mock.calls.some(message => message.type === 'SAVE_OBSERVATION'), false);
    assert.equal(mock.calls.filter(message => message.type === 'SAVE_SLIDE').length, 0, 'saved content must not be extracted again');
  } finally { assistant.destroy(); environment.window.close(); }
});
test('Stop preempts review START while storage is still loading', async () => {
  const environment = dom(), mock = mockAPI(), assistant = new Assistant(environment.window.document, mock.api);
  try {
    await assistant.init(); const original = mock.api.runtime.sendMessage;
    let release;
    mock.api.runtime.sendMessage = async message => {
      if (message.type === 'GET_REVIEW_DATA') await new Promise(resolve => { release = resolve; });
      return original(message);
    };
    const start = assistant.command('REVIEW_START'); await assistant.command('REVIEW_STOP'); release();
    await assert.rejects(() => start, /hủy/); assert.equal(assistant.review.state.mode, 'stopped'); assert.equal(assistant.review.timer, null);
  } finally { assistant.destroy(); environment.window.close(); }
});
test('logged-in classroom without account marker can use the default local profile', async () => {
  const environment = dom(), mock = mockAPI(); environment.window.document.querySelector('[data-testid="account-name"]').remove();
  const assistant = new Assistant(environment.window.document, mock.api);
  try { await assistant.init(); await assistant.command('START'); assert.equal(assistant.state.mode, 'running'); assert.equal(assistant.profile, 'local:default'); }
  finally { assistant.destroy(); environment.window.close(); }
});
test('review uses slide-reader once for an open uncached slide without navigating MAIC', async () => {
  const environment = dom(), mock = mockAPI(), player = wirePlayer(environment.window.document);
  const assistant = new Assistant(environment.window.document, mock.api);
  try {
    await assistant.init(); await assistant.command('REVIEW_START'); await assistant.command('REVIEW_STOP');
    const data = await mock.store.data(assistant.profile);
    assert.equal(data.slides.length, 1); assert.match(data.slides[0].content, /Theory informs/);
    assert.equal(mock.calls.filter(message => message.type === 'SAVE_SLIDE' && message.purpose === 'review').length, 1);
    assert.equal(player.clicks, 0);
    await assistant.command('REVIEW_START'); await assistant.command('REVIEW_STOP');
    assert.equal(mock.calls.filter(message => message.type === 'SAVE_SLIDE' && message.purpose === 'review').length, 1);
  } finally { assistant.destroy(); environment.window.close(); }
});
