@echo off
REM Lance le preview Phase 2 (catalogue anime) dans le navigateur.
REM 1) Demarre MediaProvider si besoin  2) Sert les fichiers en local

setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js requis — https://nodejs.org
  pause
  exit /b 1
)

REM Start MediaProvider in a new window if port 8765 is free
curl -s -o nul -w "" http://127.0.0.1:8765/health >nul 2>nul
if errorlevel 1 (
  echo [Kai] Demarrage MediaProvider...
  start "Kai MediaProvider" cmd /c "cd /d "%~dp0media-provider" && if not exist node_modules npm install --no-fund --no-audit && npm start"
  timeout /t 3 /nobreak >nul
)

echo [Kai] Preview UI sur http://127.0.0.1:8790/docs/anime-catalog-preview.html
echo [Kai] Ctrl+C dans la fenetre serveur pour arreter.
echo.
npx --yes serve -l 8790 .
