import { all, normalize, textOf, rootsFor, exactControls } from '../utils/selectors.js';
import { moduleContext } from '../core/context.js';
export function parseCounter(value) {
  const match = normalize(value).match(/^(\d{1,4})\s*\/\s*(\d{1,4})$/);
  if (!match) return null;
  const current = +match[1], total = +match[2];
  return current > 0 && current <= total && total <= 2000 ? { current, total } : null;
}
export function slideCounter(roots) {
  const candidates = all(roots, '[data-slide-counter],[aria-label*="slide" i],[role="status"],span,div,p')
    .filter(el => el.children.length <= 3).map(el => parseCounter(textOf(el))).filter(Boolean);
  const values = [...new Map(candidates.map(x => [`${x.current}/${x.total}`, x])).values()];
  return values.length === 1 ? values[0] : null;
}
export function activityState(roots, url = '') {
  const text = roots.map(root => textOf(root.body || root)).join('\n');
  if (/\/(exam|assessment|pre-?test|quiz)(\/|$)/i.test(new URL(url || 'https://maic.chat/').pathname)) return 'assessment';
  if (/(单选题|多选题|判断题|查看解析|提交答案|开始考试|开始前测|Single.choice question|Multiple.choice question)/i.test(text) ||
      all(roots, '[data-quiz],input[type="radio"],input[type="checkbox"][name*="answer" i]').length ||
      exactControls(roots, ['完成', 'Finish']).length) return 'question';
  return null;
}
export function readTranscript(roots, slide) {
  const sections = all(roots, '[data-transcript],[role="tabpanel"],[aria-label="分页讲稿"],[aria-label="Page Transcript"]');
  for (const header of exactControls(roots, ['分页讲稿', 'Page Transcript'])) {
    for (let parent = header.parentElement, depth = 0; parent && depth < 5 && !parent.matches('body,main,html'); parent = parent.parentElement, depth++) {
      const text = textOf(parent);
      if (/P\s*\d+\s*页/.test(text) && text.length < 30000) { sections.push(parent); break; }
    }
  }
  let texts = sections.filter(el => el.hasAttribute('data-transcript') || /讲稿|transcript/i.test(el.getAttribute('aria-label') || '') || /P\s*\d+\s*页/.test(textOf(el))).map(textOf);
  if (slide) texts = texts.map(text => {
    const matches = [...text.matchAll(/P\s*(\d+)\s*页/g)];
    if (!matches.length) return text;
    const index = matches.findIndex(match => +match[1] === slide.current);
    return index < 0 ? '' : text.slice(matches[index].index, matches[index + 1]?.index);
  });
  return [...new Set(texts.filter(Boolean))].join('\n').slice(0, 24000);
}
export function readSlide(doc, url = doc.URL) {
  const { roots, blocked } = rootsFor(doc);
  const slide = slideCounter(roots), context = moduleContext(roots, url);
  const elements = all(roots, '[data-slide-content],a2mpage,[role="document"][aria-label*="slide" i],.slide-content');
  // Only a recognizable slide frame is a body fallback. Other same-origin
  // frames may contain chat or account information and must not become notes.
  for (const root of roots) if (root.nodeType === 9 && root !== doc && root.body) {
    const frame = root.defaultView?.frameElement;
    const label = frame && ['title', 'name', 'aria-label'].map(name => frame.getAttribute(name) || '').join(' ');
    if (frame && (/a2mpage|slide|课件/i.test(label) || frame.closest('a2mpage,[data-slide-content]'))) elements.push(root.body);
  }
  const activeSelector = `[aria-current="page"],[aria-current="true"],[data-active="true"],[data-slide-number="${slide?.current}"],[data-page="${slide?.current}"]`;
  const activeElements = elements.filter(element => element.closest(activeSelector) || element.ownerDocument.defaultView?.frameElement?.matches(activeSelector));
  const texts = [...new Set((activeElements.length ? activeElements : elements).map(textOf).filter(Boolean))];
  // Some classrooms keep several pages mounted. Without a unique active region,
  // saving their concatenation under the current page number would be incorrect.
  const ambiguous = texts.length > 1;
  const content = texts.length === 1 ? texts[0].slice(0, 24000) : '';
  const transcript = readTranscript(roots, slide);
  const explanations = all(roots, '[data-explanation],[aria-label="AI Teacher"],[aria-label="课程解析"]').map(textOf).join('\n').slice(0, 12000);
  return { ...context, slideNumber: slide?.current ?? null, totalSlides: slide?.total ?? null,
    content, transcript, explanations, activity: activityState(roots, url), extractedAt: new Date().toISOString(),
    diagnostic: ambiguous ? 'Nhiều vùng slide cùng hiển thị, chưa xác định trang hiện tại. Hãy dùng 分页讲稿 hoặc chọn slide trực tiếp trên MAIC.' :
      blocked.length ? 'Một số iframe khác origin không đọc được. Chỉ lưu phần văn bản truy cập được.' :
      !content && !transcript ? 'Chưa thấy văn bản slide. Hãy mở 分页讲稿; nội dung có thể là ảnh/canvas hoặc khung không truy cập được.' : null };
}
