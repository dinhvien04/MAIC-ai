import { safeUrl } from './context.js';
export function classifySender(sender, extensionId, extensionRoot) {
  if (sender.id !== extensionId) throw new Error('Nguồn gửi không hợp lệ.');
  if (sender.url?.startsWith(extensionRoot) && new URL(sender.url).pathname === '/popup/popup.html') return 'ui';
  if (Number.isInteger(sender.tab?.id) && safeUrl(sender.url || sender.tab.url) && (sender.frameId ?? 0) === 0) return 'content';
  throw new Error('Nguồn gửi không phải tab MAIC chính hoặc giao diện extension.');
}
