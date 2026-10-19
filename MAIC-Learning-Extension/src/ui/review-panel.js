import styles from './review-panel.css';
export function savedReviewModules(slides, current) {
  const modules = new Map(slides.map(slide => [slide.moduleId, { id: slide.moduleId, title: slide.moduleTitle || slide.moduleId }]));
  if (current?.moduleId && !modules.has(current.moduleId)) modules.set(current.moduleId, { id: current.moduleId, title: current.moduleTitle || current.moduleId });
  return [...modules.values()];
}
export class ReviewPanel {
  constructor(parent, command) {
    this.doc = parent.ownerDocument; this.command = command; this.events = new this.doc.defaultView.AbortController();
    const el = (tag, className, text) => {
      const node = this.doc.createElement(tag); if (className) node.className = className; if (text) node.textContent = text; return node;
    };
    this.host = el('section', 'review-panel'); this.host.setAttribute('aria-label', 'AUTO SLIDE REVIEW'); parent.append(this.host);
    const style = el('style'); style.textContent = styles; this.host.append(style);
    this.host.append(el('h2', 'review-title', 'AUTO SLIDE REVIEW'), el('p', 'review-hint', 'Xem bản đã lưu · Không chuyển trang học MAIC'));
    this.modules = el('select', 'review-module'); this.modules.setAttribute('aria-label', 'Module để xem nhanh'); this.host.append(this.modules);
    const intervals = el('div', 'review-intervals'); intervals.setAttribute('aria-label', 'Interval'); this.host.append(intervals);
    this.presets = [];
    for (const seconds of [1, 2, 3, 5]) {
      const button = this.button(`${seconds}s`, () => this.run('REVIEW_INTERVAL', { intervalMs: seconds * 1000 }));
      button.dataset.interval = String(seconds * 1000); this.presets.push(button); intervals.append(button);
    }
    const label = el('label', 'review-custom', 'Custom (s)');
    this.custom = el('input'); this.custom.type = 'number'; this.custom.min = '0.1'; this.custom.max = '3600'; this.custom.step = '0.1'; this.custom.value = '3';
    this.custom.setAttribute('aria-label', 'Custom interval, giây'); label.append(this.custom); intervals.append(label);
    this.custom.addEventListener('change', () => this.run('REVIEW_INTERVAL', { intervalMs: Number(this.custom.value) * 1000 }), { signal: this.events.signal });
    const controls = el('div', 'review-controls'); this.host.append(controls); this.controls = {};
    for (const [label, action] of [['▶ START', 'REVIEW_START'], ['⏸ PAUSE', 'REVIEW_PAUSE'], ['▶ RESUME', 'REVIEW_RESUME'], ['⏹ STOP', 'REVIEW_STOP']]) {
      const button = this.button(label, () => this.run(action, { moduleId: this.modules.value })); button.dataset.action = action;
      controls.append(button); this.controls[action] = button;
    }
    this.position = el('p', 'review-position', 'Current Slide: ? / ?'); this.countdown = el('p', 'review-countdown', 'Next Slide In: —');
    this.status = el('p', 'review-status', 'Status: Stopped'); this.status.setAttribute('aria-live', 'polite');
    this.reason = el('p', 'review-hint'); this.content = el('pre', 'review-content', 'Bấm START để xem nội dung đã trích xuất.');
    this.host.append(this.position, this.countdown, this.status, this.reason, this.content);
    this.update(null);
  }
  button(label, operation) {
    const button = this.doc.createElement('button'); button.type = 'button'; button.textContent = label;
    button.addEventListener('click', operation, { signal: this.events.signal }); return button;
  }
  async run(action, args) {
    try { await this.command(action, args); } catch (error) { this.reason.textContent = error.message; }
  }
  update(review, { modules } = {}) {
    this.review = review;
    if (modules) {
      const selected = this.modules.value; this.modules.replaceChildren();
      for (const module of modules) { const option = this.doc.createElement('option'); option.value = module.id; option.textContent = module.title; this.modules.append(option); }
      if (modules.some(module => module.id === selected)) this.modules.value = selected;
      else if (modules.some(module => module.id === review?.moduleId)) this.modules.value = review.moduleId;
      this.modules.disabled = review?.mode === 'reviewing';
    }
    const interval = review?.intervalMs || 3000;
    for (const button of this.presets) button.setAttribute('aria-pressed', String(+button.dataset.interval === interval));
    if (this.doc.activeElement !== this.custom && this.custom.getRootNode().activeElement !== this.custom) this.custom.value = String(interval / 1000);
    const labels = { reviewing: 'Reviewing', paused: 'Paused', blocked: 'Stopped · Missing content', completed: 'Stopped · Last slide', stopped: 'Stopped' };
    this.status.textContent = `Status: ${labels[review?.mode] || 'Stopped'}`;
    this.position.textContent = `Current Slide: ${review?.currentSlide ?? '?'} / ${review?.totalSlides ?? '?'}`;
    this.reason.textContent = review?.reason || 'Đọc slide hiện tại hoặc chọn module có nội dung đã lưu.';
    const item = review?.item;
    this.content.textContent = item ? [item.moduleTitle, item.content, item.transcript && `分页讲稿\n${item.transcript}`, item.explanations].filter(Boolean).join('\n\n') : 'Chưa có nội dung trong trình xem nhanh.';
    this.controls.REVIEW_PAUSE.disabled = review?.mode !== 'reviewing';
    this.controls.REVIEW_RESUME.disabled = !['paused', 'blocked'].includes(review?.mode);
    this.controls.REVIEW_START.disabled = review?.mode === 'reviewing';
    this.controls.REVIEW_STOP.disabled = !review?.moduleId || review.mode === 'stopped';
    this.tick();
  }
  tick(now = Date.now()) {
    const review = this.review;
    const remaining = review?.mode === 'reviewing' ? Math.max(0, (review.deadline || now) - now) : review?.remainingMs;
    this.countdown.textContent = `Next Slide In: ${['reviewing', 'paused'].includes(review?.mode) ? `${((remaining || 0) / 1000).toFixed(1)}s` : '—'}`;
  }
  destroy() { this.events.abort(); this.host.remove(); }
}
