# PolyWatch Alerts — Project Overview

Last updated: 2025-11-04
Owner: PolyWatchAlerts_bot (Telegram)
Announcements channel: https://t.me/PolyWatchAlerts

## 1) Executive summary
PolyWatch Alerts is a best-in-class Telegram experience that lets users watch any Polymarket trader and receive high-signal alerts about their activity. We leverage Polymarket’s public Data API (for user trades, positions, and activity) and Gamma Markets API (for market metadata) with a rate‑limit–aware polling engine to deliver near real-time notifications. A companion Publisher automates announcements to the public channel and attaches branded image cards that summarize trades and performance. The system is secure, scalable, and designed for future “autopilot copy-trading” once enabled.

This document defines goals, scope, rules, architecture, data, KPIs, risks, and rollout. A separate Implementation Plan covers the how-to in depth.

## 2) Goals and non-goals
- Goals
  - Best-in-class alerts for tracked traders: new trades, position changes, milestones.
  - Persuasive, shareable trade images and a strong TG UX with inline actions.
  - Channel announcements that highlight notable trades with smart ranking.
  - Referral system to grow adoption; free-to-use at launch.
  - Future-ready for copy-trading autopilot (Phase 2), with strong security/compliance.
- Non-goals (v1)
  - On-chain execution or custody; we only link to Polymarket for manual trading in MVP.
  - Complex paywalls or billing. Monetization is deferred (free at launch).

## 3) Primary audience and UX principles
- Copy-traders, market spectators, and community members who want timely, high-signal alerts.
- UX principles: signal over noise, speed over perfection, safe defaults, clear CTAs, tasteful branding.

## 4) Feature summary
- Telegram Bot (PolyWatch Alerts)
  - Watch any trader by Polymarket profile link or proxy wallet.
  - Alerts: new trades (buy/sell), position size changes (“staking behavior”), PnL milestones, streaks.
  - Filters: minimum trade size (default > $1,000), tags (all by default), side, time windows.
  - Daily/weekly summaries per watched trader.
  - One-tap CTAs to open the market page for “copy” (prefilled deep links), then autopilot later.
- Publisher (Announcements Bot)
  - Auto-post notable trades to t.me/PolyWatchAlerts based on configurable rules (e.g., notional > $5k, large PnL, trending markets), attaching branded image cards.
- Trade Image Cards
  - Branded OG-style images showing max potential return, realized wins/losses, win-rate, bet-size distribution, and short PnL heatmaps; QR and deep-link to subscribe.
- Referral & Points
  - Deep-link referrals; award points on the referee’s first alert setup. Leaderboard later.
- Socials/Tagging
  - Display profile metadata and, when verified, tag the trader’s X handle in announcements.

## 5) Business rules (defaults we define)
- Minimum trade size to alert: $1,000 notional (user-configurable; default applies if unset).
- All tags: enabled by default; users can later restrict to categories.
- Wins/Losses counting
  - “Win”: a realized PnL > 0 on a close/redeem action; “Loss”: realized PnL < 0.
  - Source: Data API closed-positions and/or activity/positions transitions.
  - Deduplicate by (proxyWallet, conditionId, txHash/timestamp). Partial closures count proportionally.
  - Streaks: based on sequential realized events (wins/losses ordered by time).
- “Staking behavior change”
  - Definition: Significant net position size change in a market by the trader within a sliding window.
  - Default trigger: |Δnotional| ≥ max($2,500, 20% of current position) within 15 minutes.
  - Also trigger if cumulative same-side buys/sells in 30 minutes exceed $5,000 even if fragmented.
- Notable trade (for channel announcements)
  - Default: single trade ≥ $5,000 OR daily net add ≥ $10,000 in a market OR new multi-day high in daily net add for that trader.
  - Cooldown: do not post more than once per 5 minutes per trader unless trade ≥ $25,000.
- Scheduling
  - Alerts: near real-time (5–30s typical latency depending on polling cadence).
  - Announcements: immediate for “large” events; hourly digest for top 3; daily recap.
- Copy-trading scope
  - Phase 1: manual CTAs with deep links (no credentials needed).
  - Phase 2 (later): optional autopilot with user keys, slippage/risk caps, and compliance guardrails.

## 6) Data sources and key endpoints
- Polymarket Data API (user-centric)
  - /activity?user=... — holistic history (TRADE, SPLIT, MERGE, REDEEM, REWARD, CONVERSION).
  - /trades?user=... — transactional trades with price/size/txHash.
  - /positions?user=... — current positions, computed PnL.
  - /closed-positions?user=... — realized outcomes for win/loss stats.
- Gamma Markets API (market metadata)
  - /events, /events/slug/{slug} — events with nested markets, best for discovery.
  - /markets?tag_id=... and /tags, /sports — tags and sports metadata.
- Real-time options
  - No public per-user stream for arbitrary users; we implement rate‑limit–aware polling per watched trader with per-trader cursors. CLOB User WebSocket is only for the authenticated user’s own orders/trades.

## 7) Rate limits and strategy
- Data API guidelines (typical): ~200 req/10s overall, /trades ~75 req/10s plus minute caps.
- Strategy: coalesce watchers by trader; incremental polling (since last timestamp); priority tiers (hot traders polled more often), exponential backoff, jitter, and Redis dedup.

