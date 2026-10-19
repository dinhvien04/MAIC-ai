"""Parse visible MAIC text. Selectors are labels observed in the browser."""

from __future__ import annotations

import re
from dataclasses import dataclass

SLIDE_LINE = re.compile(r"^(\d+)/(\d+)$")
PERCENT_LINE = re.compile(r"^(\d+(?:\.\d+)?)%$")
MODULE_COUNT = re.compile(r"已完成\s*(\d+)\s*/\s*共\s*(\d+)\s*个模块")
STUDY_PERCENT = re.compile(r"^已学习(\d+)%$")

NAV_NOISE = {
    "模课",
    "课程广场",
    "我的学习",
    "关于",
    "中文",
    "目录",
    "收起",
    "课程简介",
    "教学大纲",
    "已加入",
    "您的反馈将帮助我们进步",
    "正在学习",
    "已学完",
    "长期有效",
    "N",
}
ACTIONS = {"开始学习", "继续学习", "去复习"}


@dataclass
class SlidePosition:
    current: int
    total: int


@dataclass
class CourseCard:
    name: str
    percent: int
    action: str


@dataclass
class OutlineItem:
    title: str
    percent: str | None


@dataclass
class AssistantStatus:
    modules_done: int | None
    modules_total: int | None
    questionnaires: str | None
    paper: str | None


class StudyPause(RuntimeError):
    """User must act. The agent does not answer or submit."""


class NavigationError(RuntimeError):
    pass


def lines_of(text: str) -> list[str]:
    return [line.strip() for line in text.splitlines() if line.strip()]


def parse_slide_counter(text: str) -> SlidePosition | None:
    for line in lines_of(text):
        match = SLIDE_LINE.match(line)
        if match:
            return SlidePosition(int(match.group(1)), int(match.group(2)))
    return None


def needs_user(text: str) -> bool:
    return "单选题" in text or "多选题" in text


def has_complete_button(text: str) -> bool:
    return any(line.strip() == "完成" for line in text.splitlines())


def detect_login(url: str, text: str) -> bool:
    lowered = url.lower()
    if "/login" in lowered or "/signin" in lowered:
        return True
    return any(marker in text for marker in ("请输入密码", "请输入MAIC登录邮箱", "立即登录", "账号密码登录"))


def parse_my_study(text: str) -> list[CourseCard]:
    rows: list[CourseCard] = []
    content = lines_of(text)
    for index, line in enumerate(content):
        match = STUDY_PERCENT.match(line)
        if not match or index < 2:
            continue
        title = content[index - 2]
        if title in NAV_NOISE or title in ACTIONS:
            continue
        action = content[index + 1] if index + 1 < len(content) and content[index + 1] in ACTIONS else ""
        rows.append(CourseCard(title, int(match.group(1)), action))
    return rows


def parse_outline(text: str) -> list[OutlineItem]:
    content = lines_of(text)
    found: list[OutlineItem] = []
    index = 0
    while index < len(content) - 1:
        title = content[index]
        if title == content[index + 1] and title not in NAV_NOISE and title not in ACTIONS and not PERCENT_LINE.match(title):
            percent = None
            step = 2
            if index + 2 < len(content) and PERCENT_LINE.match(content[index + 2]):
                percent = content[index + 2]
                step = 3
            found.append(OutlineItem(title, percent))
            index += step
            continue
        index += 1
    return found


def parse_assistant(text: str) -> AssistantStatus:
    flat = re.sub(r"\s+", " ", text)
    modules = MODULE_COUNT.search(flat)
    questionnaires = re.search(r"(\d+\s*/\s*\d+)\s*已完成问卷", flat)
    paper = re.search(r"(\d+\s*/\s*\d+)\s*论文提交", flat)
    return AssistantStatus(
        modules_done=int(modules.group(1)) if modules else None,
        modules_total=int(modules.group(2)) if modules else None,
        questionnaires=questionnaires.group(1).replace(" ", "") if questionnaires else None,
        paper=paper.group(1).replace(" ", "") if paper else None,
    )


def extract_script(text: str) -> str:
    """Current-page narration shown by 分页讲稿. Not the whole module."""
    content = lines_of(text)
    chunks = [line for line in content if len(line) > 80 and not line.startswith("http")]
    if chunks:
        return max(chunks, key=len)
    marker = next((i for i, line in enumerate(content) if re.fullmatch(r"P\d+页", line)), None)
    if marker and marker > 0:
        return content[marker - 1]
    return ""


def classroom_title(text: str) -> str:
    for line in lines_of(text):
        if " / " in line and "Introduction" in line or line.count(" / ") >= 2:
            return line
        if line.count(" / ") >= 2:
            return line
    return ""
