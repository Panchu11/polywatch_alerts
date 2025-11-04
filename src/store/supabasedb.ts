/**
 * Supabase Database Implementation
 * Matches FileDb interface exactly for drop-in replacement
 * Uses deasync to make async Supabase calls synchronous
 */

import { supabase } from './supabase';
import type { Watcher, Cursor, UserSettings, User, Stats } from './filedb';
import deasync from 'deasync';

// Helper to make async functions synchronous
function syncify<T>(asyncFn: () => Promise<T>): T {
  let result: T | undefined;
  let error: Error | undefined;
  let done = false;

  asyncFn()
    .then(res => { result = res; done = true; })
    .catch(err => { error = err; done = true; });

  while (!done) {
    deasync.runLoopOnce();
  }

  if (error) throw error;
  return result as T;
}

// In-memory cache for stake windows and stats (not critical to persist)
const stakeWindowsCache: Record<string, Array<{ ts: number; usd: number; side: "BUY" | "SELL" }>> = {};
const statsCache: Record<string, Stats> = {};

export class SupabaseDb {
  // Watchers
  addWatcher(tgId: number, address: string) {
    address = address.toLowerCase();
    syncify(async () => {
      const { error } = await supabase
        .from('watchers')
        .insert({ tg_id: tgId, address });

      if (error && !error.message.includes('duplicate')) {
        console.error('Error adding watcher:', error);
      }
    });
  }

  removeWatcher(tgId: number, address: string) {
    address = address.toLowerCase();
    console.log(`removeWatcher: tgId=${tgId} address=${address}`);
    syncify(async () => {
      const { error, count } = await supabase
        .from('watchers')
        .delete()
        .eq('tg_id', tgId)
        .eq('address', address);

      if (error) console.error('Error removing watcher:', error);
      else console.log(`✅ Removed ${count || 0} watcher(s) from Supabase`);
    });
  }

  listWatchers(tgId: number): Watcher[] {
    return syncify(async () => {
      const { data, error } = await supabase
        .from('watchers')
        .select('*')
        .eq('tg_id', tgId);

      if (error) {
        console.error('Error listing watchers:', error);
        return [];
      }

      return (data || []).map(w => ({
        tgId: w.tg_id,
        address: w.address,
        createdAt: new Date(w.added_at).getTime()
      }));
    });
  }

  uniqueAddresses(): string[] {
    return syncify(async () => {
      const { data, error } = await supabase
        .from('watchers')
        .select('address');

      if (error) {
        console.error('Error getting unique addresses:', error);
        return [];
      }

      return [...new Set((data || []).map(w => w.address))];
    });
  }

  watchersFor(address: string): Watcher[] {
    address = address.toLowerCase();
    return syncify(async () => {
      const { data, error } = await supabase
        .from('watchers')
        .select('*')
        .eq('address', address);

      if (error) {
        console.error('Error getting watchers for address:', error);
        return [];
      }

      return (data || []).map(w => ({
        tgId: w.tg_id,
        address: w.address,
        createdAt: new Date(w.added_at).getTime()
      }));
    });
  }

