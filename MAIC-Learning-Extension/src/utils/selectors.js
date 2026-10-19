export const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
export function visible(element) {
  if (!element || element.closest?.('[hidden],[aria-hidden="true"],[data-maic-extension]')) return false;
  for (let node = element; node?.nodeType === 1; node = node.parentElement) {
    const style = node.ownerDocument.defaultView?.getComputedStyle(node);
    if (style?.display === 'none' || style?.visibility === 'hidden') return false;
  }
  return true;
}
export function textOf(element) {
  if (!element || !visible(element)) return '';
  // Text nodes only, excluding hidden/editable/personal input values. InnerText on
  // a detached clone loses layout, so inspect visibility in the original tree.
  const lines = [];
  const walk = node => {
    if (node.nodeType === 3) { lines.push(node.textContent); return; }
    if (node.nodeType !== 1 && node.nodeType !== 11) return;
    if (node.nodeType === 1 && (node.matches('script,style,noscript,input,textarea,select,[contenteditable="true"],[data-maic-extension]') || !visible(node))) return;
    const block = node.nodeType === 1 && /^(DIV|P|SECTION|ARTICLE|LI|H[1-6]|TR|BR|ASIDE|HEADER|NAV|MAIN)$/.test(node.tagName);
    if (block) lines.push('\n');
    for (const child of node.childNodes) walk(child);
    if (block) lines.push('\n');
  };
  walk(element);
  return lines.join('').replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n').trim().slice(0, 48000);
}
export function rootsFor(doc) {
  const roots = [doc], blocked = [];
  for (let index = 0; index < roots.length && index < 24; index++) {
    for (const element of roots[index].querySelectorAll('*')) {
      if (element.shadowRoot && visible(element)) roots.push(element.shadowRoot);
      if (element.tagName === 'IFRAME' && visible(element)) {
        try {
          const child = element.contentDocument;
          if (child?.documentElement) roots.push(child); else blocked.push(element);
        } catch { blocked.push(element); }
      }
    }
  }
  return { roots: [...new Set(roots)].slice(0, 24), blocked };
}
export function all(roots, selector) {
  return roots.flatMap(root => [...root.querySelectorAll(selector)]).filter(visible);
}
export function labelOf(element) {
  if (!element) return '';
  return normalize(element.getAttribute('aria-label') || element.getAttribute('title') || textOf(element));
}
export function exactControls(roots, labels) {
  const candidates = all(roots, 'button,a,[role="button"],[role="tab"],label,div,span,b,strong,h2,h3');
  return candidates.filter(el => labels.includes(normalize(el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent)) && labels.includes(labelOf(el)) &&
    ![...el.children].some(child => labels.includes(labelOf(child))));
}
export function disabled(element) {
  return element.matches(':disabled') || element.getAttribute('aria-disabled') === 'true' || element.hasAttribute('disabled') ||
    element.closest('[inert]') !== null;
}
export function uniqueControl(roots, labels) {
  const controls = exactControls(roots, labels).map(el => el.closest('button,[role="button"],a,label') || el);
  const unique = [...new Set(controls)].filter(el => !disabled(el));
  if (unique.length !== 1) throw new Error(unique.length ? `Nhiều nút “${labels[0]}”; cần chọn trực tiếp trên trang.` : `Không thấy nút “${labels[0]}” khả dụng.`);
  const element = unique[0];
  if (element.closest('form') || element.matches('button[type="submit"],input')) throw new Error('Không thao tác nút trong biểu mẫu.');
  return element;
}
export function waitFor(doc, predicate, { signal, timeout = 6000 } = {}) {
  return new Promise((resolve, reject) => {
    let observer, timer;
    const cleanup = () => { observer?.disconnect(); clearTimeout(timer); signal?.removeEventListener('abort', abort); doc.removeEventListener('load', check, true); };
    const abort = () => { cleanup(); reject(new Error('Thao tác đã hủy.')); };
    const check = () => { try { const value = predicate(); if (value) { cleanup(); resolve(value); return true; } } catch (error) { cleanup(); reject(error); return true; } return false; };
    if (signal?.aborted) return abort();
    if (check()) return;
    observer = new doc.defaultView.MutationObserver(check);
    for (const root of rootsFor(doc).roots) observer.observe(root.documentElement || root, { subtree: true, childList: true, characterData: true, attributes: true });
    doc.addEventListener('load', check, true);
    timer = setTimeout(() => { cleanup(); reject(new Error('Hết thời gian chờ giao diện. Không tự bấm lại.')); }, timeout);
    signal?.addEventListener('abort', abort, { once: true });
  });
}
