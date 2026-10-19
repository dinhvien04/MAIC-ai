"""Streamlit progress dashboard. Scanning runs in a subprocess so Playwright stays sync."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import streamlit as st

from maic_agent.db import connect, courses_for, latest_scan, logs_for, requirements_for, save_summary
from maic_agent.guards import REQUIREMENT_LABELS
from maic_agent.summary import summarize_text

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "maic_agent.sqlite"


def _run_scan(fresh: bool) -> None:
    command = [sys.executable, "-m", "maic_agent", "scan"]
    if fresh:
        command.append("--fresh")
    with st.spinner("Đang mở Chromium. Nếu thấy trang đăng nhập, hãy tự nhập. Cửa sổ này không gửi mật khẩu."):
        completed = subprocess.run(command, cwd=ROOT, capture_output=True, text=True)
    if completed.returncode != 0:
        st.error(completed.stderr or completed.stdout or "Quét thất bại.")
    else:
        st.success(completed.stdout or "Quét xong.")
        st.rerun()


st.set_page_config(page_title="MAIC Agent V1", layout="wide")
st.title("MAIC Agent V1")
st.caption("Theo dõi tiến độ. Không làm bài thi, không nộp questionnaire, không viết hộ bài luận.")

st.warning(
    "14 khóa trên 我的学习 không phải 60 module bắt buộc. "
    "File gắn ở 我的作业 không được tính là đã nộp. "
    "Learning Assistant là site riêng và có thể vẫn ở trang đăng nhập."
)

conn = connect(DB_PATH)
scan = latest_scan(conn)

left, right = st.columns(2)
with left:
    if st.button("Quét chỉ đọc"):
        _run_scan(fresh=False)
with right:
    if st.button("Quét mới, không nối scan cũ"):
        _run_scan(fresh=True)

if scan is None:
    st.info("Chưa có scan. Bấm quét, rồi tự đăng nhập trên cửa sổ Chromium. Agent không nhập mật khẩu.")
else:
    st.subheader(f"Scan #{scan['id']} — {scan['status']}")
    st.write(
        {
            "bắt đầu": scan["started_at"],
            "kết thúc": scan["finished_at"],
            "bước cuối": scan["last_step"],
            "URL cuối": scan["last_url"],
            "lỗi": scan["error"],
        }
    )
    courses = courses_for(conn, scan["id"])
    st.subheader("Khóa trên 我的学习")
    if courses:
        st.dataframe(
            [
                {
                    "khóa": row["name"],
                    "nhóm": row["group_name"],
                    "phần trăm": row["percent"],
                    "nút nhìn thấy": row["action_label"],
                    "hiệu lực": row["validity"],
                }
                for row in courses
            ],
            use_container_width=True,
        )
    else:
        st.write("Scan này chưa đọc được danh sách khóa.")

    st.subheader("Năm yêu cầu chứng chỉ")
    st.dataframe(
        [
            {
                "yêu cầu": REQUIREMENT_LABELS.get(row["code"], row["code"]),
                "trạng thái": row["state"],
                "bằng chứng": row["evidence"],
            }
            for row in requirements_for(conn, scan["id"])
        ],
        use_container_width=True,
    )

with st.expander("Log"):
    rows = logs_for(conn, None if scan is None else scan["id"])
    st.dataframe(
        [{"lúc": row["created_at"], "mức": row["level"], "nội dung": row["message"]} for row in rows],
        use_container_width=True,
    )

st.subheader("Đọc tài liệu có sẵn")
st.caption("Tóm tắt trích đoạn và đếm độ dài. Không tạo bản để nộp.")
uploaded = st.file_uploader("File .txt, .md hoặc .docx", type=["txt", "md", "docx"])
pasted = st.text_area("Hoặc dán văn bản")
if st.button("Tóm tắt"):
    text = ""
    source = "văn bản dán vào"
    if uploaded is not None:
        source = uploaded.name
        raw = uploaded.getvalue()
        if uploaded.name.lower().endswith(".docx"):
            temp = ROOT / "data" / "upload.docx"
            temp.parent.mkdir(parents=True, exist_ok=True)
            temp.write_bytes(raw)
            from maic_agent.summary import read_text_file

            text = read_text_file(temp)
        else:
            text = raw.decode("utf-8", errors="replace")
    elif pasted.strip():
        text = pasted
    if not text.strip():
        st.error("Chưa có văn bản.")
    else:
        result = summarize_text(text, source)
        save_summary(
            conn,
            result.source_name,
            result.char_count,
            result.word_count,
            result.cjk_count,
            result.summary,
            result.checklist,
        )
        st.text(result.checklist)
        st.write(result.summary)

conn.close()
