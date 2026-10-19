"""Local paths and optional LLM settings. Secrets stay in the environment."""

from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
PROFILE = DATA / "browser-profile"
DB_PATH = DATA / "maic.sqlite"
LOG_DIR = ROOT / "logs"
SCREENSHOTS = DATA / "screenshots"

MY_STUDY_URL = "https://maic.chat/my_study"
ASSISTANT_URL = "https://learning-feal.maic.chat/dashboard"

FORBIDDEN_CLICKS = frozenset({"完成", "提交", "登录", "立即登录", "开始前测"})


def load_env_file() -> None:
    path = ROOT / ".env"
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


def review_seconds() -> float:
    load_env_file()
    raw = os.environ.get("MAIC_REVIEW_SECONDS", "0")
    try:
        return max(0.0, float(raw))
    except ValueError:
        return 0.0


def llm_settings() -> dict[str, str] | None:
    load_env_file()
    key = os.environ.get("MAIC_LLM_API_KEY", "").strip()
    if not key:
        return None
    return {
        "key": key,
        "base_url": os.environ.get("MAIC_LLM_BASE_URL", "https://api.openai.com/v1").rstrip("/"),
        "model": os.environ.get("MAIC_LLM_MODEL", "gpt-4o-mini"),
    }
