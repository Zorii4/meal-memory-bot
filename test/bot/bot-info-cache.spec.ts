import { describe, expect, it } from "vitest";
import { createBotInfoCache } from "../../src/bot/bot-info-cache";

describe("bot info cache", () => {
  it("fetches bot information once for repeated updates in the same Worker isolate", async () => {
    let calls = 0;
    const cache = createBotInfoCache(async () => {
      calls += 1;
      return { id: 1, is_bot: true, first_name: "Meal Memory" };
    });

    await Promise.all([cache.get("telegram-token"), cache.get("telegram-token")]);

    expect(calls).toBe(1);
  });

  it("does not cache a failed fetch", async () => {
    let calls = 0;
    const cache = createBotInfoCache(async () => {
      calls += 1;
      if (calls === 1) {
        throw new Error("temporary Telegram failure");
      }

      return { id: 1, is_bot: true, first_name: "Meal Memory" };
    });

    await expect(cache.get("telegram-token")).rejects.toThrow("temporary Telegram failure");
    await expect(cache.get("telegram-token")).resolves.toMatchObject({ id: 1 });
    expect(calls).toBe(2);
  });
});
