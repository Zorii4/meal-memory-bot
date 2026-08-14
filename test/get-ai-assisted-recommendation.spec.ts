import { describe, expect, it } from "vitest";
import {
  getAIAssistedRecommendationForUser,
  getAIAssistedRecommendationForDish,
  type AIAssistedRecommendationDishRepository,
  type AIAssistedRecommendationHistoryRepository,
  type AIRecommendationClient
} from "../src/application/get-ai-assisted-recommendation";
import type { Dish, DishStatistics } from "../src/domain/dish";
import type { RecentCookedDish, RecommendationEvent } from "../src/domain/history";
import { AIHttpError, AITimeoutError } from "../src/infrastructure/ai/ai-client";

const now = new Date("2026-07-22T12:00:00.000Z");

describe("getAIAssistedRecommendationForUser", () => {
  it("uses one valid AI response and persists its new idea", async () => {
    const dishes = new DishRepositoryStub([dish("dish-1"), dish("dish-2")]);
    const history = new HistoryRepositoryStub();
    const ai = new AIClientStub(
      JSON.stringify({
        selectedDishId: "dish-2",
        selectionReason: "Подходит сегодня.",
        newIdea: {
          name: "Суп с чечевицей",
          similarToDishIds: ["dish-2"],
          whyItFits: "Простой похожий вариант.",
          ingredients: ["чечевица", "лук"],
          prepMinutes: 30,
          nutritionFocus: ["protein", "fiber"]
        },
        warnings: []
      })
    );

    const result = await getAIAssistedRecommendationForUser("123", dependencies(dishes, history, ai));

    expect(result).toMatchObject({
      kind: "recommended",
      source: "ai",
      dish: { id: "dish-2" },
      recommendation: { id: "recommendation-1", primaryDishId: "dish-2" }
    });
    expect(ai.requests).toHaveLength(1);
    expect(ai.requests[0]).toMatchObject({ maxTokens: 2_000 });
    expect(history.recommendations[0]?.newIdeaJson).toContain("Суп с чечевицей");
  });

  it("falls back without retrying when AI selects an ID outside candidates", async () => {
    const dishes = new DishRepositoryStub([dish("dish-1")]);
    const history = new HistoryRepositoryStub();
    const ai = new AIClientStub(
      JSON.stringify({
        selectedDishId: "unknown",
        selectionReason: "invalid",
        newIdea: null,
        warnings: []
      })
    );

    const result = await getAIAssistedRecommendationForUser("123", dependencies(dishes, history, ai));

    expect(result).toMatchObject({
      kind: "recommended",
      source: "fallback",
      dish: { id: "dish-1" },
      aiResponse: null
    });
    expect(ai.requests).toHaveLength(1);
    expect(history.recommendations[0]?.newIdeaJson).toBeNull();
  });

  it("falls back when AI returns malformed JSON", async () => {
    const result = await getAIAssistedRecommendationForUser(
      "123",
      dependencies(new DishRepositoryStub([dish("dish-1")]), new HistoryRepositoryStub(), new AIClientStub("{"))
    );

    expect(result).toMatchObject({ kind: "recommended", source: "fallback", aiResponse: null });
  });

  it("reports the fallback reason without changing the result", async () => {
    const errors: unknown[] = [];
    const result = await getAIAssistedRecommendationForUser(
      "123",
      {
        ...dependencies(
          new DishRepositoryStub([dish("dish-1")]),
          new HistoryRepositoryStub(),
          new AIClientStub("{")
        ),
        onAIFallback: (error: unknown) => errors.push(error)
      }
    );

    expect(result).toMatchObject({ kind: "recommended", source: "fallback", aiResponse: null });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ code: "AI_RESPONSE_INVALID_JSON" });
  });

  it("falls back when the AI new idea already exists", async () => {
    const dishes = new DishRepositoryStub(
      [dish("dish-1")],
      dish("existing", { name: "Суп", normalizedName: "суп" })
    );
    const history = new HistoryRepositoryStub();
    const ai = new AIClientStub(
      JSON.stringify({
        selectedDishId: "dish-1",
        selectionReason: "valid",
        newIdea: {
          name: "Суп",
          similarToDishIds: ["dish-1"],
          whyItFits: "valid",
          ingredients: ["лук"],
          prepMinutes: 20,
          nutritionFocus: []
        },
        warnings: []
      })
    );

    const result = await getAIAssistedRecommendationForUser("123", dependencies(dishes, history, ai));

    expect(result).toMatchObject({ kind: "recommended", source: "fallback", aiResponse: null });
    expect(ai.requests).toHaveLength(1);
  });

  it("falls back when a new idea refers to a dish outside candidates", async () => {
    const dishes = new DishRepositoryStub([dish("dish-1")]);
    const history = new HistoryRepositoryStub();
    const ai = new AIClientStub(
      JSON.stringify({
        selectedDishId: "dish-1",
        selectionReason: "valid",
        newIdea: {
          name: "Суп",
          similarToDishIds: ["unknown"],
          whyItFits: "valid",
          ingredients: ["лук"],
          prepMinutes: 20,
          nutritionFocus: []
        },
        warnings: []
      })
    );

    const result = await getAIAssistedRecommendationForUser("123", dependencies(dishes, history, ai));

    expect(result).toMatchObject({ kind: "recommended", source: "fallback", aiResponse: null });
  });

  it("falls back when a new idea omits the AI-selected dish", async () => {
    const dishes = new DishRepositoryStub([dish("dish-1"), dish("dish-2")]);
    const history = new HistoryRepositoryStub();
    const ai = new AIClientStub(
      JSON.stringify({
        selectedDishId: "dish-1",
        selectionReason: "valid",
        newIdea: {
          name: "Суп",
          similarToDishIds: ["dish-2"],
          whyItFits: "valid",
          ingredients: ["лук"],
          prepMinutes: 20,
          nutritionFocus: []
        },
        warnings: []
      })
    );

    const result = await getAIAssistedRecommendationForUser("123", dependencies(dishes, history, ai));

    expect(result).toMatchObject({ kind: "recommended", source: "fallback", aiResponse: null });
  });

  it("falls back when the AI client fails", async () => {
    const dishes = new DishRepositoryStub([dish("dish-1")]);
    const history = new HistoryRepositoryStub();
    const ai = new AIClientStub(new Error("AI unavailable"));

    const result = await getAIAssistedRecommendationForUser("123", dependencies(dishes, history, ai));

    expect(result).toMatchObject({ kind: "recommended", source: "fallback", aiResponse: null });
    expect(ai.requests).toHaveLength(1);
  });

  it.each([
    new AIHttpError(500),
    new AITimeoutError(20_000, new DOMException("Aborted", "AbortError"))
  ])("falls back for a provider error: %s", async (error) => {
    const result = await getAIAssistedRecommendationForUser(
      "123",
      dependencies(
        new DishRepositoryStub([dish("dish-1")]),
        new HistoryRepositoryStub(),
        new AIClientStub(error)
      )
    );

    expect(result).toMatchObject({ kind: "recommended", source: "fallback", aiResponse: null });
  });

  it("falls back when an AI text field exceeds its contract limit", async () => {
    const result = await getAIAssistedRecommendationForUser(
      "123",
      dependencies(
        new DishRepositoryStub([dish("dish-1")]),
        new HistoryRepositoryStub(),
        new AIClientStub(
          JSON.stringify({
            selectedDishId: "dish-1",
            selectionReason: "x".repeat(281),
            newIdea: null,
            warnings: []
          })
        )
      )
    );

    expect(result).toMatchObject({ kind: "recommended", source: "fallback", aiResponse: null });
  });
});

