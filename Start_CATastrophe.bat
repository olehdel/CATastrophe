@echo off
setlocal
set "SCRIPT=%~dp0CatastropheServer.ps1"
for %%I in ("%~dp0.") do set "PROJECT_ROOT=%%~fI"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%" -Action Start -ProjectRoot "%PROJECT_ROOT%"
if errorlevel 1 (
  echo.
  echo Could not start CATastrophe. See the message above.
  pause
  exit /b 1
)

exit /b 0
