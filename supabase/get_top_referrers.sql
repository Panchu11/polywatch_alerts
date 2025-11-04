-- SQL Function for Top Referrers Leaderboard
-- Run this in Supabase SQL Editor for better performance

CREATE OR REPLACE FUNCTION get_top_referrers(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
  tg_id BIGINT,
  username TEXT,
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.tg_id,
    u.username,
    COUNT(r.tg_id) as count
  FROM users u
  LEFT JOIN users r ON r.referred_by = u.tg_id
  WHERE r.tg_id IS NOT NULL
  GROUP BY u.tg_id, u.username
  HAVING COUNT(r.tg_id) > 0
  ORDER BY count DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

