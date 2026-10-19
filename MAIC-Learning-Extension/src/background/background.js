import { extensionAPI, listen } from '../core/messaging.js';
import { Store, DEFAULT_PROFILE } from '../core/storage.js';
import { safeUrl, cleanUrl } from '../core/context.js';
import { classifySender } from '../core/sender.js';
const api = extensionAPI(), store = new Store(api.storage.local);

listen(api.runtime.onMessage, (message, sender) => store.transact(async () => {
  const runtime = (globalThis.browser || globalThis.chrome).runtime;
  const fromTab = classifySender(sender, runtime.id, runtime.getURL('')) === 'content';
  const tabId = fromTab ? sender.tab.id : message.tabId;
  const tab = Number.isInteger(tabId) ? await store.get(`tab:${tabId}`, { mode: 'stopped', profile: DEFAULT_PROFILE, manualProfile: DEFAULT_PROFILE }) : null;
  switch (message.type) {
    case 'HELLO':
      if (!fromTab) throw new Error('HELLO chỉ dành cho content script.');
      return { tab, preferences: await store.get('preferences', { fastMode: true, autoCapture: true }) };
    case 'TAB_STATUS':
      if (!fromTab) throw new Error('Không có tab.');
      return store.patchTab(tabId, { ...message.status, url: cleanUrl(sender.url || sender.tab.url) });
    case 'SAVE_SLIDE':
      if (!fromTab || !['running', 'paused'].includes(tab.mode)) throw new Error('Trợ lý đang dừng.');
      return store.saveSlide(tab.profile, message.slide, { notes: Boolean(message.notes) });
    case 'SAVE_OBSERVATION':
      if (!fromTab || tab.mode === 'stopped') throw new Error('Trợ lý đang dừng.');
      await store.saveObservation(tab.profile, message.observation); return true;
    case 'GET_DATA':
      if (fromTab || !tab) throw new Error('Hãy chọn một tab MAIC.');
      return { ...await store.data(tab.profile), profile: tab.profile, tab };
    case 'PERSONAL_NOTE':
      if (fromTab || !tab) throw new Error('Nguồn gửi không hợp lệ.');
      return store.personalNote(tab.profile, message.moduleId, message.slideNumber, message.text);
    case 'SET_PROFILE': {
      if (fromTab || !tab) throw new Error('Nguồn gửi không hợp lệ.');
      const name = String(message.name || '').trim();
      if (!/^[\p{L}\p{N} _-]{1,40}$/u.test(name)) throw new Error('Tên hồ sơ cần 1–40 chữ/số, dấu cách, _ hoặc -.');
      const profile = `local:${name}`;
      await store.patchTab(tabId, { mode: 'stopped', profile, manualProfile: profile, profileOverride: true });
      return profile;
    }
    case 'SET_PREFERENCES':
      if (fromTab) throw new Error('Chỉ sửa cài đặt từ popup.');
      return store.put('preferences', { fastMode: Boolean(message.preferences.fastMode), autoCapture: Boolean(message.preferences.autoCapture) });
    case 'DELETE_PROFILE':
      if (fromTab || !tab || tab.mode !== 'stopped') throw new Error('Dừng trợ lý trước khi xóa dữ liệu.');
      await store.deleteProfile(tab.profile); return true;
    default: throw new Error('Thông điệp không được hỗ trợ.');
  }
}));
api.tabs.onRemoved.addListener(tabId => { store.transact(() => api.storage.local.remove(`tab:${tabId}`)).catch(console.error); });
api.tabs.onUpdated.addListener((tabId, change, tab) => {
  if (change.url && safeUrl(tab.url)) api.tabs.sendMessage(tabId, { channel: 'maic-learning-v1', type: 'COMMAND', command: 'ROUTE' }).catch(() => {});
});
api.runtime.onStartup.addListener(() => {
  store.transact(async () => {
    const all = await api.storage.local.get(null);
    const keys = Object.keys(all).filter(key => key.startsWith('tab:'));
    if (keys.length) await api.storage.local.remove(keys);
  }).catch(console.error);
});
