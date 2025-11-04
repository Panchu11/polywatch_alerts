import { Telegraf } from "telegraf";
import { FileDb } from "../../store/filedb";

export function registerLeaderboard(bot: Telegraf) {
  const handle = async (ctx: any) => {
    // eslint-disable-next-line no-console
    console.log("/leaderboard invoked by", ctx.from?.id, "text=", ctx.message?.text || ctx.update?.message?.text);
    try {
      const db = new FileDb();
      const top = db.topReferrers(10);
      if (!top.length) return ctx.reply("No referrals yet. Share your link from /start and invite friends!");
      const lines = top.map((u, i) => {
        const name = u.username ? `@${u.username}` : `ID:${u.id}`;
        const c = u.referrals || 0;
        return `${i + 1}. ${name} — ${c} referral${c === 1 ? "" : "s"}`;
      });
      await ctx.reply(`Top referrers:\n` + lines.join("\n"));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("/leaderboard error:", e);
      await ctx.reply("Error fetching leaderboard.").catch(() => {});
    }
  };

  bot.command("leaderboard", handle);
  bot.hears(/^\s*leaderboard\s*$/i, handle);
}

