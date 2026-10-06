@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo [1/3] Python venv 생성...
if not exist .venv ( py -3 -m venv .venv || python -m venv .venv )
call .venv\Scripts\activate.bat
echo [2/3] 패키지 설치...
python -m pip install --upgrade pip >nul
python -m pip install -r requirements.txt || goto :err
echo [3/3] 예비용 브라우저 설치 (크롬이 없을 때 사용)...
python -m playwright install chromium
if not exist .env copy .env.example .env >nul
echo.
echo 설치 완료! .env 파일을 메모장으로 열어 ANTHROPIC_API_KEY 등을 입력한 뒤 run.bat 을 실행하세요.
notepad .env
pause
exit /b 0
:err
echo 설치 중 오류가 발생했습니다. 위 메시지를 확인하세요.
pause
exit /b 1
