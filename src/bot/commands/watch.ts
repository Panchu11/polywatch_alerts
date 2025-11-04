import { Telegraf } from "telegraf";
import { getDb } from "../../store/db";
import { resolveToAddress } from "../../utils/polymarket";

const POLY_URL = /^https?:\/\/(?:www\.)?polymarket\.com\/profile\/[a-zA-Z0-9_-]+/i;
const WALLET = /^0x[a-fA-F0-9]{40}$/;

function getArg(text?: string): string | null {
  if (!text) return null;
  const parts = text.split(/\s+/);
  if (parts.length < 2) return null;
  return parts.slice(1).join(" ").trim();
}

export function registerWatch(bot: Telegraf) {
  bot.command("watch", async (ctx) => {
    const arg = getArg(ctx.message?.text || "");
    if (!arg) {
      return ctx.reply(
        "Usage: /watch <Polymarket profile URL or 0x wallet>\nExample: /watch https://polymarket.com/profile/vitalik"
      );
    }
    const text = arg.trim();
    if (!(POLY_URL.test(text) || WALLET.test(text))) {
      return ctx.reply("Please provide a valid Polymarket profile URL or wallet address.");
    }
    try {
      const address = await resolveToAddress(text);
      const tgId = ctx.from?.id;
      if (!tgId) return;
      const db = getDb();
      db.addWatcher(tgId, address);
      await ctx.reply(
        `Added ${address} to your watchlist. Min alert threshold is $1,000 by default.\nUse /list to view or /unwatch to remove.`
      );
    } catch (e) {
      await ctx.reply(`Could not resolve that profile: ${(e as Error).message}`);
    }
  });
}

