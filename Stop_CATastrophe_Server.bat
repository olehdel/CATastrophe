@echo off
setlocal
set "SCRIPT=%~dp0CatastropheServer.ps1"
for %%I in ("%~dp0.") do set "PROJECT_ROOT=%%~fI"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%" -Action Stop -ProjectRoot "%PROJECT_ROOT%"
if errorlevel 1 (
  echo.
  echo Could not stop the CATastrophe server. See the message above.
  pause
  exit /b 1
)

echo.
pause
exit /b 0
