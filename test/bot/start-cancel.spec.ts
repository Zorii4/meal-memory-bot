import type { Update } from "grammy/types";
import { describe, expect, it, vi } from "vitest";
import type { DishRepository } from "../../src/application/add-dish";
import type {
  AIAssistedRecommendationDishRepository,
  AIRecommendationClient
} from "../../src/application/get-ai-assisted-recommendation";
import type { RecommendationDishRepository } from "../../src/application/get-fallback-recommendation";
import { createBot } from "../../src/bot/create-bot";
import { handleStartCommand } from "../../src/bot/handlers/start";
import { userGuideMessage } from "../../src/bot/user-guide";
import type { ConversationState } from "../../src/domain/conversation-state";
import type { UserGuideMessage, UserGuideRepository } from "../../src/application/user-guide-repository";
import type { Dish, NewDish } from "../../src/domain/dish";
import type { DishStatistics } from "../../src/domain/dish";
import type { CookEvent, RecentCookedDish, RecommendationEvent } from "../../src/domain/history";

describe("/start", () => {
  it("shows the persistent main keyboard and pins the user guide", async () => {
    const telegram = new TelegramApiStub();
    const states = new StateRepositoryStub();
    const bot = createTestBot(telegram, states);

    await bot.handleUpdate(createCommandUpdate(123, "/start"));

    expect(telegram.sentMessages).toEqual([
      {
        chat_id: 123,
        text: userGuideMessage,
        reply_markup: {
          keyboard: [
            [{ text: "➕ Добавить блюдо в базу" }],
            [{ text: "🍽 Посоветовать что приготовить" }],
            [{ text: "📚 Посмотреть все мои блюда" }]
          ],
          resize_keyboard: true,
          is_persistent: true
        }
      },
      { chat_id: 123, message_id: 2, disable_notification: true }
    ]);
    expect(states.clearedUserIds).toEqual(["123"]);
  });

  it("still shows the guide when Telegram cannot pin it", async () => {
    const telegram = new TelegramApiStub(true);
    const bot = createTestBot(telegram, new StateRepositoryStub());
    const logError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await bot.handleUpdate(createCommandUpdate(123, "/start"));

    const loggedErrors = logError.mock.calls;
    logError.mockRestore();

    expect(telegram.sentMessages[0]).toEqual(
      expect.objectContaining({ chat_id: 123, text: userGuideMessage })
    );
    expect(loggedErrors).toEqual([
      [expect.stringContaining('"event":"telegram_user_guide_pin_failed"')]
    ]);
  });

  it("reuses the stored guide message on repeated /start", async () => {
    const pinned: Array<{ chatId: string; messageId: number }> = [];
    const states = new StateRepositoryStub();
    const userGuides: UserGuideRepository = {
      findByUserId: async () => ({ telegramUserId: "123", chatId: "123", messageId: 7 }),
      save: async () => undefined
    };

    await handleStartCommand(
      {
        from: { id: 123 },
        reply: async () => {
          throw new Error("a duplicate guide must not be sent");
        },
        api: {
          pinChatMessage: async (chatId, messageId) => {
            pinned.push({ chatId: String(chatId), messageId });
            return true;
          }
        }
      } as never,
      { states, userGuides }
    );

    expect(states.clearedUserIds).toEqual(["123"]);
    expect(pinned).toEqual([{ chatId: "123", messageId: 7 }]);
  });

  it("replaces a stored guide message that is no longer available", async () => {
    const states = new StateRepositoryStub();
    const saved: UserGuideMessage[] = [];
    let pinCalls = 0;
    const logError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await handleStartCommand(
      {
        from: { id: 123 },
        reply: async () => ({ chat: { id: 123 }, message_id: 8 }),
        api: {
          pinChatMessage: async () => {
            pinCalls += 1;
            if (pinCalls === 1) {
              throw new Error("message to pin not found");
            }
            return true;
          }
        }
      } as never,
      {
        states,
        userGuides: {
          findByUserId: async () => ({ telegramUserId: "123", chatId: "123", messageId: 7 }),
          save: async (message) => {
            saved.push(message);
          }
        }
      }
    );

    logError.mockRestore();
    expect(saved).toEqual([{ telegramUserId: "123", chatId: "123", messageId: 8 }]);
    expect(pinCalls).toBe(2);
  });
});

