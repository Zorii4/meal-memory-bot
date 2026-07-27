import { describe, expect, it } from "vitest";
import {
  beginCatalogDishDeletion,
  confirmCatalogDishDeletion,
  type CatalogDeleteDishRepository
} from "../src/application/delete-catalog-dish";
import type { CatalogDish } from "../src/application/get-dish-catalog-page";

describe("catalog dish deletion", () => {
  it("requires confirmation for an active dish", async () => {
    const result = await beginCatalogDishDeletion("dish-1", {
      dishes: new DishRepositoryStub({ id: "dish-1", name: "Омлет" })
    });

    expect(result).toEqual({
      kind: "confirmation-required",
      dish: { id: "dish-1", name: "Омлет" }
    });
  });

  it("does not begin deletion for a missing dish", async () => {
    const result = await beginCatalogDishDeletion("missing", {
      dishes: new DishRepositoryStub(null)
    });

    expect(result).toEqual({ kind: "dish-not-found" });
  });

  it("deletes only after confirmation", async () => {
    const dishes = new DishRepositoryStub({ id: "dish-1", name: "Омлет" });

    const result = await confirmCatalogDishDeletion("dish-1", { dishes });

    expect(result).toEqual({ kind: "deleted" });
    expect(dishes.deletedIds).toEqual(["dish-1"]);
  });

  it("does not delete a dish that disappears before confirmation", async () => {
    const dishes = new DishRepositoryStub(null);

    const result = await confirmCatalogDishDeletion("dish-1", { dishes });

    expect(result).toEqual({ kind: "dish-not-found" });
    expect(dishes.deletedIds).toEqual([]);
  });
});

class DishRepositoryStub implements CatalogDeleteDishRepository {
  public readonly deletedIds: string[] = [];

  public constructor(private readonly dish: CatalogDish | null) {}

  public async findActiveCatalogDishById(): Promise<CatalogDish | null> {
    return this.dish;
  }

  public async deleteActiveCatalogDishById(id: string): Promise<boolean> {
    this.deletedIds.push(id);
    return true;
  }
}
