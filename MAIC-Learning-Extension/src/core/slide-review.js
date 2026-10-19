export const DEFAULT_REVIEW_INTERVAL = 3000;
export const REVIEW_MODES = ['stopped', 'reviewing', 'paused', 'blocked', 'completed'];
export function reviewQuestion(slide) {
  return Boolean(slide?.activity || /单选题|多选题|\bquiz\b|\bassessment\b|\bfinal\s+exam\b/i.test(
    [slide?.moduleTitle, slide?.content, slide?.transcript, slide?.explanations].filter(Boolean).join('\n')));
}
export function hasReviewContent(slide) { return Boolean(slide && (slide.content?.trim() || slide.transcript?.trim() || slide.explanations?.trim())); }
export function validReviewInterval(value) {
  const interval = Number(value);
  if (!Number.isFinite(interval) || interval < 100 || interval > 3600000) throw new Error('Khoảng chuyển trang phải từ 0,1 đến 3600 giây.');
  return Math.round(interval);
}

// Deliberately contains no DOM, browser navigation, audio or MAIC progress APIs.
// One timeout drives the saved-content viewer even after the popup closes.
export class SlideReview {
  constructor({ now = () => Date.now(), setTimer = (callback, delay) => setTimeout(callback, delay), clearTimer = handle => clearTimeout(handle), onUpdate = () => {} } = {}) {
    this.now = now; this.setTimer = setTimer; this.clearTimer = clearTimer; this.onUpdate = onUpdate;
    this.state = { mode: 'stopped', moduleId: null, currentSlide: null, totalSlides: null, intervalMs: DEFAULT_REVIEW_INTERVAL,
      remainingMs: DEFAULT_REVIEW_INTERVAL, deadline: null, reason: 'Chỉ xem nội dung đã lưu; không chuyển slide trên MAIC.' };
    this.slides = new Map(); this.timer = null; this.generation = 0;
  }
  snapshot() {
    return { ...this.state, remainingMs: this.state.mode === 'reviewing' ? Math.max(0, this.state.deadline - this.now()) : this.state.remainingMs };
  }
  current() { return this.slides.get(this.state.currentSlide) || null; }
  emit(persist = true) { this.onUpdate(this.snapshot(), persist); }
  cancel() { if (this.timer !== null) this.clearTimer(this.timer); this.timer = null; this.generation++; }
  load(slides, moduleId) {
    this.slides = new Map(slides.filter(slide => slide.moduleId === moduleId && Number.isInteger(slide.slideNumber))
      .map(slide => [slide.slideNumber, slide]));
  }
  start(slides, { moduleId, slideNumber = 1, totalSlides, intervalMs = this.state.intervalMs } = {}) {
    const interval = validReviewInterval(intervalMs);
    if (!moduleId || !Number.isInteger(slideNumber) || slideNumber < 1) throw new Error('Hãy chọn module và slide đã đọc để xem nhanh.');
    this.cancel(); this.load(slides, moduleId);
    const totals = [...new Set([...this.slides.values()].map(slide => slide.totalSlides).filter(value => Number.isInteger(value) && value > 0))];
    const total = totalSlides ?? (totals.length === 1 ? totals[0] : null);
    if (!Number.isInteger(total) || total < slideNumber || total > 2000 || totals.some(value => value !== total)) {
      this.stop('Chưa xác định thống nhất tổng số slide. Hãy đọc lại trang trên MAIC.');
      throw new Error(this.state.reason);
    }
    this.state = { mode: 'reviewing', moduleId, currentSlide: slideNumber, totalSlides: total, intervalMs: interval,
      remainingMs: interval, deadline: this.now() + interval, reason: 'Reviewing · Xem bản lưu cục bộ.' };
    if (this.checkCurrent()) { this.emit(); this.schedule(); }
    return this.snapshot();
  }
  checkCurrent() {
    if (!hasReviewContent(this.current())) { this.block(this.state.currentSlide); return false; }
    if (reviewQuestion(this.current())) {
      this.pause('Gặp câu hỏi / Quiz / Assessment / Final Exam. Hãy tự xem và tham gia trên MAIC.'); return false;
    }
    if (this.state.currentSlide === this.state.totalSlides) {
      this.cancel(); Object.assign(this.state, { mode: 'completed', deadline: null, remainingMs: 0,
        reason: 'Đã tới slide cuối trong bản lưu. Không xác nhận hoàn thành học trên MAIC.' }); this.emit(); return false;
    }
    return true;
  }
  block(number) {
    this.cancel(); Object.assign(this.state, { mode: 'blocked', deadline: null, remainingMs: this.state.intervalMs,
      missingSlide: number, reason: `Chưa có nội dung slide ${number}. Hãy tự mở trang đó trên MAIC, bấm Đọc slide hoặc mở 分页讲稿 rồi Tiếp tục review.` }); this.emit();
  }
  schedule() {
    if (this.state.mode !== 'reviewing' || this.timer !== null) return;
    const generation = this.generation;
    this.timer = this.setTimer(() => {
      this.timer = null;
      if (generation !== this.generation || this.state.mode !== 'reviewing') return;
      if (this.now() >= this.state.deadline) {
        const next = this.state.currentSlide + 1;
        if (next > this.state.totalSlides) return this.stop('Đã tới slide cuối.');
        if (!hasReviewContent(this.slides.get(next))) return this.block(next);
        this.state.currentSlide = next;
        this.state.remainingMs = this.state.intervalMs; this.state.deadline = this.now() + this.state.intervalMs;
        if (!this.checkCurrent()) return;
        this.emit();
      } else this.emit(false);
      this.schedule();
    }, Math.max(1, Math.min(100, this.state.deadline - this.now())));
  }
  pause(reason = 'Paused · Đã tạm dừng trình xem nhanh.') {
    const remaining = this.snapshot().remainingMs; this.cancel();
    if (this.state.mode === 'stopped' || this.state.mode === 'completed') return this.snapshot();
    Object.assign(this.state, { mode: 'paused', remainingMs: remaining, deadline: null, reason }); this.emit(); return this.snapshot();
  }
  resume(slides = [...this.slides.values()]) {
    if (this.state.mode === 'reviewing') return this.snapshot();
    if (!this.state.moduleId || this.state.mode === 'stopped' || this.state.mode === 'completed') throw new Error('Bấm START để bắt đầu một lượt review.');
    this.cancel(); this.load(slides, this.state.moduleId);
    if (this.state.missingSlide && !hasReviewContent(this.slides.get(this.state.missingSlide))) {
      this.block(this.state.missingSlide); return this.snapshot();
    }
    delete this.state.missingSlide;
    Object.assign(this.state, { mode: 'reviewing', deadline: this.now() + this.state.remainingMs,
      reason: 'Reviewing · Tiếp tục bản lưu cục bộ.' });
    if (this.checkCurrent()) { this.emit(); this.schedule(); }
    return this.snapshot();
  }
  stop(reason = 'Stopped · Đã dừng trình xem nhanh.') {
    this.cancel(); Object.assign(this.state, { mode: 'stopped', remainingMs: this.state.intervalMs, deadline: null, reason });
    this.emit(); return this.snapshot();
  }
  setInterval(intervalMs) {
    const value = validReviewInterval(intervalMs); this.cancel();
    Object.assign(this.state, { intervalMs: value, remainingMs: value, deadline: this.state.mode === 'reviewing' ? this.now() + value : null });
    this.emit(); this.schedule(); return this.snapshot();
  }
  restore(saved, slides) {
    this.cancel();
    if (!saved || !REVIEW_MODES.includes(saved.mode)) return this.snapshot();
    const interval = validReviewInterval(saved.intervalMs ?? DEFAULT_REVIEW_INTERVAL);
    if (!saved.moduleId) { this.state.intervalMs = interval; this.state.remainingMs = interval; return this.snapshot(); }
    if (!Number.isInteger(saved.currentSlide) || !Number.isInteger(saved.totalSlides) || saved.currentSlide < 1 || saved.currentSlide > saved.totalSlides) return this.snapshot();
    this.load(slides, saved.moduleId);
    this.state = { ...saved, intervalMs: interval, remainingMs: Math.min(interval, Math.max(0, Number.isFinite(saved.remainingMs) ? saved.remainingMs : interval)), deadline: null,
      mode: saved.mode === 'reviewing' ? 'paused' : saved.mode,
      reason: saved.mode === 'reviewing' ? 'Đã khôi phục vị trí. Bấm RESUME để tiếp tục xem bản lưu.' : saved.reason };
    this.emit(); return this.snapshot();
  }
}
