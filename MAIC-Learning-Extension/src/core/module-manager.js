import { all, textOf, normalize, exactControls } from '../utils/selectors.js';
import { safeUrl, classroomIds, cleanUrl } from './context.js';
export function moduleEntries(roots, pageUrl) {
  const results = [];
  for (const element of all(roots, 'a[href],li,[role="treeitem"],[data-module-id]')) {
    const href = element.getAttribute('href');
    const target = href ? safeUrl(new URL(href, pageUrl).href) : null;
    const ids = target && classroomIds(target.href);
    const courseLink = target?.hostname === 'maic.chat' && /^\/course_introduction\/[\w-]+\/?$/.test(target.pathname);
    const row = element.closest('li,article,tr,[role="treeitem"],[data-module-id]') || element;
    const raw = textOf(row);
    if ((!ids && !courseLink && !element.matches('[data-module-id],[role="treeitem"]')) || raw.length > 1400) continue;
    const title = normalize(textOf(element.querySelector('h2,h3,[data-module-title]') || element)).replace(/(?:已学完|已完成|未开始|未完成|已学习\s*\d+(?:\.\d+)?%)/g, '').trim().slice(0, 350);
    if (!title) continue;
    const percent = raw.match(/(?:已学习\s*)?(\d+(?:\.\d+)?)%/)?.[1];
    results.push({ element, module: { id: ids?.moduleId || (target ? target.pathname : `visible:${title}`),
      title, kind: courseLink ? 'course' : 'module', url: target ? cleanUrl(target.href) : null,
      officialStatus: /未完成|未开始/.test(raw) ? 'not-completed' : /已学完|已完成/.test(raw) ? 'completed' : 'unknown',
      browsingPercent: percent !== undefined && +percent <= 100 ? +percent : null,
      sourceUrl: cleanUrl(pageUrl), observedAt: new Date().toISOString() } });
  }
  // Observed MAIC cards use div controls and a text sequence instead of hrefs.
  for (const action of exactControls(roots, ['开始学习', '继续学习', '去复习'])) {
    for (let row = action.parentElement, depth = 0; row && depth < 6 && !row.matches('body,main,html'); row = row.parentElement, depth++) {
      const raw = textOf(row), percentages = [...raw.matchAll(/已学习\s*(\d+(?:\.\d+)?)%/g)];
      if (percentages.length !== 1 || raw.length > 1200) continue;
      const lines = raw.split('\n').map(normalize).filter(Boolean);
      const index = lines.findIndex(line => /^已学习\s*\d+(?:\.\d+)?%$/.test(line));
      const title = index >= 2 ? lines[index - 2] : null;
      if (!title || /^(正在学习|已学完|长期有效)$/.test(title)) continue;
      results.push({ element: action.closest('button,[role="button"]') || action,
        module: { id: `course-visible:${title}`, title, kind: 'course', url: null,
          officialStatus: 'unknown', browsingPercent: +percentages[0][1], sourceUrl: cleanUrl(pageUrl), observedAt: new Date().toISOString() } });
      break;
    }
  }
  // Preserve duplicate visible targets so navigation can reject ambiguous titles.
  return results;
}
export function discoverModules(roots, pageUrl) { return [...new Map(moduleEntries(roots, pageUrl).map(item => [item.module.id, item.module])).values()]; }
export function allowedLessonUrl(url) { return Boolean(classroomIds(url) || (safeUrl(url)?.hostname === 'maic.chat' && /^\/course_introduction\/[\w-]+\/?$/.test(safeUrl(url).pathname))); }
