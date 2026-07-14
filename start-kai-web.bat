@echo off
REM Kai — official stremio-web + MediaProvider one-click
setlocal EnableDelayedExpansion
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js ^>=22 requis — https://nodejs.org
  pause
  exit /b 1
)

where pnpm >nul 2>nul
if errorlevel 1 (
  echo [Kai] Installation de pnpm...
  call npm install -g pnpm
)

echo [1/2] MediaProvider :8765
curl -s http://127.0.0.1:8765/health >nul 2>nul
if errorlevel 1 (
  start "Kai MediaProvider" cmd /c "cd /d "%~dp0media-provider" && if not exist node_modules npm install --no-fund --no-audit && npm start"
  timeout /t 3 /nobreak >nul
) else (
  echo       deja actif
)

echo [2/2] stremio-web (Kai fork)
cd /d "%~dp0stremio-web"
if not exist node_modules (
  echo       pnpm install...
  call pnpm install
)
echo.
echo  Lance webpack — ouvre l'URL affichee (souvent http://127.0.0.1:8080).
echo  Board = catalogues anime via MediaProvider. Pas de login Stremio.
echo.
call pnpm start
pause
