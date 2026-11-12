@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "LEARNNEST_PY=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
if exist "%LEARNNEST_PY%" (
  "%LEARNNEST_PY%" -X utf8 launch.py
) else (
  python -X utf8 launch.py
)
if errorlevel 1 (
  echo.
  echo 启动失败，请确认已安装 Python 3.10 或更新版本，或查看窗口中的错误信息。
  pause
)
