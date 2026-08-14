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
  page: number;
}

export interface CatalogDeleteCallbackData {
  dishId: string;
  page: number;
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

export function createCatalogCookCallbackData(dishId: string, page: number = 0): string {
  return `${CATALOG_COOK_ACTION}:${dishId}:${page}`;
}

export function createCatalogDeleteCallbackData(dishId: string, page: number = 0): string {
  return `${CATALOG_DELETE_ACTION}:${dishId}:${page}`;
}

export function createCatalogConfirmDeleteCallbackData(dishId: string, page: number = 0): string {
  return `${CATALOG_CONFIRM_DELETE_ACTION}:${dishId}:${page}`;
}

export function createCatalogCancelDeleteCallbackData(dishId: string, page: number = 0): string {
  return `${CATALOG_CANCEL_DELETE_ACTION}:${dishId}:${page}`;
}

export function createCatalogSimilarRecommendationCallbackData(dishId: string): string {
  return `${CATALOG_SIMILAR_RECOMMENDATION_ACTION}:${dishId}`;
}

export function parseCatalogCallbackData(value: string | undefined): CatalogCallbackData | null {
  if (value === undefined) {
    return null;
  }

  const [action, identifier, pageValue, extra] = value.split(":");

  if (identifier === undefined || extra !== undefined) {
    return null;
  }

  if (identifier.length > 0 && identifier.length <= 56) {
    const page = pageValue === undefined ? 0 : parsePage(pageValue);

    if (action === CATALOG_COOK_ACTION) {
      return page === null ? null : { kind: "cook", value: { dishId: identifier, page } };
    }

    if (action === CATALOG_DELETE_ACTION) {
      return page === null ? null : { kind: "request-delete", value: { dishId: identifier, page } };
    }

    if (action === CATALOG_CONFIRM_DELETE_ACTION) {
      return page === null ? null : { kind: "confirm-delete", value: { dishId: identifier, page } };
    }

    if (action === CATALOG_CANCEL_DELETE_ACTION) {
      return page === null ? null : { kind: "cancel-delete", value: { dishId: identifier, page } };
    }

    if (action === CATALOG_SIMILAR_RECOMMENDATION_ACTION && pageValue === undefined) {
      return { kind: "similar-recommendation", value: { dishId: identifier } };
    }
  }

  if (action !== CATALOG_PAGE_ACTION || pageValue !== undefined) {
    return null;
  }

  const page = parsePage(identifier);

  return page === null ? null : { kind: "page", value: { page } };
}

function parsePage(value: string): number | null {
  if (!/^(0|[1-9]\d*)$/.test(value)) {
    return null;
  }

  const page = Number(value);
  return Number.isSafeInteger(page) ? page : null;
}
