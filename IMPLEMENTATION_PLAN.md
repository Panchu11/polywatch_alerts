# PolyWatch Alerts — Implementation Plan

Last updated: 2025-11-04
Scope: Pre-build plan with tasks, specs, and acceptance criteria. This complements Project Overview.

## 1) Timeline and phases
- Phase 0 (2–3 days): Design + infra
  - Finalize business rules (defaults set in overview). Provision DB, Redis, hosting, Sentry. Bootstrap repo, CI, secrets layout.
- Phase 1 (5–7 days): MVP alerts
  - Telegram flows, watch/unwatch; per-trader polling worker; market metadata cache; daily/weekly summaries.
- Phase 2 (4–6 days): Image cards + Publisher
  - Image service; announcement ranking; channel posting; hourly/daily digests.
- Phase 3 (2–4 days): Referrals + socials verification
  - Deep-link referrals; points; admin review for social mappings; basic leaderboard.
- Phase 4 (optional, 1–2+ weeks): Copy-trading autopilot
  - Secure storage, risk controls, execution engine, compliance gating.

## 2) Deliverables and acceptance criteria
- D1: Telegram Bot MVP
  - Commands: /start (with referral), /watch, /unwatch, /list, /settings, /help.
  - Users can add a Polymarket profile link or wallet; see confirmations; receive alerts for new trades meeting thresholds (> $1,000).
  - Alert latency p50 < 30s (under nominal rate limits). Zero crashes on empty/invalid inputs.
- D2: Alert Engine
  - Polls /activity and /trades incrementally per watched trader; dedupes by txHash; computes position deltas per market; respects rate limits with backoff.
  - Per-trader cursor persisted; priority scheduling by number of subscribers; retries with jitter; idempotent fan-out.
- D3: Market Cache
  - Periodic refresh from Gamma /events; maps conditionId→{slug,title,icon,eventSlug,tags}. Cache TTL 15 min with stagger.
- D4: Summaries
  - Daily and weekly summaries with key stats per watched trader.
- D5: Image Service + Publisher
  - Renders branded PNGs under 300KB; 1200×628 and 1080×1350 variants. Posts to @PolyWatchAlerts with text + image.
- D6: Referrals + Socials
  - Referral tracking via deep-link; award points on first alert creation. Social mapping flow with admin approval required for public tagging.

## 3) System architecture (detailed)
- Packages/services (monorepo or multi-repo)
  - bot/ (Telegraf, presentation + chat flows)
  - api/ (REST for admin, webhooks, health)
  - worker/ (Alert Engine schedulers + jobs)
  - image/ (Renderer; Satori/Resvg or puppeteer-based)
  - shared/ (types, DTOs, schema, logging)
- Data flows
  - Watchlists collapsed to distinct proxy wallets → per-trader polling jobs.
  - Each polling cycle fetches from Data API using since_ts/last_tx; compares to last_seen; computes new events; enriches with market_cache; publishes alerts to bot.
  - Publisher consumes a stream of notable events scored by ranker.

## 4) Algorithms and polling strategy
- Per-trader cadence tiers (adaptive):
  - Tier A (≥ 50 subscribers): target 5–10s
  - Tier B (10–49): 10–20s
  - Tier C (1–9): 20–45s
  - Tier D (no recent activity): 60–120s, decay up to 10 min during long inactivity
- Incremental fetch
  - Maintain cursor {last_ts, last_tx_hash} per trader. Query with start=last_ts-5s guard window.
  - Prefer /activity for breadth, supplement with /trades for missing granularity if needed.
- Dedup/idempotency
  - Idempotency key: sha1("user|txHash|conditionId|side|size|price|ts"). Store in Redis for 24h.
- Stake-change detection (defaults)
  - For each conditionId, track position size (units and notional = size*price approximations). Trigger alert when |Δnotional| ≥ max($2,500, 20% of current position) within 15 min; or cumulative same-side buys/sells ≥ $5,000 in 30 min.
- Notable trade scoring
  - Score = w1*log1p(notional) + w2*market_trend + w3*user_popularity − cooldown_penalty.
  - Thresholds: immediate if trade ≥ $5k or score ≥ S_crit. Otherwise candidate for hourly digest.