describe("/cancel", () => {
  it("clears only the sender's conversation state", async () => {
    const telegram = new TelegramApiStub();
    const states = new StateRepositoryStub();
    const bot = createTestBot(telegram, states);

    await bot.handleUpdate(createCommandUpdate(123, "/cancel"));

    expect(states.clearedUserIds).toEqual(["123"]);
    expect(telegram.sentMessages).toEqual([
      { chat_id: 123, text: "Текущий ввод отменён." }
    ]);
  });
});

describe("add dish button", () => {
  it("starts a 5-minute awaiting_dish state", async () => {
    const telegram = new TelegramApiStub();
    const states = new StateRepositoryStub();
    const bot = createTestBot(telegram, states, () => new Date("2026-07-21T12:00:00.000Z"));

    await bot.handleUpdate(createTextUpdate(123, "➕ Добавить блюдо в базу"));

    expect(states.savedStates).toEqual([
      {
        telegramUserId: "123",
        state: "awaiting_dish",
        expiresAt: "2026-07-21T12:05:00.000Z",
        updatedAt: "2026-07-21T12:00:00.000Z"
      }
    ]);
    expect(telegram.sentMessages).toEqual([
      {
        chat_id: 123,
        text:
          "Пришлите блюдо одним сообщением: первая строка — название, остальные — ингредиенты или комментарий (необязательно). Для отмены используйте /cancel."
      }
    ]);
  });
});

