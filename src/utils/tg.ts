import { Telegraf } from "telegraf";

function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }

export async function sendMessageSafe(bot: Telegraf, chatId: number | string, text: string, extra?: any) {
  try {
    return await bot.telegram.sendMessage(chatId, text, extra);
  } catch (e: any) {
    const msg = String(e?.message || "");
    const m = /retry after\s+(\d+)/i.exec(msg);
    const retrySec = m ? parseInt(m[1], 10) : 0;
    if (retrySec > 0 && retrySec <= 60) {
      // eslint-disable-next-line no-console
      console.log(`429 from Telegram for chat ${chatId}, retrying after ${retrySec}s`);
      await sleep((retrySec + 1) * 1000);
      try {
        return await bot.telegram.sendMessage(chatId, text, extra);
      } catch {
        return undefined;
      }
    }
    return undefined;
  }
}

