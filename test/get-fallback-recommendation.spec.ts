import { describe, expect, it } from "vitest";
import type { DishStatistics } from "../src/domain/dish";
import { getFallbackRecommendation } from "../src/domain/get-fallback-recommendation";

describe("getFallbackRecommendation", () => {
  it("returns the first candidate", () => {
    const first = dish("first");

    expect(getFallbackRecommendation([first, dish("second")])).toEqual(first);
  });

  it("returns null for an empty candidate list", () => {
    expect(getFallbackRecommendation([])).toBeNull();
  });
});

function dish(id: string): DishStatistics {
  return {
    id,
    name: id,
    normalizedName: id,
    details: null,
    source: "user",
    isActive: true,
    createdByUserId: "user-1",
    createdAt: "2026-07-21T12:00:00.000Z",
    updatedAt: "2026-07-21T12:00:00.000Z",
    lastCookedAt: null,
    timesCooked: 0,
    lastRecommendedAt: null
  };
}
