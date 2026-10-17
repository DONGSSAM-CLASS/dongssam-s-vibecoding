#!/usr/bin/env bash
# macOS · 리눅스용 배포 (Windows는 deploy.bat를 두 번 클릭)
set -e
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Node.js(LTS)를 먼저 설치하세요: https://nodejs.org/ko"; exit 1; }
if [ ! -f .firebaserc ]; then
  read -rp "Firebase 프로젝트 ID: " PID
  printf '{"projects":{"default":"%s"}}\n' "$PID" > .firebaserc
fi
npx -y firebase-tools login
npx -y firebase-tools deploy --only firestore:rules,hosting