describe("dish catalog button", () => {
  it("shows the first catalog page and navigation", async () => {
    const telegram = new TelegramApiStub();
    const dishes = new DishRepositoryStub(
      Array.from({ length: 9 }, (_, index) =>
        dishStatistics({ id: `dish-${index + 1}`, name: `Блюдо ${index + 1}` })
      )
    );
    const bot = createTestBot(telegram, new StateRepositoryStub(), undefined, dishes);

    await bot.handleUpdate(createTextUpdate(123, "📚 Посмотреть все мои блюда"));

    expect(telegram.sentMessages).toEqual([
      {
        chat_id: 123,
        text:
          "📚 Мои блюда — страница 1\n\n1. Блюдо 1\n2. Блюдо 2\n3. Блюдо 3\n4. Блюдо 4\n5. Блюдо 5\n6. Блюдо 6\n7. Блюдо 7\n8. Блюдо 8",
        reply_markup: {
          inline_keyboard: catalogKeyboard(["dish-1", "dish-2", "dish-3", "dish-4", "dish-5", "dish-6", "dish-7", "dish-8"], [
            { text: "▶️", callback_data: "p:1" }
          ])
        }
      }
    ]);
  });

  it("answers the page callback and sends the requested page", async () => {
    const telegram = new TelegramApiStub();
    const dishes = new DishRepositoryStub(
      Array.from({ length: 9 }, (_, index) =>
        dishStatistics({ id: `dish-${index + 1}`, name: `Блюдо ${index + 1}` })
      )
    );
    const bot = createTestBot(telegram, new StateRepositoryStub(), undefined, dishes);

    await bot.handleUpdate(createCallbackUpdate(123, "p:1"));

    expect(telegram.sentMessages).toEqual([
      { callback_query_id: "callback-1", text: "Обновляю каталог…" },
      {
        chat_id: 123,
        message_id: 1,
        text: "📚 Мои блюда — страница 2\n\n1. Блюдо 9",
        reply_markup: {
          inline_keyboard: catalogKeyboard(["dish-9"], [{ text: "◀️", callback_data: "p:0" }], 1)
        }
      }
    ]);
  });

  it("records cooking for the selected catalog dish", async () => {
    const telegram = new TelegramApiStub();
    const history = new HistoryRepositoryStub();
    const bot = createTestBot(
      telegram,
      new StateRepositoryStub(),
      () => new Date("2026-07-27T12:00:00.000Z"),
      new DishRepositoryStub([dishStatistics({ id: "dish-1" })]),
      () => "cook-1",
      history
    );

    await bot.handleUpdate(createCallbackUpdate(123, "m:dish-1"));

    expect(history.cookEvents).toEqual([
      {
        id: "cook-1",
        dishId: "dish-1",
        cookedByUserId: "123",
        cookedAt: "2026-07-27T12:00:00.000Z",
        telegramCallbackQueryId: "callback-1"
      }
    ]);
    expect(telegram.sentMessages).toEqual([
      { callback_query_id: "callback-1", text: "Отметил приготовление." },
      catalogEditPayload(["dish-1"], ["Омлет"])
    ]);
  });

  it("creates a similar recommendation for the selected catalog dish", async () => {
    const telegram = new TelegramApiStub();
    const history = new HistoryRepositoryStub();
    const bot = createTestBot(
      telegram,
      new StateRepositoryStub(),
      () => new Date("2026-07-27T12:00:00.000Z"),
      new DishRepositoryStub([dishStatistics({ id: "dish-1", name: "Омлет" })]),
      () => "recommendation-1",
      history,
      new AIClientStub(
        JSON.stringify({
          selectedDishId: "dish-1",
          selectionReason: "Не показывается.",
          newIdea: {
            name: "Суп с чечевицей",
            similarToDishIds: ["dish-1"],
            whyItFits: "Похожий простой вариант.",
            ingredients: ["чечевица", "лук"],
            prepMinutes: 30,
            nutritionFocus: ["protein"]
          },
          warnings: []
        })
      )
    );

    await bot.handleUpdate(createCallbackUpdate(123, "r:dish-1"));

    expect(history.recommendations).toMatchObject([{ primaryDishId: "dish-1", purpose: "similar" }]);
    expect(telegram.sentMessages).toEqual([
      { callback_query_id: "callback-1" },
      {
        chat_id: 123,
        text: "⏳ Ищу похожее блюдо…"
      },
      {
        chat_id: 123,
        message_id: 2,
        text: "✨ Похожее блюдо: Суп с чечевицей\n\nПохожий простой вариант.",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Приготовили новинку", callback_data: "n:recommendation-1" },
              { text: "💾 Сохранить новинку", callback_data: "s:recommendation-1" }
            ]
          ]
        }
      }
    ]);
  });

  it("does not duplicate cooking when Telegram repeats the callback", async () => {
    const telegram = new TelegramApiStub();
    const history = new HistoryRepositoryStub();
    const bot = createTestBot(
      telegram,
      new StateRepositoryStub(),
      () => new Date("2026-07-27T12:00:00.000Z"),
      new DishRepositoryStub([dishStatistics({ id: "dish-1" })]),
      () => "cook-1",
      history
    );

    await bot.handleUpdate(createCallbackUpdate(123, "m:dish-1"));
    await bot.handleUpdate(createCallbackUpdate(123, "m:dish-1"));

    expect(history.cookEvents).toHaveLength(1);
    expect(telegram.sentMessages).toEqual([
      { callback_query_id: "callback-1", text: "Отметил приготовление." },
      catalogEditPayload(["dish-1"], ["Омлет"]),
      { callback_query_id: "callback-1", text: "Приготовление уже отмечено." },
      catalogEditPayload(["dish-1"], ["Омлет"])
    ]);
  });

  it("asks for confirmation before deleting a catalog dish", async () => {
    const telegram = new TelegramApiStub();
    const bot = createTestBot(
      telegram,
      new StateRepositoryStub(),
      undefined,
      new DishRepositoryStub([dishStatistics({ id: "dish-1", name: "Омлет" })])
    );

    await bot.handleUpdate(createCallbackUpdate(123, "d:dish-1"));

    expect(telegram.sentMessages).toEqual([
      { callback_query_id: "callback-1", text: "Открываю подтверждение…" },
      {
        chat_id: 123,
        message_id: 1,
        text:
          "Удалить блюдо «Омлет» навсегда? Вместе с ним будут удалены связанные отметки приготовления и рекомендации.",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "🗑 Удалить навсегда", callback_data: "x:dish-1:0" },
              { text: "Отмена", callback_data: "k:dish-1:0" }
            ]
          ]
        }
      }
    ]);
  });

  it("deletes a catalog dish only after explicit confirmation", async () => {
    const telegram = new TelegramApiStub();
    const dishes = new DishRepositoryStub([dishStatistics({ id: "dish-1", name: "Омлет" })]);
    const bot = createTestBot(telegram, new StateRepositoryStub(), undefined, dishes);

    await bot.handleUpdate(createCallbackUpdate(123, "x:dish-1"));

    expect(await dishes.findActiveCatalogDishById("dish-1")).toBeNull();
    expect(telegram.sentMessages).toEqual([
      {
        callback_query_id: "callback-1",
        text: "Блюдо и связанные с ним записи истории удалены."
      },
      catalogEditPayload([], [])
    ]);
  });

  it("does not delete a catalog dish when deletion is cancelled", async () => {
    const telegram = new TelegramApiStub();
    const dishes = new DishRepositoryStub([dishStatistics({ id: "dish-1", name: "Омлет" })]);
    const bot = createTestBot(telegram, new StateRepositoryStub(), undefined, dishes);

    await bot.handleUpdate(createCallbackUpdate(123, "k:dish-1"));

    expect(await dishes.findActiveCatalogDishById("dish-1")).toEqual({ id: "dish-1", name: "Омлет" });
    expect(telegram.sentMessages).toEqual([
      { callback_query_id: "callback-1", text: "Удаление отменено." },
      catalogEditPayload(["dish-1"], ["Омлет"])
    ]);
  });

  it("returns to the previous catalog page when deletion empties the last page", async () => {
    const telegram = new TelegramApiStub();
    const statistics = Array.from({ length: 9 }, (_, index) =>
      dishStatistics({
        id: `dish-${index + 1}`,
        name: `Блюдо ${String(index + 1).padStart(2, "0")}`
      })
    );
    const bot = createTestBot(
      telegram,
      new StateRepositoryStub(),
      undefined,
      new DishRepositoryStub(statistics)
    );

    await bot.handleUpdate(createCallbackUpdate(123, "x:dish-9:1"));

    expect(telegram.sentMessages.at(-1)).toEqual(
      catalogEditPayload(
        statistics.slice(0, 8).map((dish) => dish.id),
        statistics.slice(0, 8).map((dish) => dish.name)
      )
    );
  });
});

