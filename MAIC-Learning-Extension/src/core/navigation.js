import { rootsFor, uniqueControl, waitFor, all, labelOf, disabled } from '../utils/selectors.js';
import { readSlide } from '../content/slide-reader.js';
export function autoControl(doc) {
  const { roots } = rootsFor(doc);
  const controls = all(roots, 'input[type="checkbox"],[role="checkbox"]')
    .filter(element => {
      const labels = element.labels ? [...element.labels] : [];
      return [labelOf(element), ...labels.map(labelOf), labelOf(element.closest('label'))].some(text => /^(自动|Automatic|Auto)$/.test(text));
    });
  return controls.length === 1 ? controls[0] : null;
}
export function autoState(doc) {
  const control = autoControl(doc);
  if (!control) return null;
  return control.matches('input') ? control.checked : control.getAttribute('aria-checked') === 'true';
}
export function setAuto(doc, enabled) {
  const control = autoControl(doc);
  if (!control || disabled(control)) throw new Error('Không nhận diện chắc chắn ô 自动. Hãy đổi trực tiếp trên trang.');
  if (autoState(doc) !== enabled) control.click();
}
export async function moveSlide(doc, direction, state) {
  state.assertRunning();
  const before = readSlide(doc);
  if (before.activity) throw new Error('Đang có câu hỏi/bài đánh giá. Hãy thao tác trực tiếp trên MAIC.');
  if (!before.slideNumber) throw new Error('Chưa xác định số slide hiện tại.');
  if ((direction === 'next' && before.slideNumber >= before.totalSlides) || (direction === 'previous' && before.slideNumber <= 1)) throw new Error('Đã ở đầu/cuối bài.');
  const { roots } = rootsFor(doc), checkpoint = state.checkpoint(), oldUrl = doc.URL;
  const control = uniqueControl(roots, direction === 'next' ? ['下一页', 'Next Page'] : ['上一页', 'Previous Page']);
  state.assertRunning();
  control.click(); // Exactly one click, explicitly requested by the user.
  return waitFor(doc, () => {
    if (doc.URL !== oldUrl) throw new Error('Trang đã chuyển ngoài dự kiến. Đã dừng chờ.');
    const after = readSlide(doc);
    return after.slideNumber !== before.slideNumber && after.slideNumber !== null ? after : null;
  }, { signal: checkpoint.signal });
}
export async function revealTranscript(doc, state) {
  state.assertRunning();
  let slide = readSlide(doc);
  if (slide.transcript) return slide;
  const checkpoint = state.checkpoint();
  uniqueControl(rootsFor(doc).roots, ['分页讲稿', 'Page Transcript']).click();
  slide = await waitFor(doc, () => { const next = readSlide(doc); return next.transcript ? next : null; }, { signal: checkpoint.signal });
  return slide;
}
