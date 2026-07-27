import type { Update } from "grammy/types";
import { describe, expect, it } from "vitest";
import { createBot } from "../../src/bot/create-bot";
import { isAllowedUser } from "../../src/bot/middleware/allowlist";

describe("allowlist", () => {
  it("compares Telegram IDs as strings", () => {
    const allowedUserIds = new Set(["123", "9007199254740993"]);

    expect(isAllowedUser(123, allowedUserIds)).toBe(true);
    expect(isAllowedUser(124, allowedUserIds)).toBe(false);
  });

  it("does not restrict /id", async () => {
    const telegram = new TelegramApiStub();
    const bot = createTestBot(telegram);

    await bot.handleUpdate(createTextUpdate(999, "/id"));

    expect(telegram.sentTexts).toEqual(["Ваш Telegram ID: 999"]);
  });

  it("blocks an unauthorized user before business handlers", async () => {
    const telegram = new TelegramApiStub();
    const bot = createTestBot(telegram);

    await bot.handleUpdate(createTextUpdate(999, "/start"));

    expect(telegram.sentTexts).toEqual(["У вас нет доступа к этому боту."]);
  });

  it("blocks an unauthorized catalog callback before it can change data", async () => {
    const telegram = new TelegramApiStub();
    const bot = createTestBot(telegram);

    await bot.handleUpdate(createCatalogCallbackUpdate(999, "d:dish-1"));

    expect(telegram.sentTexts).toEqual(["У вас нет доступа к этому боту."]);
  });
});

function createTestBot(telegram: TelegramApiStub) {
  return createBot(
    {
      telegram: {
        botToken: "telegram-token",
        webhookSecret: "webhook-secret",
        allowedUserIds: new Set(["123"])
      }
    },
    {
      dishes: {
        findByNormalizedName: async () => null,
        create: async (dish) => ({ kind: "created", dish: { ...dish, isActive: true } }),
        listActiveWithStatistics: async () => [],
        listActiveNames: async () => []
      },
      history: {
        createRecommendation: async (event) => event,
        listRecentCooked: async () => [],
        findRecommendationById: async () => null,
        recordCook: async () => ({ kind: "duplicate" as const })
      },
      ai: { complete: async () => "{}" },
      systemPrompt: "private prompt",
      states: {
        save: async (state) => state,
        findByUserId: async () => null,
        clear: async () => false
      },
      botInfo: {
        id: 1,
        is_bot: true,
        first_name: "Meal Memory Bot",
        username: "meal_memory_bot",
        can_join_groups: true,
        can_read_all_group_messages: false,
        supports_inline_queries: false,
        can_connect_to_business: false,
        has_main_web_app: false,
        has_topics_enabled: false,
        allows_users_to_create_topics: false,
        can_manage_bots: false,
        supports_join_request_queries: false
      },
      client: { fetch: telegram.fetch }
    }
  );
}

function createTextUpdate(userId: number, text: string): Update {
  return {
    update_id: 1,
    message: {
      message_id: 1,
      date: 0,
      chat: { id: userId, type: "private", first_name: "Test" },
      from: { id: userId, is_bot: false, first_name: "Test" },
      text,
      entities: [{ offset: 0, length: text.length, type: "bot_command" }]
    }
  };
}

function createCatalogCallbackUpdate(userId: number, data: string): Update {
  return {
    update_id: 1,
    callback_query: {
      id: "callback-1",
      from: { id: userId, is_bot: false, first_name: "Test" },
      chat_instance: "chat-instance",
      data,
      message: {
        message_id: 1,
        date: 0,
        chat: { id: userId, type: "private", first_name: "Test" }
      }
    }
  };
}

class TelegramApiStub {
  public readonly sentTexts: string[] = [];

  public readonly fetch: typeof fetch = async (input, init): Promise<Response> => {
    const request = new Request(input, init);
    const body = (await request.json()) as { text: string };
    this.sentTexts.push(body.text);

    return Response.json({
      ok: true,
      result: {
        message_id: 2,
        date: 0,
        chat: { id: 123, type: "private" }
      }
    });
  };
}
