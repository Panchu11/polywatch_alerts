import fs from "fs";
import path from "path";

export interface Watcher { tgId: number; address: string; createdAt: number }
export interface Cursor { lastTs: number; lastTx?: string | null }
export interface Stats { lastStakeAlertTs?: number; lastWinsAlertDay?: string; lastLossesAlertDay?: string }
export interface UserSettings { minDmUsd?: number }
export interface User { id: number; username?: string; firstSeen: number; referredBy?: number; referrals?: number; settings?: UserSettings }
export interface DbSchema {
  watchers: Watcher[];
  cursors: Record<string, Cursor>;
  stakeWindows: Record<string, Array<{ ts: number; usd: number; side: "BUY" | "SELL" }>>;
  stats: Record<string, Stats>;
  channelTxPosted: Record<string, number>; // txHash -> ts
  dmTxSeen: Record<string, Record<string, number>>; // address -> txHash -> ts
  users: Record<string, User>; // key: tgId as string
}

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

export class FileDb {
  private data: DbSchema;

  constructor() {
    ensureDir();
    if (!fs.existsSync(DB_FILE)) {
      this.data = { watchers: [], cursors: {}, stakeWindows: {}, stats: {}, channelTxPosted: {}, dmTxSeen: {}, users: {} };
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2));
    }
    const raw = fs.readFileSync(DB_FILE, "utf-8");
    const parsed = JSON.parse(raw || "{}");
    this.data = {
      watchers: parsed.watchers || [],
      cursors: parsed.cursors || {},
      stakeWindows: parsed.stakeWindows || {},
      stats: parsed.stats || {},
      channelTxPosted: parsed.channelTxPosted || {},
      dmTxSeen: parsed.dmTxSeen || {},
      users: parsed.users || {},
    } as DbSchema;
  }

  save() {
    fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2));
  }
  private reload() {
    try {
      const raw = fs.readFileSync(DB_FILE, "utf-8");
      const parsed = JSON.parse(raw || "{}");
      this.data = {
        watchers: parsed.watchers || [],
        cursors: parsed.cursors || {},
        stakeWindows: parsed.stakeWindows || {},
        stats: parsed.stats || {},
        channelTxPosted: parsed.channelTxPosted || {},
        dmTxSeen: parsed.dmTxSeen || {},
        users: parsed.users || {},
      } as DbSchema;
    } catch {}
  }

  // Watchers
  addWatcher(tgId: number, address: string) {
    address = address.toLowerCase();
    if (!this.data.watchers.find(w => w.tgId === tgId && w.address === address)) {
      this.data.watchers.push({ tgId, address, createdAt: Date.now() });
      this.save();
    }
  }
  removeWatcher(tgId: number, address: string) {
    address = address.toLowerCase();
    this.reload();
    const before = this.data.watchers.length;
    const matchingBefore = this.data.watchers.filter(w => w.tgId === tgId && w.address === address).length;
    this.data.watchers = this.data.watchers.filter(w => !(w.tgId === tgId && w.address === address));
    const after = this.data.watchers.length;
    // eslint-disable-next-line no-console
    console.log(`removeWatcher: tgId=${tgId} address=${address} before=${before} matching=${matchingBefore} after=${after} removed=${before - after}`);
    this.save();
  }
  listWatchers(tgId: number) {
    return this.data.watchers.filter(w => w.tgId === tgId);
  }
  uniqueAddresses(): string[] {
    return Array.from(new Set(this.data.watchers.map(w => w.address)));
  }
  watchersFor(address: string): Watcher[] {
    address = address.toLowerCase();
    return this.data.watchers.filter(w => w.address === address);
  }

  // Cursors
  getCursor(address: string): Cursor | undefined {
    return this.data.cursors[address.toLowerCase()];
  }
  setCursor(address: string, c: Cursor) {
    this.data.cursors[address.toLowerCase()] = c;
    this.save();
  }

  // Stake windows
  pushStake(address: string, ts: number, usd: number, side: "BUY" | "SELL") {
    address = address.toLowerCase();
    const arr = this.data.stakeWindows[address] || [];
    arr.push({ ts, usd, side });
    this.data.stakeWindows[address] = arr;
    this.save();
  }
  pruneStake(address: string, cutoffTs: number) {
    address = address.toLowerCase();
    const arr = this.data.stakeWindows[address] || [];
    this.data.stakeWindows[address] = arr.filter(x => x.ts >= cutoffTs);
    this.save();
  }
  getStake(address: string) {
    return (this.data.stakeWindows[address.toLowerCase()] || []).slice();
  }

  // Stats
  getStats(address: string): Stats {
    address = address.toLowerCase();
    return (this.data.stats[address] ||= {});
  }
  setStats(address: string, s: Stats) {
    address = address.toLowerCase();
    this.data.stats[address] = s;
    this.save();
  }

  // Channel dedupe
  hasChannelTx(tx?: string | null): boolean {
    if (!tx) return false;
    this.reload();
    this.pruneChannelTx();
    return !!this.data.channelTxPosted[tx];
  }
  markChannelTx(tx?: string | null) {
    if (!tx) return;
    // ensure latest, then write
    this.reload();
    this.pruneChannelTx();
    this.data.channelTxPosted[tx] = Date.now();
    this.save();
  }
  // Atomically reserve a channel tx if absent; returns true if reserved by this call
  tryReserveChannelTx(tx?: string | null): boolean {
    if (!tx) return false;
    this.reload();
    this.pruneChannelTx();
    if (this.data.channelTxPosted[tx]) return false;
    this.data.channelTxPosted[tx] = Date.now();
    this.save();
    return true;
  }

  // DM dedupe per address (by tx hash), pruned to ~48h
  hasDmTx(address: string, tx?: string | null): boolean {
    if (!tx) return false;
    address = address.toLowerCase();
    return !!this.data.dmTxSeen[address]?.[tx];
  }
  markDmTx(address: string, tx?: string | null) {
    if (!tx) return;
    address = address.toLowerCase();
    const now = Date.now();
    const ttl = 48 * 60 * 60 * 1000;
    const m = (this.data.dmTxSeen[address] ||= {});
    // prune old
    for (const [k, ts] of Object.entries(m)) {
      if (now - (ts as number) > ttl) delete m[k];
    }
    m[tx] = now;
    this.save();
  }

  // Users and referrals
  ensureUser(id: number, username?: string) {
    const key = String(id);
    const existing = this.data.users[key];
    if (existing) {
      if (username && username !== existing.username) {
        existing.username = username;
        this.save();
      }
      return existing;
    }
    const u: User = { id, username, firstSeen: Date.now(), referrals: 0 };
    this.data.users[key] = u;
    this.save();
    return u;
  }
  setReferral(userId: number, referrerId: number) {
    const userKey = String(userId);
    const refKey = String(referrerId);
    if (userId === referrerId) return; // ignore self-referral
    const u = this.ensureUser(userId);
    if (u.referredBy) return; // already set
    u.referredBy = referrerId;
    const r = this.ensureUser(referrerId);
    r.referrals = (r.referrals || 0) + 1;
    this.data.users[userKey] = u;
    this.data.users[refKey] = r;
    this.save();
  }

  // User settings
  getUserSettings(id: number): UserSettings {
    const u = this.ensureUser(id);
    return (u.settings ||= {});
  }
  setUserSettings(id: number, s: UserSettings) {
    const u = this.ensureUser(id);
    u.settings = { ...(u.settings || {}), ...s };
    this.data.users[String(id)] = u;
    this.save();
  }

  topReferrers(limit = 10): Array<User> {
    const arr = Object.values(this.data.users || {});
    return arr
      .filter(u => (u.referrals || 0) > 0)
      .sort((a, b) => (b.referrals || 0) - (a.referrals || 0))
      .slice(0, limit);
  }

  // Channel dedupe utils and pruning
  pruneChannelTx(ttlMs = 7 * 24 * 60 * 60 * 1000) {
    const now = Date.now();
    for (const [tx, ts] of Object.entries(this.data.channelTxPosted || {})) {
      if (now - (ts as number) > ttlMs) delete this.data.channelTxPosted[tx];
    }
    this.save();
  }
  channelTxStats() {
    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;
    const today = new Date().toISOString().slice(0, 10);
    let total = 0, last1h = 0, todayCount = 0;
    for (const ts of Object.values(this.data.channelTxPosted || {})) {
      const t = ts as number;
      total++;
      if (t >= hourAgo) last1h++;
      if (new Date(t).toISOString().slice(0, 10) === today) todayCount++;
    }
    return { total, last1h, today: todayCount };
  }
}

