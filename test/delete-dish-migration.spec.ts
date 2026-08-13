import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import initialSchema from "../migrations/0001_initial_schema.sql?raw";
import deleteDishRelatedHistory from "../migrations/0002_delete_dish_related_history.sql?raw";
import { D1DishRepository } from "../src/infrastructure/d1/dish-repository";
import { D1HistoryRepository } from "../src/infrastructure/d1/history-repository";

beforeAll(async () => {
  const statements = initialSchema
    .split(/;\s*$/m)
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0)
    .filter((statement) => !statement.startsWith("PRAGMA"));

  await env.DB.batch(statements.map((statement) => env.DB.prepare(statement)));
});

describe("0002_delete_dish_related_history migration", () => {
  it("cleans related history when applied to a database with existing data", async () => {
    const dishes = new D1DishRepository(env.DB);
    const history = new D1HistoryRepository(env.DB);
    await dishes.create({
      id: "migration-dish-1",
      name: "Омлет",
      normalizedName: "migration омлет",
      details: null,
      source: "user",
      createdByUserId: "123",
      createdAt: "2026-07-27T12:00:00.000Z",
      updatedAt: "2026-07-27T12:00:00.000Z"
    });
    await history.recordCook({
      id: "migration-cook-1",
      dishId: "migration-dish-1",
      cookedByUserId: "123",
      cookedAt: "2026-07-27T12:00:00.000Z",
      telegramCallbackQueryId: "migration-callback-1"
    });
    await env.DB
      .prepare(
        `INSERT INTO recommendation_events (
          id, primary_dish_id, new_idea_json, requested_by_user_id, created_at
        ) VALUES (?, ?, ?, ?, ?)`
      )
      .bind("migration-recommendation-1", "migration-dish-1", null, "123", "2026-07-27T12:00:00.000Z")
      .run();

    await env.DB
      .prepare(deleteDishRelatedHistory.replace(/^PRAGMA foreign_keys = ON;\s*/m, ""))
      .run();

    expect(await dishes.deleteActiveCatalogDishById("migration-dish-1")).toBe(true);
    expect(
      await env.DB
        .prepare("SELECT COUNT(*) AS count FROM cook_events WHERE dish_id = ?")
        .bind("migration-dish-1")
        .first<{ count: number }>()
    ).toEqual({ count: 0 });
    expect(
      await env.DB
        .prepare("SELECT COUNT(*) AS count FROM recommendation_events WHERE primary_dish_id = ?")
        .bind("migration-dish-1")
        .first<{ count: number }>()
    ).toEqual({ count: 0 });
  });
});
