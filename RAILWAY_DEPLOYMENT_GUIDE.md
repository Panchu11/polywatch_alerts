# 🚂 Railway Deployment Guide - PolyWatch Alerts

**Complete step-by-step guide to deploy your bot to Railway in 5 minutes.**

---

## 📋 Prerequisites

You already have:
- ✅ GitHub repository: `https://github.com/Panchu11/polywatch_alerts`
- ✅ Telegram Bot Token: `8573756899:AAGOeu6TWWrIj8zNvvnaZZqTtBwwou7wmtw`
- ✅ Bot Username: `@PolyWatchAlerts_bot`
- ✅ Announcements Channel: `@PolyWatchAlerts`
- ✅ Code pushed to GitHub ✅

---

## 🚀 Step-by-Step Deployment

### Step 1: Sign Up for Railway

1. **Go to Railway:**
   - Open: [https://railway.app](https://railway.app)

2. **Sign Up with GitHub:**
   - Click "Login" in top right
   - Click "Login with GitHub"
   - Authorize Railway to access your GitHub account
   - ✅ You're now logged in!

---

### Step 2: Create New Project

1. **Click "New Project"** (big purple button in the center or top right)

2. **Select "Deploy from GitHub repo"**

3. **Configure GitHub App:**
   - If this is your first time, Railway will ask to install the GitHub App
   - Click "Configure GitHub App"
   - Select "Only select repositories"
   - Choose: `Panchu11/polywatch_alerts`
   - Click "Install & Authorize"

4. **Select Repository:**
   - You'll see `Panchu11/polywatch_alerts` in the list
   - Click on it

5. **Railway will start deploying automatically**
   - You'll see a new project created
   - It will start building immediately
   - ⚠️ **It will FAIL** because we haven't set environment variables yet - this is normal!

---

### Step 3: Configure Environment Variables

1. **Click on your service** (should be called "polywatchalerts" or similar)

2. **Go to "Variables" tab** (in the left sidebar)

3. **Click "New Variable"** and add these **ONE BY ONE**:

   **Variable 1:**
   ```
   Name: TELEGRAM_BOT_TOKEN
   Value: 8573756899:AAGOeu6TWWrIj8zNvvnaZZqTtBwwou7wmtw
   ```

   **Variable 2:**
   ```
   Name: TELEGRAM_ANNOUNCEMENTS_CHAT_ID
   Value: @PolyWatchAlerts
   ```

   **Variable 3 (Optional - for custom threshold):**
   ```
   Name: CHANNEL_ANNOUNCE_USD
   Value: 25000
   ```

4. **Click "Add" after each variable**

---

### Step 4: Add Persistent Storage

This is **CRITICAL** - without this, your watchlist will be lost on every deploy!

1. **Click on "Settings" tab** (in the left sidebar)

2. **Scroll down to "Volumes"**

3. **Click "New Volume"**

4. **Configure Volume:**
   ```
   Mount Path: /app/data
   ```

5. **Click "Add"**

---

### Step 5: Configure Build & Start Commands

Railway should auto-detect these, but let's verify:

1. **Go to "Settings" tab**

2. **Scroll to "Build"**
   - Build Command: `npm install && npm run build`
   - If empty, add it manually

3. **Scroll to "Deploy"**
   - Start Command: `npm start`
   - If empty, add it manually

4. **Root Directory:** Leave as `/` (default)

---

### Step 6: Deploy!

1. **Go back to "Deployments" tab**

2. **Click "Deploy"** (or it may auto-deploy after you added variables)

3. **Watch the logs:**
   - You'll see build output
   - Wait for: `Starting PolyWatch Alerts bot...`
   - Then: `Token OK. Bot identity: @PolyWatchAlerts_bot`
   - Finally: `PolyWatch Alerts bot is running.`

4. **✅ If you see these messages, your bot is LIVE!**

---

### Step 7: Test Your Bot

1. **Open Telegram**

2. **Search for:** `@PolyWatchAlerts_bot`

3. **Send:** `/start`
   - You should get a welcome message with buttons

4. **Test watching a trader:**
   ```
   /watch 0x9e29f8f3c63401ccc6f0ec03050494756d8157c4
   ```

5. **Check your list:**
   ```
   /list
   ```

6. **Test other commands:**
   ```
   /settings
   /stats
   /leaderboard
   ```

---

## 📊 Monitoring Your Bot

### View Logs

1. **Go to your Railway project**
2. **Click on your service**
3. **Click "Deployments" tab**
4. **Click on the latest deployment**
5. **You'll see live logs**

**What to look for:**
- ✅ `Bot is running` - Good!
- ✅ `[INCOMING] from=...` - Commands being received
- ⚠️ `429 from Telegram` - Rate limiting (normal, handled automatically)
- ❌ `Error:` - Something wrong (check the error message)

### Check Resource Usage

1. **Go to "Metrics" tab**
2. **You'll see:**
   - CPU usage
   - Memory usage
   - Network traffic

**Expected usage:**
- CPU: 5-15% (spikes during polling)
- Memory: 50-100 MB
- Network: Minimal

---

## 💰 Free Tier Limits

Railway gives you:
- **$5 free credit per month**
- **500 hours of usage** (enough for ~21 days of 24/7 operation)

**Your bot will use approximately:**
- ~$0.20-0.30 per day
- ~$6-9 per month

**To stay within free tier:**
- Monitor your usage in Railway dashboard
- Consider upgrading to Hobby plan ($5/mo) for unlimited usage

---

## 🔧 Common Issues & Solutions

### Issue 1: Bot Not Starting

**Symptoms:** Deployment succeeds but bot doesn't respond

**Solution:**
1. Check logs for errors
2. Verify `TELEGRAM_BOT_TOKEN` is correct
3. Make sure volume is mounted at `/app/data`
4. Restart deployment

### Issue 2: "Instance already running" Error

**Symptoms:** Log shows "Another instance is already running"

**Solution:**
1. Go to "Settings" → "Volumes"
2. Click on your volume
3. Delete the `instance.lock` file
4. Redeploy

### Issue 3: Watchlist Lost After Redeploy

**Symptoms:** Users' watchlists disappear after deployment

**Solution:**
1. **You forgot to add the volume!**
2. Go to "Settings" → "Volumes"
3. Add volume with mount path: `/app/data`
4. Redeploy

### Issue 4: 429 Rate Limit Spam in Logs

**Symptoms:** Logs filled with "429 from Telegram"

**Solution:**
1. This is normal during high-volume periods
2. Bot handles it automatically with retry
3. To reduce frequency, increase `CHANNEL_ANNOUNCE_USD` to 50000 or higher

### Issue 5: Out of Free Credits

**Symptoms:** Bot stops working mid-month

**Solution:**
1. Upgrade to Railway Hobby plan ($5/mo)
2. Or migrate to Render (750 free hours/mo)

---

## 🔄 Updating Your Bot

When you make code changes:

1. **Commit and push to GitHub:**
   ```bash
   git add .
   git commit -m "Your update message"
   git push origin main
   ```

2. **Railway auto-deploys:**
   - Railway watches your GitHub repo
   - It will automatically build and deploy
   - Check "Deployments" tab to see progress

3. **Manual deploy (if needed):**
   - Go to "Deployments" tab
   - Click "Deploy" button

---

## 📱 Your Bot Details

**For reference:**

- **Bot Username:** `@PolyWatchAlerts_bot`
- **Bot Token:** `8573756899:AAGOeu6TWWrIj8zNvvnaZZqTtBwwou7wmtw`
- **Channel:** `@PolyWatchAlerts`
- **GitHub Repo:** `https://github.com/Panchu11/polywatch_alerts`
- **Railway Project:** (You'll get this after creating the project)

---

## 🎯 Post-Deployment Checklist

After successful deployment:

- [ ] Bot responds to `/start`
- [ ] `/watch` command works
- [ ] `/list` shows watched addresses
- [ ] `/settings` displays configuration
- [ ] `/stats` shows bot statistics
- [ ] `/leaderboard` shows referrals
- [ ] Channel announcements working (check @PolyWatchAlerts)
- [ ] Logs show no errors
- [ ] Volume is mounted (check Settings → Volumes)
- [ ] Auto-deploy is enabled (check Settings → GitHub)

---

## 🚨 Emergency: Stop the Bot

If something goes wrong and you need to stop the bot immediately:

1. **Go to Railway dashboard**
2. **Click on your service**
3. **Click "Settings" tab**
4. **Scroll to bottom**
5. **Click "Remove Service"** (or just pause deployments)

---

## 📈 Scaling Beyond Free Tier

### When to Upgrade?

Upgrade to Railway Hobby ($5/mo) when:
- You exceed $5 free credit
- You have >50 active users
- You want guaranteed uptime

### Alternative: Migrate to Render

If you want to stay free:
1. Render offers 750 hours/month (enough for 24/7)
2. Follow the guide in `DEPLOYMENT.md`
3. Export your `data/db.json` from Railway volume
4. Import to Render persistent disk

---

## 🎉 You're Done!

Your bot is now:
- ✅ Running 24/7 on Railway
- ✅ Auto-deploying from GitHub
- ✅ Storing data persistently
- ✅ Handling rate limits automatically
- ✅ Ready for users!

**Next steps:**
1. Announce your bot in @PolyWatchAlerts channel
2. Share the bot link: `https://t.me/PolyWatchAlerts_bot`
3. Monitor logs for first 24 hours
4. Gather user feedback
5. Iterate and improve!

---

## 📞 Need Help?

If you encounter issues:
1. Check Railway logs first
2. Review this guide
3. Check `DEPLOYMENT.md` for troubleshooting
4. Create GitHub issue with logs

---

**🚀 Happy deploying!**

