-- PolyWatch Alerts - Supabase Database Schema
-- Run this in Supabase SQL Editor

-- Users table
CREATE TABLE IF NOT EXISTS users (
  tg_id BIGINT PRIMARY KEY,
  username TEXT,
  referred_by BIGINT REFERENCES users(tg_id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by);

-- Watchers table (many-to-many: users watch addresses)
CREATE TABLE IF NOT EXISTS watchers (
  id BIGSERIAL PRIMARY KEY,
  tg_id BIGINT NOT NULL REFERENCES users(tg_id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tg_id, address)
);

CREATE INDEX IF NOT EXISTS idx_watchers_tg_id ON watchers(tg_id);
CREATE INDEX IF NOT EXISTS idx_watchers_address ON watchers(address);

-- User settings
CREATE TABLE IF NOT EXISTS user_settings (
  tg_id BIGINT PRIMARY KEY REFERENCES users(tg_id) ON DELETE CASCADE,
  min_dm_usd INTEGER,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cursors (last seen trade per address)
CREATE TABLE IF NOT EXISTS cursors (
  address TEXT PRIMARY KEY,
  last_ts BIGINT NOT NULL,
  last_tx TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- DM transaction deduplication (per user per address)
CREATE TABLE IF NOT EXISTS dm_tx_seen (
  id BIGSERIAL PRIMARY KEY,
  tg_id BIGINT NOT NULL,
  address TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  seen_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tg_id, address, tx_hash)
);

CREATE INDEX IF NOT EXISTS idx_dm_tx_seen_at ON dm_tx_seen(seen_at);

-- Channel transaction deduplication (global)
CREATE TABLE IF NOT EXISTS channel_tx_posted (
  tx_hash TEXT PRIMARY KEY,
  posted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_channel_tx_posted_at ON channel_tx_posted(posted_at);

-- Function to get top referrers
DROP FUNCTION IF EXISTS get_top_referrers(INTEGER);
CREATE FUNCTION get_top_referrers(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
  tg_id BIGINT,
  username TEXT,
  referral_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.tg_id,
    u.username,
    COUNT(r.tg_id) as referral_count
  FROM users u
  LEFT JOIN users r ON r.referred_by = u.tg_id
  GROUP BY u.tg_id, u.username
  HAVING COUNT(r.tg_id) > 0
  ORDER BY referral_count DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Cleanup function for old deduplication records
DROP FUNCTION IF EXISTS cleanup_old_dedupe_records();
CREATE FUNCTION cleanup_old_dedupe_records()
RETURNS void AS $$
BEGIN
  -- Delete DM tx older than 48 hours
  DELETE FROM dm_tx_seen
  WHERE seen_at < NOW() - INTERVAL '48 hours';

  -- Delete channel tx older than 7 days
  DELETE FROM channel_tx_posted
  WHERE posted_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Optional: Create a cron job to run cleanup daily
-- (Requires pg_cron extension - may not be available on free tier)
-- SELECT cron.schedule('cleanup-dedupe', '0 2 * * *', 'SELECT cleanup_old_dedupe_records()');

COMMENT ON TABLE users IS 'Telegram users who have started the bot';
COMMENT ON TABLE watchers IS 'User watchlist - which addresses each user is watching';
COMMENT ON TABLE user_settings IS 'Per-user settings like minimum DM threshold';
COMMENT ON TABLE cursors IS 'Last seen trade timestamp per address for polling';
COMMENT ON TABLE dm_tx_seen IS 'DM deduplication - tracks which transactions have been sent to which users';
COMMENT ON TABLE channel_tx_posted IS 'Channel deduplication - tracks which transactions have been posted to the channel';