describe("getAIAssistedRecommendationForDish", () => {
  it("limits the AI to the selected catalog dish and records one recommendation", async () => {
    const dishes = new DishRepositoryStub([dish("dish-1"), dish("dish-2")]);
    const history = new HistoryRepositoryStub();
    const ai = new AIClientStub(JSON.stringify({
      selectedDishId: "dish-2",
      selectionReason: "Подходит.",
      newIdea: {
        name: "Похожая новинка",
        similarToDishIds: ["dish-2"],
        whyItFits: "Похожий простой вариант.",
        ingredients: ["овощи"],
        prepMinutes: 20,
        nutritionFocus: []
      },
      warnings: []
    }));

    const result = await getAIAssistedRecommendationForDish("dish-2", "123", dependencies(dishes, history, ai));

    expect(result).toMatchObject({
      kind: "recommended",
      recommendation: { primaryDishId: "dish-2", purpose: "similar" },
      newIdea: { name: "Похожая новинка" }
    });
    expect(ai.requests).toHaveLength(1);
    expect(ai.requests[0]).toMatchObject({
      systemPrompt: "similar-only instruction",
      maxTokens: 2_000
    });
    expect(ai.requests[0]).toMatchObject({ input: { candidates: [{ id: "dish-2" }] } });
    expect(history.recommendations).toHaveLength(1);
  });

  it("does not use the selected dish as fallback when AI fails", async () => {
    const result = await getAIAssistedRecommendationForDish(
      "dish-2",
      "123",
      dependencies(new DishRepositoryStub([dish("dish-1"), dish("dish-2")]), new HistoryRepositoryStub(), new AIClientStub("{"))
    );

    expect(result).toEqual({ kind: "new-idea-unavailable" });
  });
});

function dependencies(
  dishes: DishRepositoryStub,
  history: HistoryRepositoryStub,
  ai: AIClientStub
) {
  return {
    dishes,
    history,
    ai,
    systemPrompt: "private prompt",
    similarSystemPrompt: "similar-only instruction",
    now,
    generateId: () => "recommendation-1",
    random: () => 0
  };
}

function dish(id: string, overrides: Partial<DishStatistics> = {}): DishStatistics {
  return {
    id,
    name: id,
    normalizedName: id,
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

class DishRepositoryStub implements AIAssistedRecommendationDishRepository {
  public constructor(
    private readonly statistics: DishStatistics[],
    private readonly duplicate: Dish | null = null
  ) {}

  public async listActiveWithStatistics(): Promise<DishStatistics[]> {
    return this.statistics;
  }

  public async listActiveNames(): Promise<string[]> {
    return this.statistics.map((dish) => dish.name);
  }

  public async findByNormalizedName(normalizedName: string): Promise<Dish | null> {
    return this.duplicate?.normalizedName === normalizedName ? this.duplicate : null;
  }
}

class HistoryRepositoryStub implements AIAssistedRecommendationHistoryRepository {
  public readonly recommendations: RecommendationEvent[] = [];

  public async listRecentCooked(): Promise<RecentCookedDish[]> {
    return [];
  }

  public async createRecommendation(event: RecommendationEvent): Promise<RecommendationEvent> {
    this.recommendations.push(event);
    return event;
  }
}

class AIClientStub implements AIRecommendationClient {
  public readonly requests: Array<{ systemPrompt: string; input: unknown; maxTokens?: number }> = [];

  public constructor(private readonly response: string | Error) {}

  public async complete(request: { systemPrompt: string; input: unknown; maxTokens?: number }): Promise<string> {
    this.requests.push(request);

    if (this.response instanceof Error) {
      throw this.response;
    }

    return this.response;
  }
}
