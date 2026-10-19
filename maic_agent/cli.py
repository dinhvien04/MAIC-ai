"""Command line entry for a read-only scan or a local document summary."""

from __future__ import annotations

import argparse
import logging
from pathlib import Path

from maic_agent.db import connect, save_summary
from maic_agent.scan import run_live_scan
from maic_agent.summary import read_text_file, summarize_text

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
DB_PATH = DATA / "maic_agent.sqlite"
PROFILE = DATA / "browser-profile"


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    parser = argparse.ArgumentParser(description="MAIC Agent V1, chỉ đọc tiến độ.")
    sub = parser.add_subparsers(dest="command", required=True)

    scan = sub.add_parser("scan", help="Đọc catalog. Không bấm vào bài học hay nộp bài.")
    scan.add_argument("--fresh", action="store_true", help="Bỏ scan dở và tạo scan mới.")
    scan.add_argument("--headless", action="store_true", help="Không mở cửa sổ. Chỉ dùng khi profile đã đăng nhập.")

    summary = sub.add_parser("summary", help="Tóm tắt file .txt, .md hoặc .docx có sẵn trên máy.")
    summary.add_argument("path", type=Path)

    args = parser.parse_args(argv)
    if args.command == "scan":
        scan_id = run_live_scan(
            DB_PATH,
            PROFILE,
            headed=not args.headless,
            resume=not args.fresh,
        )
        print(f"Scan {scan_id} đã ghi vào {DB_PATH}")
        return 0

    text = read_text_file(args.path)
    result = summarize_text(text, args.path.name)
    conn = connect(DB_PATH)
    save_summary(
        conn,
        result.source_name,
        result.char_count,
        result.word_count,
        result.cjk_count,
        result.summary,
        result.checklist,
    )
    conn.close()
    print(result.checklist)
    print()
    print(result.summary)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
