from pathlib import Path

import pytest

from automation.slides import NavigationError, turn
from browser.session import SHORTCUTS, BrowserSession
from courses.parse import (
    StudyPause,
    detect_login,
    extract_script,
    has_complete_button,
    needs_user,
    parse_assistant,
    parse_my_study,
    parse_outline,
    parse_slide_counter,
)
from dashboard.controls import CONTROLS
from database.store import connect, latest_assistant, module_row, save_assistant, save_module, save_note
from ai.notes import extractive_notes
from tests.fixtures import ASSISTANT, MY_STUDY, OUTLINE, QUIZ, SLIDE_1, SLIDE_2


class FakePage:
    def __init__(self, slides: list[str]) -> None:
        self.slides = slides
        self.index = 0
        self.clicks: list[str] = []

    def text(self) -> str:
        return self.slides[self.index]

    def click_label(self, label: str) -> None:
        self.clicks.append(label)
        if label == "下一页":
            self.index = min(self.index + 1, len(self.slides) - 1)
        elif label == "上一页":
            self.index = max(self.index - 1, 0)


def test_slide_counter_and_login_and_quiz():
    position = parse_slide_counter(SLIDE_1)
    assert position is not None
    assert (position.current, position.total) == (1, 31)
    assert detect_login("https://learning-feal.maic.chat/login", "请输入密码")
    assert not detect_login("https://maic.chat/my_study", MY_STUDY)
    assert needs_user(QUIZ)
    assert has_complete_button(QUIZ)
    assert not has_complete_button(SLIDE_1)


def test_course_and_module_and_assistant_parsing():
    courses = parse_my_study(MY_STUDY)
    assert courses[0].name == "The Major Schools of Educational Theory"
    assert courses[0].percent == 5
    assert courses[1].action == "去复习"
    outline = parse_outline(OUTLINE)
    assert [item.title for item in outline] == [
        "Introduction",
        "Lecture 1 - Marxism and Education",
        "Lecture 2 - Liberalism and Education",
    ]
    assert outline[1].percent == "30.00%"
    status = parse_assistant(ASSISTANT)
    assert (status.modules_done, status.modules_total) == (1, 10)
    assert status.questionnaires == "2/4"
    assert status.paper == "0/1"
    assert "Educational Practice" in extract_script(SLIDE_1)


def test_next_and_previous_do_not_click_complete():
    page = FakePage([SLIDE_1, SLIDE_2])
    assert turn(page, "下一页") == (2, 31)
    assert turn(page, "上一页") == (1, 31)
    quiz = FakePage([QUIZ])
    with pytest.raises(StudyPause):
        turn(quiz, "下一页")
    assert "完成" not in quiz.clicks
    assert "完成" not in SHORTCUTS.split("click")[-1]


def test_sqlite_checkpoint_resume(tmp_path: Path):
    db = tmp_path / "maic.sqlite"
    conn = connect(db)
    save_module(conn, title="Introduction", classroom_url="https://maic.chat/classroom/a/b/c", last_slide=2, total_slides=31)
    save_note(conn, "Introduction", 2, "ghi chú", "extractive")
    save_assistant(conn, 1, 10, "2/4", "0/1")
    conn.close()
    conn = connect(db)
    row = module_row(conn, "Introduction")
    assert row["last_slide"] == 2
    assert row["total_slides"] == 31
    assert row["ai_status"] == "noted"
    assert row["official_status"] == "unknown"
    assert latest_assistant(conn)["modules_done"] == 1
    conn.close()


def test_notes_keep_english_terms_and_dashboard_controls():
    notes = extractive_notes("Educational Practice shapes policy.", 2, 31)
    assert "Educational Practice" in notes
    assert "已学完" in notes
    assert len(CONTROLS) == 12
    source = Path("app.py").read_text(encoding="utf-8")
    assert "CONTROLS" in source
    assert "st.set_page_config" in source


def test_browser_refuses_complete_without_launching():
    session = BrowserSession()
    session.page = object()
    with pytest.raises(NavigationError):
        session.click_label("完成")


def test_duplicate_click_is_rejected():
    stuck = FakePage([SLIDE_1, SLIDE_1])

    def click_label(label: str) -> None:
        stuck.clicks.append(label)

    stuck.click_label = click_label
    with pytest.raises(NavigationError):
        turn(stuck, "下一页")
