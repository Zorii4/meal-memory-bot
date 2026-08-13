import { describe, expect, it } from "vitest";
import {
  confirmRecommendationCooked,
  type ConfirmationHistoryRepository
} from "../src/application/confirm-recommendation-cooked";
import type { CookEvent, RecommendationEvent } from "../src/domain/history";

const now = new Date("2026-07-21T12:00:00.000Z");

describe("confirmRecommendationCooked", () => {
  it("creates a cook event for the recommendation's primary dish", async () => {
    const history = new HistoryRepositoryStub([recommendation()]);

    const result = await confirmRecommendationCooked("recommendation-1", "123", "callback-1", {
      history,
      now,
      generateId: () => "cook-1"
    });

    expect(result).toEqual({
      kind: "created",
      event: {
        id: "cook-1",
        dishId: "dish-1",
        cookedByUserId: "123",
        cookedAt: "2026-07-21T12:00:00.000Z",
        telegramCallbackQueryId: "callback-1"
      }
    });
  });

  it("does not create a cook event for an unknown recommendation", async () => {
    const history = new HistoryRepositoryStub([]);

    const result = await confirmRecommendationCooked("unknown", "123", "callback-1", {
      history,
      now,
      generateId: () => "cook-1"
    });

    expect(result).toEqual({ kind: "recommendation-not-found" });
    expect(history.cookEvents).toEqual([]);
  });

  it("does not duplicate a repeated callback", async () => {
    const history = new HistoryRepositoryStub([recommendation()]);
    const dependencies = { history, now, generateId: () => "cook-1" };

    await confirmRecommendationCooked("recommendation-1", "123", "callback-1", dependencies);
    const repeated = await confirmRecommendationCooked(
      "recommendation-1",
      "123",
      "callback-1",
      dependencies
    );

    expect(repeated).toEqual({ kind: "duplicate" });
    expect(history.cookEvents).toHaveLength(1);
  });
});

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

class HistoryRepositoryStub implements ConfirmationHistoryRepository {
  public readonly cookEvents: CookEvent[] = [];

  public constructor(private readonly recommendations: RecommendationEvent[]) {}

  public async findRecommendationById(id: string): Promise<RecommendationEvent | null> {
    return this.recommendations.find((recommendation) => recommendation.id === id) ?? null;
  }

  public async recordCook(event: CookEvent): Promise<{ kind: "created"; event: CookEvent } | { kind: "duplicate" }> {
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
