"""SQLite storage for scans, progress snapshots, and logs."""

from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from maic_agent.guards import REQUIREMENT_CODES
from maic_agent.parse import CourseProgress, HomeworkView, OutlineItem, PlazaCourse, paper_requirement_state

SCHEMA = """
CREATE TABLE IF NOT EXISTS scans (
    id INTEGER PRIMARY KEY,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    status TEXT NOT NULL,
    last_step TEXT,
    last_url TEXT,
    error TEXT
);
CREATE TABLE IF NOT EXISTS course_snapshots (
    id INTEGER PRIMARY KEY,
    scan_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    group_name TEXT,
    percent INTEGER,
    action_label TEXT,
    validity TEXT,
    source_url TEXT
);
CREATE TABLE IF NOT EXISTS plaza_courses (
    id INTEGER PRIMARY KEY,
    scan_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    teacher TEXT,
    source_url TEXT
);
CREATE TABLE IF NOT EXISTS outline_items (
    id INTEGER PRIMARY KEY,
    scan_id INTEGER NOT NULL,
    course_url TEXT,
    title TEXT NOT NULL,
    status_label TEXT
);
CREATE TABLE IF NOT EXISTS page_reads (
    id INTEGER PRIMARY KEY,
    scan_id INTEGER NOT NULL,
    step TEXT NOT NULL,
    url TEXT,
    outcome TEXT,
    excerpt TEXT,
    screenshot_path TEXT,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS requirement_status (
    id INTEGER PRIMARY KEY,
    scan_id INTEGER NOT NULL,
    code TEXT NOT NULL,
    state TEXT NOT NULL,
    evidence TEXT,
    UNIQUE(scan_id, code)
);
CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY,
    created_at TEXT NOT NULL,
    level TEXT NOT NULL,
    scan_id INTEGER,
    message TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS document_summaries (
    id INTEGER PRIMARY KEY,
    created_at TEXT NOT NULL,
    source_name TEXT,
    char_count INTEGER,
    word_count INTEGER,
    cjk_count INTEGER,
    summary TEXT,
    checklist TEXT
);
"""

STEPS = ("my_study", "plaza", "intro", "homework", "assistant")


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def connect(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    return conn


def add_log(conn: sqlite3.Connection, level: str, message: str, scan_id: int | None = None) -> None:
    conn.execute(
        "INSERT INTO logs (created_at, level, scan_id, message) VALUES (?, ?, ?, ?)",
        (utc_now(), level, scan_id, message),
    )
    conn.commit()


def interrupt_running(conn: sqlite3.Connection) -> int:
    rows = conn.execute("SELECT id FROM scans WHERE status = 'running'").fetchall()
    for row in rows:
        conn.execute(
            "UPDATE scans SET status = 'interrupted', finished_at = ?, error = COALESCE(error, ?) WHERE id = ?",
            (utc_now(), "Tiến trình dừng trước khi quét xong.", row["id"]),
        )
        add_log(conn, "warning", "Đánh dấu scan đang chạy là interrupted.", row["id"])
    conn.commit()
    return len(rows)


def start_scan(conn: sqlite3.Connection, resume_id: int | None = None) -> int:
    if resume_id is not None:
        conn.execute(
            "UPDATE scans SET status = 'running', finished_at = NULL, error = NULL WHERE id = ?",
            (resume_id,),
        )
        conn.commit()
        add_log(conn, "info", "Tiếp tục scan bị gián đoạn.", resume_id)
        return resume_id
    cur = conn.execute(
        "INSERT INTO scans (started_at, status) VALUES (?, 'running')",
        (utc_now(),),
    )
    conn.commit()
    scan_id = int(cur.lastrowid)
    for code in REQUIREMENT_CODES:
        conn.execute(
            "INSERT INTO requirement_status (scan_id, code, state, evidence) VALUES (?, ?, 'not_seen', ?)",
            (scan_id, code, "Chưa đọc trang tương ứng trong scan này."),
        )
    conn.commit()
    add_log(conn, "info", "Bắt đầu scan chỉ đọc.", scan_id)
    return scan_id


def latest_resumable(conn: sqlite3.Connection) -> int | None:
    row = conn.execute(
        "SELECT id FROM scans WHERE status IN ('interrupted', 'error') ORDER BY id DESC LIMIT 1"
    ).fetchone()
    return None if row is None else int(row["id"])


def steps_done(conn: sqlite3.Connection, scan_id: int) -> set[str]:
    rows = conn.execute(
        "SELECT step FROM page_reads WHERE scan_id = ? AND outcome = 'ok'",
        (scan_id,),
    ).fetchall()
    return {row["step"] for row in rows}


def mark_step(
    conn: sqlite3.Connection,
    scan_id: int,
    step: str,
    url: str,
    outcome: str,
    excerpt: str,
    screenshot_path: str | None = None,
) -> None:
    conn.execute(
        "DELETE FROM page_reads WHERE scan_id = ? AND step = ?",
        (scan_id, step),
    )
    conn.execute(
        """
        INSERT INTO page_reads (scan_id, step, url, outcome, excerpt, screenshot_path, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (scan_id, step, url, outcome, excerpt[:2000], screenshot_path, utc_now()),
    )
    conn.execute(
        "UPDATE scans SET last_step = ?, last_url = ? WHERE id = ?",
        (step, url, scan_id),
    )
    conn.commit()


def save_courses(conn: sqlite3.Connection, scan_id: int, courses: list[CourseProgress], source_url: str) -> None:
    conn.execute("DELETE FROM course_snapshots WHERE scan_id = ?", (scan_id,))
    conn.executemany(
        """
        INSERT INTO course_snapshots
            (scan_id, name, group_name, percent, action_label, validity, source_url)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (scan_id, c.name, c.group_name, c.percent, c.action_label, c.validity, source_url)
            for c in courses
        ],
    )
    conn.commit()


