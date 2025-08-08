@echo off
echo Creating deployment package...

REM Create deployment directory
mkdir deployment-package 2>nul

REM Copy necessary files
echo Copying files...
copy Dockerfile deployment-package\
copy docker-compose.prod.yml deployment-package\
copy nginx.conf deployment-package\
copy package*.json deployment-package\
copy tsconfig.json deployment-package\
copy .env.production.local deployment-package\.env.production

REM Copy source directories
xcopy /E /I src deployment-package\src
xcopy /E /I client deployment-package\client
xcopy /E /I data deployment-package\data

REM Create tar archive
echo Creating archive...
tar -czf deployment-package.tar.gz deployment-package

echo.
echo Deployment package created: deployment-package.tar.gz
echo.
echo Now upload this file to your server using:
echo scp deployment-package.tar.gz root@YOUR_SERVER_IP:/root/
pause