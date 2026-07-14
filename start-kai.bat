@echo off
REM ============================================================
REM  Kai one-click run (Phase 1+2+3)
REM  1) MediaProviderManager (:8765)
REM  2) Optional browser catalog preview (:8790)
REM  3) Launch stremio.exe if found (streaming-server :11470 + MPV/SVP)
REM ============================================================
setlocal EnableDelayedExpansion
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js LTS requis — https://nodejs.org
  pause
  exit /b 1
)

echo.
echo  ========================================
echo   KAI  ·  one-click desktop anime player
echo  ========================================
echo.

REM --- MediaProvider ---
curl -s http://127.0.0.1:8765/health >nul 2>nul
if errorlevel 1 (
  echo [1/3] Demarrage MediaProviderManager :8765 ...
  start "Kai MediaProvider" cmd /c "cd /d "%~dp0media-provider" && if not exist node_modules npm install --no-fund --no-audit && npm start"
  set /a _wait=0
  :wait_mp
  timeout /t 1 /nobreak >nul
  curl -s http://127.0.0.1:8765/health >nul 2>nul
  if not errorlevel 1 goto mp_ok
  set /a _wait+=1
  if !_wait! geq 20 (
    echo [WARN] MediaProvider n'a pas repondu a temps — continue quand meme.
    goto mp_ok
  )
  goto wait_mp
) else (
  echo [1/3] MediaProvider deja actif sur :8765
)
:mp_ok

REM --- Catalog preview (UI without waiting for shell inject) ---
echo [2/3] Preview catalogue http://127.0.0.1:8790/docs/anime-catalog-preview.html
start "Kai Catalog Preview" cmd /c "cd /d "%~dp0" && npx --yes serve -l 8790 ."
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8790/docs/anime-catalog-preview.html"

REM --- Stremio-Kai / Community binary (provides :11470 + MPV + SVP) ---
echo [3/3] Recherche stremio.exe ...
set "STREMIO_EXE="

if defined KAI_STREMIO_EXE if exist "%KAI_STREMIO_EXE%" set "STREMIO_EXE=%KAI_STREMIO_EXE%"

if not defined STREMIO_EXE if exist "%~dp0stremio.exe" set "STREMIO_EXE=%~dp0stremio.exe"
if not defined STREMIO_EXE if exist "%~dp0..\stremio.exe" set "STREMIO_EXE=%~dp0..\stremio.exe"
if not defined STREMIO_EXE if exist "%LOCALAPPDATA%\Programs\LNV\Stremio-4\stremio.exe" set "STREMIO_EXE=%LOCALAPPDATA%\Programs\LNV\Stremio-4\stremio.exe"
if not defined STREMIO_EXE if exist "%LOCALAPPDATA%\StremioKai\stremio.exe" set "STREMIO_EXE=%LOCALAPPDATA%\StremioKai\stremio.exe"
if not defined STREMIO_EXE if exist "C:\Stremio-Kai\stremio.exe" set "STREMIO_EXE=C:\Stremio-Kai\stremio.exe"

if defined STREMIO_EXE (
  echo       Lance: %STREMIO_EXE%
  start "" "%STREMIO_EXE%"
  echo.
  echo  Lecture complète = shell Stremio-Kai + webmods de ce depot.
  echo  Copie/synchronise portable_config\webmods vers l'install Kai si besoin.
) else (
  echo       stremio.exe introuvable.
  echo       Pour la lecture MPV/SVP, installe Stremio-Kai puis:
  echo         set KAI_STREMIO_EXE=C:\chemin\vers\stremio.exe
  echo       Le preview navigateur reste utilisable pour le catalogue.
)

echo.
echo  API      http://127.0.0.1:8765/health
echo  Preview  http://127.0.0.1:8790/docs/anime-catalog-preview.html
echo  Streams  EngineFS http://127.0.0.1:11470  (via stremio.exe)
echo.
echo  Play dans le catalogue → handoff → :11470 → loadfile → profile_manager (SVP).
echo.
pause
