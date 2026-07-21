import type { DishStatistics } from "./dish";

/**
 * Selects the deterministic fallback from an already ordered candidate list.
 */
export function getFallbackRecommendation(
  candidates: readonly DishStatistics[]
): DishStatistics | null {
  return candidates[0] ?? null;
}
