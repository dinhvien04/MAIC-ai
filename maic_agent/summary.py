"""Extractive reading aid. This does not write a paper for submission."""

from __future__ import annotations

import re
import zipfile
from dataclasses import dataclass
from pathlib import Path
from xml.etree import ElementTree

WORD_RE = re.compile(r"[A-Za-z]+(?:'[A-Za-z]+)?")
CJK_RE = re.compile(r"[\u4e00-\u9fff]")
SECTION_HINTS = (
    "Introduction",
    "Literature Review",
    "Theoretical Analysis",
    "Research Design",
    "Analytical Framework",
    "Main Results",
    "Discussion",
)

DISCLAIMER = (
    "Đây là bản tóm tắt để đọc lại, không phải bài luận để nộp. "
    "Người học tự viết và tự nộp."
)


@dataclass
class DocumentSummary:
    source_name: str
    char_count: int
    word_count: int
    cjk_count: int
    summary: str
    checklist: str


def read_text_file(path: Path) -> str:
    suffix = path.suffix.lower()
    if suffix in {".txt", ".md"}:
        return path.read_text(encoding="utf-8", errors="replace")
    if suffix == ".docx":
        return _read_docx(path)
    raise ValueError(f"Chỉ đọc .txt, .md, .docx. Không hỗ trợ {suffix}.")


def _read_docx(path: Path) -> str:
    namespace = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    with zipfile.ZipFile(path) as archive:
        xml = archive.read("word/document.xml")
    root = ElementTree.fromstring(xml)
    paragraphs = []
    for paragraph in root.findall(".//w:p", namespace):
        texts = [node.text or "" for node in paragraph.findall(".//w:t", namespace)]
        line = "".join(texts).strip()
        if line:
            paragraphs.append(line)
    return "\n".join(paragraphs)


def summarize_text(text: str, source_name: str = "văn bản dán vào") -> DocumentSummary:
    words = WORD_RE.findall(text)
    cjk = CJK_RE.findall(text)
    sentences = _sentences(text)
    picked = sentences[:8]
    summary = " ".join(picked) if picked else "(Không tách được câu.)"
    checklist = _checklist(len(words), len(cjk), text)
    return DocumentSummary(
        source_name=source_name,
        char_count=len(text),
        word_count=len(words),
        cjk_count=len(cjk),
        summary=summary,
        checklist=checklist,
    )


def _sentences(text: str) -> list[str]:
    chunks = re.split(r"(?<=[.!?。！？])\s+", text.strip())
    return [chunk.strip() for chunk in chunks if chunk.strip()]


def _checklist(words: int, cjk: int, text: str) -> str:
    english = "đạt" if 4000 <= words <= 6000 else "chưa nằm trong 4000–6000 từ tiếng Anh"
    chinese = "đạt" if 5000 <= cjk <= 8000 else "chưa nằm trong 5000–8000 chữ Trung"
    present = [name for name in SECTION_HINTS if name.lower() in text.lower()]
    missing = [name for name in SECTION_HINTS if name.lower() not in text.lower()]
    lines = [
        DISCLAIMER,
        f"Số từ tiếng Anh đếm được: {words} ({english}).",
        f"Số chữ Hán đếm được: {cjk} ({chinese}).",
        "Mục thấy trong văn bản: " + (", ".join(present) if present else "không thấy mục nào trong danh sách gợi ý."),
        "Mục chưa thấy: " + ", ".join(missing) + ".",
        "Độ dài không tính tài liệu tham khảo, phụ lục, bảng và chú thích hình. Bộ đếm này không loại các phần đó.",
    ]
    return "\n".join(lines)
