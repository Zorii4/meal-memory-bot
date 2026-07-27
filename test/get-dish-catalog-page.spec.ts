import { describe, expect, it } from "vitest";
import {
  CATALOG_PAGE_SIZE,
  getDishCatalogPage,
  type CatalogDish,
  type CatalogDishRepository
} from "../src/application/get-dish-catalog-page";

describe("getDishCatalogPage", () => {
  it("returns the first page and indicates when another page exists", async () => {
    const result = await getDishCatalogPage(0, {
      dishes: new DishCatalogRepositoryStub(dishes(CATALOG_PAGE_SIZE + 1))
    });

    expect(result).toEqual({
      dishes: dishes(CATALOG_PAGE_SIZE),
      page: 0,
      hasPreviousPage: false,
      hasNextPage: true
    });
  });

  it("returns the final page without a next-page flag", async () => {
    const result = await getDishCatalogPage(1, {
      dishes: new DishCatalogRepositoryStub(dishes(CATALOG_PAGE_SIZE + 1))
    });

    expect(result).toEqual({
      dishes: [{ id: "dish-9", name: "Блюдо 9" }],
      page: 1,
      hasPreviousPage: true,
      hasNextPage: false
    });
  });

  it("normalizes a negative page to the first page", async () => {
    const result = await getDishCatalogPage(-1, {
      dishes: new DishCatalogRepositoryStub(dishes(1))
    });

    expect(result.page).toBe(0);
    expect(result.dishes).toEqual(dishes(1));
  });

  it("returns an empty catalog page when there are no active dishes", async () => {
    const result = await getDishCatalogPage(0, {
      dishes: new DishCatalogRepositoryStub([])
    });

    expect(result).toEqual({
      dishes: [],
      page: 0,
      hasPreviousPage: false,
      hasNextPage: false
    });
  });
});

function dishes(count: number): CatalogDish[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `dish-${index + 1}`,
    name: `Блюдо ${index + 1}`
  }));
}

class DishCatalogRepositoryStub implements CatalogDishRepository {
  public constructor(private readonly dishes: CatalogDish[]) {}

  public async listActiveCatalogPage(limit: number, offset: number): Promise<CatalogDish[]> {
    return this.dishes.slice(offset, offset + limit);
  }
}
