import test from 'node:test';
import assert from 'node:assert/strict';
import { Assistant } from './.generated/assistant.mjs';
import { dom, mockAPI, wirePlayer, CLASSROOM_URL } from './helpers.js';
import { JSDOM } from 'jsdom';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function setup(options) {
  const environment = dom(), mock = mockAPI(), player = wirePlayer(environment.window.document, options);
  const assistant = new Assistant(environment.window.document, mock.api); await assistant.init();
  return { ...mock, window: environment.window, player, assistant, cleanup() { assistant.destroy(); environment.window.close(); } };
}
test('inactive until START; notes persist when popup closes; pause/resume/stop cancel observers', async () => {
  const env = await setup();
  try {
    assert.equal(env.assistant.state.mode, 'stopped'); assert.equal(env.assistant.observer, undefined);
    assert.equal(env.calls.some(x => x.type === 'SAVE_SLIDE'), false); assert.equal(env.assistant.status.slide.content, undefined);
    await env.assistant.command('START'); assert.equal(env.assistant.state.mode, 'running');
    assert.ok(env.window.document.querySelector('[data-maic-extension]')?.shadowRoot);
    await env.assistant.command('NOTES'); const data = await env.store.data(env.assistant.profile); assert.equal(data.slides.length, 1);
    await env.assistant.command('PAUSE'); await assert.rejects(() => env.assistant.command('NEXT'), /tạm dừng/);
    await env.assistant.command('RESUME'); await env.assistant.command('NEXT'); assert.equal(env.assistant.slide.slideNumber, 2);
    await env.assistant.command('STOP'); assert.equal(env.assistant.state.mode, 'stopped'); assert.equal(env.window.document.querySelector('[data-maic-extension]'), null);
    assert.equal((await env.store.data(env.assistant.profile)).slides.length, 2);
  } finally { env.cleanup(); }
});
test('previous/next and transcript opening use one supported control only', async () => {
  const env = await setup(); try {
    await env.assistant.command('START'); await env.assistant.command('NEXT'); await env.assistant.command('PREVIOUS'); assert.equal(env.player.clicks, 2);
    await env.assistant.command('TRANSCRIPT'); assert.match(env.assistant.slide.transcript, /Welcome/);
  } finally { env.cleanup(); }
});
test('STOP cancels an in-flight next-slide wait and duplicate NEXT never clicks twice', async () => {
  const env = await setup({ delayed: true }); try {
    await env.assistant.command('START'); const next = env.assistant.command('NEXT');
    // Let the read-only preflight finish before the single player click.
    while (env.player.clicks === 0) await delay(5);
    await assert.rejects(() => env.assistant.command('NEXT'), /Đang xử lý/);
    const rejected = assert.rejects(() => next, /hủy/); await env.assistant.command('STOP'); await rejected;
    assert.equal(env.player.clicks, 1); assert.equal(env.assistant.state.mode, 'stopped');
  } finally { env.cleanup(); }
});
test('Auto follows MAIC checkbox and is turned off by PAUSE and STOP', async () => {
  const env = await setup(); try {
    await env.assistant.command('START'); await env.assistant.command('AUTO', { enabled: true }); assert.equal(env.window.document.querySelector('#auto').checked, true);
    await env.assistant.command('PAUSE'); assert.equal(env.window.document.querySelector('#auto').checked, false);
    await env.assistant.command('RESUME'); assert.equal(env.window.document.querySelector('#auto').checked, false);
  } finally { env.cleanup(); }
});
test('visible questions immediately pause assistance without selecting or submitting', async () => {
  const env = await setup(); try {
    await env.assistant.command('START'); env.window.document.querySelector('main').insertAdjacentHTML('beforeend', '<section data-quiz><h2>单选题</h2><input type="radio"><button>完成</button></section>');
    await env.assistant.inspect(); assert.equal(env.assistant.state.mode, 'paused');
    await assert.rejects(() => env.assistant.command('RESUME'), /câu hỏi/); assert.equal(env.player.clicks, 0); assert.equal(env.window.document.querySelector('input[type=radio]').checked, false);
  } finally { env.cleanup(); }
});
test('SPA route changes pause safely; no navigation from assessment pages', async () => {
  const env = await setup(); try {
    await env.assistant.command('START'); env.window.history.pushState({}, '', '/classroom/course/other/new-lesson');
    await env.assistant.command('ROUTE'); assert.equal(env.assistant.state.mode, 'paused'); assert.equal(env.assistant.slide.moduleId, 'course/other/new-lesson');
    env.window.history.pushState({}, '', '/assessment'); await env.assistant.command('ROUTE');
    await assert.rejects(() => env.assistant.command('START'), /đánh giá/); assert.equal(env.player.clicks, 0);
  } finally { env.cleanup(); }
});
test('keyboard shortcuts ignore inputs and only work in classroom', async () => {
  const env = await setup(); try {
    await env.assistant.command('START');
    const input = env.window.document.createElement('textarea'); env.window.document.body.append(input);
    input.dispatchEvent(new env.window.KeyboardEvent('keydown', { code: 'ArrowRight', altKey: true, bubbles: true })); assert.equal(env.player.clicks, 0);
    env.window.document.body.dispatchEvent(new env.window.KeyboardEvent('keydown', { code: 'ArrowRight', altKey: true, bubbles: true })); await delay(30); assert.equal(env.player.clicks, 1);
  } finally { env.cleanup(); }
});
test('popup commands verify current URL and communicate through async callback listener', async () => {
  const env = await setup(); try {
    const listener = [...env.listeners][0];
    const message = { channel: 'maic-learning-v1', type: 'COMMAND', command: 'START', expectedUrl: `${CLASSROOM_URL}/wrong` };
    const reply = await new Promise(resolve => { assert.equal(listener(message, { id: 'self' }, resolve), true); });
    assert.equal(reply.ok, false); assert.equal(env.assistant.state.mode, 'stopped');
    const result = await new Promise(resolve => listener({ ...message, expectedUrl: CLASSROOM_URL }, { id: 'self' }, resolve)); assert.equal(result.ok, true);
  } finally { env.cleanup(); }
});
test('session expiration and account change pause and keep records isolated', async () => {
  const env = await setup(); try {
    await env.assistant.command('START'); const original = env.assistant.profile;
    env.window.document.querySelector('[data-testid="account-name"]').textContent = 'different-user'; await env.assistant.inspect();
    assert.notEqual(env.assistant.profile, original); assert.equal(env.assistant.state.mode, 'paused'); assert.equal((await env.store.data(env.assistant.profile)).slides.length, 0);
    env.window.document.body.insertAdjacentHTML('beforeend', '<input type="password">'); await env.assistant.inspect(); assert.equal(env.assistant.status.auth, 'login-required'); assert.equal(env.assistant.slide, null);
  } finally { env.cleanup(); }
});
test('refresh recovers into paused state, rather than auto-resuming playback', async () => {
  const env = await setup(); try {
    await env.assistant.command('START'); const replacement = new Assistant(env.window.document, env.api); env.assistant.destroy();
    await replacement.init(); assert.equal(replacement.state.mode, 'paused'); replacement.destroy();
  } finally { env.cleanup(); }
});
test('refresh opens the read-only progress panel once and reads live values', async () => {
  const environment = dom('dashboard', 'https://learning-feal.maic.chat/dashboard'), mock = mockAPI();
  const doc = environment.window.document, panel = doc.querySelector('[data-progress-panel]'); panel.hidden = true;
  let clicks = 0; doc.querySelector('button').onclick = () => { clicks++; panel.hidden = false; };
  const assistant = new Assistant(doc, mock.api);
  try {
    await assistant.init(); await assistant.command('START'); await assistant.command('REFRESH'); await assistant.command('REFRESH');
    assert.equal(clicks, 1); assert.equal((await mock.store.data(assistant.profile)).progress.some(row => row.value.modules?.total === 10), true);
  } finally { assistant.destroy(); environment.window.close(); }
});
test('user-selected div course opening clicks the discovered card, not an arbitrary label', async () => {
  const environment = new JSDOM('<main><section><div><h2>Educational Psychology</h2><p>长期有效</p><p>已学习0%</p><div role="button">开始学习</div></div></section></main>', { url: 'https://maic.chat/my_study' });
  const mock = mockAPI(), assistant = new Assistant(environment.window.document, mock.api);
  await mock.store.patchTab(1, { profile: 'local:course-test', manualProfile: 'local:course-test', profileOverride: true });
  let clicks = 0; environment.window.document.querySelector('[role=button]').onclick = () => { clicks++; };
  try {
    await assistant.init(); await assistant.command('START'); await assistant.command('OPEN_VISIBLE', { id: 'course-visible:Educational Psychology' });
    assert.equal(clicks, 1); assert.equal(assistant.state.mode, 'paused');
    await assert.rejects(() => assistant.command('OPEN_VISIBLE', { id: 'invented' }), /tạm dừng/);
  } finally { assistant.destroy(); environment.window.close(); }
});