def save_plaza(conn: sqlite3.Connection, scan_id: int, courses: list[PlazaCourse], source_url: str) -> None:
    conn.execute("DELETE FROM plaza_courses WHERE scan_id = ?", (scan_id,))
    conn.executemany(
        "INSERT INTO plaza_courses (scan_id, name, teacher, source_url) VALUES (?, ?, ?, ?)",
        [(scan_id, c.name, c.teacher, source_url) for c in courses],
    )
    conn.commit()


def save_outline(conn: sqlite3.Connection, scan_id: int, course_url: str, items: list[OutlineItem]) -> None:
    conn.execute("DELETE FROM outline_items WHERE scan_id = ?", (scan_id,))
    conn.executemany(
        "INSERT INTO outline_items (scan_id, course_url, title, status_label) VALUES (?, ?, ?, ?)",
        [(scan_id, course_url, item.title, item.status_label) for item in items],
    )
    conn.commit()


def set_requirement(conn: sqlite3.Connection, scan_id: int, code: str, state: str, evidence: str) -> None:
    conn.execute(
        """
        INSERT INTO requirement_status (scan_id, code, state, evidence)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(scan_id, code) DO UPDATE SET state = excluded.state, evidence = excluded.evidence
        """,
        (scan_id, code, state, evidence),
    )
    conn.commit()


def apply_homework(conn: sqlite3.Connection, scan_id: int, view: HomeworkView) -> None:
    state, evidence = paper_requirement_state(view)
    if view.deadline:
        evidence = f"{evidence} Hạn trên trang: {view.deadline}."
    set_requirement(conn, scan_id, "paper", state, evidence)


def note_modules_not_inferred(conn: sqlite3.Connection, scan_id: int, course_count: int) -> None:
    set_requirement(
        conn,
        scan_id,
        "modules_60",
        "not_seen",
        f"Đọc được {course_count} khóa trên 我的学习. Danh sách này không phải 60 module bắt buộc.",
    )


def note_assistant_blocked(conn: sqlite3.Connection, scan_id: int) -> None:
    evidence = "Learning Assistant trả về trang đăng nhập. Không đọc Pre-test, Progress hay Assessment."
    for code in ("modules_60", "pre_questionnaires", "post_tests", "final_exam"):
        current = conn.execute(
            "SELECT state FROM requirement_status WHERE scan_id = ? AND code = ?",
            (scan_id, code),
        ).fetchone()
        if current and current["state"] == "confirmed":
            continue
        if code == "modules_60" and current and current["state"] == "not_seen":
            evidence = (
                "我的学习 không phải 60 module, và Learning Assistant vẫn đang ở trang đăng nhập."
            )
        set_requirement(conn, scan_id, code, "blocked", evidence)


def finish_scan(conn: sqlite3.Connection, scan_id: int, status: str, error: str | None = None) -> None:
    conn.execute(
        "UPDATE scans SET status = ?, finished_at = ?, error = ? WHERE id = ?",
        (status, utc_now(), error, scan_id),
    )
    conn.commit()
    add_log(conn, "info" if status == "done" else "error", f"Kết thúc scan: {status}. {error or ''}".strip(), scan_id)


def latest_scan(conn: sqlite3.Connection) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM scans ORDER BY id DESC LIMIT 1").fetchone()


def courses_for(conn: sqlite3.Connection, scan_id: int) -> list[sqlite3.Row]:
    return conn.execute(
        "SELECT * FROM course_snapshots WHERE scan_id = ? ORDER BY id",
        (scan_id,),
    ).fetchall()


def requirements_for(conn: sqlite3.Connection, scan_id: int) -> list[sqlite3.Row]:
    return conn.execute(
        "SELECT * FROM requirement_status WHERE scan_id = ? ORDER BY id",
        (scan_id,),
    ).fetchall()


def logs_for(conn: sqlite3.Connection, scan_id: int | None = None, limit: int = 100) -> list[sqlite3.Row]:
    if scan_id is None:
        return conn.execute("SELECT * FROM logs ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
    return conn.execute(
        "SELECT * FROM logs WHERE scan_id = ? OR scan_id IS NULL ORDER BY id DESC LIMIT ?",
        (scan_id, limit),
    ).fetchall()


def save_summary(
    conn: sqlite3.Connection,
    source_name: str,
    char_count: int,
    word_count: int,
    cjk_count: int,
    summary: str,
    checklist: str,
) -> int:
    cur = conn.execute(
        """
        INSERT INTO document_summaries
            (created_at, source_name, char_count, word_count, cjk_count, summary, checklist)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (utc_now(), source_name, char_count, word_count, cjk_count, summary, checklist),
    )
    conn.commit()
    return int(cur.lastrowid)
