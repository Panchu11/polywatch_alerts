/**
 * Supabase Database Implementation
 * Matches FileDb interface exactly for drop-in replacement
 */

import { supabase } from './supabase';
import type { Watcher, Cursor, UserSettings, User, Stats } from './filedb';

// In-memory cache for stake windows and stats (not critical to persist)
const stakeWindowsCache: Record<string, Array<{ ts: number; usd: number; side: "BUY" | "SELL" }>> = {};
const statsCache: Record<string, Stats> = {};

export class SupabaseDb {
  // Watchers
  addWatcher(tgId: number, address: string) {
    address = address.toLowerCase();
    supabase
      .from('watchers')
      .insert({ tg_id: tgId, address })
      .then(({ error }) => {
        if (error && !error.message.includes('duplicate')) {
          console.error('Error adding watcher:', error);
        }
      });
  }

  removeWatcher(tgId: number, address: string) {
    address = address.toLowerCase();
    console.log(`removeWatcher: tgId=${tgId} address=${address}`);
    supabase
      .from('watchers')
      .delete()
      .eq('tg_id', tgId)
      .eq('address', address)
      .then(({ error, count }) => {
        if (error) console.error('Error removing watcher:', error);
        else console.log(`✅ Removed ${count || 0} watcher(s) from Supabase`);
      });
  }

  listWatchers(tgId: number): Watcher[] {
    // Return empty array immediately, will be populated by async call
    const result: Watcher[] = [];
    supabase
      .from('watchers')
      .select('*')
      .eq('tg_id', tgId)
      .then(({ data }) => {
        if (data) {
          result.length = 0; // Clear array
          data.forEach(w => result.push({ 
            tgId: w.tg_id, 
            address: w.address, 
            createdAt: new Date(w.added_at).getTime() 
          }));
        }
      });
    // Hack: wait a bit for the query to complete
    const start = Date.now();
    while (Date.now() - start < 100) { /* busy wait */ }
    return result;
  }

  uniqueAddresses(): string[] {
    const result: string[] = [];
    supabase
      .from('watchers')
      .select('address')
      .then(({ data }) => {
        if (data) {
          const unique = [...new Set(data.map(w => w.address))];
          result.push(...unique);
        }
      });
    const start = Date.now();
    while (Date.now() - start < 100) { /* busy wait */ }
    return result;
  }

  watchersFor(address: string): Watcher[] {
    address = address.toLowerCase();
    const result: Watcher[] = [];
    supabase
      .from('watchers')
      .select('*')
      .eq('address', address)
      .then(({ data }) => {
        if (data) {
          result.length = 0;
          data.forEach(w => result.push({ 
            tgId: w.tg_id, 
            address: w.address, 
            createdAt: new Date(w.added_at).getTime() 
          }));
        }
      });
    const start = Date.now();
    while (Date.now() - start < 100) { /* busy wait */ }
    return result;
  }

  // Cursors
  getCursor(address: string): Cursor | undefined {
    let result: Cursor | undefined;
    supabase
      .from('cursors')
      .select('*')
      .eq('address', address.toLowerCase())
      .single()
      .then(({ data }) => {
        if (data) {
          result = { lastTs: data.last_ts, lastTx: data.last_tx };
        }
      });
    const start = Date.now();
    while (Date.now() - start < 100) { /* busy wait */ }
    return result;
  }

