"""SQLite checkpoints. Official completion is stored only when the site says so."""

from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY,
    course_key TEXT UNIQUE,
    title TEXT NOT NULL,
    percent INTEGER,
    action TEXT,
    updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS modules (
    id INTEGER PRIMARY KEY,
    course_key TEXT,
    module_key TEXT UNIQUE,
    title TEXT NOT NULL,
    classroom_url TEXT,
    last_slide INTEGER,
    total_slides INTEGER,
    official_status TEXT NOT NULL DEFAULT 'unknown',
    ai_status TEXT NOT NULL DEFAULT 'unread',
    user_reviewed INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY,
    module_key TEXT NOT NULL,
    slide_number INTEGER,
    body TEXT NOT NULL,
    source TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS assistant_snapshots (
    id INTEGER PRIMARY KEY,
    modules_done INTEGER,
    modules_total INTEGER,
    questionnaires TEXT,
    paper TEXT,
    synced_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY,
    created_at TEXT NOT NULL,
    level TEXT NOT NULL,
    message TEXT NOT NULL
);
"""


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def connect(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    return conn


def add_log(conn: sqlite3.Connection, level: str, message: str) -> None:
    conn.execute(
        "INSERT INTO logs (created_at, level, message) VALUES (?, ?, ?)",
        (utc_now(), level, message),
    )
    conn.commit()


def save_courses(conn: sqlite3.Connection, rows: list[tuple[str, int, str]]) -> None:
    now = utc_now()
    for title, percent, action in rows:
        conn.execute(
            """
            INSERT INTO courses (course_key, title, percent, action, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(course_key) DO UPDATE SET
                percent = excluded.percent,
                action = excluded.action,
                updated_at = excluded.updated_at
            """,
            (title, title, percent, action, now),
        )
    conn.commit()


def save_module(
    conn: sqlite3.Connection,
    *,
    title: str,
    course_key: str = "",
    classroom_url: str = "",
    last_slide: int | None = None,
    total_slides: int | None = None,
    official_status: str | None = None,
) -> None:
    now = utc_now()
    conn.execute(
        """
        INSERT INTO modules (
            course_key, module_key, title, classroom_url, last_slide, total_slides, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(module_key) DO UPDATE SET
            classroom_url = CASE WHEN excluded.classroom_url != '' THEN excluded.classroom_url ELSE modules.classroom_url END,
            last_slide = COALESCE(excluded.last_slide, modules.last_slide),
            total_slides = COALESCE(excluded.total_slides, modules.total_slides),
            updated_at = excluded.updated_at
        """,
        (course_key, title, title, classroom_url, last_slide, total_slides, now),
    )
    if official_status:
        conn.execute(
            "UPDATE modules SET official_status = ?, updated_at = ? WHERE module_key = ?",
            (official_status, now, title),
        )
    conn.commit()


def save_note(conn: sqlite3.Connection, module_key: str, slide_number: int | None, body: str, source: str) -> None:
    conn.execute(
        "INSERT INTO notes (module_key, slide_number, body, source, created_at) VALUES (?, ?, ?, ?, ?)",
        (module_key, slide_number, body, source, utc_now()),
    )
    conn.execute(
        "UPDATE modules SET ai_status = 'noted', updated_at = ? WHERE module_key = ?",
        (utc_now(), module_key),
    )
    conn.commit()


def mark_user_reviewed(conn: sqlite3.Connection, module_key: str) -> None:
    conn.execute(
        "UPDATE modules SET user_reviewed = 1, updated_at = ? WHERE module_key = ?",
        (utc_now(), module_key),
    )
    conn.commit()


def save_assistant(
    conn: sqlite3.Connection,
    modules_done: int | None,
    modules_total: int | None,
    questionnaires: str | None,
    paper: str | None,
) -> None:
    conn.execute(
        """
        INSERT INTO assistant_snapshots (modules_done, modules_total, questionnaires, paper, synced_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (modules_done, modules_total, questionnaires, paper, utc_now()),
    )
    conn.commit()


def latest_assistant(conn: sqlite3.Connection) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM assistant_snapshots ORDER BY id DESC LIMIT 1").fetchone()


def list_modules(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute("SELECT * FROM modules ORDER BY title").fetchall()


def module_row(conn: sqlite3.Connection, title: str) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM modules WHERE module_key = ?", (title,)).fetchone()


def notes_for(conn: sqlite3.Connection, module_key: str) -> list[sqlite3.Row]:
    return conn.execute(
        "SELECT * FROM notes WHERE module_key = ? ORDER BY id",
        (module_key,),
    ).fetchall()
