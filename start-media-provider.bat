@echo off
REM One-click Phase 1 MediaProvider for Windows
REM Double-click this file from the repo root, or run it from cmd.

setlocal
cd /d "%~dp0"

if not exist "media-provider\package.json" (
  echo [ERROR] media-provider\package.json introuvable.
  echo.
  echo Tu dois etre dans le depot Stremio-Kai clone, branche:
  echo   cursor/media-provider-manager-2868
  echo.
  echo Exemple:
  echo   git clone https://github.com/nabachan/Stremio-Kai.git
  echo   cd Stremio-Kai
  echo   git checkout cursor/media-provider-manager-2868
  echo   start-media-provider.bat
  echo.
  pause
  exit /b 1
)

cd media-provider

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js n'est pas installe ou pas dans le PATH.
  echo Installe LTS depuis https://nodejs.org puis rouvre ce terminal.
  pause
  exit /b 1
)

echo [Kai] Node: 
node -v
echo [Kai] Working dir: %CD%

if not exist node_modules (
  echo [Kai] npm install...
  call npm install --no-fund --no-audit
  if errorlevel 1 (
    echo [ERROR] npm install a echoue.
    pause
    exit /b 1
  )
)

echo [Kai] Smoke tests...
call npm test
if errorlevel 1 (
  echo [ERROR] smoke tests failed.
  pause
  exit /b 1
)

echo.
echo [Kai] Demarrage serveur http://127.0.0.1:8765
echo [Kai] Laisse cette fenetre ouverte. Ctrl+C pour arreter.
echo.
call npm start
pause
