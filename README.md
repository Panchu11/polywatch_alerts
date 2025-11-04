# PolyWatch Alerts 🔔

A Telegram bot that tracks Polymarket traders and delivers real-time alerts about their trading activity.

**Bot:** [@PolyWatchAlerts_bot](https://t.me/PolyWatchAlerts_bot)  
**Channel:** [@PolyWatchAlerts](https://t.me/PolyWatchAlerts)

---

## Features

### Core Functionality
- ✅ **Watch any Polymarket trader** by profile URL or wallet address
- ✅ **Real-time trade alerts** for trades ≥ $1,000 (customizable per user)
- ✅ **Staking behavior detection** - Get notified of significant position changes
- ✅ **Wins/Losses tracking** - Summaries when traders have ≥3 wins/losses in 24h
- ✅ **Channel announcements** - High-value trades (≥$10k) posted to public channel
- ✅ **Referral system** - Invite friends and track referrals

### Bot Commands
- `/start` - Welcome message and quick actions
- `/watch <url|wallet>` - Add a trader to your watchlist
- `/unwatch <wallet>` - Remove a trader from your watchlist
- `/list` - View your current watchlist
- `/settings` - Configure your alert preferences
- `/leaderboard` - See top referrers
- `/stats` - View bot statistics

---

## Quick Start

### Prerequisites
- Node.js 20+ 
- npm or pnpm
- Telegram Bot Token (from [@BotFather](https://t.me/BotFather))

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/Panchu11/polywatch_alerts.git
cd polywatch_alerts
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment**
```bash
cp .env.example .env
# Edit .env and add your TELEGRAM_BOT_TOKEN
```

4. **Build the project**
```bash
npm run build
```

5. **Start the bot**
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

---

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TELEGRAM_BOT_TOKEN` | ✅ Yes | - | Your Telegram bot token from BotFather |
| `TELEGRAM_ANNOUNCEMENTS_CHAT_ID` | No | `@PolyWatchAlerts` | Channel for announcements |
| `MIN_TRADE_USD` | No | `1000` | Minimum trade size for DM alerts |
| `CHANNEL_ANNOUNCE_USD` | No | `10000` | Minimum trade size for channel posts |
| `STAKE_DELTA_15M_USD` | No | `2500` | Threshold for 15-min stake change alerts |
| `STAKE_CUM_30M_USD` | No | `5000` | Threshold for 30-min cumulative stake alerts |
| `TRADE_POLL_MS` | No | `15000` | Polling interval for trades (milliseconds) |
| `WINS_CHECK_MS` | No | `300000` | Polling interval for wins/losses (milliseconds) |

### Per-User Settings

Users can customize their DM alert threshold:
```
/settings min 5000    # Only alert for trades ≥ $5,000
/settings reset       # Reset to global default
```

---

## Deployment

### Recommended Free Hosting Options

#### 1. **Railway** (Recommended)
- **Free tier:** 500 hours/month, $5 credit
- **Pros:** Easy setup, auto-deploy from GitHub, persistent storage
- **Cons:** Credit runs out after ~21 days of 24/7 operation

**Deploy to Railway:**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

Add environment variables in Railway dashboard.

#### 2. **Render**
- **Free tier:** 750 hours/month, auto-sleep after 15min inactivity
- **Pros:** Generous free tier, persistent disk
- **Cons:** Cold starts (bot sleeps when inactive)

**Deploy to Render:**
1. Connect your GitHub repo
2. Select "Background Worker" service type
3. Build command: `npm install && npm run build`
4. Start command: `npm start`
5. Add environment variables

#### 3. **Fly.io**
- **Free tier:** 3 shared VMs, 3GB storage
- **Pros:** Always-on, good performance
- **Cons:** Requires credit card

**Deploy to Fly.io:**
```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Deploy
fly launch
fly secrets set TELEGRAM_BOT_TOKEN=your_token_here
fly deploy
```

---

## Production Checklist

Before deploying to production:

- [ ] Set `TELEGRAM_BOT_TOKEN` in environment variables
- [ ] Configure `TELEGRAM_ANNOUNCEMENTS_CHAT_ID` if using custom channel
- [ ] Test all commands in private chat with bot
- [ ] Verify alerts are working for a test wallet
- [ ] Set up daily backups of `data/db.json` (if using file storage)
- [ ] Monitor logs for first 24-48 hours
- [ ] Set up error alerting (optional: Sentry)

---

## Architecture

### Tech Stack
- **Runtime:** Node.js 20+ with TypeScript
- **Bot Framework:** Telegraf
- **Storage:** File-based JSON (MVP) - PostgreSQL recommended for scale
- **APIs:** Polymarket Data API

### Project Structure
```
src/
├── bot/
│   ├── commands/      # Bot command handlers
│   └── telegram.ts    # Bot setup and middleware
├── worker/
│   ├── poller.ts      # Trade polling for watched addresses
│   └── announcer.ts   # Channel announcement publisher
├── store/
│   └── filedb.ts      # File-based data persistence
├── utils/
│   ├── polymarket.ts  # Polymarket API client
│   └── tg.ts          # Telegram helpers
├── config.ts          # Configuration
└── index.ts           # Entry point
```

### Data Flow
1. User adds trader via `/watch`
2. Poller fetches new trades every 15s for watched addresses
3. New trades trigger DM alerts to subscribers
4. High-value trades (≥$10k) posted to announcements channel
5. Wins/losses checked every 5 minutes

---

## Scaling Considerations

### Current Limitations (File-based Storage)
- Single process only (no horizontal scaling)
- No concurrent writes (single-instance lock)
- Manual backups required

### Recommended Upgrades for >100 Users
1. **Migrate to PostgreSQL** - Supabase free tier (500MB)
2. **Add Redis** - Upstash free tier for job queues
3. **Implement BullMQ** - Reliable job scheduling
4. **Add monitoring** - Sentry for error tracking

---

## Troubleshooting

### Bot not responding to commands
1. Check bot is running: `ps aux | grep node`
2. Check logs for errors
3. Verify `TELEGRAM_BOT_TOKEN` is correct
4. Ensure no other instance is running (check `data/instance.lock`)

### 429 Rate Limit Errors
- Normal during high-volume periods
- Bot automatically retries with backoff
- Consider increasing `CHANNEL_ANNOUNCE_USD` to reduce announcement volume

### Duplicate alerts
- Should be prevented by deduplication
- If persisting, check `data/db.json` for corruption
- Restart bot to reload dedupe state

---

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

## License

ISC

---

## Support

- **Issues:** [GitHub Issues](https://github.com/Panchu11/polywatch_alerts/issues)
- **Telegram:** [@PolyWatchAlerts_bot](https://t.me/PolyWatchAlerts_bot)

---

## Roadmap

### Phase 1 (Current - MVP)
- ✅ Core bot commands
- ✅ Real-time trade alerts
- ✅ Channel announcements
- ✅ Referral tracking

### Phase 2 (Planned)
- [ ] PostgreSQL migration
- [ ] Daily/weekly trader summaries
- [ ] Tag filtering
- [ ] Mute functionality
- [ ] Image cards for announcements

### Phase 3 (Future)
- [ ] Web dashboard
- [ ] Advanced analytics
- [ ] Social verification
- [ ] Copy-trading (informational only)

---

**Built with ❤️ for the Polymarket community**

