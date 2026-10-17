@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo  ===== 조선의 농민 : Firebase 배포 =====
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo  Node.js가 없습니다. 열리는 누리집에서 LTS 버전을 설치한 뒤 이 파일을 다시 실행하세요.
  start https://nodejs.org/ko
  pause
  exit /b 1
)
if exist .firebaserc goto login
set /p PID=Firebase 프로젝트 ID를 입력하세요 (예: joseon-farmer-1a2b3): 
if "%PID%"=="" (
  echo  프로젝트 ID가 비었습니다.
  pause
  exit /b 1
)
> .firebaserc echo {"projects":{"default":"%PID%"}}
:login
echo.
echo  [1/2] 구글 계정으로 로그인합니다. 브라우저 창이 열리면 Firebase 프로젝트를 만든 계정을 고르세요.
call npx -y firebase-tools login
echo.
echo  [2/2] 보안 규칙과 웹 화면을 올립니다.
call npx -y firebase-tools deploy --only firestore:rules,hosting
echo.
echo  끝났습니다. 위에 나온 Hosting URL 이 학생 주소이고, 뒤에 /teacher.html 을 붙이면 교사 화면입니다.
pause
