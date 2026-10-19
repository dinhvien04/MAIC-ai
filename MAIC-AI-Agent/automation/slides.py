"""Slide moves. Page turns are explicit. 完成 and quiz answers are never clicked."""

from __future__ import annotations

from dataclasses import dataclass

from courses.parse import (
    NavigationError,
    StudyPause,
    has_complete_button,
    needs_user,
    parse_slide_counter,
)

NEXT_LABEL = "下一页"
PREV_LABEL = "上一页"


@dataclass
class PageSurface:
    """Enough of a page for tests. The live browser implements the same methods."""

    def text(self) -> str:
        raise NotImplementedError

    def click_label(self, label: str) -> None:
        raise NotImplementedError


def assert_can_turn(text: str) -> None:
    if needs_user(text):
        raise StudyPause("Trang có câu hỏi. Dừng để người học tự trả lời. Không chọn đáp án và không nộp.")
    if has_complete_button(text):
        raise StudyPause("Nút 完成 đang hiện. Agent không bấm nút này.")


def turn(page: PageSurface, label: str) -> tuple[int, int]:
    if label not in {NEXT_LABEL, PREV_LABEL}:
        raise NavigationError(f"Chỉ được bấm {PREV_LABEL} hoặc {NEXT_LABEL}.")
    before_text = page.text()
    assert_can_turn(before_text)
    before = parse_slide_counter(before_text)
    if before is None:
        raise NavigationError("Không thấy số trang dạng 1/31.")
    if label == NEXT_LABEL and before.current >= before.total:
        raise NavigationError("Đang ở trang cuối. Không lật tiếp.")
    if label == PREV_LABEL and before.current <= 1:
        raise NavigationError("Đang ở trang đầu. Không lật lui.")
    page.click_label(label)
    after = parse_slide_counter(page.text())
    if after is None or (after.current, after.total) == (before.current, before.total):
        raise NavigationError("Số trang không đổi sau khi bấm. Không bấm lại ngay.")
    return after.current, after.total
