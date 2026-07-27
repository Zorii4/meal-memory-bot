import type { DishCatalogPage } from "../application/get-dish-catalog-page";
import { messages } from "./messages";

export function formatCatalogText(page: DishCatalogPage): string {
  if (page.dishes.length === 0) {
    return messages.catalogEmpty;
  }

  return messages.catalogPage(
    page.page + 1,
    page.dishes.map((dish) => dish.name)
  );
}
