"""CLI for the MAIC study agent."""

from __future__ import annotations

import argparse
import logging
from pathlib import Path

from automation.workflow import read_current_slide, scan_assistant, scan_my_study, user_turn
from browser.session import BrowserSession
from config import DB_PATH, LOG_DIR
from courses.parse import StudyPause
from database.store import add_log, connect, module_row, notes_for


def _logging() -> None:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
        handlers=[logging.FileHandler(LOG_DIR / "agent.log", encoding="utf-8"), logging.StreamHandler()],
    )


def _with_browser(fn):
    session = BrowserSession(headed=True)
    session.start()
    try:
        if not session.wait_for_user_login(5):
            print("Nếu thấy trang đăng nhập, hãy tự nhập trên cửa sổ Chromium. Agent không điền mật khẩu.")
            session.wait_for_user_login(180)
        return fn(session)
    finally:
        session.stop()


def main(argv: list[str] | None = None) -> int:
    _logging()
    parser = argparse.ArgumentParser(description="MAIC AI Learning Agent")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("scan-courses")
    sub.add_parser("scan-progress")
    study = sub.add_parser("notes")
    study.add_argument("--module", required=True)
    nxt = sub.add_parser("next")
    nxt.add_argument("--module", required=True)
    prev = sub.add_parser("prev")
    prev.add_argument("--module", required=True)
    open_url = sub.add_parser("open")
    open_url.add_argument("url")
    study = sub.add_parser("study")
    study.add_argument("--module", required=True)
    study.add_argument("--url", required=True)
    args = parser.parse_args(argv)

    try:
        if args.command == "scan-courses":
            count = _with_browser(scan_my_study)
            print(f"Đã lưu {count} khóa.")
        elif args.command == "scan-progress":
            done, total = _with_browser(scan_assistant)
            print(f"Module chính thức: {done}/{total}")
        elif args.command == "open":
            def _open(session):
                session.goto(args.url)
                print(session.url().split("?")[0])
            _with_browser(_open)
        elif args.command == "study":
            def _study(session):
                session.goto(args.url)
                print(read_current_slide(session, args.module))
            _with_browser(_study)
        elif args.command == "notes":
            def _notes(session):
                print(read_current_slide(session, args.module))
            _with_browser(_notes)
        elif args.command == "next":
            print(_with_browser(lambda session: user_turn(session, "下一页", args.module)))
        elif args.command == "prev":
            print(_with_browser(lambda session: user_turn(session, "上一页", args.module)))
    except StudyPause as exc:
        conn = connect(DB_PATH)
        add_log(conn, "warning", str(exc))
        conn.close()
        print(exc)
        return 2
    return 0


def export_notes(module_title: str, path: Path) -> int:
    conn = connect(DB_PATH)
    rows = notes_for(conn, module_title)
    official = module_row(conn, module_title)
    conn.close()
    lines = [f"# {module_title}", ""]
    if official:
        lines.append(f"Trạng thái chính thức đã lưu: {official['official_status']}")
        lines.append(f"AI đã đọc: {official['ai_status']}")
        lines.append("")
    for row in rows:
        lines.append(f"## Trang {row['slide_number']} ({row['source']})")
        lines.append(row["body"])
        lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")
    return len(rows)


if __name__ == "__main__":
    raise SystemExit(main())
