export const config = {
  botToken: process.env.TELEGRAM_BOT_TOKEN || "",
  announcementsChatId: process.env.TELEGRAM_ANNOUNCEMENTS_CHAT_ID || "@PolyWatchAlerts",
  branding: {
    name: "PolyWatch Alerts",
    palette: {
      primary: "#2E5CFF",
      dark: "#0B0C0E",
      green: "#16A34A",
      red: "#DC2626",
      gray: "#6B7280"
    }
  },
  rules: {
    minTradeUsd: Number(process.env.MIN_TRADE_USD || 1000),
    channelAnnounceUsd: Number(process.env.CHANNEL_ANNOUNCE_USD || 10000), // $10k threshold for channel announcements
    stakeDelta15mUsd: Number(process.env.STAKE_DELTA_15M_USD || 2500),
    stakeCum30mUsd: Number(process.env.STAKE_CUM_30M_USD || 5000),
    winsLossesThreshold: Number(process.env.WINS_LOSSES_THRESHOLD || 3),
    winsLossesLookbackHours: Number(process.env.WINS_LOSSES_LOOKBACK_HOURS || 24),
    imageMinUsd: Number(process.env.IMAGE_MIN_USD || 10000),
  },
  flags: {
    useImageCards: process.env.IMAGE_CARDS !== "0",
  },
  intervals: {
    tradePollMs: Number(process.env.TRADE_POLL_MS || 15_000),
    winsCheckMs: Number(process.env.WINS_CHECK_MS || 5 * 60_000),
  }
};

export function requireEnv(): void {
  if (!config.botToken) {
    throw new Error("TELEGRAM_BOT_TOKEN is not set. Add it to your .env file.");
  }
}
