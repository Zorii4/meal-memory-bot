import type { Context } from "grammy";
import { describe, expect, it } from "vitest";
import type { ConfirmationHistoryRepository } from "../../src/application/confirm-recommendation-cooked";
import type {
  RecommendationDishRepository,
  RecommendationHistoryRepository
} from "../../src/application/get-fallback-recommendation";
import { handleRecommendationCallback } from "../../src/bot/handlers/confirm-recommendation-cooked";
import type { DishStatistics } from "../../src/domain/dish";
import type { CookEvent, RecommendationEvent } from "../../src/domain/history";

describe("recommendation callback", () => {
  it("records cooking and answers the callback", async () => {
    const context = new CallbackContextStub("c:recommendation-1");
    const history = new HistoryRepositoryStub(recommendation());

    await handleRecommendationCallback(context.asContext(), {
      history,
      dishes: new DishRepositoryStub([]),
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
      now: new Date("2026-07-21T12:00:00.000Z"),
      generateId: () => "recommendation-2",
      random: () => 0
    });

    expect(history.cookEvents).toEqual([]);
    expect(history.recommendations).toEqual([
      recommendation(),
      { ...recommendation(), id: "recommendation-2", createdAt: "2026-07-21T12:00:00.000Z" }
    ]);
    expect(context.answers).toEqual([{ text: "Вот другой вариант." }]);
    expect(context.replies).toEqual([
      {
        text: "🍽 Сегодня: Омлет",
        other: {
          reply_markup: {
            inline_keyboard: [
              [{ text: "✅ Приготовили основное", callback_data: "c:recommendation-2" }],
              [{ text: "🔄 Другой совет", callback_data: "a:recommendation-2" }]
            ]
          }
        }
      }
    ]);
  });
});

class CallbackContextStub {
  public readonly answers: Array<{ text?: string }> = [];
  public readonly replies: Array<{ text: string; other: unknown }> = [];

  public constructor(private readonly data: string) {}

  public asContext(): Pick<Context, "callbackQuery" | "answerCallbackQuery" | "reply"> {
    return {
      callbackQuery: {
        id: "callback-1",
        from: { id: 123 },
        data: this.data
      },
      answerCallbackQuery: async (options) => {
        this.answers.push(options ?? {});
        return true;
      },
      reply: async (text, other) => {
        this.replies.push({ text, other });
        return {};
      }
    } as unknown as Pick<Context, "callbackQuery" | "answerCallbackQuery" | "reply">;
  }
}

function recommendation(): RecommendationEvent {
  return {
    id: "recommendation-1",
    primaryDishId: "dish-1",
    newIdeaJson: null,
    requestedByUserId: "123",
    createdAt: "2026-07-21T11:00:00.000Z"
  };
}

class DishRepositoryStub implements RecommendationDishRepository {
  public constructor(private readonly dishes: DishStatistics[]) {}

  public async listActiveWithStatistics(): Promise<DishStatistics[]> {
    return this.dishes;
  }
}

class HistoryRepositoryStub implements ConfirmationHistoryRepository, RecommendationHistoryRepository {
  public readonly cookEvents: CookEvent[] = [];
  public readonly recommendations: RecommendationEvent[];

  public constructor(private readonly storedRecommendation: RecommendationEvent) {
    this.recommendations = [storedRecommendation];
  }

  public async findRecommendationById(id: string): Promise<RecommendationEvent | null> {
    return id === this.storedRecommendation.id ? this.storedRecommendation : null;
  }

  public async recordCook(event: CookEvent): Promise<{ kind: "created"; event: CookEvent }> {
    this.cookEvents.push(event);
    return { kind: "created", event };
  }

  public async createRecommendation(event: RecommendationEvent): Promise<RecommendationEvent> {
    this.recommendations.push(event);
    return event;
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
