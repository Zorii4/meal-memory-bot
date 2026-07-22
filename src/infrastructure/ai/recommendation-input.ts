import type { DishStatistics } from "../../domain/dish";
import type { RecentCookedDish } from "../../domain/history";

export const AI_CANDIDATE_LIMIT = 5;
export const AI_RECENT_COOKED_LIMIT = 10;
export const AI_CATALOG_NAME_LIMIT = 50;

export interface BuildAIRecommendationInputSource {
  candidates: readonly DishStatistics[];
  recentCooked: readonly RecentCookedDish[];
  catalogNames: readonly string[];
}

export interface AIRecommendationInput {
  candidates: Array<{
    id: string;
    name: string;
    details: string | null;
    lastCookedAt: string | null;
    timesCooked: number;
  }>;
  recentCooked: RecentCookedDish[];
  catalogNames: string[];
  preferences: {
    language: "ru";
    simpleCooking: true;
    nutritionMode: "qualitative";
    avoidIngredients: string[];
  };
}

export function buildAIRecommendationInput(
  source: BuildAIRecommendationInputSource
): AIRecommendationInput {
  return {
    candidates: source.candidates.slice(0, AI_CANDIDATE_LIMIT).map(toCandidate),
    recentCooked: source.recentCooked.slice(0, AI_RECENT_COOKED_LIMIT).map(toRecentCookedDish),
    catalogNames: source.catalogNames.slice(0, AI_CATALOG_NAME_LIMIT),
    preferences: {
      language: "ru",
      simpleCooking: true,
      nutritionMode: "qualitative",
      avoidIngredients: []
    }
  };
}

function toCandidate(dish: DishStatistics): AIRecommendationInput["candidates"][number] {
  return {
    id: dish.id,
    name: dish.name,
    details: dish.details,
    lastCookedAt: dish.lastCookedAt,
    timesCooked: dish.timesCooked
  };
}

function toRecentCookedDish(dish: RecentCookedDish): RecentCookedDish {
  return { name: dish.name, cookedAt: dish.cookedAt };
}
