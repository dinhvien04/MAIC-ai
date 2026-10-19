"""Scan catalog pages and read the current slide. Does not finish modules."""

from __future__ import annotations

import logging
import time

from ai.notes import maybe_llm_notes
from automation.slides import PageSurface, turn
from config import ASSISTANT_URL, DB_PATH, MY_STUDY_URL, review_seconds
from courses.parse import (
    StudyPause,
    classroom_title,
    extract_script,
    parse_assistant,
    parse_my_study,
    parse_outline,
    parse_slide_counter,
)
from database.store import (
    add_log,
    connect,
    latest_assistant,
    list_modules,
    save_assistant,
    save_courses,
    save_module,
    save_note,
)

log = logging.getLogger("maic.workflow")


class LiveSurface(PageSurface):
    def __init__(self, session) -> None:
        self.session = session

    def text(self) -> str:
        return self.session.text()

    def click_label(self, label: str) -> None:
        self.session.click_label(label)


def scan_my_study(session) -> int:
    session.goto(MY_STUDY_URL)
    if _blocked(session):
        raise StudyPause("maic.chat đang ở trang đăng nhập. Hãy đăng nhập trên cửa sổ Chromium.")
    cards = parse_my_study(session.text())
    conn = connect(DB_PATH)
    save_courses(conn, [(card.name, card.percent, card.action) for card in cards])
    add_log(conn, "info", f"Đọc {len(cards)} khóa từ 我的学习.")
    conn.close()
    return len(cards)


def scan_assistant(session) -> tuple[int | None, int | None]:
    session.goto(ASSISTANT_URL)
    if _blocked(session):
        raise StudyPause("Learning Assistant đang ở trang đăng nhập.")
    status = parse_assistant(session.text())
    conn = connect(DB_PATH)
    save_assistant(conn, status.modules_done, status.modules_total, status.questionnaires, status.paper)
    add_log(
        conn,
        "info",
        f"Assistant: module {status.modules_done}/{status.modules_total}, "
        f"questionnaire {status.questionnaires}, bài luận {status.paper}.",
    )
    conn.close()
    return status.modules_done, status.modules_total


def remember_outline(session, course_title: str, outline_url: str) -> int:
    if "/course_introduction/" not in outline_url:
        raise StudyPause("Chỉ đọc mục lục ở trang giới thiệu khóa, không tự mở phòng học.")
    session.goto(outline_url)
    items = parse_outline(session.text())
    conn = connect(DB_PATH)
    for item in items:
        official = "completed" if item.percent == "100.00%" or item.percent == "100%" else "unknown"
        if item.percent is None:
            official = "unknown"
        save_module(conn, title=item.title, course_key=course_title, official_status=official)
    add_log(conn, "info", f"Mục lục {course_title}: {len(items)} chương.")
    conn.close()
    return len(items)


def read_current_slide(session, module_title: str) -> str:
    """Read the open classroom. Does not click next or 完成."""
    if "/classroom/" not in session.url():
        raise StudyPause("Hãy mở phòng học trước. Agent không tự bấm 继续学习.")
    session.click_label("分页讲稿")
    text = session.text()
    position = parse_slide_counter(text)
    script = extract_script(text)
    delay = review_seconds()
    if delay:
        time.sleep(delay)
    notes, source = maybe_llm_notes(
        script,
        position.current if position else None,
        position.total if position else None,
    )
    conn = connect(DB_PATH)
    save_module(
        conn,
        title=module_title or classroom_title(text) or "module-dang-mo",
        classroom_url=session.url().split("?")[0],
        last_slide=position.current if position else None,
        total_slides=position.total if position else None,
    )
    save_note(
        conn,
        module_title or classroom_title(text) or "module-dang-mo",
        position.current if position else None,
        notes,
        source,
    )
    add_log(conn, "info", f"Đã ghi chú trang {position.current if position else '?'}.")
    conn.close()
    return notes


def user_turn(session, label: str, module_title: str) -> str:
    surface = LiveSurface(session)
    current, total = turn(surface, label)
    conn = connect(DB_PATH)
    save_module(
        conn,
        title=module_title,
        classroom_url=session.url().split("?")[0],
        last_slide=current,
        total_slides=total,
    )
    add_log(conn, "info", f"Người học chuyển tới {current}/{total}.")
    conn.close()
    return f"{current}/{total}"


def _blocked(session) -> bool:
    from courses.parse import detect_login

    return detect_login(session.url(), session.text())


def dashboard_rows() -> dict:
    conn = connect(DB_PATH)
    assistant = latest_assistant(conn)
    modules = list_modules(conn)
    conn.close()
    return {"assistant": assistant, "modules": modules}
