import { Telegraf } from "telegraf";
import { getDb } from "../store/db";
import { fetchRecentTrades, Trade, fetchClosedPositions } from "../utils/polymarket";
import { config } from "../config";
import { sendMessageSafe } from "../utils/tg";

function calcUsd(t: Trade): number {
  // Best-effort notional estimation; server already filtered by CASH filter
  return Math.round((t.size || 0) * (t.price || 0));
}
function slugToTitle(s?: string): string | undefined {
  if (!s) return undefined;
  const t = s.replace(/[-_]+/g, " ").trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : undefined;
}


async function summarizeTrade(t: Trade): Promise<string> {
  const usd = calcUsd(t);
  const when = new Date((t.timestamp || 0) * 1000).toISOString();
  // Do not trust t.title (can be stale/incorrect); derive from slug
  const title = slugToTitle(t.slug) || slugToTitle(t.eventSlug) || "Market";
  const marketUrl = t.slug
    ? `https://polymarket.com/market/${t.slug}`
    : t.eventSlug
    ? `https://polymarket.com/event/${t.eventSlug}`
    : undefined;
  const link = marketUrl ? `\n${marketUrl}` : "";
  const txLink = t.transactionHash ? `\nhttps://polygonscan.com/tx/${t.transactionHash}` : "";
  return `${t.side} ~ $${usd.toLocaleString()} on ${title} at ${when}${link}${txLink}`;
}

