import { Telegraf } from "telegraf";
import { FileDb } from "../../store/filedb";

export function registerList(bot: Telegraf) {
  bot.command("list", async (ctx) => {
    const db = new FileDb();
    const tgId = ctx.from?.id;
    if (!tgId) return;
    const items = db.listWatchers(tgId);
    if (!items.length) return ctx.reply("Your watchlist is empty. Send /watch to add a trader.");
    const lines = items.map((w, i) => `${i + 1}. ${w.address}`);
    await ctx.reply(`You are watching ${items.length} trader(s):\n` + lines.join("\n"));
  });
}

