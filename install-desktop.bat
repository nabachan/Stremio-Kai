@echo off
REM ============================================================
REM  Stremio-Kai DESKTOP — sources locales
REM  Usage:
REM    install-desktop.bat
REM    install-desktop.bat "D:\Apps\Stremio-Kai\stremio.exe"
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
echo   KAI DESKTOP - sources locales
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

REM 1) Argument en ligne de commande
if not "%~1"=="" (
  if exist "%~1" set "STREMIO_EXE=%~1"
)

REM 2) Fichier local de config persistant
if not defined STREMIO_EXE if exist "%~dp0.kai-stremio-path.txt" (
  set /p STREMIO_EXE=<"%~dp0.kai-stremio-path.txt"
  if not exist "!STREMIO_EXE!" set "STREMIO_EXE="
)

REM 3) Variable d'environnement
if not defined STREMIO_EXE if defined KAI_STREMIO_EXE (
  if exist "!KAI_STREMIO_EXE!" set "STREMIO_EXE=!KAI_STREMIO_EXE!"
)

REM 4) Emplacements courants
if not defined STREMIO_EXE if exist "%~dp0stremio.exe" set "STREMIO_EXE=%~dp0stremio.exe"
if not defined STREMIO_EXE if exist "%~dp0..\stremio.exe" set "STREMIO_EXE=%~dp0..\stremio.exe"
if not defined STREMIO_EXE if exist "C:\Stremio-Kai\stremio.exe" set "STREMIO_EXE=C:\Stremio-Kai\stremio.exe"
if not defined STREMIO_EXE if exist "D:\Stremio-Kai\stremio.exe" set "STREMIO_EXE=D:\Stremio-Kai\stremio.exe"
if not defined STREMIO_EXE if exist "%USERPROFILE%\Desktop\Stremio-Kai\stremio.exe" set "STREMIO_EXE=%USERPROFILE%\Desktop\Stremio-Kai\stremio.exe"
if not defined STREMIO_EXE if exist "%USERPROFILE%\Downloads\Stremio-Kai\stremio.exe" set "STREMIO_EXE=%USERPROFILE%\Downloads\Stremio-Kai\stremio.exe"
if not defined STREMIO_EXE if exist "%LOCALAPPDATA%\StremioKai\stremio.exe" set "STREMIO_EXE=%LOCALAPPDATA%\StremioKai\stremio.exe"
if not defined STREMIO_EXE if exist "%LOCALAPPDATA%\Programs\LNV\Stremio-4\stremio.exe" set "STREMIO_EXE=%LOCALAPPDATA%\Programs\LNV\Stremio-4\stremio.exe"
if not defined STREMIO_EXE if exist "%LOCALAPPDATA%\Programs\Stremio\stremio.exe" set "STREMIO_EXE=%LOCALAPPDATA%\Programs\Stremio\stremio.exe"

REM 5) Demande interactive
if not defined STREMIO_EXE (
  echo.
  echo  stremio.exe introuvable aux chemins habituels.
  echo  C:\Stremio-Kai\stremio.exe n'existe PAS sur ta machine.
  echo.
  echo  Cherche le fichier toi-meme:
  echo    1. Ouvre l'Explorateur Windows
  echo    2. Dans la barre de recherche: stremio.exe
  echo    3. Copie le chemin complet ici
  echo.
  echo  Exemple: D:\Apps\Stremio-Kai\stremio.exe
  echo.
  set /p STREMIO_EXE=Chemin vers stremio.exe: 
  set "STREMIO_EXE=!STREMIO_EXE:"=!"
  if not exist "!STREMIO_EXE!" (
    echo.
    echo  [ERROR] Fichier introuvable: !STREMIO_EXE!
    echo  Telecharge Stremio-Kai:
    echo  https://github.com/allecsc/Stremio-Kai/releases/latest
    echo  Extrais le .7z, puis relance:
    echo    install-desktop.bat "C:\chemin\extrait\stremio.exe"
    echo.
    pause
    exit /b 1
  )
)

REM Memoriser le chemin pour la prochaine fois
echo !STREMIO_EXE!>"%~dp0.kai-stremio-path.txt"

for %%I in ("!STREMIO_EXE!") do set "STREMIO_DIR=%%~dpI"
echo       Trouve: !STREMIO_EXE!

echo [2b] Sync portable_config...
if exist "!STREMIO_DIR!portable_config" (
  xcopy /E /I /Y "%~dp0portable_config\*" "!STREMIO_DIR!portable_config\" >nul
  echo       portable_config synchronise.
) else (
  echo       [WARN] Pas de portable_config a cote de stremio.exe.
  echo       Si ton build Kai en a un, copie:
  echo         %~dp0portable_config
  echo       vers:
  echo         !STREMIO_DIR!portable_config
)

echo [3/3] Lancement de Stremio-Kai...
start "" "!STREMIO_EXE!"

echo.
echo  ========================================
echo  DANS STREMIO-KAI:
echo    Addons  -^>  installer cette URL:
echo.
echo    http://127.0.0.1:8765/manifest.json
echo.
echo  Desinstalle les autres addons streams/catalogs.
echo  MediaProvider doit rester ouvert en arriere-plan.
echo  ========================================
echo.
pause