export function attachPoller(bot: Telegraf) {
  const db = getDb();
  const lastSeen: Record<string, { ts: number; tx?: string | null }> = {};

  // Channel announcements are handled exclusively by the global announcer.

  async function handleStakeSignals(address: string, t: Trade) {
    try {
      const tsMs = (t.timestamp || 0) * 1000;
      const usd = calcUsd(t);
      db.pushStake(address, tsMs, usd, t.side);
      // prune to last 30m
      const cutoff30 = tsMs - 30 * 60 * 1000;
      db.pruneStake(address, cutoff30);
      const window = db.getStake(address);
      const sum15 = window.filter(x => x.ts >= tsMs - 15 * 60 * 1000).reduce((a, b) => a + b.usd, 0);
      const sum30Buy = window.filter(x => x.ts >= tsMs - 30 * 60 * 1000 && x.side === "BUY").reduce((a, b) => a + b.usd, 0);
      const sum30Sell = window.filter(x => x.ts >= tsMs - 30 * 60 * 1000 && x.side === "SELL").reduce((a, b) => a + b.usd, 0);
      const cum30 = Math.max(sum30Buy, sum30Sell);

      const stats = db.getStats(address);
      const now = Date.now();
      const shouldAlert = sum15 >= config.rules.stakeDelta15mUsd || cum30 >= config.rules.stakeCum30mUsd;
      if (shouldAlert && (!stats.lastStakeAlertTs || now - stats.lastStakeAlertTs > 15 * 60 * 1000)) {
        const watchers = db.watchersFor(address);
        const msg = `Staking behavior change detected for ${address.slice(0, 6)}…\n` +
          `Last 15m flow: $${Math.round(sum15).toLocaleString()} | Max same-side 30m: $${Math.round(cum30).toLocaleString()}\n` +
          `Latest trade:\n${await summarizeTrade(t)}`;

        // Send with rate limiting
        for (let i = 0; i < watchers.length; i++) {
          try {
            await sendMessageSafe(bot, watchers[i].tgId, msg);
            if (i < watchers.length - 1 && watchers.length > 10) {
              await new Promise(res => setTimeout(res, 50));
            }
          } catch (err) {
            console.log(`Failed to send stake alert to user ${watchers[i].tgId}:`, (err as Error).message);
          }
        }

        stats.lastStakeAlertTs = now;
        db.setStats(address, stats);
      }
    } catch (e) {
      console.log(`Stake signal error for ${address}:`, (e as Error).message);
    }
  }

  async function checkAddress(address: string) {
    try {
      const cursor = db.getCursor(address);
      if (cursor) lastSeen[address] = { ts: cursor.lastTs, tx: cursor.lastTx };
      const trades = await fetchRecentTrades(address, config.rules.minTradeUsd, 100);
      const newestFirst = trades; // desc by timestamp

      // If first time seeing this address, seed cursor to newest trade to avoid backfill spam
      if (!lastSeen[address] && newestFirst.length) {
        const newest = newestFirst[0];
        db.setCursor(address, { lastTs: newest.timestamp || 0, lastTx: newest.transactionHash });
        lastSeen[address] = { ts: newest.timestamp || 0, tx: newest.transactionHash };
        return;
      }

      let maxTs = lastSeen[address]?.ts ?? 0;
      let maxTx = lastSeen[address]?.tx ?? null;
      // Process from oldest to newest to maintain order
      for (const t of [...newestFirst].reverse()) {
        const ts = t.timestamp || 0;
        const tx = t.transactionHash || undefined;
        // Newness: prefer explicit tx-based dedupe; fallback to timestamp edge
        const txNew = !!tx && !db.hasDmTx(address, tx);
        const tsNew = ts > (lastSeen[address]?.ts ?? 0);
        if (txNew || tsNew) {
          const watchers = db.watchersFor(address);
          const caption = `Trader ${address.slice(0, 6)}… placed a trade:\n${await summarizeTrade(t)}`;
          const usd = calcUsd(t);

          // Send messages with rate limiting to prevent crashes
          for (let i = 0; i < watchers.length; i++) {
            const w = watchers[i];
            try {
              const prefs = db.getUserSettings(w.tgId);
              const minUsd = (prefs.minDmUsd ?? config.rules.minTradeUsd) || 0;
              if (usd >= minUsd) {
                await sendMessageSafe(bot, w.tgId, caption);
                // Add small delay between messages to prevent rate limits
                if (i < watchers.length - 1 && watchers.length > 10) {
                  await new Promise(res => setTimeout(res, 50)); // 50ms delay for large batches
                }
              }
            } catch (err) {
              // eslint-disable-next-line no-console
              console.log(`Failed to send DM to user ${w.tgId}:`, (err as Error).message);
              // Continue with other users even if one fails
            }
          }

          if (tx) db.markDmTx(address, tx);
          // stake signals only; channel announcements are posted by announcer
          await handleStakeSignals(address, t);

          if (ts >= maxTs) {
            maxTs = ts;
            maxTx = tx ?? maxTx;
          }
        }
      }
      if (maxTs) {
        db.setCursor(address, { lastTs: maxTs, lastTx: maxTx });
        lastSeen[address] = { ts: maxTs, tx: maxTx };
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log(`Poll error for ${address}:`, (e as Error).message);
    }
  }

  function toMs(v: any): number {
    if (!v && v !== 0) return 0;
    if (typeof v === "number") return v > 1e12 ? v : v * 1000;
    const d = new Date(v);
    const t = d.getTime();
    return Number.isFinite(t) ? t : 0;
  }

  async function winsCheckAddress(address: string) {
    try {
      const lookbackMs = config.rules.winsLossesLookbackHours * 60 * 60 * 1000;
      const now = Date.now();
      const since = now - lookbackMs;
      const closed = await fetchClosedPositions(address, 200);
      let wins = 0, losses = 0;
      for (const p of closed) {
        const ts = toMs((p as any).closedAt || (p as any).updatedAt || 0);
        if (ts && ts >= since) {
          if ((p.realizedPnl || 0) > 0) wins++;
          else if ((p.realizedPnl || 0) < 0) losses++;
        }
      }
      const stats = db.getStats(address);
      const day = new Date().toISOString().slice(0, 10);
      const watchers = db.watchersFor(address);

      if (wins >= config.rules.winsLossesThreshold && stats.lastWinsAlertDay !== day) {
        const msg = `Results update for ${address.slice(0, 6)}…\n` +
          `${wins} winning close(s) in the last ${config.rules.winsLossesLookbackHours}h (realized PnL > 0).`;
        for (let i = 0; i < watchers.length; i++) {
          try {
            await sendMessageSafe(bot, watchers[i].tgId, msg);
            if (i < watchers.length - 1 && watchers.length > 10) {
              await new Promise(res => setTimeout(res, 50));
            }
          } catch (err) {
            console.log(`Failed to send wins alert to user ${watchers[i].tgId}:`, (err as Error).message);
          }
        }
        stats.lastWinsAlertDay = day;
        db.setStats(address, stats);
      }

      if (losses >= config.rules.winsLossesThreshold && stats.lastLossesAlertDay !== day) {
        const msg = `Results update for ${address.slice(0, 6)}…\n` +
          `${losses} losing close(s) in the last ${config.rules.winsLossesLookbackHours}h (realized PnL < 0).`;
        for (let i = 0; i < watchers.length; i++) {
          try {
            await sendMessageSafe(bot, watchers[i].tgId, msg);
            if (i < watchers.length - 1 && watchers.length > 10) {
              await new Promise(res => setTimeout(res, 50));
            }
          } catch (err) {
            console.log(`Failed to send losses alert to user ${watchers[i].tgId}:`, (err as Error).message);
          }
        }
        stats.lastLossesAlertDay = day;
        db.setStats(address, stats);
      }
    } catch (e) {
      console.log(`Wins/losses check error for ${address}:`, (e as Error).message);
    }
  }

  // Process addresses in batches to prevent overwhelming the system
  async function processBatch<T>(items: T[], batchSize: number, processor: (item: T) => Promise<void>) {
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      await Promise.all(batch.map(item => processor(item).catch(err => {
        console.log(`Batch processor error:`, (err as Error).message);
      })));
      // Small delay between batches to prevent rate limits
      if (i + batchSize < items.length) {
        await new Promise(res => setTimeout(res, 100));
      }
    }
  }

  async function loopTrades() {
    try {
      const addresses = db.uniqueAddresses();
      // Process in batches of 10 to prevent overwhelming the system
      await processBatch(addresses, 10, checkAddress);
    } catch (e) {
      console.log(`Trade loop error:`, (e as Error).message);
    }
  }

  async function loopWins() {
    try {
      const addresses = db.uniqueAddresses();
      // Process in batches of 5 for wins/losses (slower API)
      await processBatch(addresses, 5, winsCheckAddress);
    } catch (e) {
      console.log(`Wins loop error:`, (e as Error).message);
    }
  }

  // initial kicks and intervals
  loopTrades().catch((e) => console.log('Initial trade loop error:', e.message));
  setInterval(loopTrades, config.intervals.tradePollMs);

  loopWins().catch((e) => console.log('Initial wins loop error:', e.message));
  setInterval(loopWins, config.intervals.winsCheckMs);
}

