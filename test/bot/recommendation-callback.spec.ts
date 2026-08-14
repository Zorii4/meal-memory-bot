import type { Context } from "grammy";
import { describe, expect, it, vi } from "vitest";
import type { ConfirmationHistoryRepository } from "../../src/application/confirm-recommendation-cooked";
import type {
  AIAssistedRecommendationDishRepository,
  AIAssistedRecommendationHistoryRepository,
  AIRecommendationClient
} from "../../src/application/get-ai-assisted-recommendation";
import type {
  RecommendationDishRepository,
  RecommendationHistoryRepository
} from "../../src/application/get-fallback-recommendation";
import type { CreateDishResult, DishRepository } from "../../src/application/add-dish";
import { handleRecommendationCallback } from "../../src/bot/handlers/confirm-recommendation-cooked";
import { messages } from "../../src/bot/messages";
import type { Dish, DishStatistics, NewDish } from "../../src/domain/dish";
import type { CookEvent, RecommendationEvent } from "../../src/domain/history";

describe("recommendation callback", () => {
  it("records cooking and answers the callback", async () => {
    const context = new CallbackContextStub("c:recommendation-1");
    const history = new HistoryRepositoryStub(recommendation());

    await handleRecommendationCallback(context.asContext(), {
      history,
      dishes: new DishRepositoryStub([]),
      ai: new AIClientStub("{}"),
      systemPrompt: "private prompt",
      now: new Date("2026-07-21T12:00:00.000Z"),
      generateId: () => "cook-1",
      random: () => 0
    });

    expect(history.cookEvents).toEqual([
      {
        id: "cook-1",
        dishId: "dish-1",
        cookedByUserId: "123",
        cookedAt: "2026-07-21T12:00:00.000Z",
        telegramCallbackQueryId: "callback-1"
      }
    ]);
    expect(context.answers).toEqual([{ text: "Отметил приготовление." }]);
  });

  it("sends another recommendation without recording cooking", async () => {
    const context = new CallbackContextStub("a:recommendation-1");
    const history = new HistoryRepositoryStub(recommendation());

    await handleRecommendationCallback(context.asContext(), {
      history,
      dishes: new DishRepositoryStub([dishStatistics()]),
      ai: new AIClientStub("{}"),
      systemPrompt: "private prompt",
      now: new Date("2026-07-21T12:00:00.000Z"),
      generateId: () => "recommendation-2",
      random: () => 0
    });

    expect(history.cookEvents).toEqual([]);
    expect(history.recommendations).toEqual([
      recommendation(),
      { ...recommendation(), id: "recommendation-2", createdAt: "2026-07-21T12:00:00.000Z" }
    ]);
    expect(context.answers).toEqual([{}]);
    expect(context.replies).toEqual([{ text: messages.recommendationLoading, other: undefined }]);
    expect(context.edits).toEqual([
      {
        chatId: 123,
        messageId: 2,
        text: "🍽 Сегодня предлагаю приготовить: Омлет",
        other: {
          reply_markup: {
            inline_keyboard: [
              [{ text: "✅ Приготовили основное", callback_data: "c:recommendation-2" }],
              [{ text: "🔄 Хочу другой совет", callback_data: "a:recommendation-2" }]
            ]
          }
        }
      }
    ]);
  });

  it("saves an AI new idea without creating a cooking event", async () => {
    const context = new CallbackContextStub("s:recommendation-1");
    const dishes = new DishRepositoryStub([]);
    const history = new HistoryRepositoryStub(recommendationWithIdea());

    await handleRecommendationCallback(context.asContext(), {
      history,
      dishes,
      ai: new AIClientStub("{}"),
      systemPrompt: "private prompt",
      now: new Date("2026-07-21T12:00:00.000Z"),
      generateId: () => "new-dish-1",
      random: () => 0
    });

    expect(dishes.created).toMatchObject([{ id: "new-dish-1", source: "ai" }]);
    expect(history.cookEvents).toEqual([]);
    expect(context.answers).toEqual([{ text: messages.newIdeaSaved }]);
  });

  it("saves and records cooking for an AI new idea", async () => {
    const context = new CallbackContextStub("n:recommendation-1");
    const dishes = new DishRepositoryStub([]);
    const history = new HistoryRepositoryStub(recommendationWithIdea());
    let id = 0;

    await handleRecommendationCallback(context.asContext(), {
      history,
      dishes,
      ai: new AIClientStub("{}"),
      systemPrompt: "private prompt",
      now: new Date("2026-07-21T12:00:00.000Z"),
      generateId: () => {
        id += 1;
        return `id-${id}`;
      },
      random: () => 0
    });

    expect(dishes.created).toMatchObject([{ id: "id-1", source: "ai" }]);
    expect(history.cookEvents).toMatchObject([{ dishId: "id-1", telegramCallbackQueryId: "callback-1" }]);
    expect(context.answers).toEqual([{ text: messages.newIdeaSavedAndCooked }]);
  });

  it("answers before starting another potentially slow recommendation", async () => {
    const context = new CallbackContextStub("a:recommendation-1");
    const history = new HistoryRepositoryStub(recommendation());
    const ai = new DeferredAIClientStub();
    const handling = handleRecommendationCallback(context.asContext(), {
      history,
      dishes: new DishRepositoryStub([dishStatistics()]),
      ai,
      systemPrompt: "private prompt",
      similarSystemPrompt: "private prompt",
      now: new Date("2026-07-21T12:00:00.000Z"),
      generateId: () => "recommendation-2",
      random: () => 0
    });

    expect(context.answers).toEqual([{}]);

    await ai.waitUntilStarted();
    ai.resolve("{}");
    await handling;
  });

  it("still sends another recommendation when Telegram rejects the early callback answer", async () => {
    const context = new CallbackContextStub("a:recommendation-1", true);
    const logError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await handleRecommendationCallback(context.asContext(), {
      history: new HistoryRepositoryStub(recommendation()),
      dishes: new DishRepositoryStub([dishStatistics()]),
      ai: new AIClientStub("{}"),
      systemPrompt: "private prompt",
      similarSystemPrompt: "private prompt",
      now: new Date("2026-07-21T12:00:00.000Z"),
      generateId: () => "recommendation-2",
      random: () => 0
    });

    logError.mockRestore();
    expect(context.edits).toHaveLength(1);
    expect(context.edits[0]?.text).toBe("🍽 Сегодня предлагаю приготовить: Омлет");
  });
});

