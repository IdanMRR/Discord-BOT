@echo off
echo ====================================
echo DEPLOYMENT WITHOUT DOCKER
echo ====================================
echo.

REM Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed!
    echo Please install from https://nodejs.org
    pause
    exit /b 1
)

echo Step 1: Installing dependencies...
call npm install
if errorlevel 1 (
    echo ERROR: Failed to install backend dependencies
    pause
    exit /b 1
)

cd client
call npm install
if errorlevel 1 (
    echo ERROR: Failed to install frontend dependencies
    pause
    exit /b 1
)
cd ..

echo.
echo Step 2: Building production files...
call npm run build
if errorlevel 1 (
    echo ERROR: Failed to build backend
    pause
    exit /b 1
)

cd client
call npm run build
if errorlevel 1 (
    echo ERROR: Failed to build frontend
    pause
    exit /b 1
)
cd ..

echo.
echo Step 3: Setting up environment...
if not exist ".env" (
    if exist ".env.production" (
        copy .env.production .env
        echo Using .env.production for configuration
    ) else if exist ".env.production.local" (
        copy .env.production.local .env
        echo Using .env.production.local for configuration
    ) else (
        echo ERROR: No environment file found!
        echo Please create .env.production or .env.production.local
        pause
        exit /b 1
    )
)

echo.
echo ====================================
echo BUILD COMPLETE!
echo ====================================
echo.
echo To run your bot:
echo   npm start
echo.
echo To run with PM2 (recommended):
echo   npm install -g pm2
echo   pm2 start dist/index.js --name discord-bot
echo   pm2 start client/build --name dashboard
echo.
pause