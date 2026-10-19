import { extensionAPI, request, tabRequest } from '../core/messaging.js';
import { safeUrl, cleanUrl } from '../core/context.js';
import { exportMarkdown } from '../core/notes.js';
import { ReviewPanel, savedReviewModules } from '../ui/review-panel.js';
const api = extensionAPI(), $ = id => document.getElementById(id);
let tab, status, data, pending = false;
let storageTimer;
const reviewPanel = new ReviewPanel($('review-container'), (action, args) => command(action, args));
const countdownTimer = setInterval(() => reviewPanel.tick(), 100);
const MODE = { running: 'Đang hỗ trợ', paused: 'Tạm dừng', stopped: 'Đã dừng' };
const pair = value => value ? `${value.completed} / ${value.total}` : 'Chưa xác minh';
function error(message) { $('error').hidden = !message; $('error').textContent = message || ''; }
function bind(id, operation) { $(id).addEventListener('click', () => safely(operation)); }
async function safely(operation) {
  if (pending) return;
  pending = true; error('');
  try { await operation(); } catch (err) { error(err.message); }
  finally { pending = false; }
}
async function command(action, args = {}) {
  if (!tab?.id || !safeUrl(tab.url)) throw new Error('Hãy mở tab https://maic.chat hoặc https://learning-feal.maic.chat.');
  status = await tabRequest(api, tab.id, action, args, tab.url);
  await refreshData(); render();
}
async function refreshData() { data = await request(api, 'GET_DATA', { tabId: tab.id }); }
function latestProgress() {
  const values = {};
  for (const { value } of [...(data?.progress || [])].sort((a, b) => a.value.observedAt.localeCompare(b.value.observedAt))) {
    for (const key of ['modules', 'questionnaires', 'paper', 'pretest', 'topic', 'finalExam']) if (value[key] !== null) values[key] = { value: value[key], at: value.observedAt, source: value.sourceUrl };
  }
  return values;
}
function render() {
  $('badge').textContent = MODE[status.mode] || 'Chưa kết nối';
  $('website').textContent = `${new URL(status.url).hostname} · ${status.pageType}`;
  $('course').textContent = status.slide?.courseTitle || 'Tên khóa chưa xác định';
  $('module').textContent = status.slide?.moduleTitle || 'Mở module để đọc nội dung';
  $('slide').textContent = `${status.slide?.slideNumber ?? '?'} / ${status.slide?.totalSlides ?? '?'}`;
  $('reason').textContent = status.reason;
  $('auth').textContent = { 'login-required': 'Cần đăng nhập thủ công trên website.', 'appears-authenticated': 'Có dấu hiệu đã đăng nhập; chưa xác minh phía máy chủ.', unknown: 'Chưa xác định trạng thái đăng nhập.' }[status.auth];
  const classroom = status.pageType === 'classroom', running = status.mode === 'running';
  for (const id of ['next', 'previous', 'transcript']) $(id).disabled = !classroom || !running;
  for (const id of ['read', 'notes']) $(id).disabled = !classroom || status.mode === 'stopped';
  $('start').disabled = running || status.auth === 'login-required' || status.pageType === 'assessment';
  $('pause').disabled = !running; $('resume').disabled = status.mode !== 'paused'; $('stop').disabled = status.mode === 'stopped';
  $('auto').checked = status.auto === true; $('auto').disabled = !running || status.auto === null;
  $('auto-hint').textContent = status.auto === null ? 'Chưa nhận diện được ô 自动; có thể bật trực tiếp trên MAIC.' : '自动 dùng tín hiệu audio của MAIC; không tua hay giả thời gian nghe.';
  $('fast-mode').checked = status.preferences.fastMode; $('auto-capture').checked = status.preferences.autoCapture;
  $('profile').textContent = data.profile.startsWith('account:') ? 'Đã nhận diện tài khoản qua dấu hiệu UI; chỉ lưu mã băm cục bộ.' : `Hồ sơ: ${data.profile.replace(/^local:/, '')}`;
  $('profile-notice').hidden = data.profile !== 'local:default';
  $('profile-notice').textContent = 'Ghi chú đang lưu trong hồ sơ cục bộ mặc định. Đây không phải yêu cầu đăng nhập. Đổi hồ sơ trong Cài đặt khi đổi tài khoản MAIC.';
  reviewPanel.update(status.review || data.review, { modules: savedReviewModules(data.slides, status.slide) });
  const progress = latestProgress(); $('official').textContent = pair(progress.modules?.value);
  $('progress-list').replaceChildren();
  for (const [key, label] of [['modules', 'Module (toàn bộ khóa)'], ['questionnaires', 'Questionnaire'], ['paper', 'Bài luận'], ['pretest', 'Pre-test'], ['topic', 'Đề tài'], ['finalExam', 'Final Exam']]) {
    const item = document.createElement('div'); item.className = 'row';
    const value = progress[key];
    item.textContent = `${label}: ${!value ? 'Chưa xác minh' : typeof value.value === 'object' ? pair(value.value) : value.value === 'locked' ? 'Đang khóa' : value.value}`;
    if (value) { const source = document.createElement('small'); source.textContent = `Đọc ${new Date(value.at).toLocaleString('vi-VN')} · ${new URL(value.source).hostname}`; item.append(source); }
    $('progress-list').append(item);
  }
  $('observed').textContent = 'Các giá trị là lần quan sát đã lưu, có thể chưa đồng bộ. Mở bảng 学习进度, chọn 全部课程 rồi bấm Đọc lại tiến độ.';
  $('module-list').replaceChildren();
  for (const module of data.modules) {
    const item = document.createElement('div'); item.className = 'row'; item.textContent = module.title;
    const detail = document.createElement('small'); detail.textContent = `${module.kind === 'course' ? 'Khóa' : 'Module'} · ${module.officialStatus} · Duyệt bài: ${module.browsingPercent ?? '?'}%`; item.append(detail);
    if (module.url || module.sourceUrl === status.url) { const open = document.createElement('button'); open.textContent = 'Mở mục này (phiên học)'; open.disabled = !running;
      open.addEventListener('click', () => safely(() => command(module.url ? 'OPEN_MODULE' : 'OPEN_VISIBLE', module.url ? { url: module.url } : { id: module.id }))); item.append(open); }
    $('module-list').append(item);
  }
  if (!data.modules.length) $('module-list').textContent = 'Chưa tìm thấy module có cấu trúc đọc được trên trang hiện tại.';
  $('last-module').disabled = !data.lastModule || !running;
  const selected = $('slide-select').value; $('slide-select').replaceChildren();
  for (const [index, slide] of data.slides.entries()) {
    const option = document.createElement('option'); option.value = String(index); option.textContent = `${slide.moduleTitle || slide.moduleId} · ${slide.slideNumber}/${slide.totalSlides || '?'}`; $('slide-select').append(option);
  }
  if (selected && data.slides[+selected]) $('slide-select').value = selected;
  else if (status.slide) { const current = data.slides.findIndex(slide => slide.moduleId === status.slide.moduleId && slide.slideNumber === status.slide.slideNumber); if (current >= 0) $('slide-select').value = String(current); }
  showNote();
}
function selectedSlide() { return data?.slides[$('slide-select').value]; }
function showNote() {
  const slide = selectedSlide(); $('keywords').replaceChildren();
  for (const word of slide?.keywords || []) { const mark = document.createElement('mark'); mark.textContent = word; $('keywords').append(mark); }
  $('note-method').textContent = slide?.method || '';
  $('preview').textContent = slide ? [slide.summary, slide.content, slide.transcript, slide.explanations].filter(Boolean).join('\n\n') : 'Chưa lưu trang nào.';
  $('personal').value = slide?.personalNote || ''; $('save-note').disabled = !slide;
}
for (const [id, action] of [['start', 'START'], ['next', 'NEXT'], ['previous', 'PREVIOUS'], ['read', 'READ'], ['transcript', 'TRANSCRIPT'], ['notes', 'NOTES'], ['refresh', 'REFRESH'], ['pause', 'PAUSE'], ['resume', 'RESUME'], ['stop', 'STOP']]) {
  // Pause and Stop must preempt a pending next-slide wait.
  if (['STOP', 'PAUSE'].includes(action)) $(id).addEventListener('click', () => command(action).catch(err => error(err.message)));
  else bind(id, () => command(action));
}
$('auto').addEventListener('change', () => safely(() => command('AUTO', { enabled: $('auto').checked })));
$('slide-select').addEventListener('change', showNote);
for (const button of document.querySelectorAll('[data-panel]')) button.addEventListener('click', () => {
  for (const other of document.querySelectorAll('[data-panel]')) other.setAttribute('aria-selected', String(other === button));
  for (const panel of document.querySelectorAll('.tab-panel')) panel.hidden = panel.id !== button.dataset.panel;
});
bind('last-module', () => command('OPEN_MODULE', { url: data.lastModule.url }));
bind('set-profile', async () => {
  await command('STOP'); await request(api, 'SET_PROFILE', { tabId: tab.id, name: $('profile-name').value }); await command('CONFIGURE');
});
bind('save-settings', async () => {
  await request(api, 'SET_PREFERENCES', { preferences: { fastMode: $('fast-mode').checked, autoCapture: $('auto-capture').checked } }); await command('CONFIGURE');
});
bind('save-note', async () => {
  const slide = selectedSlide(); if (!slide) return;
  await request(api, 'PERSONAL_NOTE', { tabId: tab.id, moduleId: slide.moduleId, slideNumber: slide.slideNumber, text: $('personal').value }); await refreshData();
});
bind('export', () => {
  if (!data?.slides.length) throw new Error('Chưa có ghi chú để xuất.');
  const url = URL.createObjectURL(new Blob([exportMarkdown(data.slides)], { type: 'text/markdown;charset=utf-8' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'maic-study-notes.md'; document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 15000);
});
bind('delete-data', () => { $('delete-confirm').hidden = false; });
bind('cancel-delete', () => { $('delete-confirm').hidden = true; });
bind('confirm-delete', async () => { await command('STOP'); await request(api, 'DELETE_PROFILE', { tabId: tab.id }); $('delete-confirm').hidden = true; await refreshData(); render(); });
async function init() {
  [tab] = await api.tabs.query({ active: true, currentWindow: true });
  if (!safeUrl(tab?.url)) throw new Error('Mở tab MAIC rồi bấm lại extension. Sau khi cài extension lần đầu, tải lại tab MAIC.');
  await command('STATUS');
}
init().catch(err => { error(err.message); for (const button of document.querySelectorAll('.actions button')) button.disabled = true; });
api.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !tab || !status) return;
  const update = changes[`tab:${tab.id}`]?.newValue;
  if (update) status = update;
  if (storageTimer || (!update && !Object.keys(changes).some(key => key.startsWith(`data:${data?.profile}:`)))) return;
  storageTimer = setTimeout(async () => {
    storageTimer = null;
    reviewPanel.update(status.review || data?.review);
    // Preserve a draft the user is typing while the site moves to another slide.
    if (document.activeElement?.matches('input,textarea,select')) return;
    try { await refreshData(); render(); } catch (err) { error(err.message); }
  }, 150);
});
window.addEventListener('unload', () => { clearTimeout(storageTimer); clearInterval(countdownTimer); reviewPanel.destroy(); });
