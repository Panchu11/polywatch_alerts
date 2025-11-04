# PolyWatch Alerts - Production Deployment Guide

This guide covers deploying PolyWatch Alerts to production using free hosting platforms.

---

## 🏆 Recommended Platform: Railway (Best Free Option)

### Why Railway?
- ✅ **$5 free credit/month** (enough for 24/7 operation for ~21 days)
- ✅ **Persistent storage** included
- ✅ **Auto-deploy** from GitHub
- ✅ **No cold starts** (always running)
- ✅ **Easy setup** (5 minutes)

### Railway Deployment Steps

1. **Sign up for Railway**
   - Go to [railway.app](https://railway.app)
   - Sign up with GitHub

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose `Panchu11/polywatch_alerts`

3. **Configure Environment Variables**
   - Go to project → Variables
   - Add required variables:
     ```
     TELEGRAM_BOT_TOKEN=your_bot_token_here
     TELEGRAM_ANNOUNCEMENTS_CHAT_ID=@PolyWatchAlerts
     ```

4. **Configure Build Settings**
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
   - Root Directory: `/`

5. **Deploy**
   - Railway will automatically build and deploy
   - Check logs to verify bot started successfully

6. **Set up Persistent Storage** (Important!)
   - Go to project → Settings → Volumes
   - Add volume: `/app/data`
   - This ensures `db.json` persists across deploys

### Railway Monitoring
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# View logs
railway logs

# SSH into container
railway shell
```

---

## 🥈 Alternative: Render (Best for Intermittent Use)

### Why Render?
- ✅ **750 free hours/month** (enough for 24/7 if you have <3 services)
- ✅ **Persistent disk** included
- ✅ **Auto-sleep** after 15min inactivity (saves hours)
- ⚠️ **Cold starts** (15-30s delay when waking up)

### Render Deployment Steps

1. **Sign up for Render**
   - Go to [render.com](https://render.com)
   - Sign up with GitHub

2. **Create New Background Worker**
   - Click "New +" → "Background Worker"
   - Connect `Panchu11/polywatch_alerts` repo

3. **Configure Service**
   - Name: `polywatchalerts`
   - Region: `Oregon (US West)`
   - Branch: `main`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`

4. **Add Environment Variables**
   ```
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   TELEGRAM_ANNOUNCEMENTS_CHAT_ID=@PolyWatchAlerts
   ```

5. **Add Persistent Disk**
   - Scroll to "Disk"
   - Name: `polywatch-data`
   - Mount Path: `/app/data`
   - Size: `1 GB`

6. **Deploy**
   - Click "Create Background Worker"
   - Monitor logs for successful startup

### Render Auto-Sleep Configuration
To prevent auto-sleep (keeps bot always running):
- Upgrade to paid plan ($7/mo), OR
- Set up a cron job to ping your service every 10 minutes (not recommended for bots)

---

## 🥉 Alternative: Fly.io (Best Performance)

### Why Fly.io?
- ✅ **3 shared VMs free** (always-on)
- ✅ **3GB persistent storage** free
- ✅ **Best performance** (global edge network)
- ⚠️ **Requires credit card** (no charges on free tier)

### Fly.io Deployment Steps

1. **Install Fly CLI**
   ```bash
   # macOS/Linux
   curl -L https://fly.io/install.sh | sh

   # Windows (PowerShell)
   iwr https://fly.io/install.ps1 -useb | iex
   ```

2. **Sign up and Login**
   ```bash
   fly auth signup
   # OR
   fly auth login
   ```

3. **Launch App**
   ```bash
   cd polywatch_alerts
   fly launch
   ```
   - App name: `polywatchalerts` (or your choice)
   - Region: Choose closest to you
   - PostgreSQL: No
   - Redis: No

4. **Set Secrets**
   ```bash
   fly secrets set TELEGRAM_BOT_TOKEN=your_bot_token_here
   fly secrets set TELEGRAM_ANNOUNCEMENTS_CHAT_ID=@PolyWatchAlerts
   ```

5. **Create Persistent Volume**
   ```bash
   fly volumes create polywatch_data --size 1
   ```

6. **Deploy**
   ```bash
   fly deploy
   ```

7. **Monitor**
   ```bash
   # View logs
   fly logs

   # Check status
   fly status

   # SSH into VM
   fly ssh console
   ```

---

## 📊 Platform Comparison

| Feature | Railway | Render | Fly.io |
|---------|---------|--------|--------|
| **Free Tier** | $5 credit/mo | 750 hrs/mo | 3 VMs always-on |
| **24/7 Operation** | ~21 days | Yes (if <3 services) | Yes |
| **Cold Starts** | No | Yes (15min idle) | No |
| **Persistent Storage** | Yes | Yes (1GB) | Yes (3GB) |
| **Credit Card Required** | No | No | Yes |
| **Setup Difficulty** | Easy | Easy | Medium |
| **Best For** | Testing/MVP | Hobby projects | Production |

---

## 🔧 Post-Deployment Setup

### 1. Verify Bot is Running
```bash
# Send /start to your bot on Telegram
# You should get a welcome message
```

### 2. Test Core Functionality
```bash
# Test watching a trader
/watch 0x9e29f8f3c63401ccc6f0ec03050494756d8157c4

# Check your list
/list

# View stats
/stats
```

### 3. Monitor Logs (First 24 Hours)
Watch for:
- ✅ "Bot is running" message
- ✅ "[INCOMING]" logs for commands
- ✅ No repeated errors
- ⚠️ 429 rate limit warnings (normal, handled automatically)

### 4. Set Up Backups (Important!)

#### Railway/Render
```bash
# SSH into container
railway shell  # or render ssh

# Backup db.json
cat /app/data/db.json > backup.json
```

#### Fly.io
```bash
fly ssh console
cat /app/data/db.json
# Copy output to local file
```

**Recommended:** Set up daily automated backups using GitHub Actions or cron job.

---

## 🚨 Troubleshooting

### Bot Not Starting
1. Check environment variables are set correctly
2. View logs for error messages
3. Verify `TELEGRAM_BOT_TOKEN` is valid
4. Ensure build completed successfully

### Bot Stops After Some Time
1. **Railway:** Check free credit balance
2. **Render:** Verify service hasn't auto-slept
3. **All platforms:** Check for crash loops in logs

### Data Loss After Redeploy
1. Verify persistent volume/disk is mounted
2. Check mount path is `/app/data`
3. Restore from backup if needed

### 429 Rate Limit Errors
- Normal during high-volume periods
- Bot handles automatically with retry
- Consider increasing `CHANNEL_ANNOUNCE_USD` to reduce load

---

## 📈 Scaling Beyond Free Tier

### When to Upgrade?
- **>100 active users** - Consider paid hosting
- **>500 watched addresses** - Migrate to PostgreSQL
- **>1000 users** - Add Redis + BullMQ

### Recommended Paid Setup ($15-30/mo)
1. **Hosting:** Railway Pro ($20/mo) or Fly.io ($5-10/mo)
2. **Database:** Supabase Pro ($25/mo) - includes PostgreSQL + Storage
3. **Redis:** Upstash Pro ($10/mo)
4. **Monitoring:** Sentry (free tier sufficient)

---

## 🔐 Security Checklist

Before going live:
- [ ] `TELEGRAM_BOT_TOKEN` stored as secret (not in code)
- [ ] `.env` file in `.gitignore`
- [ ] `data/` directory in `.gitignore`
- [ ] No sensitive data in logs
- [ ] Bot token regenerated if accidentally committed
- [ ] Webhook URL (if used) uses HTTPS

---

## 📞 Support

If you encounter issues:
1. Check logs first
2. Review [GitHub Issues](https://github.com/Panchu11/polywatch_alerts/issues)
3. Create new issue with:
   - Platform used
   - Error logs
   - Steps to reproduce

---

## 🎯 Quick Deploy Commands

### Railway
```bash
npm install -g @railway/cli
railway login
railway init
railway up
railway variables set TELEGRAM_BOT_TOKEN=your_token
```

### Render
```bash
# Use web UI - no CLI needed
# https://dashboard.render.com
```

### Fly.io
```bash
fly launch
fly secrets set TELEGRAM_BOT_TOKEN=your_token
fly volumes create polywatch_data --size 1
fly deploy
```

---

**Choose Railway for easiest setup and best free tier experience!**