describe("recommend dish button", () => {
  it("clears an unfinished dish input before changing sections", async () => {
    const telegram = new TelegramApiStub();
    const states = new StateRepositoryStub({
      telegramUserId: "123",
      state: "awaiting_dish",
      expiresAt: "2026-07-21T12:05:00.000Z",
      updatedAt: "2026-07-21T12:00:00.000Z"
    });
    const bot = createTestBot(telegram, states);

    await bot.handleUpdate(createTextUpdate(123, "🍽 Посоветовать что приготовить"));

    expect(states.clearedUserIds).toEqual(["123"]);
  });
  it("explains how to proceed when the catalog is empty", async () => {
    const telegram = new TelegramApiStub();
    const bot = createTestBot(telegram, new StateRepositoryStub());

    await bot.handleUpdate(createTextUpdate(123, "🍽 Посоветовать что приготовить"));

    expect(telegram.sentMessages).toEqual([
      {
        chat_id: 123,
        text: "⏳ Подбираю вариант…"
      },
      {
        chat_id: 123,
        message_id: 2,
        text: "В списке пока нет блюд. Сначала добавьте несколько знакомых вариантов."
      }
    ]);
  });

  it("sends a fallback recommendation and records it", async () => {
    const telegram = new TelegramApiStub();
    const dishes = new DishRepositoryStub([
      dishStatistics({ id: "dish-1", name: "Омлет" })
    ]);
    const history = new HistoryRepositoryStub();
    const bot = createTestBot(
      telegram,
      new StateRepositoryStub(),
      () => new Date("2026-07-21T12:00:00.000Z"),
      dishes,
      () => "recommendation-1",
      history
    );

    await bot.handleUpdate(createTextUpdate(123, "🍽 Посоветовать что приготовить"));

    expect(telegram.sentMessages).toEqual([
      {
        chat_id: 123,
        text: "⏳ Подбираю вариант…"
      },
      {
        chat_id: 123,
        message_id: 2,
        text: "🍽 Сегодня предлагаю приготовить: Омлет",
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ Приготовили основное", callback_data: "c:recommendation-1" }],
            [{ text: "🔄 Хочу другой совет", callback_data: "a:recommendation-1" }]
          ]
        }
      }
    ]);
    expect(history.recommendations).toEqual([
      {
        id: "recommendation-1",
        primaryDishId: "dish-1",
        purpose: "daily",
        newIdeaJson: null,
        requestedByUserId: "123",
        createdAt: "2026-07-21T12:00:00.000Z"
      }
    ]);
  });

  it("shows the AI selection reason when the response is valid", async () => {
    const telegram = new TelegramApiStub();
    const bot = createTestBot(
      telegram,
      new StateRepositoryStub(),
      () => new Date("2026-07-21T12:00:00.000Z"),
      new DishRepositoryStub([dishStatistics({ id: "dish-1", name: "Омлет" })]),
      () => "recommendation-1",
      new HistoryRepositoryStub(),
      new AIClientStub(
        JSON.stringify({
          selectedDishId: "dish-1",
          selectionReason: "Это простой вариант на сегодня.",
          newIdea: null,
          warnings: []
        })
      )
    );

    await bot.handleUpdate(createTextUpdate(123, "🍽 Посоветовать что приготовить"));

    expect(telegram.sentMessages).toContainEqual(
      expect.objectContaining({
        text: "🍽 Сегодня предлагаю приготовить: Омлет\n\nЭто простой вариант на сегодня."
      })
    );
  });

  it("shows a valid AI new idea with its two actions", async () => {
    const telegram = new TelegramApiStub();
    const bot = createTestBot(
      telegram,
      new StateRepositoryStub(),
      () => new Date("2026-07-21T12:00:00.000Z"),
      new DishRepositoryStub([dishStatistics({ id: "dish-1", name: "Омлет" })]),
      () => "recommendation-1",
      new HistoryRepositoryStub(),
      new AIClientStub(
        JSON.stringify({
          selectedDishId: "dish-1",
          selectionReason: "Это простой вариант на сегодня.",
          newIdea: {
            name: "Суп с чечевицей",
            similarToDishIds: ["dish-1"],
            whyItFits: "Похожий простой вариант.",
            ingredients: ["чечевица", "лук"],
            prepMinutes: 30,
            nutritionFocus: ["protein", "fiber"]
          },
          warnings: []
        })
      )
    );

    await bot.handleUpdate(createTextUpdate(123, "🍽 Посоветовать что приготовить"));

    expect(telegram.sentMessages).toContainEqual({
      chat_id: 123,
      message_id: 2,
      text:
        "🍽 Сегодня предлагаю приготовить: Омлет\n\nЭто простой вариант на сегодня.\n\n✨ Похожее от ИИ: Суп с чечевицей\nПохожий простой вариант.",
      reply_markup: {
        inline_keyboard: [
          [{ text: "✅ Приготовили основное", callback_data: "c:recommendation-1" }],
          [{ text: "🔄 Хочу другой совет", callback_data: "a:recommendation-1" }],
          [
            { text: "✅ Приготовили новинку", callback_data: "n:recommendation-1" },
            { text: "💾 Сохранить новинку", callback_data: "s:recommendation-1" }
          ]
        ]
      }
    });
  });
});

