import { describe, expect, it } from "vitest";
import {
  recordCatalogDishCooked,
  type CatalogCookDishRepository,
  type CatalogCookHistoryRepository
} from "../src/application/record-catalog-dish-cooked";
import type { CatalogDish } from "../src/application/get-dish-catalog-page";
import type { CookEvent } from "../src/domain/history";

const now = new Date("2026-07-27T12:00:00.000Z");

describe("recordCatalogDishCooked", () => {
  it("records cooking for an active catalog dish", async () => {
    const history = new HistoryRepositoryStub();

    const result = await recordCatalogDishCooked("dish-1", "123", "callback-1", {
      dishes: new DishRepositoryStub({ id: "dish-1", name: "Омлет" }),
      history,
      now,
      generateId: () => "cook-1"
    });

    expect(result).toEqual({
      kind: "created",
      event: {
        id: "cook-1",
        dishId: "dish-1",
        cookedByUserId: "123",
        cookedAt: now.toISOString(),
        telegramCallbackQueryId: "callback-1"
      }
    });
  });

  it("does not create an event for a missing or inactive catalog dish", async () => {
    const history = new HistoryRepositoryStub();

    const result = await recordCatalogDishCooked("missing", "123", "callback-1", {
      dishes: new DishRepositoryStub(null),
      history,
      now,
      generateId: () => "cook-1"
    });

    expect(result).toEqual({ kind: "dish-not-found" });
    expect(history.events).toEqual([]);
  });

  it("returns the repository's duplicate result for a repeated callback", async () => {
    const history = new HistoryRepositoryStub("duplicate");

    const result = await recordCatalogDishCooked("dish-1", "123", "callback-1", {
      dishes: new DishRepositoryStub({ id: "dish-1", name: "Омлет" }),
      history,
      now,
      generateId: () => "cook-1"
    });

    expect(result).toEqual({ kind: "duplicate" });
  });
});

class DishRepositoryStub implements CatalogCookDishRepository {
  public constructor(private readonly dish: CatalogDish | null) {}

  public async findActiveCatalogDishById(): Promise<CatalogDish | null> {
    return this.dish;
  }
}

class HistoryRepositoryStub implements CatalogCookHistoryRepository {
  public readonly events: CookEvent[] = [];

  public constructor(private readonly result: "created" | "duplicate" = "created") {}

  public async recordCook(event: CookEvent): Promise<{ kind: "created"; event: CookEvent } | { kind: "duplicate" }> {
    if (this.result === "duplicate") {
      return { kind: "duplicate" };
    }

    this.events.push(event);
    return { kind: "created", event };
  }
}
