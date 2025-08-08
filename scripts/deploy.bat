@echo off
REM Production Deployment Script for Discord Bot & Dashboard (Windows)
setlocal enabledelayedexpansion

echo 🚀 Starting production deployment...

REM Configuration
set DOMAIN=your-domain.com

REM Check if .env.production exists
if not exist ".env.production" (
    echo [ERROR] .env.production file not found!
    echo [WARNING] Please create .env.production with your production configuration
    pause
    exit /b 1
)

REM Check if Docker is available
docker --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not installed or not in PATH
    pause
    exit /b 1
)

docker-compose --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker Compose is not installed or not in PATH
    pause
    exit /b 1
)

echo [INFO] Building production images...

REM Stop existing containers
echo [INFO] Stopping existing containers...
docker-compose -f docker-compose.prod.yml down

REM Build new images
echo [INFO] Building Docker images...
docker-compose -f docker-compose.prod.yml build --no-cache

echo [INFO] Starting services...
docker-compose -f docker-compose.prod.yml up -d

REM Wait for services to be healthy
echo [INFO] Waiting for services to be healthy...
timeout /t 30 >nul

REM Display running services
echo [INFO] Current service status:
docker-compose -f docker-compose.prod.yml ps

echo [SUCCESS] Deployment completed successfully!
echo [INFO] Dashboard: https://%DOMAIN%
echo [INFO] API: https://%DOMAIN%/api

echo.
echo [INFO] To monitor logs, run:
echo docker-compose -f docker-compose.prod.yml logs -f

echo [INFO] To stop services, run:
echo docker-compose -f docker-compose.prod.yml down

pause