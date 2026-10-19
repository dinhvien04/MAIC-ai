import { extensionAPI, listen, request } from '../core/messaging.js';
import { pageType, authState, accountMarker, accountProfile, cleanUrl, moduleContext } from '../core/context.js';
import { rootsFor, disabled } from '../utils/selectors.js';
import { readSlide, slideCounter } from './slide-reader.js';
import { readProgress } from './progress-reader.js';
import { discoverModules, allowedLessonUrl, moduleEntries } from '../core/module-manager.js';
import { revealProgress } from './learning-assistant.js';
import { StudyState } from '../core/state.js';
import { moveSlide, autoState, setAuto, revealTranscript } from '../core/navigation.js';
import { makeNotes } from '../core/notes.js';
import { Overlay } from '../overlay/overlay.js';

export class Assistant {
  constructor(doc, api) {
    this.doc = doc; this.api = api; this.state = new StudyState(); this.profile = 'local:default';
    this.preferences = { fastMode: true, autoCapture: true }; this.lastUrl = doc.URL;
    this.overlay = new Overlay(doc, action => this.command(action));
    this.keyHandler = event => this.onKey(event); this.routeHandler = () => this.schedule();
    this.focusHandler = () => this.schedule(); this.busy = false;
  }
  async init() {
    const { tab, preferences } = await request(this.api, 'HELLO');
    this.preferences = preferences; this.profile = tab.profile; this.manualProfile = tab.manualProfile || 'local:default'; this.profileOverride = tab.profileOverride;
    // Reload restores a safe checkpoint, never turns the site's Auto on.
    if (tab.mode !== 'stopped') { this.state.set('paused', 'Trang vừa tải lại. Bấm Tiếp tục để khôi phục.'); this.watch(); }
    await this.inspect();
    this.unlisten = listen(this.api.runtime.onMessage, (message, sender) => {
      if (sender.tab || message.type !== 'COMMAND') throw new Error('Lệnh chỉ nhận từ giao diện extension.');
      if (message.expectedUrl && cleanUrl(message.expectedUrl) !== cleanUrl(this.doc.URL)) throw new Error('Tab đã đổi trang. Hãy mở lại popup.');
      return this.command(message.command, message.args);
    });
  }
  watch() {
    this.unwatch();
    this.observer = new this.doc.defaultView.MutationObserver(records => {
      if (records.some(record => !record.target.closest?.('[data-maic-extension]'))) this.schedule();
    });
    this.observer.observe(this.doc.documentElement, { childList: true, subtree: true, characterData: true, attributes: true,
      attributeFilter: ['hidden', 'aria-hidden', 'aria-checked', 'checked', 'disabled', 'aria-disabled', 'class', 'style'] });
    this.doc.addEventListener('keydown', this.keyHandler);
    this.doc.defaultView.addEventListener('popstate', this.routeHandler);
    this.doc.defaultView.addEventListener('hashchange', this.routeHandler);
    this.doc.defaultView.addEventListener('focus', this.focusHandler);
    // Navigation API observes pushState in Chromium; DOM observer + popstate handles Firefox.
    this.doc.defaultView.navigation?.addEventListener('navigate', this.routeHandler);
  }
  unwatch() {
    this.observer?.disconnect(); clearTimeout(this.timer); this.timer = null;
    this.doc.removeEventListener('keydown', this.keyHandler);
    this.doc.defaultView.removeEventListener('popstate', this.routeHandler);
    this.doc.defaultView.removeEventListener('hashchange', this.routeHandler);
    this.doc.defaultView.removeEventListener('focus', this.focusHandler);
    this.doc.defaultView.navigation?.removeEventListener('navigate', this.routeHandler);
  }
  schedule() {
    if (this.timer || this.state.mode === 'stopped') return;
    this.timer = setTimeout(() => { this.timer = null; this.inspect().catch(error => this.fail(error)); }, 450);
  }
  async inspect() {
    const checkpoint = this.state.checkpoint();
    const { roots } = rootsFor(this.doc); const type = pageType(this.doc.URL), auth = authState(this.doc, roots);
    const marker = accountMarker(roots);
    const profile = !this.profileOverride && marker ? await accountProfile(marker) : this.manualProfile;
    if (!this.state.valid(checkpoint)) return this.status;
    if (profile !== this.profile) {
      this.observationSignature = null; this.fingerprint = null;
      if (this.state.mode === 'running') this.pause('Tài khoản/hồ sơ đã đổi. Kiểm tra hồ sơ rồi tiếp tục.');
    }
    this.profile = profile;
    if (this.lastUrl !== this.doc.URL) {
      this.lastUrl = this.doc.URL;
      if (this.state.mode === 'running') this.pause('Trang đã đổi. Kiểm tra module rồi bấm Tiếp tục.');
      this.fingerprint = null;
    }
    if (auth === 'login-required' && this.state.mode !== 'stopped') this.pause('Phiên đăng nhập cần kiểm tra. Hãy đăng nhập thủ công.');
    if (type === 'assessment' && this.state.mode !== 'stopped') this.pause('Trang đánh giá: trợ lý tạm dừng; tự thao tác trên MAIC.');
    this.slide = type === 'classroom' && auth !== 'login-required' ? this.state.mode === 'stopped'
      ? { ...moduleContext(roots, this.doc.URL), slideNumber: slideCounter(roots)?.current ?? null, totalSlides: slideCounter(roots)?.total ?? null }
      : readSlide(this.doc) : null;
    if (this.slide?.activity && this.state.mode === 'running') this.pause('Phát hiện câu hỏi. Hãy tự trả lời và hoàn thành trên MAIC.');
    if (this.observer && this.state.mode !== 'stopped') {
      for (const root of roots) this.observer.observe(root.documentElement || root, { childList: true, subtree: true, characterData: true, attributes: true,
        attributeFilter: ['hidden', 'aria-hidden', 'aria-checked', 'checked', 'disabled', 'aria-disabled', 'class', 'style'] });
    }
    if (type === 'classroom' && this.state.mode !== 'stopped') {
      this.overlay.mount(); this.overlay.update(this.slide, this.state.reason);
    } else this.overlay.remove();
    await this.report(type, auth);
    if (this.state.mode !== 'stopped' && auth !== 'login-required' && type !== 'assessment') {
      const observation = { modules: discoverModules(roots, this.doc.URL), progress: readProgress(roots, cleanUrl(this.doc.URL)) };
      if (this.slide?.moduleId) observation.modules.push({ id: this.slide.moduleId, title: this.slide.moduleTitle || 'Module chưa rõ tên',
        kind: 'module', url: cleanUrl(this.doc.URL), officialStatus: 'unknown', browsingPercent: null, sourceUrl: cleanUrl(this.doc.URL), observedAt: new Date().toISOString() });
      const signature = JSON.stringify(observation, (key, value) => ['observedAt'].includes(key) ? undefined : value);
      if (signature !== this.observationSignature) {
        await request(this.api, 'SAVE_OBSERVATION', { observation }); this.observationSignature = signature;
      }
      if (this.preferences.autoCapture && this.state.mode === 'running' && this.slide?.slideNumber && !this.slide.activity && (this.slide.content || this.slide.transcript)) {
        const fingerprint = JSON.stringify([this.profile, this.slide.moduleId, this.slide.slideNumber, this.slide.content, this.slide.transcript]);
        if (fingerprint !== this.fingerprint) {
          await request(this.api, 'SAVE_SLIDE', { slide: this.slide }); this.fingerprint = fingerprint;
        }
      }
    }
    return this.status;
  }
  async report(type = pageType(this.doc.URL), auth = authState(this.doc)) {
    this.status = { mode: this.state.mode, reason: this.state.reason, pageType: type, auth, profile: this.profile,
      manualProfile: this.manualProfile, profileOverride: Boolean(this.profileOverride), slide: this.slide,
      url: cleanUrl(this.doc.URL), auto: type === 'classroom' ? autoState(this.doc) : null, preferences: this.preferences };
    await request(this.api, 'TAB_STATUS', { status: this.status });
    if (this.overlay.host) this.overlay.update(this.slide, this.state.reason);
    return this.status;
  }
  pause(reason = 'Đã tạm dừng. Chế độ 自动 đã được tắt nếu nhận diện được.') {
    this.state.set('paused', reason);
    if (autoState(this.doc) === true) { try { setAuto(this.doc, false); } catch { this.state.reason += ' Không tắt được 自动; hãy tắt trực tiếp trên trang.'; } }
  }
  fail(error) {
    if (this.state.mode === 'stopped') return;
    this.pause(error.message); this.report().catch(console.error);
  }
  async command(action, args = {}) {
    if (action === 'ROUTE') { if (this.state.mode !== 'stopped') return this.inspect(); return this.status; }
    if (action === 'STATUS') return this.inspect();
    if (action === 'STOP') {
      this.pause(); this.state.set('stopped', 'Đã dừng trợ lý.'); this.unwatch(); this.overlay.remove();
      return this.report();
    }
    if (action === 'PAUSE') { if (this.state.mode !== 'stopped') this.pause(); return this.report(); }
    if (this.busy) throw new Error('Đang xử lý thao tác trước. Không bấm lặp lại.');
    this.busy = true;
    try {
      if (this.lastUrl !== this.doc.URL && !['CONFIGURE', 'START', 'RESUME'].includes(action)) {
        await this.inspect(); throw new Error('Trang đã đổi. Kiểm tra module rồi Tiếp tục.');
      }
      if (action === 'CONFIGURE') {
        this.pause(); this.state.set('stopped', 'Đã đổi hồ sơ. Bấm Bật trợ lý.'); this.unwatch(); this.overlay.remove();
        const { tab, preferences } = await request(this.api, 'HELLO');
        this.profile = tab.profile; this.manualProfile = tab.manualProfile; this.profileOverride = tab.profileOverride; this.preferences = preferences;
        this.observationSignature = null; this.fingerprint = null; return this.inspect();
      }
      if (action === 'START' || action === 'RESUME') {
        if (authState(this.doc) === 'login-required') throw new Error('Hãy đăng nhập trực tiếp trên trang trước.');
        if (pageType(this.doc.URL) === 'assessment') throw new Error('Không bật trợ lý trong bài đánh giá.');
        if (!this.profileOverride && !accountMarker(rootsFor(this.doc).roots) && this.manualProfile === 'local:default') throw new Error('Chưa nhận diện tài khoản. Vào Cài đặt, đặt hồ sơ cục bộ riêng cho tài khoản này rồi bật lại.');
        if (pageType(this.doc.URL) === 'classroom' && readSlide(this.doc).activity) throw new Error('Đang có câu hỏi. Trợ lý giữ tạm dừng cho đến khi bạn rời câu hỏi.');
        this.state.set('running', 'Đang hỗ trợ đọc. Điều hướng do bạn chọn.'); this.watch(); return await this.inspect();
      }
      if (action === 'REFRESH') {
        if (this.state.mode === 'stopped') throw new Error('Bật trợ lý trước khi đọc tiến độ.');
        if (pageType(this.doc.URL) === 'dashboard') await revealProgress(this.doc, this.state);
        this.observationSignature = null; return await this.inspect();
      }
      if (['NEXT', 'PREVIOUS', 'AUTO', 'OPEN_MODULE', 'OPEN_VISIBLE', 'TRANSCRIPT'].includes(action)) {
        this.state.assertRunning();
        const checkpoint = this.state.checkpoint(); await this.inspect();
        if (!this.state.valid(checkpoint)) throw new Error('Thao tác đã hủy do trạng thái, trang hoặc tài khoản thay đổi.');
        this.state.assertRunning();
      }
      if (['NEXT', 'PREVIOUS', 'AUTO', 'TRANSCRIPT'].includes(action) && pageType(this.doc.URL) !== 'classroom') throw new Error('Chỉ dùng thao tác này trong phòng học.');
      if (['NEXT', 'PREVIOUS'].includes(action)) await moveSlide(this.doc, action === 'NEXT' ? 'next' : 'previous', this.state);
      else if (action === 'AUTO') { if (readSlide(this.doc).activity) throw new Error('Đang có câu hỏi.'); setAuto(this.doc, Boolean(args.enabled)); }
      else if (['READ', 'NOTES', 'TRANSCRIPT'].includes(action)) {
        if (this.state.mode === 'stopped' || pageType(this.doc.URL) !== 'classroom') throw new Error('Bật trợ lý trong phòng học trước.');
        const checkpoint = this.state.checkpoint();
        const slide = action === 'TRANSCRIPT' ? await revealTranscript(this.doc, this.state) : readSlide(this.doc);
        if (!this.state.valid(checkpoint)) throw new Error('Thao tác đã hủy.');
        if (!slide.content && !slide.transcript) throw new Error(slide.diagnostic || 'Không đọc được nội dung.');
        await request(this.api, 'SAVE_SLIDE', { slide: action === 'NOTES' ? makeNotes(slide) : slide, notes: action === 'NOTES' });
        this.state.reason = action === 'NOTES' ? 'Đã lưu trích đoạn, từ khóa và mẫu ghi chú cục bộ.' : 'Đã lưu văn bản trang hiện tại.';
      } else if (action === 'OPEN_VISIBLE') {
        if (!['main', 'my-learning', 'course-introduction', 'dashboard'].includes(pageType(this.doc.URL))) throw new Error('Chỉ mở mục từ catalog hoặc bản đồ module.');
        const candidates = moduleEntries(rootsFor(this.doc).roots, this.doc.URL).filter(entry => entry.module.id === args.id);
        if (candidates.length !== 1) throw new Error('Mục đã đổi hoặc không còn hiện. Hãy chọn trực tiếp trên MAIC.');
        const element = candidates[0].element;
        if (disabled(element) || element.closest('form') || /^(?:提交.*|完成|开始考试|开始前测)$/.test(element.textContent.trim())) throw new Error('Không mở mục này bằng trợ lý.');
        this.pause('Đang mở mục bạn chọn; trang có thể ghi nhận một phiên học.');
        const checkpoint = this.state.checkpoint(); await this.report();
        if (!this.state.valid(checkpoint)) throw new Error('Đã hủy mở mục.');
        element.click(); this.schedule(); return this.status;
      } else if (action === 'OPEN_MODULE') {
        const checkpoint = this.state.checkpoint();
        if (pageType(this.doc.URL) === 'assessment' || (pageType(this.doc.URL) === 'classroom' && readSlide(this.doc).activity)) throw new Error('Không rời trang có câu hỏi/bài đánh giá bằng trợ lý.');
        if (!allowedLessonUrl(args.url)) throw new Error('URL module không hợp lệ.');
        const data = await request(this.api, 'HELLO');
        if (data.tab.profile !== this.profile) throw new Error('Hồ sơ đã đổi. Hãy mở lại popup.');
        const stored = await this.api.storage.local.get(null);
        const prefix = `data:${this.profile}:`;
        const known = Object.entries(stored).some(([key, value]) => key.startsWith(prefix) && value.url === args.url);
        if (!known) throw new Error('Module chưa được tìm thấy từ giao diện MAIC.');
        if (!this.state.valid(checkpoint)) throw new Error('Đã hủy mở module.');
        this.pause('Đang mở phiên học bạn đã chọn; vị trí slide do MAIC khôi phục.'); await this.report();
        if (this.state.mode === 'stopped') throw new Error('Đã hủy mở module.');
        this.doc.defaultView.location.assign(args.url); return this.status;
      } else if (!['NEXT', 'PREVIOUS', 'AUTO'].includes(action)) throw new Error('Lệnh không được hỗ trợ.');
      return await this.inspect();
    } catch (error) { this.fail(error); throw error; }
    finally { this.busy = false; }
  }
  onKey(event) {
    if (!this.preferences.fastMode || pageType(this.doc.URL) !== 'classroom' || !event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.repeat) return;
    if (event.composedPath().some(node => node?.matches?.('input,textarea,select,[contenteditable=""],[contenteditable="true"],[role="textbox"]'))) return;
    const action = { ArrowRight: 'NEXT', ArrowLeft: 'PREVIOUS', KeyP: 'PAUSE', KeyR: 'RESUME' }[event.code];
    if (!action || (this.state.mode !== 'running' && action !== 'RESUME')) return;
    event.preventDefault(); this.command(action).catch(error => this.fail(error));
  }
  destroy() { this.state.set('stopped', 'Tab đóng.'); this.unwatch(); this.overlay.remove(); this.unlisten?.(); }
}
if (typeof document !== 'undefined' && !globalThis.__MAIC_LEARNING_EXTENSION__) {
  globalThis.__MAIC_LEARNING_EXTENSION__ = true;
  const assistant = new Assistant(document, extensionAPI());
  assistant.init().catch(console.error);
  window.addEventListener('pagehide', () => assistant.destroy());
  window.addEventListener('pageshow', event => { if (event.persisted) assistant.init().catch(console.error); });
}
