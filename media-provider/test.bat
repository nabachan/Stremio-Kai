@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js manquant. https://nodejs.org
  pause
  exit /b 1
)

if not exist node_modules (
  call npm install --no-fund --no-audit
)

call npm test
echo.
pause
