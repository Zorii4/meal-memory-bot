import { Bot } from "grammy";
import type { UserFromGetMe } from "grammy/types";

export interface BotInfoCache {
  get(token: string): Promise<UserFromGetMe>;
}

export function createBotInfoCache(
  fetchBotInfo: (token: string) => Promise<UserFromGetMe> = fetchBotInfoFromTelegram
): BotInfoCache {
  const entries = new Map<string, Promise<UserFromGetMe>>();

  return {
    async get(token: string): Promise<UserFromGetMe> {
      const cached = entries.get(token);

      if (cached !== undefined) {
        return cached;
      }

      const pending = fetchBotInfo(token).catch((error: unknown) => {
        entries.delete(token);
        throw error;
      });
      entries.set(token, pending);
      return pending;
    }
  };
}

const workerBotInfoCache = createBotInfoCache();

export function getCachedBotInfo(token: string): Promise<UserFromGetMe> {
  return workerBotInfoCache.get(token);
}

async function fetchBotInfoFromTelegram(token: string): Promise<UserFromGetMe> {
  const bot = new Bot(token);
  await bot.init();
  return bot.botInfo;
}
