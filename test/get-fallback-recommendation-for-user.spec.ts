import { describe, expect, it } from "vitest";
import {
  getFallbackRecommendationForUser,
  type RecommendationDishRepository,
  type RecommendationHistoryRepository
} from "../src/application/get-fallback-recommendation";
import type { DishStatistics } from "../src/domain/dish";
import type { RecommendationEvent } from "../src/domain/history";

const now = new Date("2026-07-21T12:00:00.000Z");

describe("getFallbackRecommendationForUser", () => {
  it("creates a recommendation event but no cook event", async () => {
    const history = new HistoryRepositoryStub();
    const dishes = new DishRepositoryStub([
      dish({ id: "never-cooked", lastCookedAt: null }),
      dish({ id: "recent", lastCookedAt: "2026-07-20T12:00:00.000Z" })
    ]);

    const result = await getFallbackRecommendationForUser("123", {
      dishes,
      history,
      now,
      generateId: () => "recommendation-1",
      random: () => 0
    });

    expect(result).toMatchObject({
      kind: "recommended",
      dish: { id: "never-cooked" },
      recommendation: {
        id: "recommendation-1",
        primaryDishId: "never-cooked",
        requestedByUserId: "123",
        createdAt: "2026-07-21T12:00:00.000Z"
      }
    });
    expect(history.recommendations).toHaveLength(1);
  });

  it("does not create an event for an empty catalog", async () => {
    const history = new HistoryRepositoryStub();

    const result = await getFallbackRecommendationForUser("123", {
      dishes: new DishRepositoryStub([]),
      history,
      now,
      generateId: () => "recommendation-1",
      random: () => 0
    });

    expect(result).toEqual({ kind: "empty" });
    expect(history.recommendations).toEqual([]);
  });
});

function dish(overrides: Partial<DishStatistics>): DishStatistics {
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

class DishRepositoryStub implements RecommendationDishRepository {
  public constructor(private readonly dishes: DishStatistics[]) {}

  public async listActiveWithStatistics(): Promise<DishStatistics[]> {
    return this.dishes;
  }
}

class HistoryRepositoryStub implements RecommendationHistoryRepository {
  public readonly recommendations: RecommendationEvent[] = [];

  public async createRecommendation(event: RecommendationEvent): Promise<RecommendationEvent> {
    this.recommendations.push(event);
    return event;
  }
}
