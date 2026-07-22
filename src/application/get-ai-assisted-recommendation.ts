import type { Dish, DishStatistics } from "../domain/dish";
import { getFallbackRecommendation } from "../domain/get-fallback-recommendation";
import type { RecentCookedDish, RecommendationEvent } from "../domain/history";
import { normalizeDishName } from "../domain/normalize-dish-name";
import { selectStaleCandidates } from "../domain/select-stale-candidates";
import {
  parseAIRecommendationResponse,
  type AIRecommendationResponse
} from "../infrastructure/ai/ai-contract";
import {
  AI_CATALOG_NAME_LIMIT,
  AI_RECENT_COOKED_LIMIT,
  buildAIRecommendationInput
} from "../infrastructure/ai/recommendation-input";

export interface AIAssistedRecommendationDishRepository {
  listActiveWithStatistics(): Promise<DishStatistics[]>;
  listActiveNames(limit: number): Promise<string[]>;
  findByNormalizedName(normalizedName: string): Promise<Dish | null>;
}

export interface AIAssistedRecommendationHistoryRepository {
  listRecentCooked(limit: number): Promise<RecentCookedDish[]>;
  createRecommendation(event: RecommendationEvent): Promise<RecommendationEvent>;
}

export interface AIRecommendationClient {
  complete(request: { systemPrompt: string; input: unknown }): Promise<string>;
}

export interface GetAIAssistedRecommendationDependencies {
  dishes: AIAssistedRecommendationDishRepository;
  history: AIAssistedRecommendationHistoryRepository;
  ai: AIRecommendationClient;
  systemPrompt: string;
  now: Date;
  generateId: () => string;
  random: () => number;
  onAIFallback?: (error: unknown) => void;
}

export type GetAIAssistedRecommendationResult =
  | { kind: "empty" }
  | {
      kind: "recommended";
      source: "ai" | "fallback";
      dish: DishStatistics;
      candidates: DishStatistics[];
      recommendation: RecommendationEvent;
      aiResponse: AIRecommendationResponse | null;
    };

export async function getAIAssistedRecommendationForUser(
  userId: string,
  dependencies: GetAIAssistedRecommendationDependencies
): Promise<GetAIAssistedRecommendationResult> {
  const dishes = await dependencies.dishes.listActiveWithStatistics();
  const candidates = selectStaleCandidates(dishes, dependencies.random);
  const fallbackDish = getFallbackRecommendation(candidates);

  if (fallbackDish === null) {
    return { kind: "empty" };
  }

  const aiResult = await getAIResult(candidates, dependencies);
  const dish = aiResult?.dish ?? fallbackDish;
  const aiResponse = aiResult?.response ?? null;
  const recommendation: RecommendationEvent = {
    id: dependencies.generateId(),
    primaryDishId: dish.id,
    newIdeaJson: aiResponse?.newIdea === null || aiResponse === null ? null : JSON.stringify(aiResponse.newIdea),
    requestedByUserId: userId,
    createdAt: dependencies.now.toISOString()
  };

  await dependencies.history.createRecommendation(recommendation);

  return {
    kind: "recommended",
    source: aiResult === null ? "fallback" : "ai",
    dish,
    candidates,
    recommendation,
    aiResponse
  };
}

async function getAIResult(
  candidates: DishStatistics[],
  dependencies: GetAIAssistedRecommendationDependencies
): Promise<{ dish: DishStatistics; response: AIRecommendationResponse } | null> {
  try {
    const [recentCooked, catalogNames] = await Promise.all([
      dependencies.history.listRecentCooked(AI_RECENT_COOKED_LIMIT),
      dependencies.dishes.listActiveNames(AI_CATALOG_NAME_LIMIT)
    ]);
    const responseText = await dependencies.ai.complete({
      systemPrompt: dependencies.systemPrompt,
      input: buildAIRecommendationInput({ candidates, recentCooked, catalogNames })
    });
    const response = parseAIRecommendationResponse(responseText);
    const dish = candidates.find((candidate) => candidate.id === response.selectedDishId);

    if (dish === undefined) {
      throw new AIRecommendationValidationError();
    }

    await validateNewIdea(response, candidates, dependencies.dishes);

    return { dish, response };
  } catch (error: unknown) {
    dependencies.onAIFallback?.(error);
    return null;
  }
}

async function validateNewIdea(
  response: AIRecommendationResponse,
  candidates: readonly DishStatistics[],
  dishes: Pick<AIAssistedRecommendationDishRepository, "findByNormalizedName">
): Promise<void> {
  const newIdea = response.newIdea;

  if (newIdea === null) {
    return;
  }

  const candidateIds = new Set(candidates.map((candidate) => candidate.id));

  if (newIdea.similarToDishIds.some((dishId) => !candidateIds.has(dishId))) {
    throw new AIRecommendationValidationError();
  }

  const duplicate = await dishes.findByNormalizedName(normalizeDishName(newIdea.name));

  if (duplicate !== null) {
    throw new AIRecommendationValidationError();
  }
}

export class AIRecommendationValidationError extends Error {
  public readonly code = "AI_RECOMMENDATION_INVALID";

  public constructor() {
    super("AI recommendation failed application validation");
    this.name = "AIRecommendationValidationError";
  }
}
