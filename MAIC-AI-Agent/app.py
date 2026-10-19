"""Streamlit dashboard. Browser actions run in a subprocess so Playwright stays sync."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import streamlit as st

from dashboard.controls import CONTROLS
from database.store import connect, latest_assistant, list_modules, mark_user_reviewed, notes_for
from config import DB_PATH, ROOT
from main import export_notes


def _run(args: list[str]) -> None:
    completed = subprocess.run(
        [sys.executable, str(ROOT / "main.py"), *args],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    if completed.returncode == 0:
        st.success(completed.stdout or "Xong.")
    else:
        st.error(completed.stdout or completed.stderr or "Lỗi.")


st.set_page_config(page_title="MAIC AI Learning Agent", layout="wide")
st.title("MAIC AI Learning Agent")
st.caption("Đọc bài và ghi chú. Không tự trả lời quiz, không bấm 完成, không ghi module là đã học chỉ vì đã mở.")

conn = connect(DB_PATH)
assistant = latest_assistant(conn)
modules = list_modules(conn)

if assistant:
    st.info(
        f"Tiến độ chính thức lần quét gần nhất: {assistant['modules_done']}/{assistant['modules_total']} module, "
        f"questionnaire {assistant['questionnaires']}, bài luận {assistant['paper']}. "
        f"Lúc {assistant['synced_at']}."
    )
else:
    st.info("Chưa quét Learning Assistant. Số 1/10 trong báo cáo cũ không được dùng làm số hiện tại.")

names = [row["title"] for row in modules] or ["(chưa có module)"]
choice = st.selectbox("Chọn module", names)
selected = next((row for row in modules if row["title"] == choice), None)

if selected:
    c1, c2, c3 = st.columns(3)
    c1.metric("Trang đã lưu", f"{selected['last_slide'] or '-'} / {selected['total_slides'] or '-'}")
    c2.metric("AI đã đọc", selected["ai_status"])
    c3.metric("Chính thức", selected["official_status"])
    st.write(f"URL phòng học: {selected['classroom_url'] or 'chưa mở'}")

left, right = st.columns(2)
with left:
    if st.button(CONTROLS[1]):
        _run(["scan-courses"])
    if st.button(CONTROLS[9]):
        _run(["scan-progress"])
    if st.button(CONTROLS[7]) and selected:
        _run(["next", "--module", selected["title"]])
    if st.button(CONTROLS[8]) and selected:
        _run(["prev", "--module", selected["title"]])
with right:
    if st.button(CONTROLS[0]):
        _run(["scan-courses"])
    if st.button(CONTROLS[3]) and selected and selected["classroom_url"]:
        _run(["study", "--module", selected["title"], "--url", selected["classroom_url"]])
    if st.button(CONTROLS[10]) and selected:
        for note in notes_for(conn, selected["title"]):
            st.markdown(f"**Trang {note['slide_number']}** ({note['source']})")
            st.text(note["body"])
    if st.button(CONTROLS[4]) and selected:
        st.warning("Đã tạm dừng. Quiz và nút 完成 luôn dừng, kể cả khi không bấm nút này.")
    if st.button(CONTROLS[5]) and selected:
        mark_user_reviewed(conn, selected["title"])
        st.success("Đã đánh dấu là người học đã xem ghi chú. Đây không phải 已学完.")
    if st.button(CONTROLS[11]) and selected:
        target = ROOT / "data" / f"{selected['title'][:40]}.md"
        count = export_notes(selected["title"], target)
        st.success(f"Đã ghi {count} ghi chú vào {target.name}")
    if st.button(CONTROLS[6]):
        st.info("Không có vòng lật trang tự động để dừng. Mỗi lần sang trang là một lần bấm.")

st.subheader("Ba lớp trạng thái")
st.dataframe(
    [
        {
            "module": row["title"],
            "AI đã đọc": row["ai_status"],
            "Người học đã xem ghi chú": "có" if row["user_reviewed"] else "chưa",
            "Chính thức trên site": row["official_status"],
            "trang": f"{row['last_slide'] or '-'} / {row['total_slides'] or '-'}",
        }
        for row in modules
    ],
    use_container_width=True,
)
conn.close()
