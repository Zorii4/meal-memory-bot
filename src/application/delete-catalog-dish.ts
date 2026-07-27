import type { CatalogDish } from "./get-dish-catalog-page";

export interface CatalogDeleteDishRepository {
  findActiveCatalogDishById(id: string): Promise<CatalogDish | null>;
  deleteActiveCatalogDishById(id: string): Promise<boolean>;
}

export interface BeginCatalogDishDeletionDependencies {
  dishes: Pick<CatalogDeleteDishRepository, "findActiveCatalogDishById">;
}

export interface ConfirmCatalogDishDeletionDependencies {
  dishes: CatalogDeleteDishRepository;
}

export type BeginCatalogDishDeletionResult =
  | { kind: "dish-not-found" }
  | { kind: "confirmation-required"; dish: CatalogDish };

export type ConfirmCatalogDishDeletionResult = { kind: "deleted" } | { kind: "dish-not-found" };

export async function beginCatalogDishDeletion(
  dishId: string,
  dependencies: BeginCatalogDishDeletionDependencies
): Promise<BeginCatalogDishDeletionResult> {
  const dish = await dependencies.dishes.findActiveCatalogDishById(dishId);

  return dish === null ? { kind: "dish-not-found" } : { kind: "confirmation-required", dish };
}

export async function confirmCatalogDishDeletion(
  dishId: string,
  dependencies: ConfirmCatalogDishDeletionDependencies
): Promise<ConfirmCatalogDishDeletionResult> {
  const dish = await dependencies.dishes.findActiveCatalogDishById(dishId);

  if (dish === null) {
    return { kind: "dish-not-found" };
  }

  const deleted = await dependencies.dishes.deleteActiveCatalogDishById(dish.id);

  return deleted ? { kind: "deleted" } : { kind: "dish-not-found" };
}
