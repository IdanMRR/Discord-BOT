# Production Deployment Guide

This guide will help you deploy your Discord bot and dashboard to production.

## 🚀 Quick Start

### 1. Environment Configuration

1. Copy `.env.production` template:
   ```bash
   cp .env.production .env.production.local
   ```

2. Edit `.env.production.local` with your actual values:
   ```env
   DISCORD_TOKEN=your_actual_bot_token
   DISCORD_CLIENT_ID=your_actual_client_id
   DISCORD_CLIENT_SECRET=your_actual_client_secret
   JWT_SECRET=your_super_secure_32_character_secret
   DASHBOARD_URL=https://your-domain.com
   CORS_ORIGIN=https://your-domain.com
   ```

### 2. Domain and SSL Setup

1. Update `nginx.conf` with your domain:
   ```nginx
   server_name your-domain.com;
   ```

2. Place your SSL certificates in the `ssl/` directory:
   - `ssl/cert.pem` - Your SSL certificate
   - `ssl/key.pem` - Your private key

### 3. Deploy

#### Option A: Docker Compose (Recommended)
```bash
# Build and start services
./scripts/deploy.sh

# Or on Windows
scripts\deploy.bat
```

#### Option B: Manual Docker Build
```bash
# Build the image
docker build -t discord-bot .

# Run with environment file
docker run -d --name discord-bot-prod --env-file .env.production.local -p 3001:3001 -p 3002:3002 discord-bot
```

#### Option C: Direct Node.js
```bash
# Build the application
npm run prod:full

# Start in production mode
npm run start:prod
```

## 🔧 Configuration Details

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NODE_ENV` | Set to `production` | ✅ |
| `DISCORD_TOKEN` | Your bot token | ✅ |
| `DISCORD_CLIENT_ID` | Discord app client ID | ✅ |
| `DISCORD_CLIENT_SECRET` | Discord app secret | ✅ |
| `JWT_SECRET` | 32+ character secret for auth | ✅ |
| `DATABASE_PATH` | SQLite database path | ✅ |
| `API_PORT` | API server port | ✅ |
| `DASHBOARD_PORT` | Dashboard port | ✅ |
| `DASHBOARD_URL` | Public dashboard URL | ✅ |
| `CORS_ORIGIN` | Allowed CORS origin | ✅ |
| `LOG_LEVEL` | Logging level (warn/error) | ❌ |

### Production Features

- ✅ Debug console logs removed
- ✅ Test commands excluded in production
- ✅ Optimized Docker builds
- ✅ Security headers configured
- ✅ Rate limiting enabled
- ✅ Health checks implemented
- ✅ Redis caching
- ✅ Nginx reverse proxy

## 🌐 Domain Deployment Options

### VPS/Cloud Server
1. **DigitalOcean Droplet** ($5-20/month)
2. **AWS EC2** (Variable pricing)
3. **Linode** ($5-15/month)
4. **Vultr** ($2.50-10/month)

### Serverless Options
1. **Railway** (Free tier available)
2. **Render** (Free tier available)
3. **Heroku** (Paid plans)

### Container Platforms
1. **Google Cloud Run**
2. **AWS Fargate**
3. **Azure Container Instances**

## 📊 Monitoring & Maintenance

### Health Checks
- API: `https://your-domain.com/api/health`
- Dashboard: `https://your-domain.com/health`

### Log Monitoring
```bash
# Docker logs
docker-compose -f docker-compose.prod.yml logs -f

# File logs (if LOG_TO_FILE=true)
tail -f logs/production.log
```

### Database Backups
```bash
# Manual backup
mkdir -p backups
cp data/discord-bot.db backups/discord-bot-$(date +%Y%m%d-%H%M%S).db

# Automated backups (set BACKUP_ENABLED=true)
```

## 🔒 Security Considerations

### Required Security Measures
- ✅ Use strong JWT secrets (32+ characters)
- ✅ Enable HTTPS with valid SSL certificates
- ✅ Set proper CORS origins
- ✅ Use environment variables for secrets
- ✅ Regular security updates

### Optional Security Enhancements
- Fail2ban for intrusion prevention
- CloudFlare DDoS protection
- Database encryption
- Access logging and monitoring

## 🚨 Troubleshooting

### Common Issues

1. **Container won't start**
   ```bash
   docker-compose -f docker-compose.prod.yml logs discord-bot
   ```

2. **Database permissions**
   ```bash
   chmod 755 data/
   chown -R 1001:1001 data/
   ```

3. **SSL certificate issues**
   - Verify certificate files exist in `ssl/` directory
   - Check certificate validity: `openssl x509 -in ssl/cert.pem -text -noout`

4. **Discord bot offline**
   - Check bot token validity
   - Verify bot permissions in Discord
   - Check bot status in Discord Developer Portal

### Log Locations
- Application logs: `/app/logs/` (in container)
- Docker logs: `docker-compose logs`
- Nginx logs: `/var/log/nginx/` (in nginx container)

## 📱 Beta Testing Setup

### 1. Private Beta
1. Set up on a subdomain: `beta.your-domain.com`
2. Use Discord guild permissions to limit access
3. Enable additional logging: `LOG_LEVEL=info`

### 2. Monitoring Setup
- Set up uptime monitoring (UptimeRobot, Pingdom)
- Configure error reporting (Sentry, LogRocket)
- Monitor resource usage (Docker stats)

### 3. Testing Checklist
- [ ] Bot responds to commands
- [ ] Dashboard loads correctly
- [ ] User authentication works
- [ ] Database operations function
- [ ] WebSocket connections stable
- [ ] All moderation features work
- [ ] Logging system captures events
- [ ] SSL certificates valid

## 🔄 Updates & Maintenance

### Updating the Application
```bash
# Pull latest changes
git pull origin main

# Rebuild and redeploy
./scripts/deploy.sh
```

### Database Migrations
Database migrations run automatically on startup in production mode.

### Scaling Considerations
- Monitor CPU/Memory usage
- Consider Redis for session storage
- Implement database connection pooling
- Use CDN for static assets

---

Need help? Check the [troubleshooting guide](TROUBLESHOOTING.md) or create an issue.