describe("awaiting dish message", () => {
  it("uses the current add button label after the state expires", async () => {
    const telegram = new TelegramApiStub();
    const states = new StateRepositoryStub({
      telegramUserId: "123",
      state: "awaiting_dish",
      expiresAt: "2026-07-21T11:59:59.000Z",
      updatedAt: "2026-07-21T11:55:00.000Z"
    });
    const dishes = new DishRepositoryStub();
    const bot = createTestBot(
      telegram,
      states,
      () => new Date("2026-07-21T12:00:00.000Z"),
      dishes
    );

    await bot.handleUpdate(createTextUpdate(123, "Омлет"));

    expect(dishes.createdDishes).toEqual([]);
    expect(states.clearedUserIds).toEqual(["123"]);
    expect(telegram.sentMessages).toEqual([
      {
        chat_id: 123,
        text:
          "Время добавления истекло. Нажмите «➕ Добавить блюдо в базу», чтобы начать заново."
      }
    ]);
  });

  it("adds the next text message and confirms it", async () => {
    const telegram = new TelegramApiStub();
    const states = new StateRepositoryStub({
      telegramUserId: "123",
      state: "awaiting_dish",
      expiresAt: "2026-07-21T12:15:00.000Z",
      updatedAt: "2026-07-21T12:00:00.000Z"
    });
    const dishes = new DishRepositoryStub();
    const bot = createTestBot(
      telegram,
      states,
      () => new Date("2026-07-21T12:00:00.000Z"),
      dishes,
      () => "dish-1"
    );

    await bot.handleUpdate(createTextUpdate(123, "Омлет\nяйца, помидоры"));

    expect(dishes.createdDishes).toMatchObject([
      { id: "dish-1", name: "Омлет", details: "яйца, помидоры" }
    ]);
    expect(states.clearedUserIds).toEqual(["123"]);
    expect(telegram.sentMessages).toEqual([{ chat_id: 123, text: "Блюдо «Омлет» добавлено." }]);
  });
});

