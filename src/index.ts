import "dotenv/config";
import fs from "fs";
import path from "path";
import { config, requireEnv } from "./config";
import { createBot } from "./bot/telegram";

// eslint-disable-next-line no-console
console.log("Starting PolyWatch Alerts bot...");

async function main() {
  requireEnv();

  // Single-instance lock to avoid multiple bots running with same token
  const dataDir = path.join(process.cwd(), "data");
  try { fs.mkdirSync(dataDir, { recursive: true }); } catch {}
  const lockPath = path.join(dataDir, "instance.lock");
  try {
    const fd = fs.openSync(lockPath, "wx");
    fs.writeFileSync(fd, String(process.pid));
    fs.closeSync(fd);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log("Another bot instance seems to be running (instance.lock exists). Exiting this process.");
    return; // don't proceed
  }

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
  process.once("SIGINT", () => {
    try { fs.unlinkSync(path.join(process.cwd(), "data", "instance.lock")); } catch {}
    bot.stop("SIGINT");
  });
  process.once("SIGTERM", () => {
    try { fs.unlinkSync(path.join(process.cwd(), "data", "instance.lock")); } catch {}
    bot.stop("SIGTERM");
  });
  // eslint-disable-next-line no-console
  console.log("PolyWatch Alerts bot is running.");
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Fatal error starting bot:", err);
  process.exit(1);
});

