export function extensionAPI(scope = globalThis) {
  if (scope.browser?.runtime) return scope.browser;
  const chrome = scope.chrome;
  if (!chrome?.runtime) throw new Error('Không tìm thấy WebExtensions API.');
  const wrap = (owner, name) => (...args) => new Promise((resolve, reject) => {
    owner[name](...args, result => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message)); else resolve(result);
    });
  });
  return {
    runtime: { sendMessage: wrap(chrome.runtime, 'sendMessage'), onMessage: chrome.runtime.onMessage,
      onStartup: chrome.runtime.onStartup, getURL: chrome.runtime.getURL.bind(chrome.runtime) },
    storage: { onChanged: chrome.storage.onChanged, local: { get: wrap(chrome.storage.local, 'get'), set: wrap(chrome.storage.local, 'set'), remove: wrap(chrome.storage.local, 'remove') } },
    tabs: chrome.tabs && { query: wrap(chrome.tabs, 'query'), sendMessage: wrap(chrome.tabs, 'sendMessage'), onRemoved: chrome.tabs.onRemoved, onUpdated: chrome.tabs.onUpdated }
  };
}

// Callback + literal true works in both Firefox event pages and Chrome workers.
export function listen(event, handler) {
  const listener = (message, sender, respond) => {
    if (message?.channel !== 'maic-learning-v1') return false;
    Promise.resolve().then(() => handler(message, sender)).then(
      result => respond({ ok: true, result }), error => respond({ ok: false, error: error.message }));
    return true;
  };
  event.addListener(listener);
  return () => event.removeListener(listener);
}
export async function request(api, type, data = {}) {
  const response = await api.runtime.sendMessage({ channel: 'maic-learning-v1', type, ...data });
  if (!response?.ok) throw new Error(response?.error || 'Mất kết nối extension. Hãy tải lại tab MAIC.');
  return response.result;
}
export async function tabRequest(api, tabId, command, args = {}, expectedUrl) {
  const response = await api.tabs.sendMessage(tabId, { channel: 'maic-learning-v1', type: 'COMMAND', command, args, expectedUrl });
  if (!response?.ok) throw new Error(response?.error || 'Tab chưa kết nối. Hãy tải lại trang MAIC.');
  return response.result;
}
