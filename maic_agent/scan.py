"""Read-only scan of catalog pages. Never clicks into lessons or submissions."""

from __future__ import annotations

import logging
from pathlib import Path

from maic_agent.db import (
    STEPS,
    add_log,
    apply_homework,
    connect,
    finish_scan,
    interrupt_running,
    latest_resumable,
    mark_step,
    note_assistant_blocked,
    note_modules_not_inferred,
    save_courses,
    save_outline,
    save_plaza,
    set_requirement,
    start_scan,
    steps_done,
)
from maic_agent.guards import FORBIDDEN_CLICKS, UnsafeUrlError, assert_url_allowed
from maic_agent.parse import detect_auth_wall, parse_homework, parse_my_study, parse_outline, parse_plaza

log = logging.getLogger("maic_agent")

MY_STUDY_URL = "https://maic.chat/my_study"
PLAZA_URL = "https://maic.chat/"
INTRO_URL = "https://maic.chat/course_introduction/6a9a1de0899ece445f038e8d"
HOMEWORK_URL = "https://maic.chat/course/homework/6a9a1de0899ece445f038e8d/6a9f74e81243012c4b178901"
ASSISTANT_URL = "https://learning-feal.maic.chat/"

STEP_URLS = {
    "my_study": MY_STUDY_URL,
    "plaza": PLAZA_URL,
    "intro": INTRO_URL,
    "homework": HOMEWORK_URL,
    "assistant": ASSISTANT_URL,
}


def run_scan_from_texts(
    db_path: Path,
    pages: dict[str, str],
    *,
    resume: bool = True,
) -> int:
    """Apply already-fetched page text. Used by tests and by the live scanner."""
    conn = connect(db_path)
    interrupt_running(conn)
    scan_id = latest_resumable(conn) if resume else None
    scan_id = start_scan(conn, scan_id)
    done = steps_done(conn, scan_id)
    try:
        for step in STEPS:
            if step in done:
                add_log(conn, "info", f"Bỏ qua bước đã đọc: {step}.", scan_id)
                continue
            if step not in pages:
                raise RuntimeError(f"Thiếu nội dung cho bước {step}.")
            _apply_step(conn, scan_id, step, STEP_URLS[step], pages[step], screenshot_path=None)
        finish_scan(conn, scan_id, "done")
    except Exception as exc:
        add_log(conn, "error", str(exc), scan_id)
        finish_scan(conn, scan_id, "error", str(exc))
        raise
    finally:
        conn.close()
    return scan_id


def _apply_step(
    conn,
    scan_id: int,
    step: str,
    url: str,
    text: str,
    screenshot_path: str | None,
) -> None:
    assert_url_allowed(url)
    if detect_auth_wall(url, text):
        mark_step(conn, scan_id, step, url, "auth_required", text[:500], screenshot_path)
        add_log(conn, "warning", f"{step} gặp trang đăng nhập. Dừng đọc dữ liệu cá nhân.", scan_id)
        if step == "assistant":
            note_assistant_blocked(conn, scan_id)
            return
        raise RuntimeError("Phiên đăng nhập không còn. Hãy đăng nhập lại trên cửa sổ trình duyệt rồi quét tiếp.")

    if step == "my_study":
        courses = parse_my_study(text)
        if not courses:
            raise RuntimeError("Không đọc được khóa nào trên 我的学习.")
        save_courses(conn, scan_id, courses, url)
        note_modules_not_inferred(conn, scan_id, len(courses))
    elif step == "plaza":
        save_plaza(conn, scan_id, parse_plaza(text), url)
    elif step == "intro":
        save_outline(conn, scan_id, url, parse_outline(text))
    elif step == "homework":
        apply_homework(conn, scan_id, parse_homework(text))
    elif step == "assistant":
        _note_assistant_open(conn, scan_id, text)
    mark_step(conn, scan_id, step, url, "ok", text[:500], screenshot_path)
    add_log(conn, "info", f"Đã đọc {step} tại {url}.", scan_id)


