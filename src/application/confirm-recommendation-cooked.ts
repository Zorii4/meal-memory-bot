import type { CookEvent, RecommendationEvent } from "../domain/history";

export interface ConfirmationHistoryRepository {
  findRecommendationById(id: string): Promise<RecommendationEvent | null>;
  recordCook(event: CookEvent): Promise<{ kind: "created"; event: CookEvent } | { kind: "duplicate" }>;
}

export interface ConfirmRecommendationCookedDependencies {
  history: ConfirmationHistoryRepository;
  now: Date;
  generateId: () => string;
}

export type ConfirmRecommendationCookedResult =
  | { kind: "recommendation-not-found" }
  | { kind: "created"; event: CookEvent }
  | { kind: "duplicate" };

export async function confirmRecommendationCooked(
  recommendationId: string,
  cookedByUserId: string,
  telegramCallbackQueryId: string,
  dependencies: ConfirmRecommendationCookedDependencies
): Promise<ConfirmRecommendationCookedResult> {
  const recommendation = await dependencies.history.findRecommendationById(recommendationId);

  if (recommendation === null) {
    return { kind: "recommendation-not-found" };
  }

  return dependencies.history.recordCook({
    id: dependencies.generateId(),
    dishId: recommendation.primaryDishId,
    cookedByUserId,
    cookedAt: dependencies.now.toISOString(),
    telegramCallbackQueryId
  });
}
