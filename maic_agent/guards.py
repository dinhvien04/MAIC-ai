"""Hard limits taken from the MAIC read-only investigation."""

from urllib.parse import urlparse

ALLOWED_HOSTS = {"maic.chat", "learning-feal.maic.chat"}

# Labels that enter a player, submit work, or log in. The scanner never clicks.
FORBIDDEN_CLICKS = frozenset(
    {
        "开始学习",
        "继续学习",
        "去复习",
        "提交",
        "登录",
        "立即登录",
        "删除",
        "上传附件",
    }
)

REQUIREMENT_CODES = (
    "modules_60",
    "pre_questionnaires",
    "post_tests",
    "final_exam",
    "paper",
)

REQUIREMENT_LABELS = {
    "modules_60": "60 module bắt buộc",
    "pre_questionnaires": "2 questionnaire trước khóa",
    "post_tests": "Post-test Survey 1 và 2",
    "final_exam": "Bài thi cuối",
    "paper": "Bài luận cuối",
}


class UnsafeUrlError(ValueError):
    """Raised when a navigation target is outside the read-only allowlist."""


def assert_url_allowed(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme not in {"https", "http"}:
        raise UnsafeUrlError(f"scheme không được phép: {url}")
    host = (parsed.hostname or "").lower()
    if host not in ALLOWED_HOSTS:
        raise UnsafeUrlError(f"host không nằm trong allowlist: {url}")
    if parsed.username or parsed.password:
        raise UnsafeUrlError("URL không được chứa thông tin đăng nhập")


def refuses_click(label: str) -> bool:
    text = " ".join(label.split())
    return text in FORBIDDEN_CLICKS or any(item in text for item in ("提交", "登录"))
