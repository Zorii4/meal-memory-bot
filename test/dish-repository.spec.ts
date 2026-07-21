import { env } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { NewDish } from "../src/domain/dish";
import { D1DishRepository } from "../src/infrastructure/d1/dish-repository";
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
});
