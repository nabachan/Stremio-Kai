@echo off
setlocal
cd /d "%~dp0\.."
if not exist node_modules (
  call npm install --no-fund --no-audit
)
call npm start
