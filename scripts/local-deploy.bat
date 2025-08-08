@echo off
echo Starting local production deployment...
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

REM Check if .env.production.local exists
if not exist ".env.production.local" (
    echo ERROR: .env.production.local not found!
    echo Please create it first with your bot credentials
    pause
    exit /b 1
)

echo Building bot...
call npm run build

echo Building dashboard...
cd client
call npm run build
cd ..

echo.
echo Starting services...
echo.

REM Start bot and API
start "Discord Bot" cmd /k "node dist/index.js"

REM Wait a moment for API to start
timeout /t 5 >nul

REM Start dashboard
cd client
start "Dashboard" cmd /k "npx serve -s build -l 3002"
cd ..

echo.
echo ===================================
echo DEPLOYMENT SUCCESSFUL!
echo ===================================
echo.
echo Bot and API running on: http://localhost:3001
echo Dashboard running on: http://localhost:3002
echo.
echo To stop, close the command windows that opened
echo.
pause