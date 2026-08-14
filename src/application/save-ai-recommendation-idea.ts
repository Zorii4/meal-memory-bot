import type { Dish, NewDish } from "../domain/dish";
import type { CookEvent, RecommendationEvent } from "../domain/history";
import { normalizeDishName } from "../domain/normalize-dish-name";
import { parseAINewIdea } from "../infrastructure/ai/ai-contract";
import type { DishRepository } from "./add-dish";

export interface NewIdeaHistoryRepository {
  findRecommendationById(id: string): Promise<RecommendationEvent | null>;
  linkNewIdeaDish(recommendationId: string, dishId: string): Promise<void>;
  recordCook(event: CookEvent): Promise<{ kind: "created"; event: CookEvent } | { kind: "duplicate" }>;
}

export interface SaveAIRecommendationIdeaDependencies {
  dishes: DishRepository;
  history: NewIdeaHistoryRepository;
  now: Date;
  generateId: () => string;
}

export type SaveAIRecommendationIdeaResult =
  | { kind: "recommendation-not-found" }
  | { kind: "new-idea-unavailable" }
  | { kind: "created"; dish: Dish }
  | { kind: "existing"; dish: Dish };

export type CookAIRecommendationIdeaResult =
  | { kind: "recommendation-not-found" }
  | { kind: "new-idea-unavailable" }
  | { kind: "created"; dish: Dish; cookEvent: CookEvent }
  | { kind: "existing"; dish: Dish; cookEvent: CookEvent }
  | { kind: "cook-duplicate"; dish: Dish };

export async function saveAIRecommendationIdea(
  recommendationId: string,
  userId: string,
  dependencies: SaveAIRecommendationIdeaDependencies
): Promise<SaveAIRecommendationIdeaResult> {
  return resolveNewIdeaDish(recommendationId, userId, dependencies);
}

export async function cookAIRecommendationIdea(
  recommendationId: string,
  userId: string,
  telegramCallbackQueryId: string,
  dependencies: SaveAIRecommendationIdeaDependencies
): Promise<CookAIRecommendationIdeaResult> {
  const result = await resolveNewIdeaDish(recommendationId, userId, dependencies);

  if (result.kind === "recommendation-not-found" || result.kind === "new-idea-unavailable") {
    return result;
  }

  const cookResult = await dependencies.history.recordCook({
    id: dependencies.generateId(),
    dishId: result.dish.id,
    cookedByUserId: userId,
    cookedAt: dependencies.now.toISOString(),
    telegramCallbackQueryId
  });

  return cookResult.kind === "duplicate"
    ? { kind: "cook-duplicate", dish: result.dish }
    : { kind: result.kind, dish: result.dish, cookEvent: cookResult.event };
}

async function resolveNewIdeaDish(
  recommendationId: string,
  userId: string,
  dependencies: SaveAIRecommendationIdeaDependencies
): Promise<SaveAIRecommendationIdeaResult> {
  const recommendation = await dependencies.history.findRecommendationById(recommendationId);

  if (recommendation === null) {
    return { kind: "recommendation-not-found" };
  }

  if (recommendation.newIdeaJson === null) {
    return { kind: "new-idea-unavailable" };
  }

  const newIdea = parseAINewIdea(recommendation.newIdeaJson);
  const normalizedName = normalizeDishName(newIdea.name);
  const existing = await dependencies.dishes.findByNormalizedName(normalizedName);

  if (existing !== null) {
    await dependencies.history.linkNewIdeaDish(recommendation.id, existing.id);
    return { kind: "existing", dish: existing };
  }

  const now = dependencies.now.toISOString();
  const dish: NewDish = {
    id: dependencies.generateId(),
    name: newIdea.name,
    normalizedName,
    details: newIdea.ingredients.join(", "),
    source: "ai",
    createdByUserId: userId,
    createdAt: now,
    updatedAt: now
  };
  const creation = await dependencies.dishes.create(dish);

  if (creation.kind === "created") {
    await dependencies.history.linkNewIdeaDish(recommendation.id, creation.dish.id);
    return creation;
  }

  const concurrentDish = await dependencies.dishes.findByNormalizedName(normalizedName);

  if (concurrentDish === null) {
    throw new NewIdeaPersistenceError();
  }

  await dependencies.history.linkNewIdeaDish(recommendation.id, concurrentDish.id);
  return { kind: "existing", dish: concurrentDish };
}

export class NewIdeaPersistenceError extends Error {
  public readonly code = "NEW_IDEA_PERSISTENCE_FAILED";

  public constructor() {
    super("AI new idea could not be resolved after a duplicate insert");
    this.name = "NewIdeaPersistenceError";
  }
}
