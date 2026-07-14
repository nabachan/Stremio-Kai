@echo off
REM ============================================================
REM  Stremio-Kai DESKTOP — sources locales (pas un site web)
REM  1) MediaProvider :8765
REM  2) Copie portable_config vers l'install Kai (si trouvee)
REM  3) Lance stremio.exe
REM ============================================================
setlocal EnableDelayedExpansion
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Installe Node.js LTS: https://nodejs.org
  pause
  exit /b 1
)

echo.
echo  ========================================
echo   KAI DESKTOP  ·  sources locales
echo  ========================================
echo.

REM --- MediaProvider ---
curl -s http://127.0.0.1:8765/health >nul 2>nul
if errorlevel 1 (
  echo [1/3] Demarrage MediaProvider...
  start "Kai MediaProvider" cmd /c "cd /d "%~dp0media-provider" && if not exist node_modules npm install --no-fund --no-audit && npm start"
  timeout /t 4 /nobreak >nul
) else (
  echo [1/3] MediaProvider deja actif
)

REM --- Trouver stremio.exe ---
echo [2/3] Recherche stremio.exe ...
set "STREMIO_EXE="
set "STREMIO_DIR="

if defined KAI_STREMIO_EXE if exist "%KAI_STREMIO_EXE%" (
  set "STREMIO_EXE=%KAI_STREMIO_EXE%"
)

if not defined STREMIO_EXE if exist "%~dp0stremio.exe" set "STREMIO_EXE=%~dp0stremio.exe"
if not defined STREMIO_EXE if exist "%~dp0..\stremio.exe" set "STREMIO_EXE=%~dp0..\stremio.exe"
if not defined STREMIO_EXE if exist "C:\Stremio-Kai\stremio.exe" set "STREMIO_EXE=C:\Stremio-Kai\stremio.exe"
if not defined STREMIO_EXE if exist "%LOCALAPPDATA%\StremioKai\stremio.exe" set "STREMIO_EXE=%LOCALAPPDATA%\StremioKai\stremio.exe"
if not defined STREMIO_EXE if exist "%LOCALAPPDATA%\Programs\LNV\Stremio-4\stremio.exe" set "STREMIO_EXE=%LOCALAPPDATA%\Programs\LNV\Stremio-4\stremio.exe"

if defined STREMIO_EXE (
  for %%I in ("%STREMIO_EXE%") do set "STREMIO_DIR=%%~dpI"
  echo       Trouve: %STREMIO_EXE%

  echo [2b] Copie portable_config vers l'install...
  if exist "%STREMIO_DIR%portable_config" (
    xcopy /E /I /Y "%~dp0portable_config\*" "%STREMIO_DIR%portable_config\" >nul
    echo       portable_config synchronise.
  ) else (
    echo       [WARN] Pas de dossier portable_config a cote de stremio.exe —
    echo              copie manuellement "%~dp0portable_config" dans ton install Kai.
  )
) else (
  echo       stremio.exe INTROUVABLE.
  echo       Installe Stremio-Kai, puis:
  echo         set KAI_STREMIO_EXE=C:\chemin\vers\stremio.exe
  echo         install-desktop.bat
)

echo [3/3] Lancement...
if defined STREMIO_EXE (
  start "" "%STREMIO_EXE%"
) else (
  echo       (skip) pas d'exe a lancer
)

echo.
echo  IMPORTANT — dans Stremio-Kai, va dans Addons et installe:
echo.
echo      http://127.0.0.1:8765/manifest.json
echo.
echo  Desinstalle les autres addons de catalogues/streams.
echo  Le Board Kai affichera Solo Leveling / AoT via MediaProvider.
echo  Lecteur MPV + SVP = inchanges.
echo.
pause