  setCursor(address: string, c: Cursor) {
    supabase
      .from('cursors')
      .upsert({
        address: address.toLowerCase(),
        last_ts: c.lastTs,
        last_tx: c.lastTx,
      })
      .then(({ error }) => {
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
    let result = false;
    supabase
      .from('channel_tx_posted')
      .select('tx_hash')
      .eq('tx_hash', tx)
      .single()
      .then(({ data }) => {
        result = !!data;
      });
    const start = Date.now();
    while (Date.now() - start < 100) { /* busy wait */ }
    return result;
  }

  markChannelTx(tx?: string | null) {
    if (!tx) return;
    supabase
      .from('channel_tx_posted')
      .insert({ tx_hash: tx })
      .then(({ error }) => {
        if (error && !error.message.includes('duplicate')) {
          console.error('Error marking channel tx:', error);
        }
      });
  }

  tryReserveChannelTx(tx?: string | null): boolean {
    if (!tx) return false;
    let reserved = false;
    supabase
      .from('channel_tx_posted')
      .insert({ tx_hash: tx })
      .then(({ error }) => {
        reserved = !error || !error.message.includes('duplicate');
      });
    const start = Date.now();
    while (Date.now() - start < 100) { /* busy wait */ }
    return reserved;
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
    const result: User = { id, username, firstSeen: Date.now(), referrals: 0 };
    
    supabase
      .from('users')
      .select('*')
      .eq('tg_id', id)
      .single()
      .then(async ({ data, error }) => {
        if (data) {
          result.id = data.tg_id;
          result.username = data.username;
          result.referredBy = data.referred_by;
          result.firstSeen = new Date(data.created_at).getTime();
          
          // Count referrals
          const { count } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('referred_by', id);
          result.referrals = count || 0;
          
          // Update username if changed
          if (username && username !== data.username) {
            await supabase
              .from('users')
              .update({ username })
              .eq('tg_id', id);
          }
        } else if (error?.code === 'PGRST116') {
          // User doesn't exist, create it
          supabase
            .from('users')
            .insert({ tg_id: id, username })
            .then(({ error: insertError }) => {
              if (insertError) console.error('Error creating user:', insertError);
            });
        }
      });
    
    const start = Date.now();
    while (Date.now() - start < 100) { /* busy wait */ }
    return result;
  }

  setReferral(userId: number, referrerId: number) {
    if (userId === referrerId) return;
    
    supabase
      .from('users')
      .select('referred_by')
      .eq('tg_id', userId)
      .single()
      .then(async ({ data }) => {
        if (data && data.referred_by) return; // Already has referrer
        
        // Set referral
        await supabase
          .from('users')
          .update({ referred_by: referrerId })
          .eq('tg_id', userId);
      });
  }

  // User settings
  getUserSettings(id: number): UserSettings {
    const result: UserSettings = {};
    supabase
      .from('user_settings')
      .select('*')
      .eq('tg_id', id)
      .single()
      .then(({ data }) => {
        if (data) {
          result.minDmUsd = data.min_dm_usd;
        }
      });
    const start = Date.now();
    while (Date.now() - start < 50) { /* busy wait */ }
    return result;
  }

  setUserSettings(id: number, s: UserSettings) {
    this.ensureUser(id); // Make sure user exists
    supabase
      .from('user_settings')
      .upsert({
        tg_id: id,
        min_dm_usd: s.minDmUsd,
      })
      .then(({ error }) => {
        if (error) console.error('Error setting user settings:', error);
      });
  }

  topReferrers(limit = 10): Array<User> {
    const result: User[] = [];
    supabase
      .from('users')
      .select('*')
      .then(({ data }) => {
        if (data) {
          const referralCounts = new Map<number, number>();
          data.forEach(u => {
            if (u.referred_by) {
              referralCounts.set(u.referred_by, (referralCounts.get(u.referred_by) || 0) + 1);
            }
          });
          
          const usersWithReferrals = data
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
          
          result.push(...usersWithReferrals);
        }
      });
    const start = Date.now();
    while (Date.now() - start < 100) { /* busy wait */ }
    return result;
  }

  // Channel dedupe utils
  pruneChannelTx(ttlMs = 7 * 24 * 60 * 60 * 1000) {
    const cutoff = new Date(Date.now() - ttlMs).toISOString();
    supabase
      .from('channel_tx_posted')
      .delete()
      .lt('posted_at', cutoff)
      .then(({ error }) => {
        if (error) console.error('Error pruning channel tx:', error);
      });
  }

  channelTxStats() {
    const result = { total: 0, last1h: 0, today: 0 };
    supabase
      .from('channel_tx_posted')
      .select('*')
      .then(({ data }) => {
        if (data) {
          const now = Date.now();
          const hourAgo = now - 60 * 60 * 1000;
          const today = new Date().toISOString().slice(0, 10);
          
          data.forEach(row => {
            const ts = new Date(row.posted_at).getTime();
            result.total++;
            if (ts >= hourAgo) result.last1h++;
            if (new Date(ts).toISOString().slice(0, 10) === today) result.today++;
          });
        }
      });
    const start = Date.now();
    while (Date.now() - start < 100) { /* busy wait */ }
    return result;
  }

  // Compatibility methods (no-ops for now)
  reload() { /* no-op */ }
  save() { /* no-op */ }
}

