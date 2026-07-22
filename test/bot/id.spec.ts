import type { Update } from "grammy/types";
import { describe, expect, it } from "vitest";
import { createBot } from "../../src/bot/create-bot";

describe("/id", () => {
  it("replies with the sender's Telegram ID", async () => {
    const userId = 1_234_567_890;
    const requests: Request[] = [];
    const bot = createBot(
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
          listActiveWithStatistics: async () => []
        },
        history: { createRecommendation: async (event) => event },
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
        client: {
          fetch: async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
            requests.push(new Request(input, init));

            return Response.json({
              ok: true,
              result: {
                message_id: 2,
                date: 0,
                chat: { id: userId, type: "private", first_name: "Test" }
              }
            });
          }
        }
      }
    );

    await bot.handleUpdate(createIdUpdate(userId));

    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toContain("/sendMessage");
    expect(await requests[0]?.json()).toEqual({
      chat_id: userId,
      text: `Ваш Telegram ID: ${userId}`
    });
  });
});

function createIdUpdate(userId: number): Update {
  return {
    update_id: 1,
    message: {
      message_id: 1,
      date: 0,
      chat: { id: userId, type: "private", first_name: "Test" },
      from: { id: userId, is_bot: false, first_name: "Test" },
      text: "/id",
      entities: [{ offset: 0, length: 3, type: "bot_command" }]
    }
  };
}
