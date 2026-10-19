#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m playwright install chromium
echo "Nếu Chromium thiếu thư viện hệ thống, chạy: sudo python -m playwright install-deps chromium"
echo "Xong. Chạy ./run.sh"
