import type { Update } from "grammy/types";
import { describe, expect, it } from "vitest";
import type { DishRepository } from "../../src/application/add-dish";
import type {
  AIAssistedRecommendationDishRepository,
  AIRecommendationClient
} from "../../src/application/get-ai-assisted-recommendation";
import type { RecommendationDishRepository } from "../../src/application/get-fallback-recommendation";
import { createBot } from "../../src/bot/create-bot";
import type { ConversationState } from "../../src/domain/conversation-state";
import type { Dish, NewDish } from "../../src/domain/dish";
import type { DishStatistics } from "../../src/domain/dish";
import type { RecentCookedDish, RecommendationEvent } from "../../src/domain/history";

describe("/start", () => {
  it("shows the persistent main keyboard to an allowed user", async () => {
    const telegram = new TelegramApiStub();
    const bot = createTestBot(telegram, new StateRepositoryStub());

    await bot.handleUpdate(createCommandUpdate(123, "/start"));

    expect(telegram.sentMessages).toEqual([
      {
        chat_id: 123,
        text: "Привет! Добавьте знакомое блюдо или попросите совет на сегодня.",
        reply_markup: {
          keyboard: [[{ text: "➕ Добавить блюдо" }], [{ text: "🍽 Посоветовать блюдо" }]],
          resize_keyboard: true,
          is_persistent: true
        }
      }
    ]);
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
  it("starts a 15-minute awaiting_dish state", async () => {
    const telegram = new TelegramApiStub();
    const states = new StateRepositoryStub();
    const bot = createTestBot(telegram, states, () => new Date("2026-07-21T12:00:00.000Z"));

    await bot.handleUpdate(createTextUpdate(123, "➕ Добавить блюдо"));

    expect(states.savedStates).toEqual([
      {
        telegramUserId: "123",
        state: "awaiting_dish",
        expiresAt: "2026-07-21T12:15:00.000Z",
        updatedAt: "2026-07-21T12:00:00.000Z"
      }
    ]);
    expect(telegram.sentMessages).toEqual([
      {
        chat_id: 123,
        text:
          "Пришлите блюдо одним сообщением: первая строка — название, остальные — ингредиенты или комментарий. Для отмены используйте /cancel."
      }
    ]);
  });
});

describe("recommend dish button", () => {
  it("explains how to proceed when the catalog is empty", async () => {
    const telegram = new TelegramApiStub();
    const bot = createTestBot(telegram, new StateRepositoryStub());

    await bot.handleUpdate(createTextUpdate(123, "🍽 Посоветовать блюдо"));

    expect(telegram.sentMessages).toEqual([
      {
        chat_id: 123,
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

    await bot.handleUpdate(createTextUpdate(123, "🍽 Посоветовать блюдо"));

    expect(telegram.sentMessages).toEqual([
      {
        chat_id: 123,
        text: "🍽 Сегодня: Омлет",
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ Приготовили основное", callback_data: "c:recommendation-1" }],
            [{ text: "🔄 Другой совет", callback_data: "a:recommendation-1" }]
          ]
        }
      }
    ]);
    expect(history.recommendations).toEqual([
      {
        id: "recommendation-1",
        primaryDishId: "dish-1",
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

    await bot.handleUpdate(createTextUpdate(123, "🍽 Посоветовать блюдо"));

    expect(telegram.sentMessages).toContainEqual(
      expect.objectContaining({ text: "🍽 Сегодня: Омлет\n\nЭто простой вариант на сегодня." })
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

    await bot.handleUpdate(createTextUpdate(123, "🍽 Посоветовать блюдо"));

    expect(telegram.sentMessages).toContainEqual({
      chat_id: 123,
      text:
        "🍽 Сегодня: Омлет\n\nЭто простой вариант на сегодня.\n\n✨ Похожая новинка: Суп с чечевицей\nПохожий простой вариант.",
      reply_markup: {
        inline_keyboard: [
          [{ text: "✅ Приготовили основное", callback_data: "c:recommendation-1" }],
          [{ text: "🔄 Другой совет", callback_data: "a:recommendation-1" }],
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
      states,
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
}

class HistoryRepositoryStub {
  public readonly recommendations: RecommendationEvent[] = [];

  public async createRecommendation(event: RecommendationEvent): Promise<RecommendationEvent> {
    this.recommendations.push(event);
    return event;
  }

  public async listRecentCooked(): Promise<RecentCookedDish[]> {
    return [];
  }
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

  public readonly fetch: typeof fetch = async (input, init): Promise<Response> => {
    const request = new Request(input, init);
    const payload: unknown = await request.json();
    this.sentMessages.push(payload);

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