class CallbackContextStub {
  public readonly answers: Array<{ text?: string }> = [];
  public readonly replies: Array<{ text: string; other: unknown }> = [];
  public readonly edits: Array<{ chatId: number; messageId: number; text: string; other: unknown }> = [];

  public constructor(
    private readonly data: string,
    private readonly failAnswer: boolean = false
  ) {}

  public asContext(): Pick<Context, "api" | "callbackQuery" | "answerCallbackQuery" | "reply"> {
    return {
      callbackQuery: {
        id: "callback-1",
        from: { id: 123 },
        data: this.data
      },
      answerCallbackQuery: async (options) => {
        this.answers.push(options ?? {});

        if (this.failAnswer) {
          throw new Error("callback query is too old");
        }

        return true;
      },
      reply: async (text, other) => {
        this.replies.push({ text, other });
        return { chat: { id: 123 }, message_id: 2 };
      },
      api: {
        editMessageText: async (chatId, messageId, text, other) => {
          this.edits.push({ chatId: Number(chatId), messageId, text, other });
          return {};
        }
      }
    } as unknown as Pick<Context, "api" | "callbackQuery" | "answerCallbackQuery" | "reply">;
  }
}

function recommendation(): RecommendationEvent {
  return {
    id: "recommendation-1",
    primaryDishId: "dish-1",
    purpose: "daily",
    newIdeaJson: null,
    requestedByUserId: "123",
    createdAt: "2026-07-21T11:00:00.000Z"
  };
}

function recommendationWithIdea(): RecommendationEvent {
  return {
    ...recommendation(),
    newIdeaJson: JSON.stringify({
      name: "Lentil soup",
      similarToDishIds: ["dish-1"],
      whyItFits: "Simple option.",
      ingredients: ["lentils", "carrot"],
      prepMinutes: 30,
      nutritionFocus: ["legumes"]
    })
  };
}

class DishRepositoryStub
  implements DishRepository, RecommendationDishRepository, AIAssistedRecommendationDishRepository
{
  public readonly created: NewDish[] = [];

  public constructor(private readonly dishes: DishStatistics[]) {}

  public async listActiveWithStatistics(): Promise<DishStatistics[]> {
    return this.dishes;
  }

  public async listActiveNames(): Promise<string[]> {
    return this.dishes.map((dish) => dish.name);
  }

  public async findByNormalizedName(normalizedName: string): Promise<Dish | null> {
    const dish = this.created.find((item) => item.normalizedName === normalizedName);
    return dish === undefined ? null : { ...dish, isActive: true };
  }

  public async create(dish: NewDish): Promise<CreateDishResult> {
    this.created.push(dish);
    return { kind: "created", dish: { ...dish, isActive: true } };
  }
}

class HistoryRepositoryStub
  implements
    ConfirmationHistoryRepository,
    RecommendationHistoryRepository,
    AIAssistedRecommendationHistoryRepository
{
  public readonly cookEvents: CookEvent[] = [];
  public readonly recommendations: RecommendationEvent[];

  public constructor(private readonly storedRecommendation: RecommendationEvent) {
    this.recommendations = [storedRecommendation];
  }

  public async findRecommendationById(id: string): Promise<RecommendationEvent | null> {
    return id === this.storedRecommendation.id ? this.storedRecommendation : null;
  }

  public async linkNewIdeaDish(): Promise<void> {}

  public async recordCook(event: CookEvent): Promise<{ kind: "created"; event: CookEvent }> {
    this.cookEvents.push(event);
    return { kind: "created", event };
  }

  public async createRecommendation(event: RecommendationEvent): Promise<RecommendationEvent> {
    this.recommendations.push(event);
    return event;
  }

  public async listRecentCooked(): Promise<[]> {
    return [];
  }
}

class AIClientStub implements AIRecommendationClient {
  public constructor(private readonly response: string) {}

  public async complete(): Promise<string> {
    return this.response;
  }
}

class DeferredAIClientStub implements AIRecommendationClient {
  private resolveResponse: ((value: string) => void) | undefined;
  private resolveStarted: (() => void) | undefined;
  private readonly started = new Promise<void>((resolve) => {
    this.resolveStarted = resolve;
  });

  public async complete(): Promise<string> {
    this.resolveStarted?.();
    return new Promise<string>((resolve) => {
      this.resolveResponse = resolve;
    });
  }

  public async waitUntilStarted(): Promise<void> {
    await this.started;
  }

  public resolve(response: string): void {
    this.resolveResponse?.(response);
  }
}

function dishStatistics(): DishStatistics {
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
    lastRecommendedAt: null
  };
}
