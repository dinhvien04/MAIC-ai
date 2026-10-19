#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [[ ! -d .venv ]]; then
  echo "Chưa có .venv. Chạy ./setup.sh trước."
  exit 1
fi
source .venv/bin/activate
streamlit run app.py
