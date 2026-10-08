@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 18+ is required.
  pause
  exit /b 1
)
echo Starting DEGZ Enterprise HRIS on http://localhost:3030
node server.js
pause
