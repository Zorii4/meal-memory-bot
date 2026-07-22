import { describe, expect, it } from "vitest";
import {
  cookAIRecommendationIdea,
  saveAIRecommendationIdea,
  type NewIdeaHistoryRepository
} from "../src/application/save-ai-recommendation-idea";
import type { CreateDishResult, DishRepository } from "../src/application/add-dish";
import type { Dish, NewDish } from "../src/domain/dish";
import type { CookEvent, RecommendationEvent } from "../src/domain/history";

const now = new Date("2026-07-22T12:00:00.000Z");

describe("AI recommendation new idea", () => {
  it("saves a validated new idea as an AI dish", async () => {
    const dishes = new DishRepositoryStub();

    const result = await saveAIRecommendationIdea("recommendation-1", "123", {
      dishes,
      history: new HistoryRepositoryStub(recommendationWithIdea()),
      now,
      generateId: () => "dish-1"
    });

    expect(result).toMatchObject({ kind: "created", dish: { id: "dish-1", source: "ai" } });
    expect(dishes.created).toEqual([
      {
        id: "dish-1",
        name: "Lentil soup",
        normalizedName: "lentil soup",
        details: "lentils, carrot",
        source: "ai",
        createdByUserId: "123",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      }
    ]);
  });

  it("creates the dish and records cooking once for a callback", async () => {
    const dishes = new DishRepositoryStub();
    const history = new HistoryRepositoryStub(recommendationWithIdea());
    let id = 0;
    const dependencies = {
      dishes,
      history,
      now,
      generateId: () => {
        id += 1;
        return `id-${id}`;
      }
    };

    const first = await cookAIRecommendationIdea("recommendation-1", "123", "callback-1", dependencies);
    const repeated = await cookAIRecommendationIdea(
      "recommendation-1",
      "123",
      "callback-1",
      dependencies
    );

    expect(first).toMatchObject({ kind: "created", dish: { id: "id-1" } });
    expect(repeated).toMatchObject({ kind: "cook-duplicate", dish: { id: "id-1" } });
    expect(history.cookEvents).toEqual([
      {
        id: "id-2",
        dishId: "id-1",
        cookedByUserId: "123",
        cookedAt: now.toISOString(),
        telegramCallbackQueryId: "callback-1"
      }
    ]);
  });

  it("does not save a recommendation without an AI new idea", async () => {
    const result = await saveAIRecommendationIdea("recommendation-1", "123", {
      dishes: new DishRepositoryStub(),
      history: new HistoryRepositoryStub({ ...recommendationWithIdea(), newIdeaJson: null }),
      now,
      generateId: () => "dish-1"
    });

    expect(result).toEqual({ kind: "new-idea-unavailable" });
  });
});

function recommendationWithIdea(): RecommendationEvent {
  return {
    id: "recommendation-1",
    primaryDishId: "dish-primary",
    newIdeaJson: JSON.stringify({
      name: "Lentil soup",
      similarToDishIds: ["dish-primary"],
      whyItFits: "Simple option.",
      ingredients: ["lentils", "carrot"],
      prepMinutes: 30,
      nutritionFocus: ["legumes"]
    }),
    requestedByUserId: "123",
    createdAt: "2026-07-22T11:00:00.000Z"
  };
}

class DishRepositoryStub implements DishRepository {
  public readonly created: NewDish[] = [];

  public async create(dish: NewDish): Promise<CreateDishResult> {
    const created: Dish = { ...dish, isActive: true };
    this.created.push(dish);
    return { kind: "created", dish: created };
  }

  public async findByNormalizedName(normalizedName: string): Promise<Dish | null> {
    const dish = this.created.find((item) => item.normalizedName === normalizedName);
    return dish === undefined ? null : { ...dish, isActive: true };
  }
}

class HistoryRepositoryStub implements NewIdeaHistoryRepository {
  public readonly cookEvents: CookEvent[] = [];

  public constructor(private readonly recommendation: RecommendationEvent) {}

  public async findRecommendationById(id: string): Promise<RecommendationEvent | null> {
    return id === this.recommendation.id ? this.recommendation : null;
  }

  public async recordCook(
    event: CookEvent
  ): Promise<{ kind: "created"; event: CookEvent } | { kind: "duplicate" }> {
    if (this.cookEvents.some((item) => item.telegramCallbackQueryId === event.telegramCallbackQueryId)) {
      return { kind: "duplicate" };
    }

    this.cookEvents.push(event);
    return { kind: "created", event };
  }
}
