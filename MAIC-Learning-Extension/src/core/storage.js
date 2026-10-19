import { cleanUrl, safeUrl, classroomIds } from './context.js';
export const DEFAULT_PROFILE = 'local:default';
export class Store {
  constructor(local) { this.local = local; this.queue = Promise.resolve(); }
  transact(operation) {
    const result = this.queue.then(operation);
    this.queue = result.catch(() => {});
    return result;
  }
  async get(key, fallback = null) { return (await this.local.get(key))[key] ?? fallback; }
  async put(key, value) { await this.local.set({ [key]: value }); return value; }
  async patchTab(id, patch) {
    return this.put(`tab:${id}`, { ...(await this.get(`tab:${id}`, { mode: 'stopped', profile: DEFAULT_PROFILE })), ...patch });
  }
  async data(profile) {
    const all = await this.local.get(null), prefix = `data:${profile}:`;
    const rows = Object.entries(all).filter(([key]) => key.startsWith(prefix)).map(([, value]) => value);
    return { slides: rows.filter(x => x.recordType === 'slide').sort((a, b) => a.moduleId.localeCompare(b.moduleId) || a.slideNumber - b.slideNumber),
      modules: rows.filter(x => x.recordType === 'module'), progress: rows.filter(x => x.recordType === 'progress'),
      lastModule: await this.get(`last:${profile}`) };
  }
  async saveSlide(profile, slide, { notes = false } = {}) {
    if (!slide.moduleId || !slide.slideNumber || !safeUrl(slide.url)) throw new Error('Chưa xác định module/trang; không lưu vào nhầm bài.');
    const key = `data:${profile}:slide:${encodeURIComponent(slide.moduleId)}:${slide.slideNumber}`;
    const previous = await this.get(key, {});
    const { slides } = await this.data(profile);
    if (!previous.moduleId && slides.length >= 600) throw new Error('Đã lưu 600 trang trong hồ sơ này. Xuất và xóa dữ liệu trước khi đọc thêm.');
    const value = { recordType: 'slide', moduleId: String(slide.moduleId).slice(0, 300),
      moduleTitle: slide.moduleTitle?.slice(0, 350) || previous.moduleTitle || null,
      courseTitle: slide.courseTitle?.slice(0, 350) || previous.courseTitle || null,
      slideNumber: slide.slideNumber, totalSlides: slide.totalSlides, url: cleanUrl(slide.url),
      content: slide.content?.slice(0, 24000) || previous.content || '',
      transcript: slide.transcript?.slice(0, 24000) || previous.transcript || '',
      explanations: slide.explanations?.slice(0, 12000) || previous.explanations || '',
      extractedAt: slide.extractedAt, summary: notes ? slide.summary : previous.summary || '',
      keywords: notes ? slide.keywords : previous.keywords || [], method: notes ? slide.method : previous.method || '',
      personalNote: previous.personalNote || '' };
    await this.put(key, value);
    await this.put(`last:${profile}`, { moduleId: value.moduleId, moduleTitle: value.moduleTitle, url: value.url, slideNumber: value.slideNumber, visitedAt: value.extractedAt });
    return value;
  }
  async personalNote(profile, moduleId, slideNumber, text) {
    const key = `data:${profile}:slide:${encodeURIComponent(moduleId)}:${slideNumber}`;
    const previous = await this.get(key);
    if (!previous) throw new Error('Hãy đọc trang trước khi lưu ghi chú.');
    return this.put(key, { ...previous, personalNote: String(text).slice(0, 12000) });
  }
  async saveObservation(profile, { modules = [], progress = null }) {
    for (const module of modules.slice(0, 150)) {
      await this.put(`data:${profile}:module:${encodeURIComponent(module.id)}`, { ...module, recordType: 'module' });
      if (module.sourceUrl === module.url && classroomIds(module.url)) await this.put(`last:${profile}`, {
        moduleId: module.id, moduleTitle: module.title, url: module.url, visitedAt: module.observedAt });
    }
    if (progress && Object.entries(progress).some(([key, value]) => ['modules', 'questionnaires', 'paper', 'pretest', 'topic', 'finalExam'].includes(key) && value !== null)) {
      // Keep provenance per UI location. An unavailable field must not erase a prior observation.
      const key = `data:${profile}:progress:${encodeURIComponent(progress.sourceUrl)}:${progress.scope}`;
      const previous = await this.get(key);
      const comparable = ({ observedAt, ...value }) => JSON.stringify(value);
      if (!previous || comparable(previous.value) !== comparable(progress)) await this.put(key, { recordType: 'progress', value: progress });
    }
  }
  async deleteProfile(profile) {
    const values = await this.local.get(null);
    const keys = Object.keys(values).filter(key => key.startsWith(`data:${profile}:`) || key === `last:${profile}`);
    if (keys.length) await this.local.remove(keys);
  }
}
