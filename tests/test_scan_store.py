from pathlib import Path

import pytest

from maic_agent.db import connect, courses_for, requirements_for, steps_done
from maic_agent.scan import assert_scanner_does_not_click, run_scan_from_texts
from maic_agent.summary import summarize_text
from tests.fixtures.pages import ASSISTANT_LOGIN, HOMEWORK, INTRO, MY_STUDY, PLAZA

PAGES = {
    "my_study": MY_STUDY,
    "plaza": PLAZA,
    "intro": INTRO,
    "homework": HOMEWORK,
    "assistant": ASSISTANT_LOGIN,
}


def test_scan_persists_progress_and_does_not_mark_sixty_modules_done(tmp_path: Path):
    db = tmp_path / "agent.sqlite"
    scan_id = run_scan_from_texts(db, PAGES, resume=False)
    conn = connect(db)
    courses = courses_for(conn, scan_id)
    assert len(courses) == 3
    requirements = {row["code"]: row for row in requirements_for(conn, scan_id)}
    assert requirements["modules_60"]["state"] == "blocked"
    assert "không phải 60 module" in requirements["modules_60"]["evidence"]
    assert requirements["paper"]["state"] == "blocked"
    assert requirements["final_exam"]["state"] == "blocked"
    assert requirements["pre_questionnaires"]["state"] == "blocked"
    assert "Project Intro A" in {row["name"] for row in courses}
    assert all(row["percent"] != 100 or row["name"] == "Project Intro A" for row in courses)
    conn.close()


def test_interrupted_scan_resumes_without_losing_finished_steps(tmp_path: Path):
    db = tmp_path / "agent.sqlite"
    conn = connect(db)
    from maic_agent.db import finish_scan, mark_step, start_scan

    scan_id = start_scan(conn)
    mark_step(conn, scan_id, "my_study", "https://maic.chat/my_study", "ok", "đã đọc")
    finish_scan(conn, scan_id, "error", "mất mạng giữa chừng")
    conn.close()

    resumed = run_scan_from_texts(db, PAGES, resume=True)
    assert resumed == scan_id
    conn = connect(db)
    rows = conn.execute(
        "SELECT step, outcome FROM page_reads WHERE scan_id = ?",
        (scan_id,),
    ).fetchall()
    outcomes = {row["step"]: row["outcome"] for row in rows}
    assert outcomes["my_study"] == "ok"
    assert outcomes["plaza"] == "ok"
    assert outcomes["intro"] == "ok"
    assert outcomes["homework"] == "ok"
    assert outcomes["assistant"] == "auth_required"
    assert steps_done(conn, scan_id) == {"my_study", "plaza", "intro", "homework"}
    status = conn.execute("SELECT status FROM scans WHERE id = ?", (scan_id,)).fetchone()["status"]
    assert status == "done"
    conn.close()


def test_summary_counts_length_and_refuses_to_be_a_submission():
    text = "Introduction. This is a short note about learning. Discussion follows."
    result = summarize_text(text, "note.txt")
    assert result.word_count == 10
    assert "không phải bài luận để nộp" in result.checklist
    assert "chưa nằm trong 4000–6000" in result.checklist
    assert "Introduction" in result.checklist


def test_scanner_source_has_no_click_or_form_fill():
    assert_scanner_does_not_click()


def test_missing_page_is_recorded_as_error(tmp_path: Path):
    db = tmp_path / "agent.sqlite"
    with pytest.raises(RuntimeError):
        run_scan_from_texts(db, {"my_study": MY_STUDY}, resume=False)
    conn = connect(db)
    row = conn.execute("SELECT status, error FROM scans").fetchone()
    assert row["status"] == "error"
    assert "Thiếu nội dung" in row["error"]
    conn.close()
