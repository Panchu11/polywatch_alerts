import "dotenv/config";
import { config, requireEnv } from "./config";
import { createBot } from "./bot/telegram";

// eslint-disable-next-line no-console
console.log("Starting PolyWatch Alerts bot...");

async function main() {
  requireEnv();

  const bot = createBot(config.botToken);

  // Quick token self-check before launching polling
  try {
    const me = await bot.telegram.getMe();
    // eslint-disable-next-line no-console
    console.log(`Token OK. Bot identity: @${me.username} (id: ${me.id})`);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log("getMe() failed before launch:", (e as Error).message);
  }

  // Skip startup test message to avoid rate limits
  // The announcer will handle channel posts with proper rate limiting
  // eslint-disable-next-line no-console
  console.log(`Announcements channel configured: ${config.announcementsChatId}`);

  // Launch bot without awaiting, continue startup
  bot.launch({ dropPendingUpdates: true }).catch((e) => {
    // eslint-disable-next-line no-console
    console.error("Telegraf launch error:", e);
  });

  // Enable graceful stop
  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
  // eslint-disable-next-line no-console
  console.log("PolyWatch Alerts bot is running.");
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Fatal error starting bot:", err);
  process.exit(1);
});

