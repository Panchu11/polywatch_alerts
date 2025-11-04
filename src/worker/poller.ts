import { Telegraf } from "telegraf";
import { FileDb } from "../store/filedb";
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
  const db = new FileDb();
  const lastSeen: Record<string, { ts: number; tx?: string | null }> = {};

  // Channel announcements are handled exclusively by the global announcer.

  async function handleStakeSignals(address: string, t: Trade) {
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
      for (const w of watchers) await sendMessageSafe(bot, w.tgId, msg);
      stats.lastStakeAlertTs = now;
      db.setStats(address, stats);
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
          for (const w of watchers) {
            const prefs = db.getUserSettings(w.tgId);
            const minUsd = (prefs.minDmUsd ?? config.rules.minTradeUsd) || 0;
            if (usd >= minUsd) {
              await sendMessageSafe(bot, w.tgId, caption);
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
        for (const w of watchers) await sendMessageSafe(bot, w.tgId, msg);
        stats.lastWinsAlertDay = day;
        db.setStats(address, stats);
      }
      if (losses >= config.rules.winsLossesThreshold && stats.lastLossesAlertDay !== day) {
        const msg = `Results update for ${address.slice(0, 6)}…\n` +
          `${losses} losing close(s) in the last ${config.rules.winsLossesLookbackHours}h (realized PnL < 0).`;
        for (const w of watchers) await sendMessageSafe(bot, w.tgId, msg);
        stats.lastLossesAlertDay = day;
        db.setStats(address, stats);
      }
    } catch (e) {
      console.log(`Wins/losses check error for ${address}:`, (e as Error).message);
    }
  }

  async function loopTrades() {
    const addresses = db.uniqueAddresses();
    await Promise.all(addresses.map(checkAddress));
  }
  async function loopWins() {
    const addresses = db.uniqueAddresses();
    await Promise.all(addresses.map(winsCheckAddress));
  }

  // initial kicks and intervals
  loopTrades().catch(() => {});
  setInterval(loopTrades, config.intervals.tradePollMs);

  loopWins().catch(() => {});
  setInterval(loopWins, config.intervals.winsCheckMs);
}