function createTestBot(
  telegram: TelegramApiStub,
  states: StateRepositoryStub,
  now?: () => Date,
  dishes: DishRepository & RecommendationDishRepository & AIAssistedRecommendationDishRepository =
    new DishRepositoryStub(),
  generateId?: () => string,
  history: HistoryRepositoryStub = new HistoryRepositoryStub(),
  ai: AIClientStub = new AIClientStub("{}")
) {
  return createBot(
    {
      telegram: {
        botToken: "telegram-token",
        webhookSecret: "webhook-secret",
        allowedUserIds: new Set(["123"])
      }
    },
    {
      dishes,
      history,
      ai,
      systemPrompt: "private prompt",
      similarSystemPrompt: "similar-only instruction",
      states,
      userGuides: new UserGuideRepositoryStub(),
      now,
      generateId,
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

function createCommandUpdate(userId: number, text: string): Update {
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

function createTextUpdate(userId: number, text: string): Update {
  return {
    update_id: 1,
    message: {
      message_id: 1,
      date: 0,
      chat: { id: userId, type: "private", first_name: "Test" },
      from: { id: userId, is_bot: false, first_name: "Test" },
      text
    }
  };
}

function createCallbackUpdate(userId: number, data: string): Update {
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

class StateRepositoryStub {
  public readonly clearedUserIds: string[] = [];
  public readonly savedStates: ConversationState[] = [];

  public constructor(private state: ConversationState | null = null) {}

  public async save(state: ConversationState): Promise<ConversationState> {
    this.savedStates.push(state);
    return state;
  }

  public async findByUserId(): Promise<ConversationState | null> {
    return this.state;
  }

  public async clear(telegramUserId: string): Promise<boolean> {
    this.clearedUserIds.push(telegramUserId);
    return true;
  }
}

class UserGuideRepositoryStub implements UserGuideRepository {
  public readonly saved: UserGuideMessage[] = [];

  public async findByUserId(): Promise<UserGuideMessage | null> {
    return null;
  }

  public async save(message: UserGuideMessage): Promise<void> {
    this.saved.push(message);
  }
}

class DishRepositoryStub implements DishRepository {
  public readonly createdDishes: NewDish[] = [];

  public constructor(private readonly statistics: DishStatistics[] = []) {}

  public async create(dish: NewDish): Promise<{ kind: "created"; dish: Dish }> {
    this.createdDishes.push(dish);
    return { kind: "created", dish: { ...dish, isActive: true } };
  }

  public async findByNormalizedName(): Promise<Dish | null> {
    return null;
  }

  public async listActiveWithStatistics(): Promise<DishStatistics[]> {
    return this.statistics;
  }

  public async listActiveNames(): Promise<string[]> {
    return this.statistics.map((dish) => dish.name);
  }

  public async listActiveCatalogPage(
    limit: number,
    offset: number
  ): Promise<Array<{ id: string; name: string }>> {
    return [...this.statistics]
      .sort((left, right) => left.name.localeCompare(right.name))
      .slice(offset, offset + limit)
      .map(({ id, name }) => ({ id, name }));
  }

  public async findActiveCatalogDishById(id: string): Promise<{ id: string; name: string } | null> {
    const dish = this.statistics.find((item) => item.id === id && item.isActive);

    return dish === undefined ? null : { id: dish.id, name: dish.name };
  }

  public async deleteActiveCatalogDishById(id: string): Promise<boolean> {
    const index = this.statistics.findIndex((dish) => dish.id === id && dish.isActive);

    if (index === -1) {
      return false;
    }

    this.statistics.splice(index, 1);
    return true;
  }
}

class HistoryRepositoryStub {
  public readonly recommendations: RecommendationEvent[] = [];
  public readonly cookEvents: CookEvent[] = [];

  public async createRecommendation(event: RecommendationEvent): Promise<RecommendationEvent> {
    this.recommendations.push(event);
    return event;
  }

  public async listRecentCooked(): Promise<RecentCookedDish[]> {
    return [];
  }

  public async recordCook(
    event: CookEvent
  ): Promise<{ kind: "created"; event: CookEvent } | { kind: "duplicate" }> {
    if (
      this.cookEvents.some(
        (existingEvent) => existingEvent.telegramCallbackQueryId === event.telegramCallbackQueryId
      )
    ) {
      return { kind: "duplicate" };
    }

    this.cookEvents.push(event);
    return { kind: "created", event };
  }
}

function catalogKeyboard(
  dishIds: string[],
  navigation: Array<{ text: string; callback_data: string }>,
  page: number = 0
): Array<Array<{ text: string; callback_data: string }>> {
  return [
    ...dishIds.flatMap((dishId, index) => [
      [
        { text: `✅ Приготовили №${index + 1}`, callback_data: `m:${dishId}:${page}` },
        { text: `🗑 Удалить №${index + 1}`, callback_data: `d:${dishId}:${page}` }
      ],
      [{ text: `✨ Похожее на №${index + 1} от ИИ`, callback_data: `r:${dishId}` }]
    ]),
    navigation
  ];
}

function catalogEditPayload(dishIds: string[], dishNames: string[], page: number = 0): unknown {
  return {
    chat_id: 123,
    message_id: 1,
    text:
      dishNames.length === 0
        ? "В списке пока нет блюд."
        : `📚 Мои блюда — страница ${page + 1}\n\n${dishNames
            .map((name, index) => `${index + 1}. ${name}`)
            .join("\n")}`,
    reply_markup: {
      inline_keyboard:
        dishIds.length === 0 ? [] : catalogKeyboard(dishIds, [], page)
    }
  };
}

class AIClientStub implements AIRecommendationClient {
  public constructor(private readonly response: string) {}

  public async complete(): Promise<string> {
    return this.response;
  }
}

function dishStatistics(overrides: Partial<DishStatistics>): DishStatistics {
  return {
    id: "dish-1",
    name: "Омлет",
    normalizedName: "омлет",
    details: null,
    source: "user",
    isActive: true,
    createdByUserId: "123",
    createdAt: "2026-07-01T12:00:00.000Z",
    updatedAt: "2026-07-01T12:00:00.000Z",
    lastCookedAt: null,
    timesCooked: 0,
    lastRecommendedAt: null,
    ...overrides
  };
}

class TelegramApiStub {
  public readonly sentMessages: unknown[] = [];

  public constructor(private readonly failPin = false) {}

  public readonly fetch: typeof fetch = async (input, init): Promise<Response> => {
    const request = new Request(input, init);
    const payload: unknown = await request.json();
    this.sentMessages.push(payload);

    if (new URL(request.url).pathname.endsWith("/pinChatMessage")) {
      if (this.failPin) {
        return Response.json({
          ok: false,
          error_code: 400,
          description: "Bad Request: message can't be pinned"
        });
      }

      return Response.json({ ok: true, result: true });
    }

    return Response.json({
      ok: true,
      result: {
        message_id: 2,
        date: 0,
        chat: { id: 123, type: "private", first_name: "Test" }
      }
    });
  };
}
