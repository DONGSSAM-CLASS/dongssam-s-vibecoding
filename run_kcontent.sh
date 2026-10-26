#!/usr/bin/env bash
# K-콘텐츠 스튜디오 실행 (macOS / Linux)
set -e
cd "$(dirname "$0")"
if [ ! -d .venv ]; then
  python3 -m venv .venv
  . .venv/bin/activate
  pip install -r requirements.txt
  [ -f .env ] || cp .env.example .env
  echo ".env 파일에 YOUTUBE_API_KEY(무료)를 입력한 뒤 다시 실행하세요. 대본은 기본으로 무료 AI 채팅을 씁니다."
  exit 0
fi
. .venv/bin/activate
python -m kcontent "$@"
