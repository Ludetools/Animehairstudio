@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start Anime Hair Studio.ps1"
if errorlevel 1 (
  echo.
  echo Anime Hair Studio could not start. See AnimeHairStudio-launch.log for details.
  pause
)
