import { env } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { NewDish } from "../src/domain/dish";
import { D1DishRepository } from "../src/infrastructure/d1/dish-repository";
import { D1HistoryRepository } from "../src/infrastructure/d1/history-repository";
import { applyInitialSchema, resetDatabase } from "./helpers/apply-initial-schema";

const dish: NewDish = {
  id: "dish-1",
  name: "Гречка с курицей",
  normalizedName: "гречка с курицей",
  details: "гречка, куриное филе",
  source: "user",
  createdByUserId: "123456",
  createdAt: "2026-07-21T12:00:00.000Z",
  updatedAt: "2026-07-21T12:00:00.000Z"
};

describe("D1DishRepository", () => {
  beforeAll(async () => {
    await applyInitialSchema(env.DB);
  });

  beforeEach(async () => {
    await resetDatabase(env.DB);
  });

  it("stores a dish and reads it by normalized name", async () => {
    const repository = new D1DishRepository(env.DB);

    const created = await repository.create(dish);
    const found = await new D1DishRepository(env.DB).findByNormalizedName(dish.normalizedName);

    expect(created).toEqual({ kind: "created", dish: { ...dish, isActive: true } });
    expect(found).toEqual({ ...dish, isActive: true });
  });

  it("does not create a duplicate normalized name", async () => {
    const repository = new D1DishRepository(env.DB);
    await repository.create(dish);

    const result = await repository.create({
      ...dish,
      id: "dish-2",
      name: "Гречка с курицей снова"
    });
    const found = await repository.findByNormalizedName(dish.normalizedName);

    expect(result).toEqual({ kind: "duplicate" });
    expect(found?.id).toBe(dish.id);
  });

  it("returns statistics for active dishes without overcounting cook events", async () => {
    const dishRepository = new D1DishRepository(env.DB);
    const historyRepository = new D1HistoryRepository(env.DB);
    const neverCookedDish: NewDish = {
      ...dish,
      id: "dish-2",
      name: "Суп",
      normalizedName: "суп"
    };
    const inactiveDish: NewDish = {
      ...dish,
      id: "dish-3",
      name: "Архивное блюдо",
      normalizedName: "архивное блюдо"
    };

    await dishRepository.create(dish);
    await dishRepository.create(neverCookedDish);
    await dishRepository.create(inactiveDish);
    await env.DB.prepare("UPDATE dishes SET is_active = 0 WHERE id = ?").bind(inactiveDish.id).run();
    await historyRepository.recordCook({
      id: "cook-1",
      dishId: dish.id,
      cookedByUserId: "123456",
      cookedAt: "2026-07-20T18:00:00.000Z",
      telegramCallbackQueryId: "callback-1"
    });
    await historyRepository.recordCook({
      id: "cook-2",
      dishId: dish.id,
      cookedByUserId: "123456",
      cookedAt: "2026-07-21T18:00:00.000Z",
      telegramCallbackQueryId: "callback-2"
    });
    await historyRepository.createRecommendation({
      id: "recommendation-1",
      primaryDishId: dish.id,
      newIdeaJson: null,
      requestedByUserId: "123456",
      createdAt: "2026-07-20T12:00:00.000Z"
    });
    await historyRepository.createRecommendation({
      id: "recommendation-2",
      primaryDishId: dish.id,
      newIdeaJson: null,
      requestedByUserId: "123456",
      createdAt: "2026-07-21T12:00:00.000Z"
    });

    const statistics = await dishRepository.listActiveWithStatistics();

    expect(statistics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: dish.id,
          lastCookedAt: "2026-07-21T18:00:00.000Z",
          timesCooked: 2,
          lastRecommendedAt: "2026-07-21T12:00:00.000Z"
        }),
        expect.objectContaining({
          id: neverCookedDish.id,
          lastCookedAt: null,
          timesCooked: 0,
          lastRecommendedAt: null
        })
      ])
    );
    expect(statistics).toHaveLength(2);
  });
});
