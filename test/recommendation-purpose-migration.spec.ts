import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import initialSchema from "../migrations/0001_initial_schema.sql?raw";
import recommendationPurpose from "../migrations/0003_add_recommendation_purpose.sql?raw";

beforeAll(async () => {
  const statements = initialSchema
    .split(/;\s*$/m)
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0 && !statement.startsWith("PRAGMA"));

  await env.DB.batch(statements.map((statement) => env.DB.prepare(statement)));
  await env.DB
    .prepare(
      `INSERT INTO dishes (
        id, name, normalized_name, details, source, created_by_user_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind("dish-1", "Омлет", "омлет", null, "user", "123", "2026-08-01T12:00:00.000Z", "2026-08-01T12:00:00.000Z")
    .run();
  await env.DB
    .prepare(
      `INSERT INTO recommendation_events (
        id, primary_dish_id, new_idea_json, requested_by_user_id, created_at
      ) VALUES (?, ?, ?, ?, ?)`
    )
    .bind("recommendation-before-migration", "dish-1", null, "123", "2026-08-01T12:00:00.000Z")
    .run();
  await env.DB.prepare(recommendationPurpose.trim()).run();
});

describe("0003_add_recommendation_purpose migration", () => {
  it("marks existing recommendation events as daily and accepts similar events", async () => {
    expect(
      await env.DB
        .prepare("SELECT purpose FROM recommendation_events WHERE id = ?")
        .bind("recommendation-before-migration")
        .first<{ purpose: string }>()
    ).toEqual({ purpose: "daily" });

    await env.DB
      .prepare(
        `INSERT INTO recommendation_events (
          id, primary_dish_id, purpose, new_idea_json, requested_by_user_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind("recommendation-similar", "dish-1", "similar", null, "123", "2026-08-02T12:00:00.000Z")
      .run();

    expect(
      await env.DB
        .prepare("SELECT purpose FROM recommendation_events WHERE id = ?")
        .bind("recommendation-similar")
        .first<{ purpose: string }>()
    ).toEqual({ purpose: "similar" });
  });
});
