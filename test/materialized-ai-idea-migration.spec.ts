import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import initialSchema from "../migrations/0001_initial_schema.sql?raw";
import deleteDishRelatedHistory from "../migrations/0002_delete_dish_related_history.sql?raw";
import recommendationPurpose from "../migrations/0003_add_recommendation_purpose.sql?raw";
import materializedAiIdeas from "../migrations/0004_link_materialized_ai_ideas.sql?raw";
import { D1DishRepository } from "../src/infrastructure/d1/dish-repository";
import { D1HistoryRepository } from "../src/infrastructure/d1/history-repository";
import { saveAIRecommendationIdea } from "../src/application/save-ai-recommendation-idea";

beforeAll(async () => {
  const statements = initialSchema
    .split(/;\s*$/m)
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0 && !statement.startsWith("PRAGMA"));

  await env.DB.batch([
    ...statements.map((statement) => env.DB.prepare(statement)),
    env.DB.prepare(deleteDishRelatedHistory.replace(/^PRAGMA foreign_keys = ON;\s*/m, "").trim()),
    env.DB.prepare(recommendationPurpose.trim())
  ]);
});

describe("0004_link_materialized_ai_ideas migration", () => {
  it("removes an existing recommendation with its deleted materialized AI idea", async () => {
    const dishes = new D1DishRepository(env.DB);
    const history = new D1HistoryRepository(env.DB);
    await dishes.create({
      id: "primary-dish",
      name: "Омлет",
      normalizedName: "омлет migration",
      details: null,
      source: "user",
      createdByUserId: "123",
      createdAt: "2026-08-14T12:00:00.000Z",
      updatedAt: "2026-08-14T12:00:00.000Z"
    });
    await dishes.create({
      id: "ai-dish",
      name: "Суп с чечевицей",
      normalizedName: "суп с чечевицей migration",
      details: null,
      source: "ai",
      createdByUserId: "123",
      createdAt: "2026-08-14T12:00:00.000Z",
      updatedAt: "2026-08-14T12:00:00.000Z"
    });
    await history.createRecommendation({
      id: "recommendation-ai-idea",
      primaryDishId: "primary-dish",
      purpose: "daily",
      newIdeaJson: JSON.stringify({ name: "Суп с чечевицей" }),
      requestedByUserId: "123",
      createdAt: "2026-08-14T12:00:00.000Z"
    });

    await env.DB.prepare(materializedAiIdeas.trim()).run();
    expect(
      await env.DB
        .prepare("SELECT new_idea_dish_id FROM recommendation_events WHERE id = ?")
        .bind("recommendation-ai-idea")
        .first<{ new_idea_dish_id: string }>()
    ).toEqual({ new_idea_dish_id: "ai-dish" });

    await dishes.deleteActiveCatalogDishById("ai-dish");
    expect(await history.findRecommendationById("recommendation-ai-idea")).toBeNull();
    await expect(
      saveAIRecommendationIdea("recommendation-ai-idea", "123", {
        dishes,
        history,
        now: new Date("2026-08-14T12:01:00.000Z"),
        generateId: () => "recreated-ai-dish"
      })
    ).resolves.toEqual({ kind: "recommendation-not-found" });
  });

  it("does not recreate a newly saved AI idea through its old button after deletion", async () => {
    const dishes = new D1DishRepository(env.DB);
    const history = new D1HistoryRepository(env.DB);
    await dishes.create({
      id: "primary-dish-new-flow",
      name: "Гречка",
      normalizedName: "гречка new flow",
      details: null,
      source: "user",
      createdByUserId: "123",
      createdAt: "2026-08-14T13:00:00.000Z",
      updatedAt: "2026-08-14T13:00:00.000Z"
    });
    await history.createRecommendation({
      id: "recommendation-new-flow",
      primaryDishId: "primary-dish-new-flow",
      purpose: "daily",
      newIdeaJson: JSON.stringify({
        name: "Булгур с овощами",
        similarToDishIds: ["primary-dish-new-flow"],
        whyItFits: "Простой похожий вариант.",
        ingredients: ["булгур", "овощи"],
        prepMinutes: 25,
        nutritionFocus: ["fiber"]
      }),
      requestedByUserId: "123",
      createdAt: "2026-08-14T13:00:00.000Z"
    });

    const saved = await saveAIRecommendationIdea("recommendation-new-flow", "123", {
      dishes,
      history,
      now: new Date("2026-08-14T13:01:00.000Z"),
      generateId: () => "ai-dish-new-flow"
    });
    expect(saved).toMatchObject({ kind: "created", dish: { id: "ai-dish-new-flow" } });

    await dishes.deleteActiveCatalogDishById("ai-dish-new-flow");
    await expect(
      saveAIRecommendationIdea("recommendation-new-flow", "123", {
        dishes,
        history,
        now: new Date("2026-08-14T13:02:00.000Z"),
        generateId: () => "recreated-ai-dish"
      })
    ).resolves.toEqual({ kind: "recommendation-not-found" });
  });
});
