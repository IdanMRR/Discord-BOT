# 🚀 COMPLETE STEP-BY-STEP DEPLOYMENT GUIDE

## ✅ PART 1: TEST LOCALLY FIRST (5 minutes)

### Step 1: Open Command Prompt
1. Press `Windows + R`
2. Type `cmd` and press Enter
3. Navigate to your project:
```cmd
cd C:\Users\PC\Desktop\VSC\DiscordBotN
```

### Step 2: Build Everything
```cmd
npm run build
cd client
npm run build
cd ..
```

### Step 3: Test Local Deployment
```cmd
scripts\local-deploy.bat
```

### Step 4: Verify It Works
1. Open browser: http://localhost:3002
2. Click "Login with Discord"
3. Select your server
4. Check bot is online in Discord

If this works, proceed to deployment! If not, check the troubleshooting section.

---

## 🌐 PART 2: DEPLOY TO RAILWAY (FREE & EASIEST - 15 minutes)

### Step 1: Push Your Code to GitHub
```cmd
git add .
git commit -m "Ready for deployment"
git push origin main
```

### Step 2: Create Railway Account
1. Go to: https://railway.app
2. Click "Start a New Project"
3. Sign in with GitHub

### Step 3: Deploy Your Project
1. Click "Deploy from GitHub repo"
2. Select your repository: `Discord-BOT`
3. Railway will auto-detect your app

### Step 4: Add Environment Variables
1. Click on your deployed service
2. Go to "Variables" tab
3. Click "Raw Editor"
4. Copy and paste this (WITH YOUR ACTUAL VALUES):

```env
NODE_ENV=production
DISCORD_TOKEN=your_actual_bot_token_here
DISCORD_CLIENT_ID=your_actual_client_id_here
DISCORD_CLIENT_SECRET=your_actual_client_secret_here
DATABASE_PATH=./data/discord-bot.db
JWT_SECRET=your_32_character_secret_here
API_PORT=3001
API_HOST=0.0.0.0
DASHBOARD_PORT=3002
DASHBOARD_HOST=0.0.0.0
DASHBOARD_URL=https://your-app.up.railway.app
CORS_ORIGIN=https://your-app.up.railway.app
LOG_LEVEL=info
LOG_TO_FILE=true
API_KEY=your_api_key_here
DASHBOARD_API_KEY=your_dashboard_api_key_here
SESSION_SECRET=your_session_secret_here
CLIENT_ID=your_client_id_here
```

### Step 5: Update URLs
1. Railway gives you a URL like: `your-app.up.railway.app`
2. Update these in your variables:
   - `DASHBOARD_URL=https://your-app.up.railway.app`
   - `CORS_ORIGIN=https://your-app.up.railway.app`

### Step 6: Add Start Command
1. In Railway settings, set start command:
```
npm run start:prod
```

### Step 7: Update Discord OAuth
1. Go to: https://discord.com/developers/applications
2. Select your bot
3. OAuth2 → Redirects
4. Add: `https://your-app.up.railway.app/api/auth/callback`
5. Save changes

### Step 8: Deploy!
1. Railway will automatically deploy
2. Watch the logs for any errors
3. Once deployed, visit your URL
4. Your bot should be online!

---

## 💻 PART 3: DEPLOY TO VPS (MORE CONTROL - 30 minutes)

### Option A: DigitalOcean ($6/month)

#### Step 1: Create Droplet
1. Sign up: https://digitalocean.com
2. Create Droplet:
   - Choose: Ubuntu 22.04
   - Plan: Basic $6/month
   - Region: Choose closest to you
   - Authentication: Password (easier) or SSH key
3. Note your server IP: `YOUR_SERVER_IP`

#### Step 2: Connect to Server
Open Command Prompt:
```cmd
ssh root@YOUR_SERVER_IP
```
Enter your password when prompted.

#### Step 3: Install Required Software
Run these commands on your server:
```bash
# Update system
apt update && apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Install Git
apt install git -y

# Install PM2 (process manager)
npm install -g pm2

# Install nginx (optional, for domain)
apt install nginx -y
```

#### Step 4: Clone Your Project
```bash
# Create app directory
mkdir -p /var/www
cd /var/www

# Clone your repository
git clone https://github.com/IdanMRR/Discord-BOT.git discord-bot
cd discord-bot
```

#### Step 5: Setup Environment
```bash
# Copy production environment
cp .env.production .env

# Edit with your values
nano .env
```

