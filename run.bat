@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist .venv ( echo 먼저 setup.bat 을 실행하세요. & pause & exit /b 1 )
call .venv\Scripts\activate.bat
python -m pumui %*
pause
