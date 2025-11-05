import { Telegraf, Context, Markup } from "telegraf";
import { getDb } from "../../store/db";
import { config } from "../../config";

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

    let text = `Welcome, ${name}! 🎉\n\nTrack Polymarket traders and get real-time alerts.\n\nUse the buttons below or type commands.`;
    if (myLink) text += `\n\n📢 Your invite link: ${myLink}`;

    // Get channel URL from config (remove @ if present)
    const channelUsername = config.announcementsChatId.replace('@', '');
    const channelUrl = `https://t.me/${channelUsername}`;

    await ctx.reply(
      text,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "📢 Join Announcements Channel", url: channelUrl }]
          ],
          resize_keyboard: true
        }
      }
    );

    // Send keyboard with commands separately
    await ctx.reply(
      "Quick commands:",
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

