# ⚡ Quick Start - Deploy in 5 Minutes

**Your bot is ready! Here's the fastest path to production.**

---

## ✅ What's Already Done

- ✅ Code pushed to GitHub: `https://github.com/Panchu11/polywatch_alerts`
- ✅ Production build tested and working
- ✅ All features implemented and tested
- ✅ Documentation complete

---

## 🚀 Deploy to Railway NOW

### 1. Sign Up (30 seconds)
- Go to: **https://railway.app**
- Click **"Login with GitHub"**
- Authorize Railway

### 2. Create Project (1 minute)
- Click **"New Project"**
- Select **"Deploy from GitHub repo"**
- Choose: **`Panchu11/polywatch_alerts`**
- Railway will start building (it will fail - that's OK!)

### 3. Add Environment Variables (1 minute)
Click on your service → **"Variables"** tab → Add these:

```
TELEGRAM_BOT_TOKEN=8573756899:AAGOeu6TWWrIj8zNvvnaZZqTtBwwou7wmtw
TELEGRAM_ANNOUNCEMENTS_CHAT_ID=@PolyWatchAlerts
CHANNEL_ANNOUNCE_USD=25000
```

### 4. Add Persistent Storage (30 seconds)
- Go to **"Settings"** tab
- Scroll to **"Volumes"**
- Click **"New Volume"**
- Mount Path: **`/app/data`**
- Click **"Add"**

### 5. Deploy! (2 minutes)
- Go to **"Deployments"** tab
- Click **"Deploy"**
- Wait for logs to show: **"PolyWatch Alerts bot is running."**

### 6. Test (30 seconds)
Open Telegram and send to `@PolyWatchAlerts_bot`:
```
/start
```

---

## 🎉 Done!

Your bot is now:
- Running 24/7 on Railway
- Auto-deploying from GitHub
- Ready for users!

**Share your bot:** `https://t.me/PolyWatchAlerts_bot`

---

## 📚 Full Guides

- **Detailed Railway Guide:** See `RAILWAY_DEPLOYMENT_GUIDE.md`
- **Other Hosting Options:** See `DEPLOYMENT.md`
- **Features & Commands:** See `README.md`

---

## 🔧 Quick Commands Reference

| Command | Description |
|---------|-------------|
| `/start` | Welcome message & menu |
| `/watch <address>` | Watch a trader |
| `/unwatch <address>` | Stop watching |
| `/list` | Your watchlist |
| `/settings` | View/change settings |
| `/stats` | Bot statistics |
| `/leaderboard` | Top referrers |

---

## 💡 Tips

1. **Monitor logs** for first 24 hours
2. **Share referral link:** `https://t.me/PolyWatchAlerts_bot?start=YOUR_TELEGRAM_ID`
3. **Adjust threshold** via `CHANNEL_ANNOUNCE_USD` env var if too many/few announcements
4. **Backup data** regularly (download `data/db.json` from Railway volume)

---

**Need help?** Check `RAILWAY_DEPLOYMENT_GUIDE.md` for detailed instructions!

