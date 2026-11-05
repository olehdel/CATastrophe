@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Build_CATastrophe.ps1"
if errorlevel 1 (
  echo.
  echo CATastrophe standalone build failed. See the error above.
  pause
  exit /b 1
)
echo.
echo CATastrophe.html was rebuilt successfully.
pause
exit /b 0
