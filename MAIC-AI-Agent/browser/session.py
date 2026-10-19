"""Persistent Chromium. Login stays in the window. Secrets are not printed."""

from __future__ import annotations

import logging
from pathlib import Path

from config import FORBIDDEN_CLICKS, PROFILE, SCREENSHOTS
from courses.parse import NavigationError, detect_login

log = logging.getLogger("maic.browser")

SHORTCUTS = """
(() => {
  if (window.__maicKeys) return;
  window.__maicKeys = true;
  document.addEventListener('keydown', (event) => {
    if (event.target && event.target.closest && event.target.closest('input, textarea')) return;
    const text = document.body ? document.body.innerText : '';
    if (text.includes('单选题') || text.includes('多选题') || text.includes('\\n完成\\n')) return;
    const label = event.key === 'ArrowRight' ? '下一页' : event.key === 'ArrowLeft' ? '上一页' : '';
    if (!label) return;
    const node = [...document.querySelectorAll('div,button,span')].find((el) => (el.innerText || '').trim() === label);
    if (node) node.click();
  }, true);
})();
"""


class BrowserSession:
    def __init__(self, profile: Path = PROFILE, headed: bool = True) -> None:
        self.profile = profile
        self.headed = headed
        self._playwright = None
        self._context = None
        self.page = None

    def start(self) -> None:
        from playwright.sync_api import sync_playwright

        self.profile.mkdir(parents=True, exist_ok=True)
        SCREENSHOTS.mkdir(parents=True, exist_ok=True)
        self._playwright = sync_playwright().start()
        self._context = self._playwright.chromium.launch_persistent_context(
            str(self.profile),
            headless=not self.headed,
            viewport={"width": 1280, "height": 900},
        )
        self.page = self._context.pages[0] if self._context.pages else self._context.new_page()
        self.page.add_init_script(SHORTCUTS)

    def stop(self) -> None:
        if self._context is not None:
            self._context.close()
            self._context = None
        if self._playwright is not None:
            self._playwright.stop()
            self._playwright = None
        self.page = None

    def goto(self, url: str, timeout_ms: int = 45000) -> None:
        if self.page is None:
            raise NavigationError("Trình duyệt chưa mở.")
        last_error: Exception | None = None
        for attempt in range(3):
            try:
                self.page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
                self.page.wait_for_timeout(800)
                return
            except Exception as exc:  # playwright raises several timeout types
                last_error = exc
                self.page.wait_for_timeout(500 * (attempt + 1))
                log.warning("goto lần %s lỗi: %s", attempt + 1, exc.__class__.__name__)
        raise NavigationError("Không mở được trang sau 3 lần.") from last_error

    def text(self) -> str:
        if self.page is None:
            raise NavigationError("Trình duyệt chưa mở.")
        return self.page.inner_text("body")

    def url(self) -> str:
        if self.page is None:
            return ""
        return self.page.url

    def wait_for_user_login(self, seconds: int = 180) -> bool:
        if self.page is None:
            return False
        for _ in range(seconds // 2):
            if not detect_login(self.page.url, self.text()):
                return True
            self.page.wait_for_timeout(2000)
        return not detect_login(self.page.url, self.text())

    def click_label(self, label: str) -> None:
        if label in FORBIDDEN_CLICKS or label.strip() == "完成":
            raise NavigationError("Không bấm nút này.")
        if self.page is None:
            raise NavigationError("Trình duyệt chưa mở.")
        clicked = self.page.evaluate(
            """(label) => {
                const nodes = [...document.querySelectorAll('div,button,span')].filter(
                  (el) => (el.innerText || '').trim() === label
                );
                if (!nodes.length) return false;
                nodes.sort((a, b) => a.getBoundingClientRect().width - b.getBoundingClientRect().width);
                nodes[0].click();
                return true;
            }""",
            label,
        )
        if not clicked:
            raise NavigationError(f"Không thấy nút {label}.")
        self.page.wait_for_timeout(700)

    def shot(self, name: str) -> str:
        if self.page is None:
            return ""
        path = SCREENSHOTS / name
        self.page.screenshot(path=str(path), full_page=True)
        return str(path)