## 5) Polymarket API usage
- Data API
  - /activity?user=<proxy>&limit=50&start=<unix> to fetch new events since cursor.
  - /trades?user=<proxy>&limit=50 for trade details/txHash if needed.
  - /positions?user=<proxy> for computing current stake and PnL snapshots.
  - /closed-positions?user=<proxy> for realized PnL and win/loss counting.
- Gamma API
  - /events?closed=false&limit=100&order=id&ascending=false for discovery and cache refresh.
  - /markets?tag_id=..., /tags, /sports when tag-specific filtering is requested.
- Rate limit handling
  - Token bucket in Redis, per-endpoint leaky bucket, exponential backoff (max 60s), randomized jitter, circuit-breakers on repeated 429s.

## 6) Telegram bot UX
- Commands
  - /start [ref]: greet, explain, and store referral if present. Offer quick actions: Watch Trader, Browse Examples, Settings.
  - /watch: prompt for Polymarket profile URL or 0x wallet; validate; preview profile; set thresholds (min size default $1,000).
  - /unwatch: list current watches with inline Remove buttons.
  - /list: show watched traders and per-trader settings.
  - /settings: global settings (min trade size, mute schedule, tag filters, summaries on/off).
  - /help: FAQ, safety, links.
- Inline keyboards on alerts: Copy Trade (opens market), Mute 1h, Tune Filter, Unwatch.
- Content formatting: concise title, amount, outcome, price, enriched with icon and market link.

## 7) Message templates (examples)
- Alert text
  - "Trader {name} bought ${notional} {outcome} @ {price} in {market}." + buttons.
- Stake-change
  - "Stake change: {name} +${delta} ({pct}%) in {market}." or "−${delta} ...".
- Milestones
  - "Milestone: {name} reached {wins} wins ({winrate}%)."
- Publisher
  - "🔥 Notable trade: {name} +${notional} in {market}. {cta}"

## 8) Trade image cards
- Renderer options
  - Option A: Satori + Resvg (fast, no headless browser). Good for static charts/heatmaps.
  - Option B: Puppeteer (Chromium) to render HTML/CSS with Chart.js for complex visuals.
- Templates (v1)
  - T1 Trade Card: trader avatar, market title, side/price/size, max return %, QR/deep link.
  - T2 Profile Summary: 24h/7d PnL spark/heatmap, win-rate, avg bet size, distribution.
  - T3 Daily Recap: Top 3 traders/markets.
- Performance
  - Cache brand assets in-memory; render under 250ms typical; store and reuse.

## 9) Data model (schema)
- users(id PK, telegram_id UNIQUE, referral_code, referrer_id, settings JSONB, created_at)
- watchlists(id PK, user_id FK, proxy_wallet, thresholds JSONB, filters JSONB, created_at)
- trader_profiles(proxy_wallet PK, name, pseudonym, bio, avatar_url, last_seen_ts)
- trader_socials(id PK, proxy_wallet FK, platform, handle, source, verified BOOL, updated_at)
- trades(id PK, proxy_wallet, condition_id, side, size, price, timestamp, tx_hash UNIQUE, outcome_index, market_slug)
- positions_snapshots(id PK, proxy_wallet, condition_id, size, avg_price, pnl, snapshot_ts)
- market_cache(condition_id PK, slug, title, icon, event_slug, tags JSONB, updated_at)
- alerts_log(id PK, user_id FK, proxy_wallet, type, payload_json JSONB, sent_at)
- referrals(id PK, referrer_id FK, referee_id FK, milestone, points_awarded_at)
- indexes: users(telegram_id), watchlists(user_id, proxy_wallet), trades(proxy_wallet, timestamp DESC), market_cache(slug)

## 10) Internal APIs and jobs
- REST (api/)
  - GET /health, GET /metrics
  - POST /admin/socials/suggest, POST /admin/socials/verify
  - GET /admin/traders/:wallet (profile snapshot)
- Jobs (worker/)
  - schedule:poll-traders (creates per-trader polling jobs by tier)
  - job:poll-trader:{wallet}
  - job:enrich-market:{conditionId}
  - job:publisher:candidate, job:publisher:post
  - job:image:render

## 11) Observability and reliability
- Logging: Pino JSON, request/response codes, latency, sampling 1–5% for verbose entries.
- Metrics: alert latency histograms, API error rates, queue depths, render times.
- Alerts: on 429 spikes, alert p95 > 60s, publisher failures, render errors.
- Circuit breakers: disable non-essential features if rate limits hit; degrade to text-only posts if image service degraded.

