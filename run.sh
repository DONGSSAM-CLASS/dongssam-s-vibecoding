#!/usr/bin/env bash
# macOS / Linux 실행 스크립트
set -e
cd "$(dirname "$0")"
if [ ! -d .venv ]; then
  python3 -m venv .venv
  . .venv/bin/activate
  pip install -r requirements.txt
  python -m playwright install chromium
  [ -f .env ] || cp .env.example .env
  echo ".env 파일에 ANTHROPIC_API_KEY 를 입력한 뒤 다시 실행하세요."
  exit 0
fi
. .venv/bin/activate
python -m pumui "$@"
