import { Telegraf } from "telegraf";
import { FileDb } from "../../store/filedb";
import { config } from "../../config";

export function registerStats(bot: Telegraf) {
  const handle = async (ctx: any) => {
    // eslint-disable-next-line no-console
    console.log("/stats invoked by", ctx.from?.id, "text=", ctx.message?.text || ctx.update?.message?.text);
    try {
      const db = new FileDb();

      // Basic aggregates
      const watchersArr = db.listWatchers(ctx.from?.id || 0); // personal
      const allWatchers = (db as any).data?.watchers || (db as any).db?.watchers || [];
      const uniqueAddresses = new Set<string>(allWatchers.map((w: any) => w.address)).size;
      const users = Object.keys((db as any).data?.users || (db as any).db?.users || {}).length;

      // Channel posts stats
      const ch = db.channelTxStats();

      // DM dedupe total entries
      const dmMap = (db as any).data?.dmTxSeen || (db as any).db?.dmTxSeen || {};
      const dmDedupEntries = Object.values(dmMap).reduce((acc: number, m: any) => acc + Object.keys(m || {}).length, 0);

      const lines = [
        `Users: ${users}`,
        `Watching (you): ${watchersArr.length} | Unique addresses (global): ${uniqueAddresses}`,
        `Channel posts: total ${ch.total}, last 1h ${ch.last1h}, today ${ch.today}`,
        `DM dedupe entries: ${dmDedupEntries}`,
        `Poll every: ${(config.intervals.tradePollMs / 1000)}s`
      ];

      await ctx.reply("Bot stats:\n" + lines.join("\n"));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("/stats error:", e);
      await ctx.reply("Error loading stats.").catch(() => {});
    }
  };

  bot.command("stats", handle);
  bot.hears(/^\s*stats\s*$/i, handle);
}