## 8) Architecture overview
- Components
  - Telegram Bot API layer (Telegraf/Node) for chat UX.
  - Alert Engine workers (BullMQ + Redis) for polling, diffing, and fan-out.
  - Market Metadata cache service (Gamma API ingestion).
  - Image Service for card rendering (Satori/Resvg or Headless Chromium templates).
  - Publisher service for channel announcements (TG Bot API, X via separate bot if desired).
  - REST Admin/API for configuration, review queues (e.g., social handle verification).
- Data
  - PostgreSQL (Supabase) for users, watches, trades cache, stats, referrals, socials.
  - Redis for queues, distributed rate limits, per-trader cursors, idempotency keys.
  - Object storage (Supabase/S3/R2) for generated images.
- Observability
  - Sentry for errors, structured logs (Pino), metrics (OpenTelemetry → Grafana/Cloud).

## 9) Data model highlights
- users: telegram_id, referral_code, referrer_id, settings.
- watchlists: user_id, target_proxy_wallet, thresholds/filters, created_at.
- trader_profiles: proxy_wallet PK, name, pseudonym, bio, avatar_url, last_seen_ts.
- trader_socials: proxy_wallet FK, platform, handle, source, verified, updated_at.
- trades: proxy_wallet, condition_id, side, size, price, timestamp, tx_hash, outcome_index.
- positions_snapshots: proxy_wallet, condition_id, size, avg_price, pnl, snapshot_ts.
- market_cache: condition_id, slug, title, icon, event_slug, tags, updated_at.
- alerts_log: user_id, proxy_wallet, type, payload_json, sent_at.
- referrals: referrer_id, referee_id, milestone, points_awarded_at.

## 10) Branding (initial)
- Name: PolyWatch Alerts.
- Palette: Electric Blue (#2E5CFF), Dark Background (#0B0C0E), Success Green (#16A34A), Alert Red (#DC2626), Neutral Gray (#6B7280).
- Style: Clean, data-forward, subtle gradients; readable on dark mode.
- Images: Rounded cards, sharp typography (Inter/Roboto), subtle depth.

## 11) KPIs and success metrics
- Activation: % users who set at least 1 watch in first session; time-to-first-alert.
- Engagement: alerts delivered per active user; mute/unsubscribe rate; CTR on market links.
- Growth: referral conversion rate; channel subscriber growth; share rate of images.
- Reliability: alert latency p50/p95; duplicate rate; error budgets.

## 12) Rollout plan (high level)
- Phase 0: Design + infra setup (schemas, queues, secrets, CI/CD).
- Phase 1: MVP alerts + user flows; market cache; daily/weekly summaries.
- Phase 2: Image cards + Publisher to announcements channel.
- Phase 3: Referrals + basic leaderboard; socials verification flow.
- Phase 4: Optional: web dashboard; then copy-trading Phase 2 (autopilot).

## 13) Risks and mitigations
- API rate limits → Per-trader coalescing, adaptive polling, caching, backoff.
- Missing social handles → Bio parsing + opt-in self-verification + admin approval; optional scraping with strict limits.
- Compliance for copy-trading → Start informational; for autopilot add explicit consent, risk limits, delays if needed, and clear disclosures.
- False positives/duplicates → Idempotency keys by txHash; guard window for out-of-order events.
- Costs → Redis/DB quotas monitored; batch/compact queries; image caching.

## 14) Third-party dependencies (initial)
- Supabase (Postgres + Storage), Upstash/Redis, Fly.io or Railway (workers/API), Sentry, OpenTelemetry stack.
- Telegram Bot API.
- Polymarket Data API + Gamma Markets API.
- Optional: URL shortener (Rebrandly/Bitly) for tracking.

## 15) Security & privacy
- No secrets in repo; environment-based config. Encrypt sensitive fields (when Phase 2 stores user CLOB keys). Minimize PII (Telegram IDs only). Strict logging hygiene.
- Abuse controls: per-user rate limits, content moderation for public posts, admin tools.

## 16) Compliance notes
- This is informational tooling for market data and alerts. No investment advice.
- Autopilot copy-trading (future) will require explicit consent, limits, and region checks depending on applicable laws.

## 17) Glossary
- Proxy wallet: Polymarket user address used in APIs.
- Condition ID: Market identifier.
- Notional: trade size × price (USDC basis).
- PnL: Profit and loss; realized when closing/redeeming, unrealized for open positions.

## 18) Default announcement schedule (v1)
- Immediate: single trades ≥ $5k notional.
- Hourly: top 3 trader events by notional or volume momentum (no repeats within 2 hours).
- Daily: 18:00 UTC recap image (top traders, top markets, biggest PnL swings).

## 19) Out of scope (v1)
- Non-TG surfaces (native mobile apps), complex paywalls, advanced portfolio analytics UI beyond cards/digests.

## 20) Acceptance for “best bot” quality bar
- Median alert latency < 30s; duplicate rate < 0.5%; > 99.9% delivery success; polished visuals; clear CTAs; resilient to API hiccups.

