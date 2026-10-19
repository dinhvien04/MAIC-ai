import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { dom, CLASSROOM_URL } from './helpers.js';
import { pageType, classroomIds, safeUrl, authState, accountProfile } from '../src/core/context.js';
import { readSlide, parseCounter, slideCounter, activityState } from '../src/content/slide-reader.js';
import { parseProgress, readProgress } from '../src/content/progress-reader.js';
import { discoverModules, allowedLessonUrl } from '../src/core/module-manager.js';
import { rootsFor, textOf } from '../src/utils/selectors.js';
import { makeNotes, exportMarkdown } from '../src/core/notes.js';

test('page detection and classroom IDs only accept the two exact HTTPS origins', () => {
  for (const [url, expected] of [[CLASSROOM_URL, 'classroom'], ['https://maic.chat/', 'main'], ['https://maic.chat/my_study', 'my-learning'], ['https://maic.chat/course_introduction/abc', 'course-introduction'], ['https://learning-feal.maic.chat/dashboard', 'dashboard'], ['https://learning-feal.maic.chat/login', 'login'], ['https://learning-feal.maic.chat/assessment', 'assessment'], ['https://maic.chat/x', 'unknown'], ['https://maic.chat.evil.test/', 'unsupported']]) assert.equal(pageType(url), expected);
  assert.equal(classroomIds(CLASSROOM_URL).moduleId, 'course/chapter/lesson');
  assert.equal(classroomIds('https://learning-feal.maic.chat/classroom/a/b/c'), null);
  for (const url of ['http://maic.chat/', 'https://u:p@maic.chat/', 'https://maic.chat:9000/', 'javascript:alert(1)']) assert.equal(safeUrl(url), null);
});
test('slide counters reject ambiguous, invalid and historical counts', () => {
  assert.deepEqual(parseCounter(' 2 / 31 '), { current: 2, total: 31 });
  for (const value of ['0/31', '32/31', '2/0', '31%', 'Viewed 2/31', '2/9999']) assert.equal(parseCounter(value), null);
  const { window } = dom();
  window.document.querySelector('main').insertAdjacentHTML('beforeend', '<span>3/18</span>');
  assert.equal(slideCounter([window.document]), null); window.close();
});
test('reads course/module, visible content, current-page transcript and source time', () => {
  const { window } = dom(), doc = window.document;
  doc.querySelector('main').insertAdjacentHTML('beforeend', '<p hidden>SECRET HIDDEN</p><input type="password" value="NEVER_READ">');
  let slide = readSlide(doc);
  assert.equal(slide.moduleTitle, 'Introduction'); assert.equal(slide.courseTitle, 'The Major Schools of Educational Theory');
  assert.equal(slide.slideNumber, 1); assert.equal(slide.totalSlides, 31); assert.match(slide.content, /Theory informs/); assert.equal(slide.transcript, '');
  doc.querySelector('#transcript').hidden = false; slide = readSlide(doc);
  assert.match(slide.transcript, /Welcome/); assert.doesNotMatch(slide.transcript, /four key/);
  assert.doesNotMatch(textOf(doc.body), /SECRET HIDDEN|NEVER_READ/); window.close();
});
test('supports generated div controls and transcript container with visible label', () => {
  const { window } = new JSDOM('<div>Course / Module / Lesson</div><div><b>分页讲稿</b><p>P1页</p><p>Actual narration for page one.</p></div><a2mpage>Actual slide.</a2mpage><div><span>1</span>/<span>2</span></div>', { url: CLASSROOM_URL });
  const slide = readSlide(window.document); assert.equal(slide.moduleTitle, 'Lesson'); assert.equal(slide.slideNumber, 1); assert.match(slide.transcript, /Actual narration/); window.close();
});
test('open shadow DOM and same-origin frame are readable without origin bypass', () => {
  const { window } = dom(), doc = window.document;
  doc.querySelector('a2mpage').remove();
  const host = doc.createElement('div'); doc.body.append(host); host.attachShadow({ mode: 'open' }).innerHTML = '<a2mpage>Shadow text</a2mpage>';
  assert.match(readSlide(doc).content, /Shadow text/); host.remove();
  const iframe = doc.createElement('iframe'); iframe.title = 'a2mpage'; doc.body.append(iframe); iframe.contentDocument.body.innerHTML = '<p>Frame text</p>';
  assert.match(readSlide(doc).content, /Frame text/);
  Object.defineProperty(iframe, 'contentDocument', { get() { throw new Error('Cross origin'); } });
  assert.match(readSlide(doc).diagnostic, /iframe khác origin/); window.close();
});
test('multiple mounted slides require a unique active slide, not concatenated old pages', () => {
  const { window } = dom(), doc = window.document;
  doc.querySelector('main').insertAdjacentHTML('beforeend', '<a2mpage data-slide-number="2">Different slide text.</a2mpage>');
  assert.equal(readSlide(doc).content, ''); assert.match(readSlide(doc).diagnostic, /Nhiều vùng slide/);
  doc.querySelector('a2mpage').setAttribute('data-slide-number', '1');
  assert.match(readSlide(doc).content, /Theory informs/); assert.doesNotMatch(readSlide(doc).content, /Different slide/); window.close();
});
test('unrelated same-origin iframe content is never copied into study notes', () => {
  const { window } = dom(), doc = window.document;
  const iframe = doc.createElement('iframe'); iframe.title = 'Personal chat'; doc.body.append(iframe); iframe.contentDocument.body.textContent = 'UNRELATED_PRIVATE_CHAT';
  assert.doesNotMatch(readSlide(doc).content, /UNRELATED_PRIVATE_CHAT/); window.close();
});
test('questions and finish controls pause, hidden quiz content does not', () => {
  const { window } = dom(), doc = window.document;
  assert.equal(activityState([doc], doc.URL), null);
  const quiz = doc.createElement('section'); quiz.innerHTML = '<p>单选题</p><button>完成</button>'; quiz.hidden = true; doc.body.append(quiz);
  assert.equal(activityState([doc], doc.URL), null); quiz.hidden = false; assert.equal(activityState([doc], doc.URL), 'question'); window.close();
});
test('UI progress parsing is dynamic and does not invent the remaining fifty modules', () => {
  assert.deepEqual(parseProgress('全部课程 已完成 3 / 共 12 个模块 Questionnaire 1/4 论文 0/1').modules, { completed: 3, total: 12 });
  assert.equal(parseProgress('Nothing').modules, null);
  const { window } = dom('dashboard', 'https://learning-feal.maic.chat/dashboard'), doc = window.document;
  const progress = readProgress([doc], doc.URL);
  assert.deepEqual(progress.modules, { completed: 1, total: 10 }); assert.deepEqual(progress.questionnaires, { completed: 2, total: 4 }); assert.deepEqual(progress.paper, { completed: 0, total: 1 }); assert.equal(progress.pretest, 'locked');
  assert.equal(progress.questionnaireDetails.filter(x => x.status === 'completed').length, 2);
  doc.querySelector('h2').textContent = 'Educational Psychology'; assert.equal(readProgress([doc], doc.URL).modules, null); window.close();
});
test('module discovery keeps only observed modules and never equates 100% to official completion', () => {
  const { window } = dom('dashboard', 'https://learning-feal.maic.chat/dashboard'), doc = window.document;
  const modules = discoverModules([doc], doc.URL); assert.equal(modules.length, 2);
  assert.equal(modules.find(x => x.id === 'visible:Classical Developmental Theories Ⅰ').url, null);
  assert.equal(modules.find(x => x.url)?.officialStatus, 'completed');
  doc.querySelector('li[data-module-id]').insertAdjacentHTML('beforeend', '<span>100%</span>');
  assert.equal(discoverModules([doc], doc.URL)[0].officialStatus, 'not-completed');
  assert.equal(allowedLessonUrl('https://maic.chat/course/homework/a/b'), false); window.close();
});
test('auth detection avoids credentials and account profiles are hashed', async () => {
  const { window } = dom(); assert.equal(authState(window.document), 'appears-authenticated');
  window.document.body.insertAdjacentHTML('beforeend', '<input type="password">'); assert.equal(authState(window.document), 'login-required');
  const a = await accountProfile('account-a'), b = await accountProfile('account-b'); assert.notEqual(a, b); assert.doesNotMatch(a, /account-a/); window.close();
});
test('actual MAIC div course cards are discovered without generated CSS classes', () => {
  const { window } = new JSDOM('<main><section><div><h2>Educational Psychology</h2><p>长期有效</p><p>已学习3.23%</p><div>继续学习</div></div></section></main>', { url: 'https://maic.chat/my_study' });
  const cards = discoverModules([window.document], window.document.URL);
  assert.equal(cards.length, 1); assert.equal(cards[0].title, 'Educational Psychology'); assert.equal(cards[0].browsingPercent, 3.23); assert.equal(cards[0].officialStatus, 'unknown'); window.close();
});
test('notes are rule-based and exported metadata excludes account IDs and query strings', () => {
  const slide = { ...readSlide(dom().window.document), profile: 'PRIVATE-ACCOUNT', url: `${CLASSROOM_URL}?token=SECRET` };
  const note = makeNotes(slide), markdown = exportMarkdown([note]); assert.match(note.method, /không phải/); assert.ok(note.keywords.includes('theory'));
  assert.doesNotMatch(markdown, /PRIVATE-ACCOUNT|token=SECRET/); assert.match(markdown, /Introduction/);
});
