const CATALOG_PAGE_ACTION = "p";
const CATALOG_COOK_ACTION = "m";
const CATALOG_DELETE_ACTION = "d";
const CATALOG_CONFIRM_DELETE_ACTION = "x";
const CATALOG_CANCEL_DELETE_ACTION = "k";
const CATALOG_SIMILAR_RECOMMENDATION_ACTION = "r";

export interface CatalogPageCallbackData {
  page: number;
}

export interface CatalogCookCallbackData {
  dishId: string;
}

export interface CatalogDeleteCallbackData {
  dishId: string;
}

export type CatalogCallbackData =
  | { kind: "page"; value: CatalogPageCallbackData }
  | { kind: "cook"; value: CatalogCookCallbackData }
  | { kind: "request-delete"; value: CatalogDeleteCallbackData }
  | { kind: "confirm-delete"; value: CatalogDeleteCallbackData }
  | { kind: "cancel-delete"; value: CatalogDeleteCallbackData }
  | { kind: "similar-recommendation"; value: CatalogDishCallbackData };

export interface CatalogDishCallbackData {
  dishId: string;
}

export function createCatalogPageCallbackData(page: number): string {
  return `${CATALOG_PAGE_ACTION}:${page}`;
}

export function createCatalogCookCallbackData(dishId: string): string {
  return `${CATALOG_COOK_ACTION}:${dishId}`;
}

export function createCatalogDeleteCallbackData(dishId: string): string {
  return `${CATALOG_DELETE_ACTION}:${dishId}`;
}

export function createCatalogConfirmDeleteCallbackData(dishId: string): string {
  return `${CATALOG_CONFIRM_DELETE_ACTION}:${dishId}`;
}

export function createCatalogCancelDeleteCallbackData(dishId: string): string {
  return `${CATALOG_CANCEL_DELETE_ACTION}:${dishId}`;
}

export function createCatalogSimilarRecommendationCallbackData(dishId: string): string {
  return `${CATALOG_SIMILAR_RECOMMENDATION_ACTION}:${dishId}`;
}

export function parseCatalogCallbackData(value: string | undefined): CatalogCallbackData | null {
  if (value === undefined) {
    return null;
  }

  const [action, identifier, extra] = value.split(":");

  if (identifier === undefined || extra !== undefined) {
    return null;
  }

  if (identifier.length > 0 && identifier.length <= 60) {
    if (action === CATALOG_COOK_ACTION) {
      return { kind: "cook", value: { dishId: identifier } };
    }

    if (action === CATALOG_DELETE_ACTION) {
      return { kind: "request-delete", value: { dishId: identifier } };
    }

    if (action === CATALOG_CONFIRM_DELETE_ACTION) {
      return { kind: "confirm-delete", value: { dishId: identifier } };
    }

    if (action === CATALOG_CANCEL_DELETE_ACTION) {
      return { kind: "cancel-delete", value: { dishId: identifier } };
    }

    if (action === CATALOG_SIMILAR_RECOMMENDATION_ACTION) {
      return { kind: "similar-recommendation", value: { dishId: identifier } };
    }
  }

  if (action !== CATALOG_PAGE_ACTION || !/^(0|[1-9]\d*)$/.test(identifier)) {
    return null;
  }

  const page = Number(identifier);

  return Number.isSafeInteger(page) ? { kind: "page", value: { page } } : null;
}
