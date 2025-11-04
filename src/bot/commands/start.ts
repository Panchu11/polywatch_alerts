import { Telegraf, Context, Markup } from "telegraf";
import { getDb } from "../../store/db";

export function registerStart(bot: Telegraf) {
  bot.start(async (ctx: Context) => {
    const db = getDb();
    const meId = ctx.from?.id;
    const meUsername = ctx.from?.username || undefined;
    if (meId) db.ensureUser(meId, meUsername);

    // Referral deep-link payload if user opened t.me/.../?start=REF_ID
    const referral = (ctx as any).startPayload as string | undefined;
    const refId = referral && /^\d+$/.test(referral) ? Number(referral) : undefined;
    if (meId && refId && meId !== refId) db.setReferral(meId, refId);

    const name = ctx.from?.first_name ?? "there";
    const botUsername = (ctx as any).botInfo?.username || "PolyWatchAlerts_bot";
    const myLink = meId ? `https://t.me/${botUsername}?start=${meId}` : undefined;

    let text = `Welcome, ${name}!\nUse the buttons below or type commands.`;
    if (myLink) text += `\n\nYour invite link: ${myLink}`;

    await ctx.reply(
      text,
      Markup.keyboard([["/watch"], ["/list", "/unwatch"], ["/settings", "/leaderboard"], ["/stats"]]).resize()
    );
  });

  bot.help(async (ctx) => {
    await ctx.reply(
      "Commands:\n/start\n/watch <url|wallet>\n/unwatch <wallet> (or send wallet after /unwatch)\n/list\n/settings (use /settings min <usd> to set personal DM threshold)\n/leaderboard\n/stats",
      Markup.keyboard([["/watch"], ["/list", "/unwatch"], ["/settings", "/leaderboard"], ["/stats"]]).resize()
    );
  });
}

