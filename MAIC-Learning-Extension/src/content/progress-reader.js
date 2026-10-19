import { all, textOf, normalize } from '../utils/selectors.js';
export function parseProgress(text) {
  const readPair = regex => { const m = text.match(regex); return m && +m[1] <= +m[2] && +m[2] > 0 ? { completed: +m[1], total: +m[2] } : null; };
  const modules = readPair(/已完成\s*(\d+)\s*\/\s*共\s*(\d+)\s*个模块/);
  const questionnaires = readPair(/(\d+)\s*\/\s*(\d+)\s*已完成问卷/) || readPair(/(?:Questionnaires?|调查问卷|问卷)\s*[:：]?\s*(\d+)\s*\/\s*(\d+)/i);
  const paper = readPair(/(\d+)\s*\/\s*(\d+)\s*论文提交/) || readPair(/(?:Research Paper|论文|研究论文|Bài luận)\s*[:：]?\s*(\d+)\s*\/\s*(\d+)/i);
  const pretest = /前测尚未开放|学完全部必修模块后即可开始前测|完成全部必修模块后即可参加前测/.test(text) ? 'locked' : null;
  const topic = /暂无课题（未解锁）|暂无课题\s*\(未解锁\)/.test(text) ? 'locked' : null;
  const finalExam = text.match(/(?:Final Exam|期末考试|最终测评)\s*[:：]?\s*(已完成|未完成|未开放|已锁定|Completed|Not completed|Locked)/i)?.[1] || null;
  return { modules, questionnaires, paper, pretest, topic, finalExam };
}
export function readProgress(roots, url) {
  const panels = all(roots, '[role="dialog"],[data-progress-panel],section,aside,[role="tabpanel"]');
  const panel = panels.find(el => /已完成\s*\d+\s*\/\s*共\s*\d+\s*个模块/.test(textOf(el))) || null;
  const bodyText = roots.map(root => textOf(root.body || root)).join('\n');
  const text = panel ? textOf(panel) : bodyText;
  const values = parseProgress(text);
  const allCourses = /全部课程(?:总览)?|All Courses/i.test(text) && !/当前知识库\s*[:：]?\s*(?!全部课程)[A-Za-z]/.test(text);
  if (!allCourses) values.modules = null; // A filtered course's count is not the program total.
  const sidebar = parseProgress(bodyText);
  for (const key of ['pretest', 'topic', 'finalExam']) if (values[key] === null) values[key] = sidebar[key];
  const details = [];
  for (const element of all(roots, 'li,tr,[data-questionnaire]')) {
    const line = normalize(textOf(element));
    if (line.length < 400 && /调查问卷|学习与思维能力调查|后测问卷|Post.test Survey/i.test(line)) {
      details.push({ label: line, status: /未完成|Not completed/i.test(line) ? 'not-completed' : /已完成|Completed/i.test(line) ? 'completed' : 'unknown' });
    }
  }
  return { ...values, questionnaireDetails: details, scope: allCourses ? 'all-courses' : 'unverified-scope',
    sourceUrl: url, observedAt: new Date().toISOString() };
}
