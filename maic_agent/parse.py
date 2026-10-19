"""Parse visible MAIC page text. No network and no completion side effects."""

from __future__ import annotations

import re
from dataclasses import dataclass, field

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
    "您的反馈将帮助我们进步",
    "N",
}

GROUP_LABELS = {"正在学习", "已学完"}
ACTION_LABELS = {"开始学习", "继续学习", "去复习"}
STATUS_LABELS = {"已学完", "未提交", "已提交"}
PERCENT_RE = re.compile(r"^已学习(\d+)%$")
FILE_RE = re.compile(r"^[\w.\- ]+\.(?:docx|doc|pdf|zip|png|jpg|mp4|mp3)$", re.I)


@dataclass
class CourseProgress:
    name: str
    group_name: str
    percent: int
    action_label: str
    validity: str = ""


@dataclass
class PlazaCourse:
    name: str
    teacher: str


@dataclass
class OutlineItem:
    title: str
    status_label: str


@dataclass
class HomeworkView:
    raw_status: str
    submitted: bool
    blocked: bool
    deadline: str | None
    assignment_files: list[str] = field(default_factory=list)
    student_files: list[str] = field(default_factory=list)


def _lines(text: str) -> list[str]:
    return [line.strip() for line in text.splitlines() if line.strip()]


def detect_auth_wall(url: str, text: str) -> bool:
    lowered = url.lower()
    if "/login" in lowered or "/signin" in lowered:
        return True
    markers = ("请输入密码", "请输入MAIC登录邮箱", "立即登录", "账号密码登录")
    return any(marker in text for marker in markers)


def parse_my_study(text: str) -> list[CourseProgress]:
    """Read 我的学习 from rendered text.

    Course cards are not links. The stable signal is the text sequence
    title / 长期有效 / 已学习N% / action.
    """
    rows: list[CourseProgress] = []
    lines = _lines(text)
    group = ""
    for index, line in enumerate(lines):
        if line in GROUP_LABELS:
            group = line
            continue
        match = PERCENT_RE.match(line)
        if not match or index < 2:
            continue
        validity = lines[index - 1]
        title = lines[index - 2]
        if title in NAV_NOISE or title in GROUP_LABELS or title in ACTION_LABELS:
            continue
        action = ""
        if index + 1 < len(lines) and lines[index + 1] in ACTION_LABELS:
            action = lines[index + 1]
        rows.append(
            CourseProgress(
                name=title,
                group_name=group,
                percent=int(match.group(1)),
                action_label=action,
                validity=validity,
            )
        )
    return rows


def parse_plaza(text: str) -> list[PlazaCourse]:
    lines = _lines(text)
    found: list[PlazaCourse] = []
    for index, line in enumerate(lines):
        if not line.startswith("授课教师") or index == 0:
            continue
        title = lines[index - 1]
        if title in NAV_NOISE or title.startswith("授课教师"):
            continue
        teacher = line.split("：", 1)[-1].strip()
        found.append(PlazaCourse(name=title, teacher=teacher))
    return found


def parse_outline(text: str) -> list[OutlineItem]:
    lines = _lines(text)
    items: list[OutlineItem] = []
    for index, line in enumerate(lines):
        if line not in STATUS_LABELS or index == 0:
            continue
        title = lines[index - 1]
        if title in NAV_NOISE or title in STATUS_LABELS:
            continue
        items.append(OutlineItem(title=title, status_label=line))
    return items


def parse_homework(text: str) -> HomeworkView:
    lines = _lines(text)
    blocked = "超出作业提交时间无法提交" in text
    if "未提交" in text:
        raw_status = "未提交"
        submitted = False
    elif "已提交" in text:
        raw_status = "已提交"
        submitted = True
    else:
        raw_status = "unknown"
        submitted = False

    deadline = None
    for line in lines:
        if line.startswith("截止时间"):
            deadline = line.split("：", 1)[-1].strip()
            break

    split_at = None
    for index, line in enumerate(lines):
        if line.startswith("我的作业"):
            split_at = index
            break

    def collect(chunk: list[str], stop_prefix: str | None = None) -> list[str]:
        names: list[str] = []
        for line in chunk:
            if stop_prefix and line.startswith(stop_prefix):
                break
            if FILE_RE.match(line) and line not in names:
                names.append(line)
        return names

    if split_at is None:
        assignment_files = collect(lines)
        student_files: list[str] = []
    else:
        assignment_files = collect(lines[:split_at])
        student_files = collect(lines[split_at + 1 :], "上传附件")

    return HomeworkView(
        raw_status=raw_status,
        submitted=submitted,
        blocked=blocked,
        deadline=deadline,
        assignment_files=assignment_files,
        student_files=student_files,
    )


def paper_requirement_state(view: HomeworkView) -> tuple[str, str]:
    """Map homework text to a requirement state.

    A file sitting in 我的作业 is not a submission. A 100% course is not either.
    """
    files = ", ".join(view.student_files) if view.student_files else "không thấy file"
    if view.submitted:
        return "confirmed", f"Trang bài hiện {view.raw_status}. File: {files}."
    if view.blocked:
        return (
            "blocked",
            f"Trang hiện {view.raw_status} và chặn nộp. File gắn trên trang ({files}) chưa được tính là đã nộp.",
        )
    if view.raw_status == "未提交":
        return "not_submitted", f"Trang hiện 未提交. File gắn trên trang: {files}."
    return "not_seen", "Chưa đọc được trạng thái bài luận trên trang."
