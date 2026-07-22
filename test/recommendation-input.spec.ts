import { describe, expect, it } from "vitest";
import {
  AI_CANDIDATE_LIMIT,
  AI_CATALOG_NAME_LIMIT,
  AI_RECENT_COOKED_LIMIT,
  buildAIRecommendationInput
} from "../src/infrastructure/ai/recommendation-input";
import type { DishStatistics } from "../src/domain/dish";

describe("buildAIRecommendationInput", () => {
  it("limits model input and supplies fixed MVP preferences", () => {
    const input = buildAIRecommendationInput({
      candidates: Array.from({ length: 6 }, (_, index) => dish(index + 1)),
      recentCooked: Array.from({ length: 11 }, (_, index) => ({
        name: `Блюдо ${index + 1}`,
        cookedAt: `2026-07-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`
      })),
      catalogNames: Array.from({ length: 51 }, (_, index) => `Блюдо ${index + 1}`)
    });

    expect(input.candidates).toHaveLength(AI_CANDIDATE_LIMIT);
    expect(input.recentCooked).toHaveLength(AI_RECENT_COOKED_LIMIT);
    expect(input.catalogNames).toHaveLength(AI_CATALOG_NAME_LIMIT);
    expect(input.candidates[0]).toEqual({
      id: "dish-1",
      name: "Блюдо 1",
      details: "Ингредиенты 1",
      lastCookedAt: null,
      timesCooked: 1
    });
    expect(input.preferences).toEqual({
      language: "ru",
      simpleCooking: true,
      nutritionMode: "qualitative",
      avoidIngredients: []
    });
  });

  it("copies only the fields defined by the AI contract", () => {
    const input = buildAIRecommendationInput({
      candidates: [dish(1)],
      recentCooked: [{ name: "Омлет", cookedAt: "2026-07-20T12:00:00.000Z" }],
      catalogNames: ["Омлет"]
    });

    expect(input.candidates[0]).not.toHaveProperty("createdByUserId");
    expect(input.recentCooked[0]).toEqual({
      name: "Омлет",
      cookedAt: "2026-07-20T12:00:00.000Z"
    });
  });
});

function dish(number: number): DishStatistics {
  return {
    id: `dish-${number}`,
    name: `Блюдо ${number}`,
    normalizedName: `блюдо ${number}`,
    details: `Ингредиенты ${number}`,
    source: "user",
    isActive: true,
    createdByUserId: "123",
    createdAt: "2026-07-01T12:00:00.000Z",
    updatedAt: "2026-07-01T12:00:00.000Z",
    lastCookedAt: null,
    timesCooked: number,
    lastRecommendedAt: null
  };
}
