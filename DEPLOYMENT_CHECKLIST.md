# 📋 Deployment Checklist

## Before Deployment
- [ ] Discord bot token obtained
- [ ] Discord OAuth credentials (client ID & secret) obtained  
- [ ] `.env.production.local` file created with all values
- [ ] JWT_SECRET is 32+ random characters
- [ ] Database path configured
- [ ] Build tested locally (`npm run build`)

## During Deployment
- [ ] Choose hosting platform (Railway/VPS/Local)
- [ ] Environment variables set on hosting platform
- [ ] Code uploaded/deployed
- [ ] Services started successfully
- [ ] No errors in logs

## After Deployment  
- [ ] Bot shows online in Discord
- [ ] Bot responds to commands
- [ ] Dashboard loads at your URL
- [ ] Discord OAuth login works
- [ ] Can select and manage servers
- [ ] All dashboard features functional
- [ ] Database operations working

## Security Check
- [ ] Remove any test/debug code
- [ ] Secure environment variables
- [ ] HTTPS enabled (if using custom domain)
- [ ] Rate limiting active
- [ ] No sensitive data in logs

## Final Steps
- [ ] Add OAuth redirect URLs in Discord
- [ ] Invite bot to your servers
- [ ] Test all major features
- [ ] Set up monitoring/alerts (optional)
- [ ] Document your deployment for team

## Support Resources
- Discord Developer Portal: https://discord.com/developers
- Railway Docs: https://docs.railway.app
- DigitalOcean Tutorials: https://www.digitalocean.com/community/tutorials
- Your deployment guide: DEPLOYMENT.md