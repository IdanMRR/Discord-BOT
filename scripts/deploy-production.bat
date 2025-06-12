@echo off
REM Production Deployment Script for Discord Bot Dashboard (Windows)
REM Usage: scripts\deploy-production.bat yourdomain.com

set DOMAIN=%1

if "%DOMAIN%"=="" (
    echo Usage: scripts\deploy-production.bat yourdomain.com
    exit /b 1
)

echo 🚀 Starting production deployment for domain: %DOMAIN%

REM Step 1: Create production environment file
echo 📝 Creating production environment configuration...
(
echo # Discord Bot Configuration
echo DISCORD_TOKEN=your_bot_token_here
echo CLIENT_ID=1368637479653216297
echo DISCORD_CLIENT_SECRET=your_client_secret_here
echo.
echo # Production Configuration
echo NODE_ENV=production
echo PRODUCTION_DOMAIN=https://%DOMAIN%
echo API_PORT=3001
echo.
echo # Security ^(you'll need to generate strong keys^)
echo API_KEY=generate_strong_random_key_here
echo DASHBOARD_API_KEY=generate_strong_random_key_here
echo JWT_SECRET=generate_strong_jwt_secret_here
echo.
echo # Optional services
echo OPENAI_API_KEY=
echo WEATHER_API_KEY=
) > .env.production

echo ✅ Production environment file created

REM Step 2: Install production dependencies
echo 📦 Installing production dependencies...
call npm ci --only=production

REM Step 3: Build client application
echo 🏗️  Building client application...
cd client
call npm ci --only=production
call npm run build
cd ..

REM Step 4: Build server application
echo 🏗️  Building server application...
call npm run build

echo 🔐 Production environment configured
echo 📋 Production checklist:
echo    1. Update Discord OAuth redirect URI to: https://%DOMAIN%/login
echo    2. Set your DISCORD_CLIENT_SECRET in .env.production
echo    3. Set your DISCORD_TOKEN in .env.production
echo    4. Generate strong API keys and JWT secret
echo    5. Configure SSL certificate for %DOMAIN%
echo    6. Deploy to your server
echo.
echo 🌐 Your dashboard will be available at: https://%DOMAIN%
echo 📝 Check the PRODUCTION_SETUP.md file for detailed instructions

echo ✅ Production deployment preparation complete! 