import { getFallbackRecommendation } from "../domain/get-fallback-recommendation";
import type { DishStatistics } from "../domain/dish";
import type { RecommendationEvent } from "../domain/history";
import { selectStaleCandidates } from "../domain/select-stale-candidates";

export interface RecommendationDishRepository {
  listActiveWithStatistics(): Promise<DishStatistics[]>;
}

export interface RecommendationHistoryRepository {
  createRecommendation(event: RecommendationEvent): Promise<RecommendationEvent>;
}

export interface GetFallbackRecommendationDependencies {
  dishes: RecommendationDishRepository;
  history: RecommendationHistoryRepository;
  now: Date;
  generateId: () => string;
  random: () => number;
}

export type GetFallbackRecommendationResult =
  | { kind: "empty" }
  | {
      kind: "recommended";
      dish: DishStatistics;
      candidates: DishStatistics[];
      recommendation: RecommendationEvent;
    };

export async function getFallbackRecommendationForUser(
  userId: string,
  dependencies: GetFallbackRecommendationDependencies
): Promise<GetFallbackRecommendationResult> {
  const dishes = await dependencies.dishes.listActiveWithStatistics();
  const candidates = selectStaleCandidates(dishes, dependencies.random);
  const dish = getFallbackRecommendation(candidates);

  if (dish === null) {
    return { kind: "empty" };
  }

  const recommendation: RecommendationEvent = {
    id: dependencies.generateId(),
    primaryDishId: dish.id,
    newIdeaJson: null,
    requestedByUserId: userId,
    createdAt: dependencies.now.toISOString()
  };

  await dependencies.history.createRecommendation(recommendation);

  return { kind: "recommended", dish, candidates, recommendation };
}