Update these values:
- Keep all your Discord tokens/secrets
- Change `DASHBOARD_URL` to your server IP: `http://YOUR_SERVER_IP:3002`
- Change `CORS_ORIGIN` to: `http://YOUR_SERVER_IP:3002`

Save: `Ctrl+X`, then `Y`, then `Enter`

#### Step 6: Install and Build
```bash
# Install dependencies
npm install
cd client
npm install
npm run build
cd ..

# Build backend
npm run build
```

#### Step 7: Start with PM2
```bash
# Start the bot
pm2 start dist/index.js --name discord-bot

# Start dashboard
cd client
pm2 serve build 3002 --name dashboard
cd ..

# Save PM2 configuration
pm2 save
pm2 startup
```

#### Step 8: Setup Firewall
```bash
# Allow ports
ufw allow 22
ufw allow 3001
ufw allow 3002
ufw allow 80
ufw allow 443
ufw enable
```

#### Step 9: Access Your Bot
1. Open: `http://YOUR_SERVER_IP:3002`
2. Login with Discord
3. Your bot should be online!

---

## 🎯 PART 4: FINAL SETUP

### Update Discord Settings
1. Go to: https://discord.com/developers/applications
2. OAuth2 → Redirects
3. Add your production URL:
   - Railway: `https://your-app.up.railway.app/api/auth/callback`
   - VPS: `http://YOUR_SERVER_IP:3001/api/auth/callback`
   - Or with domain: `https://yourdomain.com/api/auth/callback`

### Invite Bot to Server
1. OAuth2 → URL Generator
2. Select scopes: `bot`, `applications.commands`
3. Select permissions your bot needs
4. Copy URL and open in browser
5. Select server and authorize

---

## 🔧 TROUBLESHOOTING

### Bot is Offline
```cmd
# Check logs locally
npm run dev

# Check logs on Railway
Railway dashboard → Logs

# Check logs on VPS
pm2 logs discord-bot
```

### Can't Login to Dashboard
1. Verify OAuth redirect URLs
2. Check CLIENT_ID and CLIENT_SECRET
3. Ensure CORS_ORIGIN matches your URL

### Database Errors
```bash
# Create data directory
mkdir -p data
chmod 755 data
```

### Port Already in Use
```cmd
# Windows - kill process on port 3001
netstat -ano | findstr :3001
taskkill /PID <PID_NUMBER> /F

# Linux
lsof -i :3001
kill -9 <PID>
```

---

## 📱 QUICK COMMANDS REFERENCE

### Local Testing
```cmd
scripts\local-deploy.bat
```

### Railway Deployment
- Push to GitHub → Auto deploys

### VPS Management
```bash
# View logs
pm2 logs

# Restart bot
pm2 restart discord-bot

# Stop all
pm2 stop all

# Update code
git pull
npm install
npm run build
pm2 restart all
```

---

## ✅ DEPLOYMENT CHECKLIST

Before deployment:
- [ ] `.env.production` has all your tokens
- [ ] Built successfully locally
- [ ] Bot works in test server

During deployment:
- [ ] Environment variables set
- [ ] OAuth redirects updated
- [ ] Ports are accessible

After deployment:
- [ ] Bot shows online
- [ ] Can login to dashboard
- [ ] Commands work
- [ ] Dashboard features work

---

## 🆘 NEED HELP?

1. **Check logs first** - They usually show the problem
2. **Verify tokens** - Make sure Discord tokens are correct
3. **Check ports** - Ensure 3001 and 3002 are accessible
4. **OAuth URLs** - Must match exactly in Discord settings

### Common Issues & Fixes:

**"Invalid token"**
→ Your bot token expired. Get new one from Discord Developer Portal

**"Cannot connect to database"**
→ Create data folder: `mkdir data`

**"Port already in use"**
→ Change ports in .env or kill existing process

**"CORS error"**
→ CORS_ORIGIN in .env must match your dashboard URL exactly

---

## 🎉 SUCCESS INDICATORS

You know it's working when:
✅ Bot shows "Online" in Discord
✅ Dashboard loads at your URL
✅ Can login with Discord
✅ Can see and manage servers
✅ Bot responds to commands

---

## 📞 SUPPORT RESOURCES

- Discord.js Guide: https://discordjs.guide
- Railway Docs: https://docs.railway.app
- DigitalOcean Tutorials: https://digitalocean.com/community/tutorials
- PM2 Docs: https://pm2.keymetrics.io

---

Remember: Start with local testing, then deploy to Railway (easiest), or VPS if you need more control!