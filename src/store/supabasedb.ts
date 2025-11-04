/**
 * Supabase Database Implementation
 * Drop-in replacement for FileDb using Supabase REST API
 */

import { supabase } from './supabase';
import type { Db, User, Watcher, Cursor, UserSettings } from './types';

export class SupabaseDb {
  /**
   * Get or create user
   */
  async getOrCreateUser(tgId: number, username?: string, firstName?: string, referredBy?: number): Promise<User> {
    // Try to get existing user
    const { data: existing } = await supabase
      .from('users')
      .select('*')
      .eq('tg_id', tgId)
      .single();

    if (existing) {
      return {
        tgId: existing.tg_id,
        username: existing.username,
        firstName: existing.first_name,
        referredBy: existing.referred_by,
      };
    }

    // Create new user
    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        tg_id: tgId,
        username,
        first_name: firstName,
        referred_by: referredBy,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      tgId: newUser.tg_id,
      username: newUser.username,
      firstName: newUser.first_name,
      referredBy: newUser.referred_by,
    };
  }

  /**
   * Add watcher (user watching an address)
   */
  async addWatcher(tgId: number, address: string): Promise<void> {
    const { error } = await supabase
      .from('watchers')
      .insert({
        tg_id: tgId,
        address: address.toLowerCase(),
      });

    // Ignore duplicate errors (unique constraint)
    if (error && !error.message.includes('duplicate')) {
      throw error;
    }
  }

  /**
   * Remove watcher
   */
  async removeWatcher(tgId: number, address: string): Promise<void> {
    const { error } = await supabase
      .from('watchers')
      .delete()
      .eq('tg_id', tgId)
      .eq('address', address.toLowerCase());

    if (error) throw error;
  }

  /**
   * Get all addresses watched by a user
   */
  async getWatchedAddresses(tgId: number): Promise<string[]> {
    const { data, error } = await supabase
      .from('watchers')
      .select('address')
      .eq('tg_id', tgId);

    if (error) throw error;
    return data.map(w => w.address);
  }

  /**
   * Get all users watching a specific address
   */
  async getWatchersForAddress(address: string): Promise<number[]> {
    const { data, error } = await supabase
      .from('watchers')
      .select('tg_id')
      .eq('address', address.toLowerCase());

    if (error) throw error;
    return data.map(w => w.tg_id);
  }

  /**
   * Get all unique addresses being watched by anyone
   */
  async getAllWatchedAddresses(): Promise<string[]> {
    const { data, error } = await supabase
      .from('watchers')
      .select('address');

    if (error) throw error;
    
    // Get unique addresses
    const unique = [...new Set(data.map(w => w.address))];
    return unique;
  }

  /**
   * Get cursor for an address (last seen trade)
   */
  async getCursor(address: string): Promise<Cursor | null> {
    const { data, error } = await supabase
      .from('cursors')
      .select('*')
      .eq('address', address.toLowerCase())
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
    if (!data) return null;

    return {
      lastTs: data.last_ts,
      lastTx: data.last_tx,
    };
  }

  /**
   * Update cursor for an address
   */
  async updateCursor(address: string, lastTs: number, lastTx: string): Promise<void> {
    const { error } = await supabase
      .from('cursors')
      .upsert({
        address: address.toLowerCase(),
        last_ts: lastTs,
        last_tx: lastTx,
      });

    if (error) throw error;
  }

  /**
   * Check if DM transaction has been seen (deduplication)
   */
  async hasDmTxBeenSeen(tgId: number, address: string, txHash: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('dm_tx_seen')
      .select('tx_hash')
      .eq('tg_id', tgId)
      .eq('address', address.toLowerCase())
      .eq('tx_hash', txHash)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return !!data;
  }

  /**
   * Mark DM transaction as seen
   */
  async markDmTxSeen(tgId: number, address: string, txHash: string): Promise<void> {
    const { error } = await supabase
      .from('dm_tx_seen')
      .insert({
        tg_id: tgId,
        address: address.toLowerCase(),
        tx_hash: txHash,
      });

    // Ignore duplicate errors
    if (error && !error.message.includes('duplicate')) {
      throw error;
    }
  }

  /**
   * Check if channel transaction has been posted (deduplication)
   */
  async hasChannelTxBeenPosted(txHash: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('channel_tx_posted')
      .select('tx_hash')
      .eq('tx_hash', txHash)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return !!data;
  }

  /**
   * Mark channel transaction as posted (atomic reservation)
   */
  async tryReserveChannelTx(txHash: string): Promise<boolean> {
    const { error } = await supabase
      .from('channel_tx_posted')
      .insert({
        tx_hash: txHash,
      });

    // If duplicate, it was already reserved
    if (error && error.message.includes('duplicate')) {
      return false;
    }

    if (error) throw error;
    return true;
  }

  /**
   * Get user settings
   */
  async getUserSettings(tgId: number): Promise<UserSettings> {
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('tg_id', tgId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    
    return {
      minDmUsd: data?.min_dm_usd,
    };
  }

  /**
   * Update user settings
   */
  async updateUserSettings(tgId: number, settings: UserSettings): Promise<void> {
    const { error } = await supabase
      .from('user_settings')
      .upsert({
        tg_id: tgId,
        min_dm_usd: settings.minDmUsd,
      });

    if (error) throw error;
  }

  /**
   * Get referral count for a user
   */
  async getReferralCount(tgId: number): Promise<number> {
    const { count, error } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('referred_by', tgId);

    if (error) throw error;
    return count || 0;
  }

  /**
   * Get top referrers (leaderboard)
   */
  async getTopReferrers(limit: number = 10): Promise<Array<{ tgId: number; username?: string; count: number }>> {
    // This requires a more complex query - we'll use a RPC function
    const { data, error } = await supabase.rpc('get_top_referrers', { limit_count: limit });

    if (error) {
      // Fallback: manual aggregation (slower but works)
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('tg_id, username, referred_by');

      if (usersError) throw usersError;

      // Count referrals manually
      const referralCounts = new Map<number, number>();
      const userMap = new Map<number, { username?: string }>();

      users.forEach(u => {
        userMap.set(u.tg_id, { username: u.username });
        if (u.referred_by) {
          referralCounts.set(u.referred_by, (referralCounts.get(u.referred_by) || 0) + 1);
        }
      });

      // Sort and limit
      const sorted = Array.from(referralCounts.entries())
        .map(([tgId, count]) => ({
          tgId,
          username: userMap.get(tgId)?.username,
          count,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);

      return sorted;
    }

    return data;
  }

  /**
   * Get total stats
   */
  async getStats(): Promise<{ totalUsers: number; totalWatchers: number; totalAddresses: number }> {
    const [usersResult, watchersResult, addressesResult] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('watchers').select('*', { count: 'exact', head: true }),
      supabase.from('watchers').select('address'),
    ]);

    if (usersResult.error) throw usersResult.error;
    if (watchersResult.error) throw watchersResult.error;
    if (addressesResult.error) throw addressesResult.error;

    const uniqueAddresses = new Set(addressesResult.data.map(w => w.address));

    return {
      totalUsers: usersResult.count || 0,
      totalWatchers: watchersResult.count || 0,
      totalAddresses: uniqueAddresses.size,
    };
  }

  /**
   * Cleanup old deduplication records (called periodically)
   */
  async cleanupOldRecords(): Promise<void> {
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    await Promise.all([
      supabase.from('dm_tx_seen').delete().lt('seen_at', twoDaysAgo),
      supabase.from('channel_tx_posted').delete().lt('posted_at', sevenDaysAgo),
    ]);
  }
}

