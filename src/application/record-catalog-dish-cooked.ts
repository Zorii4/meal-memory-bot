import type { CookEvent } from "../domain/history";
import type { CatalogDish } from "./get-dish-catalog-page";

export interface CatalogCookDishRepository {
  findActiveCatalogDishById(id: string): Promise<CatalogDish | null>;
}

export interface CatalogCookHistoryRepository {
  recordCook(event: CookEvent): Promise<{ kind: "created"; event: CookEvent } | { kind: "duplicate" }>;
}

export interface RecordCatalogDishCookedDependencies {
  dishes: CatalogCookDishRepository;
  history: CatalogCookHistoryRepository;
  now: Date;
  generateId: () => string;
}

export type RecordCatalogDishCookedResult =
  | { kind: "dish-not-found" }
  | { kind: "created"; event: CookEvent }
  | { kind: "duplicate" };

export async function recordCatalogDishCooked(
  dishId: string,
  cookedByUserId: string,
  telegramCallbackQueryId: string,
  dependencies: RecordCatalogDishCookedDependencies
): Promise<RecordCatalogDishCookedResult> {
  const dish = await dependencies.dishes.findActiveCatalogDishById(dishId);

  if (dish === null) {
    return { kind: "dish-not-found" };
  }

  return dependencies.history.recordCook({
    id: dependencies.generateId(),
    dishId: dish.id,
    cookedByUserId,
    cookedAt: dependencies.now.toISOString(),
    telegramCallbackQueryId
  });
}