def _note_assistant_open(conn, scan_id: int, text: str) -> None:
    labels = [name for name in ("Pre-test", "Assessment", "Final Exam", "Progress") if name in text]
    seen = ", ".join(labels) if labels else "không thấy Pre-test, Assessment, Final Exam hay Progress"
    evidence = (
        "Đã mở Learning Assistant. Nhãn nhìn thấy: "
        + seen
        + ". Chưa đọc trạng thái hoàn thành, nên không đánh dấu đã xong."
    )
    for code in ("pre_questionnaires", "post_tests", "final_exam"):
        set_requirement(conn, scan_id, code, "not_seen", evidence)
    add_log(conn, "info", evidence, scan_id)


def assert_scanner_does_not_click() -> None:
    """The live path only calls goto and screenshot. Checked from those functions, not this guard."""
    import inspect

    source = "\n".join(
        inspect.getsource(fn) for fn in (run_live_scan, _read_page, _apply_step)
    )
    for token in (".click(", ".fill(", ".type(", "set_input_files("):
        if token in source:
            raise RuntimeError(f"scanner chứa thao tác bị cấm: {token}")
    for label in FORBIDDEN_CLICKS:
        if f'click("{label}"' in source or f"click('{label}'" in source:
            raise RuntimeError(f"scanner bấm nhãn bị cấm: {label}")


def run_live_scan(db_path: Path, profile_dir: Path, *, headed: bool = True, resume: bool = True) -> int:
    """Open Chromium, reuse a local profile, and read catalog pages.

    The user types credentials in the browser window. This function never fills them.
    """
    for url in STEP_URLS.values():
        assert_url_allowed(url)
    assert_scanner_does_not_click()

    from playwright.sync_api import sync_playwright

    profile_dir.mkdir(parents=True, exist_ok=True)
    screenshot_dir = db_path.parent / "screenshots"
    screenshot_dir.mkdir(parents=True, exist_ok=True)

    conn = connect(db_path)
    interrupt_running(conn)
    scan_id = latest_resumable(conn) if resume else None
    scan_id = start_scan(conn, scan_id)
    done = steps_done(conn, scan_id)
    conn.close()

    try:
        with sync_playwright() as playwright:
            context = playwright.chromium.launch_persistent_context(
                str(profile_dir),
                headless=not headed,
                viewport={"width": 1280, "height": 900},
            )
            page = context.pages[0] if context.pages else context.new_page()
            try:
                for step in STEPS:
                    if step in done:
                        continue
                    url = STEP_URLS[step]
                    attempts = 90 if step == "my_study" else 15
                    text = _read_page(page, url, wait_for_login=headed, attempts=attempts)
                    shot = screenshot_dir / f"{scan_id}-{step}.png"
                    page.screenshot(path=str(shot), full_page=True)
                    conn = connect(db_path)
                    try:
                        _apply_step(conn, scan_id, step, url, text, str(shot))
                    finally:
                        conn.close()
            finally:
                context.close()
        conn = connect(db_path)
        finish_scan(conn, scan_id, "done")
        conn.close()
    except Exception as exc:
        conn = connect(db_path)
        add_log(conn, "error", str(exc), scan_id)
        finish_scan(conn, scan_id, "error", str(exc))
        conn.close()
        raise
    return scan_id


def _read_page(page, url: str, *, wait_for_login: bool, attempts: int) -> str:
    assert_url_allowed(url)
    page.goto(url, wait_until="domcontentloaded", timeout=45000)
    page.wait_for_timeout(1500)
    text = page.inner_text("body")
    if detect_auth_wall(page.url, text):
        if not wait_for_login:
            return text
        for _ in range(attempts):
            page.wait_for_timeout(2000)
            text = page.inner_text("body")
            if not detect_auth_wall(page.url, text):
                return text
        return page.inner_text("body")
    try:
        page.wait_for_function(
            "() => document.body && document.body.innerText.length > 80",
            timeout=15000,
        )
    except Exception as exc:
        log.info("Hết thời gian chờ nội dung %s: %s", url, exc)
    if isinstance(page.url, str):
        assert_url_allowed(page.url)
    return page.inner_text("body")