## 12) Security and secrets
- Do not store secrets in repo. Required env vars (examples):
  - TELEGRAM_BOT_TOKEN, TELEGRAM_ANNOUNCEMENTS_CHAT_ID
  - DATABASE_URL (Postgres), REDIS_URL
  - SENTRY_DSN, STORAGE_BUCKET creds
- For Phase 2 copy-trading: encrypt user API keys (KMS), never log; implement per-user risk caps and explicit consent flow.

## 13) Testing strategy
- Unit tests: parsing, diffing, stake-change detection, scoring, rate-limit adapters.
- Integration: mock Polymarket APIs via MSW/nock; seed responses; ensure idempotency.
- E2E (local): run bot against sandbox TG chat; simulate watch, trigger mocked trades, assert delivery and formatting.
- Load: simulate 10k watches across 1k traders; ensure rate-limit compliance and stable latencies.
- Quality gates: > 80% line coverage worker core; alert duplicate rate < 0.5% under test.

## 14) Deployment plan
- Environments: dev, staging, prod.
- Hosting: workers/api on Fly.io or Railway (autoscale 0→1). Redis (Upstash). DB (Supabase Postgres). Storage (Supabase Storage/S3).
- CI/CD: GitHub Actions (lint, test, build, health check). Versioned envs. Blue/green or rolling deploy.
- Secrets: per-environment; rotated quarterly; audit access.

## 15) Cost and scaling
- Early budget: $50–150/mo excluding X API. Redis/DB tiers scale as usage grows.
- Scale-out plan: shard per-trader queues by hash ring; increase worker concurrency; implement per-endpoint adaptive polling caps.

## 16) Copy-trading Phase 2 (future design excerpt)
- Auth: store Polymarket CLOB API key/secret/passphrase encrypted per user.
- Execution engine: subscribe to target trader alerts → place mirrored orders with user-defined rules (max per trade/day, allowed tags, slippage, delay window to avoid front-running).
- Compliance: region checks, explicit risk disclosure, kill-switch, audit trails.

## 17) Operational playbooks
- Rate-limit incidents: raise guard intervals, pause low-tier traders, drain queues; post status in channel if user-visible.
- Data drift (API fields change): feature flags to bypass enrichment; fallback to minimal alert content.
- Image service outage: auto-switch to text-only announcements; queue images for later re-post in thread.

## 18) Work breakdown (initial tickets)
- Repo bootstrap: Node 20 TS, pnpm, ESLint/Prettier, tsconfig, basic packages.
- DB: Prisma schema + migrations for users/watchlists/trader_profiles/market_cache.
- Bot: /start with referral, /watch flow, validation of Polymarket URLs and 0x wallets.
- Worker: per-trader polling (activity + trades), cursor store, dedup, fan-out to bot.
- Market cache: Gamma events ingestion and mapping conditionId→slug/title/icon.
- Summaries: daily job and template.
- Publisher: scoring + immediate posts to @PolyWatchAlerts, with cooldown logic.
- Image service: implement T1/T2; cache; attach to posts.
- Referrals: deep-link param store; award points; simple leaderboard.
- Admin: socials suggest/verify endpoints and minimal admin UI or CLI.
- Observability: Sentry + metrics; dashboards.

## 19) Acceptance checklist before going live
- [ ] Bot responds reliably to /start, /watch, /list, /help.
- [ ] Alerts delivered within p50 < 30s, p95 < 60s under nominal load.
- [ ] No duplicate alerts in 24h soak test; de-dup keys verified.
- [ ] Publisher posts to https://t.me/PolyWatchAlerts with correct formatting and cooldowns.
- [ ] Images render under 300ms p50; fallback works.
- [ ] Rate-limit backoff observed; no sustained 429s.
- [ ] Security: no secrets in logs; env vars verified; least-privileged tokens.
- [ ] Documentation: runbooks, env template, and admin procedures updated.

## 20) Notes and constraints
- The provided Telegram Bot token must be injected via environment variables; do not commit it to the repo. The bot username is PolyWatchAlerts_bot.
- X/Twitter posting is handled by a separate bot (out of scope here).
- All tags are enabled by default; users may opt to filter later in settings.

