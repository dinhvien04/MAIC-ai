from maic_agent.guards import UnsafeUrlError, assert_url_allowed, refuses_click
from maic_agent.parse import (
    detect_auth_wall,
    paper_requirement_state,
    parse_homework,
    parse_my_study,
    parse_outline,
    parse_plaza,
)
from tests.fixtures.pages import ASSISTANT_LOGIN, HOMEWORK, INTRO, LOGIN, MY_STUDY, PLAZA


def test_my_study_reads_percent_without_treating_courses_as_sixty_modules():
    courses = parse_my_study(MY_STUDY)
    assert [c.name for c in courses] == [
        "The Major Schools of Educational Theory",
        "Data Mining (0822)",
        "Project Intro A",
    ]
    by_name = {c.name: c for c in courses}
    assert by_name["Project Intro A"].percent == 100
    assert by_name["Project Intro A"].group_name == "已学完"
    assert by_name["Project Intro A"].action_label == "去复习"
    assert by_name["Data Mining (0822)"].percent == 0
    assert by_name["The Major Schools of Educational Theory"].percent == 5


def test_plaza_pairs_title_with_teacher():
    courses = parse_plaza(PLAZA)
    assert [(c.name, c.teacher) for c in courses] == [
        ("Project Intro A", "Mr. Yu"),
        ("The Major Schools of Educational Theory", "石中英(Shi Zhongying)"),
        ("Educational Psychology", "Mr. Wei"),
    ]


def test_outline_and_homework_do_not_count_attached_file_as_submitted():
    outline = parse_outline(INTRO)
    assert ("Course Learning and Platform Guide", "已学完") in [
        (item.title, item.status_label) for item in outline
    ]
    view = parse_homework(HOMEWORK)
    assert view.submitted is False
    assert view.blocked is True
    assert view.deadline == "2026-10-18 23:59:00"
    assert view.student_files == ["MAIC_AI_Education_Research_Paper.docx"]
    assert "Rubric.docx" in view.assignment_files
    assert "Task 1.docx" in view.assignment_files
    state, evidence = paper_requirement_state(view)
    assert state == "blocked"
    assert "chưa được tính là đã nộp" in evidence


def test_auth_wall_and_url_guard():
    assert detect_auth_wall("https://maic.chat/signin?redirect=%2F", LOGIN)
    assert detect_auth_wall("https://learning-feal.maic.chat/login", ASSISTANT_LOGIN)
    assert not detect_auth_wall("https://maic.chat/my_study", MY_STUDY)
    assert refuses_click("开始学习")
    assert refuses_click("提交")
    assert_url_allowed("https://maic.chat/my_study")
    try:
        assert_url_allowed("https://evil.example/steal")
    except UnsafeUrlError:
        pass
    else:
        raise AssertionError("host lạ phải bị chặn")
