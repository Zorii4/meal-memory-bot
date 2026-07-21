import { describe, expect, it } from "vitest";
import {
  addDish,
  type CreateDishResult,
  type DishRepository
} from "../src/application/add-dish";
import type { Dish, NewDish } from "../src/domain/dish";

const now = new Date("2026-07-21T12:00:00.000Z");

describe("addDish", () => {
  it("creates a normalized user dish from a valid message", async () => {
    const repository = new FakeDishRepository();

    const result = await addDish(
      { message: "  Ёжики с курицей  \nфарш, рис", userId: "user-1" },
      { dishes: repository, now, generateId: () => "dish-1" }
    );

    expect(result).toEqual({
      kind: "created",
      dish: {
        id: "dish-1",
        name: "Ёжики с курицей",
        normalizedName: "ежики с курицей",
        details: "фарш, рис",
        source: "user",
        isActive: true,
        createdByUserId: "user-1",
        createdAt: "2026-07-21T12:00:00.000Z",
        updatedAt: "2026-07-21T12:00:00.000Z"
      }
    });
  });

  it.each([
    ["   ", "EMPTY_MESSAGE"],
    ["x", "NAME_TOO_SHORT"],
    ["x".repeat(101), "NAME_TOO_LONG"],
    ["x".repeat(1_501), "MESSAGE_TOO_LONG"]
  ])("rejects an invalid message", async (message, code) => {
    const repository = new FakeDishRepository();

    const result = await addDish(
      { message, userId: "user-1" },
      { dishes: repository, now, generateId: () => "dish-1" }
    );

    expect(result).toEqual({ kind: "invalid", code });
    expect(repository.createdDishes).toEqual([]);
  });

  it("returns duplicate before attempting an insert", async () => {
    const repository = new FakeDishRepository({
      id: "dish-1",
      name: "Омлет",
      normalizedName: "омлет",
      details: null,
      source: "user",
      isActive: true,
      createdByUserId: "user-1",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    });

    const result = await addDish(
      { message: "  ОМЛЕТ ", userId: "user-2" },
      { dishes: repository, now, generateId: () => "dish-2" }
    );

    expect(result).toEqual({ kind: "duplicate" });
    expect(repository.createdDishes).toEqual([]);
  });

  it("handles a duplicate reported by the repository during a concurrent insert", async () => {
    const repository = new FakeDishRepository(null, { kind: "duplicate" });

    const result = await addDish(
      { message: "Омлет", userId: "user-1" },
      { dishes: repository, now, generateId: () => "dish-1" }
    );

    expect(result).toEqual({ kind: "duplicate" });
  });
});

class FakeDishRepository implements DishRepository {
  public readonly createdDishes: NewDish[] = [];

  public constructor(
    private readonly existingDish: Dish | null = null,
    private readonly createResult?: CreateDishResult
  ) {}

  public async create(dish: NewDish): Promise<CreateDishResult> {
    this.createdDishes.push(dish);

    if (this.createResult !== undefined) {
      return this.createResult;
    }

    return { kind: "created", dish: { ...dish, isActive: true } };
  }

  public async findByNormalizedName(): Promise<Dish | null> {
    return this.existingDish;
  }
}
