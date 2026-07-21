import { env } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { NewDish } from "../src/domain/dish";
import type { CookEvent, RecommendationEvent } from "../src/domain/history";
import { D1DishRepository } from "../src/infrastructure/d1/dish-repository";
import { D1HistoryRepository } from "../src/infrastructure/d1/history-repository";
import { D1StateRepository } from "../src/infrastructure/d1/state-repository";
import { applyInitialSchema, resetDatabase } from "./helpers/apply-initial-schema";

const dish: NewDish = {
  id: "dish-history-1",
  name: "Омлет",
  normalizedName: "омлет",
  details: null,
  source: "user",
  createdByUserId: "123456",
  createdAt: "2026-07-21T12:00:00.000Z",
  updatedAt: "2026-07-21T12:00:00.000Z"
};

beforeAll(async () => {
  await applyInitialSchema(env.DB);
});

describe("D1HistoryRepository", () => {
  beforeEach(async () => {
    await resetDatabase(env.DB);
    await new D1DishRepository(env.DB).create(dish);
  });

  it("records a cook event only once for a callback query", async () => {
    const repository = new D1HistoryRepository(env.DB);
    const event: CookEvent = {
      id: "cook-1",
      dishId: dish.id,
      cookedByUserId: "123456",
      cookedAt: "2026-07-21T18:00:00.000Z",
      telegramCallbackQueryId: "callback-1"
    };

    const first = await repository.recordCook(event);
    const repeated = await repository.recordCook({ ...event, id: "cook-2" });

    expect(first).toEqual({ kind: "created", event });
    expect(repeated).toEqual({ kind: "duplicate" });
  });

  it("validates new idea JSON when storing and reading a recommendation", async () => {
    const repository = new D1HistoryRepository(env.DB);
    const event: RecommendationEvent = {
      id: "recommendation-1",
      primaryDishId: dish.id,
      newIdeaJson: '{"name":"Шакшука"}',
      requestedByUserId: "123456",
      createdAt: "2026-07-21T18:00:00.000Z"
    };

    await repository.createRecommendation(event);
    const found = await repository.findRecommendationById(event.id);

    expect(found).toEqual(event);
  });

  it("rejects an invalid new idea JSON before writing", async () => {
    const repository = new D1HistoryRepository(env.DB);

    await expect(
      repository.createRecommendation({
        id: "recommendation-invalid-json",
        primaryDishId: dish.id,
        newIdeaJson: "not json",
        requestedByUserId: "123456",
        createdAt: "2026-07-21T18:00:00.000Z"
      })
    ).rejects.toMatchObject({ code: "INVALID_NEW_IDEA_JSON" });
  });
});

describe("D1StateRepository", () => {
  beforeEach(async () => {
    await resetDatabase(env.DB);
  });

  it("saves, updates, and clears a conversation state", async () => {
    const repository = new D1StateRepository(env.DB);
    const initialState = {
      telegramUserId: "123456",
      state: "awaiting_dish" as const,
      expiresAt: "2026-07-21T12:15:00.000Z",
      updatedAt: "2026-07-21T12:00:00.000Z"
    };
    const updatedState = {
      ...initialState,
      expiresAt: "2026-07-21T12:30:00.000Z",
      updatedAt: "2026-07-21T12:15:00.000Z"
    };

    await repository.save(initialState);
    await repository.save(updatedState);

    expect(await repository.findByUserId(initialState.telegramUserId)).toEqual(updatedState);
    expect(await repository.clear(initialState.telegramUserId)).toBe(true);
    expect(await repository.findByUserId(initialState.telegramUserId)).toBeNull();
  });
});
