import "dotenv/config";
import { config, requireEnv } from "./config";
import { createBot } from "./bot/telegram";

// eslint-disable-next-line no-console
console.log("Starting PolyWatch Alerts bot...");

// Global error handlers to prevent crashes
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit - keep bot running
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit - keep bot running
});

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
    // Try to relaunch after 5 seconds
    setTimeout(() => {
      console.log("Attempting to relaunch bot...");
      bot.launch({ dropPendingUpdates: true }).catch(console.error);
    }, 5000);
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

