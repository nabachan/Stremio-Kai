@echo off
REM Aide a trouver stremio.exe sur le PC
echo Recherche de stremio.exe (peut prendre 1-2 min)...
echo.
where /R C:\ stremio.exe 2>nul
where /R "%USERPROFILE%" stremio.exe 2>nul
where /R D:\ stremio.exe 2>nul
echo.
echo Si un chemin s'affiche, lance:
echo   install-desktop.bat "CHEMIN\COMPLET\stremio.exe"
echo.
pause
