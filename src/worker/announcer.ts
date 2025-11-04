import { Telegraf } from "telegraf";
import { config } from "../config";
import { getDb } from "../store/db";
import { fetchTopTrades, Trade } from "../utils/polymarket";
import { sendMessageSafe } from "../utils/tg";

function calcUsd(t: Trade): number {
  return Math.round((t.size || 0) * (t.price || 0));
}

async function summarizeTrade(t: Trade): Promise<string> {
  const usd = calcUsd(t);
  const when = new Date((t.timestamp || 0) * 1000).toISOString();
  const prettify = (s: string) => {
    const x = s.replace(/[-_]+/g, " ").trim();
    return x ? x.charAt(0).toUpperCase() + x.slice(1) : s;
  };
  // Derive title from slug/eventSlug only; do not trust t.title
  const base = t.slug || t.eventSlug || "Market";
  const title = prettify(base);
  const marketUrl = t.slug
    ? `https://polymarket.com/market/${t.slug}`
    : t.eventSlug
    ? `https://polymarket.com/event/${t.eventSlug}`
    : undefined;
  const link = marketUrl ? `\n${marketUrl}` : "";
  const txLink = t.transactionHash ? `\nhttps://polygonscan.com/tx/${t.transactionHash}` : "";
  return `${t.side} ~ $${usd.toLocaleString()} on ${title} at ${when}${link}${txLink}`;
}

function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }

export function attachAnnouncer(bot: Telegraf) {
  const db = getDb();
  let seeded = false;

  async function tick() {
    try {
      const trades = await fetchTopTrades(config.rules.channelAnnounceUsd, 100); // desc by ts
      if (!trades.length) return;

      // First run: seed dedupe so we don't backfill-spam the channel
      if (!seeded) {
        for (const t of trades) {
          const tx = t.transactionHash || undefined;
          if (tx && !db.hasChannelTx(tx)) db.markChannelTx(tx);
        }
        seeded = true;
        return;
      }

      // Process oldest -> newest, relying solely on tx-hash dedupe across modules
      // Rate limit: Telegram allows ~20 msgs/min to channels; we add 3.5s delay between posts
      const toPost: Trade[] = [];
      for (const t of [...trades].reverse()) {
        const tx = t.transactionHash || undefined;
        if (!tx) continue;
        // Atomic reservation to avoid race conditions with other modules/processes
        if (!db.tryReserveChannelTx(tx)) continue;
        toPost.push(t);
      }

      // Post with delay to avoid 429 rate limits
      for (const t of toPost) {
        const usd = calcUsd(t);
        const msg = `High-value trade detected:\n${await summarizeTrade(t)}`;
        await sendMessageSafe(bot, config.announcementsChatId, msg);
        if (toPost.indexOf(t) < toPost.length - 1) {
          await sleep(3500); // 3.5 seconds between posts = ~17 posts/min (safe margin)
        }
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log("Announcer error:", (e as Error).message);
    }
  }

  // Kick and schedule using the same cadence as trade polling to keep it light
  tick().catch(() => {});
  setInterval(tick, config.intervals.tradePollMs);
}

