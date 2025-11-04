import { Telegraf } from "telegraf";
import { getDb } from "../../store/db";

const WALLET = /^0x[a-fA-F0-9]{40}$/;

function getArg(text?: string): string | null {
  if (!text) return null;
  const parts = text.split(/\s+/);
  if (parts.length < 2) return null;
  return parts.slice(1).join(" ").trim();
}

// Lightweight interactive flow: if user sends /unwatch without arg, ask for the wallet and
// accept the next wallet-shaped message from that user within a short time window.
const pendingUnwatch = new Map<number, number>(); // tgId -> expiresTs
const PENDING_TTL_MS = 2 * 60 * 1000;

export function registerUnwatch(bot: Telegraf) {
  bot.command("unwatch", async (ctx) => {
    const tgId = ctx.from?.id;
    if (!tgId) return;
    const arg = getArg(ctx.message?.text || "");

    if (arg && WALLET.test(arg)) {
      const normalized = arg.toLowerCase();
      // eslint-disable-next-line no-console
      console.log(`/unwatch command: tgId=${tgId} arg="${arg}" normalized="${normalized}"`);
      const db = getDb();
      db.removeWatcher(tgId, normalized);
      return ctx.reply("✅ Removed from your watchlist.\nSend /list to verify.");
    }

    // No valid arg — switch to interactive mode
    const until = Date.now() + PENDING_TTL_MS;
    pendingUnwatch.set(tgId, until);
    return ctx.reply("Send the 0x wallet address to remove (valid for 2 minutes).\nExample: 0x9e29f8f3c63401ccc6f0ec03050494756d8157c4");
  });

  bot.on("text", async (ctx, next) => {
    const tgId = ctx.from?.id;
    const text = ctx.message?.text || "";
    if (!tgId || !text) return next && next();

    // Ignore commands and non-pending users
    if (text.startsWith("/")) return next && next();
    const exp = pendingUnwatch.get(tgId);
    if (!exp || Date.now() > exp) return next && next();

    if (!WALLET.test(text.trim())) {
      return next && next(); // not a wallet, let other handlers process it
    }

    const normalized = text.trim().toLowerCase();
    // eslint-disable-next-line no-console
    console.log(`/unwatch interactive: tgId=${tgId} text="${text}" normalized="${normalized}"`);
    const db = getDb();
    db.removeWatcher(tgId, normalized);
    pendingUnwatch.delete(tgId);
    await ctx.reply("✅ Removed from your watchlist.\nSend /list to verify.");
  });
}

