import { all, textOf, uniqueControl, rootsFor, waitFor } from '../utils/selectors.js';
export async function revealProgress(doc, state) {
  const roots = rootsFor(doc).roots;
  if (all(roots, '[role="dialog"],[data-progress-panel],section').some(el => /已完成\s*\d+\s*\/\s*共\s*\d+\s*个模块/.test(textOf(el)))) return;
  const labels = [...new Set(all(roots, 'button,[role="button"],div,span').filter(el => el.children.length < 3)
    .map(textOf).filter(text => /^(?:学习进度|Learning Progress|Progress)\s*(?:\d{1,3}%\s*)?$/.test(text)))];
  if (labels.length !== 1) throw new Error('Hãy mở bảng 学习进度 trên MAIC và chọn 全部课程 rồi đọc lại.');
  const checkpoint = state.checkpoint(); uniqueControl(roots, labels).click();
  await waitFor(doc, () => /已完成\s*\d+\s*\/\s*共\s*\d+\s*个模块/.test(textOf(doc.body)), { signal: checkpoint.signal });
}
