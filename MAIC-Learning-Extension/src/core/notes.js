const STOP = new Set('the a an and of to in is are for with this that from by as or be on it at we you can will have has was were'.split(' '));
export function keywords(text) {
  const counts = new Map();
  for (const word of text.match(/[\p{L}][\p{L}\p{N}-]{2,}/gu) || []) {
    const key = word.toLowerCase();
    if (!STOP.has(key)) counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([word]) => word);
}
export function makeNotes(slide) {
  const text = [slide.content, slide.transcript].filter(Boolean).join('\n');
  if (!text.trim()) throw new Error('Chưa có văn bản để tạo ghi chú.');
  return { ...slide, keywords: keywords(text),
    summary: text.split(/(?<=[.!?。！？])\s+|\n+/).map(s => s.trim()).filter(Boolean).slice(0, 5).join('\n').slice(0, 4000),
    personalNote: '', method: 'Trích tối đa 5 câu đầu và đếm từ khóa; không phải tóm tắt bằng LLM.' };
}
export function exportMarkdown(slides) {
  // Deliberate allowlist: no profile, account, URL queries, cookies or other metadata.
  const lines = ['# Ghi chú học MAIC', '', 'Ghi chú cục bộ. Trang đã đọc không xác nhận hoàn thành module.', ''];
  for (const slide of slides) {
    lines.push(`## ${slide.moduleTitle || 'Module chưa rõ'} — ${slide.slideNumber || '?'} / ${slide.totalSlides || '?'}`, '',
      `Thời điểm đọc: ${slide.extractedAt}`, '', '### Nội dung', '', slide.content || '(Không đọc được)', '',
      '### Lời giảng', '', slide.transcript || '(Chưa đọc được)', '', '### Trích đoạn', '', slide.summary || '', '',
      '### Từ khóa', '', (slide.keywords || []).join(', '), '', '### Ghi chú của tôi', '', slide.personalNote || '', '');
  }
  return lines.join('\n');
}
