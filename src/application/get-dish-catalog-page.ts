const CATALOG_PAGE_SIZE = 8;

export interface CatalogDish {
  id: string;
  name: string;
}

export interface CatalogDishRepository {
  listActiveCatalogPage(limit: number, offset: number): Promise<CatalogDish[]>;
}

export interface GetDishCatalogPageDependencies {
  dishes: CatalogDishRepository;
}

export interface DishCatalogPage {
  dishes: CatalogDish[];
  page: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export async function getDishCatalogPage(
  page: number,
  dependencies: GetDishCatalogPageDependencies
): Promise<DishCatalogPage> {
  const normalizedPage = Math.max(0, page);
  const offset = normalizedPage * CATALOG_PAGE_SIZE;
  const dishes = await dependencies.dishes.listActiveCatalogPage(CATALOG_PAGE_SIZE + 1, offset);

  return {
    dishes: dishes.slice(0, CATALOG_PAGE_SIZE),
    page: normalizedPage,
    hasPreviousPage: normalizedPage > 0,
    hasNextPage: dishes.length > CATALOG_PAGE_SIZE
  };
}

export { CATALOG_PAGE_SIZE };
