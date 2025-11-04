import { Telegraf } from "telegraf";
import { registerStart } from "./commands/start";
import { registerWatch } from "./commands/watch";
import { registerList } from "./commands/list";
import { registerUnwatch } from "./commands/unwatch";
import { registerSettings } from "./commands/settings";
import { registerLeaderboard } from "./commands/leaderboard";
import { registerStats } from "./commands/stats";
import { attachPoller } from "../worker/poller";
import { attachAnnouncer } from "../worker/announcer";

export function createBot(token: string) {
  const bot = new Telegraf(token);

  // Global middleware to log all incoming updates
  bot.use(async (ctx, next) => {
    const text = (ctx.message as any)?.text || "";
    const from = ctx.from?.id || "unknown";
    const chatType = (ctx.chat as any)?.type || "unknown";
    // eslint-disable-next-line no-console
    console.log(`[INCOMING] from=${from} chatType=${chatType} text="${text}"`);
    return next();
  });

  // Set command menu for clients
  bot.telegram.setMyCommands([
    { command: "start", description: "Welcome and quick menu" },
    { command: "watch", description: "Watch a trader: /watch <url|wallet>" },
    { command: "unwatch", description: "Remove a trader: /unwatch <wallet>" },
    { command: "list", description: "Show your watchlist" },
    { command: "settings", description: "View bot settings" },
    { command: "leaderboard", description: "Top referrers" },
    { command: "stats", description: "Bot stats" },
  ]).catch(() => {});

  registerStart(bot);
  registerWatch(bot);
  registerList(bot);
  registerUnwatch(bot);
  registerSettings(bot);
  registerLeaderboard(bot);
  registerStats(bot);
  attachPoller(bot);
  attachAnnouncer(bot);
  return bot;
}

