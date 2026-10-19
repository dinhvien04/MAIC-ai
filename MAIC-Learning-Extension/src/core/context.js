import { all, normalize, textOf } from '../utils/selectors.js';
export const HOSTS = new Set(['maic.chat', 'learning-feal.maic.chat']);
export function safeUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && HOSTS.has(url.hostname) && !url.username && !url.password && !url.port ? url : null; } catch { return null; }
}
export function cleanUrl(value) { const url = safeUrl(value); return url ? `${url.origin}${url.pathname}` : null; }
export function classroomIds(value) {
  const url = safeUrl(value);
  const match = url?.hostname === 'maic.chat' && url.pathname.match(/^\/classroom\/([\w-]+)\/([\w-]+)\/([\w-]+)\/?$/);
  return match ? { courseId: match[1], chapterId: match[2], moduleId: match.slice(1).join('/') } : null;
}
export function pageType(value) {
  const url = safeUrl(value);
  if (!url) return 'unsupported';
  if (/\/(login|signin|forgot-password)(\/|$)/i.test(url.pathname)) return 'login';
  if (/\/(exam|assessment|pre-?test|quiz|test)(\/|$)/i.test(url.pathname)) return 'assessment';
  if (classroomIds(value)) return 'classroom';
  if (url.hostname === 'learning-feal.maic.chat' && url.pathname === '/dashboard') return 'dashboard';
  if (url.hostname === 'maic.chat') {
    if (url.pathname === '/my_study') return 'my-learning';
    if (/^\/course_introduction\/[\w-]+\/?$/.test(url.pathname)) return 'course-introduction';
    if (url.pathname === '/') return 'main';
  }
  return 'unknown';
}
export function authState(doc, roots = [doc], url = doc.URL) {
  if (pageType(url) === 'login' || all(roots, 'input[type="password"]').length) return 'login-required';
  if (all(roots, '[data-account-id],[data-user-id],[data-testid="account-name"],a[href*="logout"]').length ||
      ['classroom', 'dashboard'].includes(pageType(url))) return 'appears-authenticated';
  return 'unknown';
}
export function accountMarker(roots) {
  const element = all(roots, '[data-account-id],[data-user-id],[data-testid="account-name"]').at(0);
  return element ? normalize(element.getAttribute('data-account-id') || element.getAttribute('data-user-id') || textOf(element)).slice(0, 256) : null;
}
export async function accountProfile(marker, cryptoAPI = globalThis.crypto) {
  const bytes = await cryptoAPI.subtle.digest('SHA-256', new TextEncoder().encode(marker));
  return `account:${[...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, '0')).join('')}`;
}
export function moduleContext(roots, url) {
  const ids = classroomIds(url);
  const breadcrumb = all(roots, 'nav[aria-label*="breadcrumb" i],[role="navigation"][aria-label*="breadcrumb" i],[data-testid="breadcrumb"],.ant-breadcrumb').at(0);
  let parts = breadcrumb ? textOf(breadcrumb).split(/\s*[\/›>]\s*|\n/).map(normalize).filter(Boolean) : [];
  if (parts.length < 2) {
    // Research observed the title as "Course / Module / Lesson"; accept one exact heading only.
    const headings = all(roots, 'h1,h2,header [title]');
    const title = headings.map(textOf).find(text => text.includes(' / ') && text.length < 500);
    if (title) parts = title.split(' / ').map(normalize);
  }
  if (parts.length < 2) {
    const titles = all(roots, 'div,span').filter(el => el.children.length < 4)
      .map(textOf).filter(text => text.length < 1200 && text.split(/\s*\/\s*/).length === 3 &&
        text.split(/\s*\/\s*/).every(part => /\p{L}/u.test(part)));
    const unique = [...new Set(titles.map(title => title.split(/\s*\/\s*/).map(normalize).join(' / ')))];
    if (unique.length === 1) parts = unique[0].split(' / ');
  }
  return { ...ids, courseTitle: parts.length >= 2 ? parts[0] : null,
    moduleTitle: parts.length >= 2 ? parts.at(-1) : null, url: cleanUrl(url) };
}