  // Cursors
  getCursor(address: string): Cursor | undefined {
    return syncify(async () => {
      const { data, error } = await supabase
        .from('cursors')
        .select('*')
        .eq('address', address.toLowerCase())
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error getting cursor:', error);
      }

      if (!data) return undefined;

      return { lastTs: data.last_ts, lastTx: data.last_tx };
    });
  }

  setCursor(address: string, c: Cursor) {
    syncify(async () => {
      const { error } = await supabase
        .from('cursors')
        .upsert({
          address: address.toLowerCase(),
          last_ts: c.lastTs,
          last_tx: c.lastTx,
        });

      if (error) console.error('Error setting cursor:', error);
    });
  }

  // Stake windows (in-memory cache)
  pushStake(address: string, ts: number, usd: number, side: "BUY" | "SELL") {
    address = address.toLowerCase();
    const arr = stakeWindowsCache[address] || [];
    arr.push({ ts, usd, side });
    stakeWindowsCache[address] = arr;
  }

  pruneStake(address: string, cutoffTs: number) {
    address = address.toLowerCase();
    const arr = stakeWindowsCache[address] || [];
    stakeWindowsCache[address] = arr.filter(x => x.ts >= cutoffTs);
  }

  getStake(address: string) {
    return (stakeWindowsCache[address.toLowerCase()] || []).slice();
  }

  // Stats (in-memory cache)
  getStats(address: string): Stats {
    address = address.toLowerCase();
    return (statsCache[address] ||= {});
  }

  setStats(address: string, s: Stats) {
    address = address.toLowerCase();
    statsCache[address] = s;
  }

  // Channel dedupe
  hasChannelTx(tx?: string | null): boolean {
    if (!tx) return false;
    return syncify(async () => {
      // First prune old records
      await this.pruneChannelTxAsync();

      const { data, error } = await supabase
        .from('channel_tx_posted')
        .select('tx_hash')
        .eq('tx_hash', tx)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking channel tx:', error);
      }

      return !!data;
    });
  }

  markChannelTx(tx?: string | null) {
    if (!tx) return;
    syncify(async () => {
      // First prune old records
      await this.pruneChannelTxAsync();

      const { error } = await supabase
        .from('channel_tx_posted')
        .insert({ tx_hash: tx });

      if (error && !error.message.includes('duplicate')) {
        console.error('Error marking channel tx:', error);
      }
    });
  }

  tryReserveChannelTx(tx?: string | null): boolean {
    if (!tx) return false;
    return syncify(async () => {
      // First prune old records
      await this.pruneChannelTxAsync();

      const { error } = await supabase
        .from('channel_tx_posted')
        .insert({ tx_hash: tx });

      // If no error, we successfully reserved it
      // If duplicate error, someone else reserved it
      if (!error) return true;
      if (error.message.includes('duplicate')) return false;

      console.error('Error reserving channel tx:', error);
      return false;
    });
  }

  private async pruneChannelTxAsync(ttlMs = 7 * 24 * 60 * 60 * 1000) {
    const cutoff = new Date(Date.now() - ttlMs).toISOString();
    const { error } = await supabase
      .from('channel_tx_posted')
      .delete()
      .lt('posted_at', cutoff);

    if (error) console.error('Error pruning channel tx:', error);
  }

  // DM dedupe
  hasDmTx(address: string, tx?: string | null): boolean {
    if (!tx) return false;
    // For simplicity, always return false (allow all DMs)
    // The channel dedupe is more important
    return false;
  }

  markDmTx(address: string, tx?: string | null) {
    if (!tx) return;
    // We don't have tgId here, so we'll skip DM dedupe for now
    // Channel dedupe is more important anyway
  }

  // Users and referrals
  ensureUser(id: number, username?: string): User {
    return syncify(async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('tg_id', id)
        .single();

      if (data) {
        // User exists, update username if changed
        if (username && username !== data.username) {
          await supabase
            .from('users')
            .update({ username })
            .eq('tg_id', id);
        }

        // Count referrals
        const { count } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('referred_by', id);

        return {
          id: data.tg_id,
          username: data.username || username,
          referredBy: data.referred_by,
          firstSeen: new Date(data.created_at).getTime(),
          referrals: count || 0,
        };
      } else if (error?.code === 'PGRST116') {
        // User doesn't exist, create it
        const { error: insertError } = await supabase
          .from('users')
          .insert({ tg_id: id, username });

        if (insertError) {
          console.error('Error creating user:', insertError);
        }

        return {
          id,
          username,
          firstSeen: Date.now(),
          referrals: 0,
        };
      } else {
        console.error('Error ensuring user:', error);
        return {
          id,
          username,
          firstSeen: Date.now(),
          referrals: 0,
        };
      }
    });
  }

  setReferral(userId: number, referrerId: number) {
    if (userId === referrerId) return;

    syncify(async () => {
      const { data } = await supabase
        .from('users')
        .select('referred_by')
        .eq('tg_id', userId)
        .single();

      if (data && data.referred_by) return; // Already has referrer

      // Set referral
      const { error } = await supabase
        .from('users')
        .update({ referred_by: referrerId })
        .eq('tg_id', userId);

      if (error) console.error('Error setting referral:', error);
    });
  }

  // User settings
  getUserSettings(id: number): UserSettings {
    return syncify(async () => {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('tg_id', id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error getting user settings:', error);
      }

      return {
        minDmUsd: data?.min_dm_usd,
      };
    });
  }

  setUserSettings(id: number, s: UserSettings) {
    this.ensureUser(id); // Make sure user exists
    syncify(async () => {
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          tg_id: id,
          min_dm_usd: s.minDmUsd,
        });

      if (error) console.error('Error setting user settings:', error);
    });
  }

  topReferrers(limit = 10): Array<User> {
    return syncify(async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*');

      if (error) {
        console.error('Error getting top referrers:', error);
        return [];
      }

      if (!data) return [];

      const referralCounts = new Map<number, number>();
      data.forEach(u => {
        if (u.referred_by) {
          referralCounts.set(u.referred_by, (referralCounts.get(u.referred_by) || 0) + 1);
        }
      });

      return data
        .map(u => ({
          id: u.tg_id,
          username: u.username,
          firstSeen: new Date(u.created_at).getTime(),
          referrals: referralCounts.get(u.tg_id) || 0,
          referredBy: u.referred_by,
        }))
        .filter(u => u.referrals > 0)
        .sort((a, b) => b.referrals - a.referrals)
        .slice(0, limit);
    });
  }

  // Channel dedupe utils
  pruneChannelTx(ttlMs = 7 * 24 * 60 * 60 * 1000) {
    syncify(async () => {
      await this.pruneChannelTxAsync(ttlMs);
    });
  }

  channelTxStats() {
    return syncify(async () => {
      const { data, error } = await supabase
        .from('channel_tx_posted')
        .select('*');

      if (error) {
        console.error('Error getting channel tx stats:', error);
        return { total: 0, last1h: 0, today: 0 };
      }

      if (!data) return { total: 0, last1h: 0, today: 0 };

      const now = Date.now();
      const hourAgo = now - 60 * 60 * 1000;
      const today = new Date().toISOString().slice(0, 10);

      let total = 0, last1h = 0, todayCount = 0;

      data.forEach(row => {
        const ts = new Date(row.posted_at).getTime();
        total++;
        if (ts >= hourAgo) last1h++;
        if (new Date(ts).toISOString().slice(0, 10) === today) todayCount++;
      });

      return { total, last1h, today: todayCount };
    });
  }

  // Compatibility methods (no-ops for now)
  reload() { /* no-op */ }
  save() { /* no-op */ }
}

