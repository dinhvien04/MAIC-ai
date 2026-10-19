"""Study notes. Without an API key this only excerpts the slide text."""

from __future__ import annotations

import json
import re
import urllib.error
import urllib.request

from config import llm_settings

DISCLAIMER = "Ghi chú để ôn. Không phải trạng thái 已学完 trên MAIC."


def extractive_notes(script: str, slide_number: int | None, total: int | None) -> str:
    position = f"{slide_number}/{total}" if slide_number and total else "không rõ trang"
    sentences = [part.strip() for part in re.split(r"(?<=[.!?])\s+", script) if part.strip()]
    summary = " ".join(sentences[:3]) if sentences else "(Trang này chưa có đoạn giảng dài.)"
    terms = sorted(set(re.findall(r"\b[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3}\b", script)))[:8]
    cards = []
    for sentence in sentences[:3]:
        cards.append(f"- {sentence}")
    term_line = ", ".join(terms) if terms else "không tách được thuật ngữ"
    return "\n".join(
        [
            DISCLAIMER,
            f"Trang {position}.",
            f"Tóm tắt: {summary}",
            f"Thuật ngữ giữ nguyên tiếng Anh: {term_line}.",
            "Thẻ ôn:",
            *cards,
        ]
    )


def maybe_llm_notes(script: str, slide_number: int | None, total: int | None) -> tuple[str, str]:
    """Return (notes, source). Source is extractive or llm."""
    settings = llm_settings()
    fallback = extractive_notes(script, slide_number, total)
    if not settings or not script.strip():
        return fallback, "extractive"
    prompt = (
        "Viết ghi chú học bằng tiếng Việt từ đoạn giảng sau. "
        "Giữ nguyên thuật ngữ tiếng Anh. Nêu khái niệm chính, 3 ý, và 2 thẻ ôn. "
        "Không bịa nội dung ngoài đoạn này. "
        f"Trang {slide_number}/{total}.\n\n{script}"
    )
    payload = {
        "model": settings["model"],
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.2,
    }
    request = urllib.request.Request(
        f"{settings['base_url']}/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {settings['key']}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            body = json.loads(response.read().decode("utf-8"))
        text = body["choices"][0]["message"]["content"].strip()
        return f"{DISCLAIMER}\n{text}", "llm"
    except (urllib.error.URLError, KeyError, TimeoutError, json.JSONDecodeError):
        return fallback, "extractive"
