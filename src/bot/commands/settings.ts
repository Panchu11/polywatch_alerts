import { Telegraf } from "telegraf";
import { config } from "../../config";
import { getDb } from "../../store/db";

export function registerSettings(bot: Telegraf) {
  const handle = async (ctx: any) => {
    // eslint-disable-next-line no-console
    console.log("/settings invoked by", ctx.from?.id, "text=", ctx.message?.text || ctx.update?.message?.text);
    try {
      const db = getDb();
      const r = config.rules;
      const tgId = ctx.from?.id;
      const my = tgId ? db.getUserSettings(tgId) : {};

      const text: string = (ctx.message?.text || ctx.update?.message?.text || "").toString();
      const parts = text.trim().split(/\s+/);

      if (parts.length >= 3 && parts[1].toLowerCase() === "min") {
        const v = Number(parts[2]);
        if (!Number.isFinite(v) || v < 0) {
          return ctx.reply("Please provide a valid USD amount. Example: /settings min 2500");
        }
        if (tgId) db.setUserSettings(tgId, { minDmUsd: Math.round(v) });
        return ctx.reply(`Personal DM min changed to $${Math.round(v).toLocaleString()}.`);
      }

      if (parts.length >= 2 && parts[1].toLowerCase() === "reset") {
        if (tgId) db.setUserSettings(tgId, { minDmUsd: undefined });
        return ctx.reply("Your personal settings have been reset.");
      }

      await ctx.reply(
        `Settings:` +
          `\n- Global min DM alert: $${r.minTradeUsd.toLocaleString()}` +
          `\n- Your min DM alert: $${(my.minDmUsd ?? r.minTradeUsd).toLocaleString()} (set with /settings min <usd>)` +
          `\n- Channel announce threshold: $${r.channelAnnounceUsd.toLocaleString()}` +
          `\n- Stake change: $${r.stakeDelta15mUsd.toLocaleString()} in 15m or $${r.stakeCum30mUsd.toLocaleString()} same-side in 30m` +
          `\n- Wins/Losses summary if >= ${r.winsLossesThreshold} in last ${r.winsLossesLookbackHours}h` +
          `\n\nExamples:\n/settings min 2500\n/settings reset`
      );
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("/settings error:", e);
      await ctx.reply("Error loading settings.").catch(() => {});
    }
  };

  bot.command("settings", handle);
  bot.hears(/^\s*settings\s*$/i, handle);
}
