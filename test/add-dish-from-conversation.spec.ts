import { describe, expect, it } from "vitest";
import {
  addDishFromConversation
} from "../src/application/add-dish-from-conversation";
import type { DishRepository } from "../src/application/add-dish";
import type { ConversationStateRepository } from "../src/application/conversation-state-repository";
import type { Dish, NewDish } from "../src/domain/dish";

const now = new Date("2026-07-21T12:00:00.000Z");

describe("addDishFromConversation", () => {
  it("adds a dish and clears the conversation state", async () => {
    const states = new StateRepositoryStub(awaitingDishState("2026-07-21T12:15:00.000Z"));
    const dishes = new DishRepositoryStub();

    const result = await addDishFromConversation("123", "Омлет\nяйца, помидоры", {
      dishes,
      states,
      now,
      generateId: () => "dish-1"
    });

    expect(result).toMatchObject({ kind: "created", dish: { id: "dish-1", name: "Омлет" } });
    expect(states.clearedUserIds).toEqual(["123"]);
    expect(dishes.createdDishes).toMatchObject([
      { id: "dish-1", normalizedName: "омлет", details: "яйца, помидоры" }
    ]);
  });

  it("keeps the state while the user corrects an invalid dish name", async () => {
    const states = new StateRepositoryStub(awaitingDishState("2026-07-21T12:15:00.000Z"));

    const result = await addDishFromConversation("123", "x", {
      dishes: new DishRepositoryStub(),
      states,
      now,
      generateId: () => "dish-1"
    });

    expect(result).toEqual({ kind: "invalid", code: "NAME_TOO_SHORT" });
    expect(states.clearedUserIds).toEqual([]);
  });

  it("clears an expired state without writing a dish", async () => {
    const states = new StateRepositoryStub(awaitingDishState("2026-07-21T11:59:59.999Z"));
    const dishes = new DishRepositoryStub();

    const result = await addDishFromConversation("123", "Омлет", {
      dishes,
      states,
      now,
      generateId: () => "dish-1"
    });

    expect(result).toEqual({ kind: "expired" });
    expect(states.clearedUserIds).toEqual(["123"]);
    expect(dishes.createdDishes).toEqual([]);
  });
});

function awaitingDishState(expiresAt: string) {
  return {
    telegramUserId: "123",
    state: "awaiting_dish" as const,
    expiresAt,
    updatedAt: "2026-07-21T11:45:00.000Z"
  };
}

class StateRepositoryStub implements ConversationStateRepository {
  public readonly clearedUserIds: string[] = [];

  public constructor(private readonly state: ReturnType<typeof awaitingDishState> | null = null) {}

  public async save(state: ReturnType<typeof awaitingDishState>): Promise<ReturnType<typeof awaitingDishState>> {
    return state;
  }

  public async findByUserId(): Promise<ReturnType<typeof awaitingDishState> | null> {
    return this.state;
  }

  public async clear(telegramUserId: string): Promise<boolean> {
    this.clearedUserIds.push(telegramUserId);
    return true;
  }
}

class DishRepositoryStub implements DishRepository {
  public readonly createdDishes: NewDish[] = [];

  public async create(dish: NewDish): Promise<{ kind: "created"; dish: Dish }> {
    this.createdDishes.push(dish);
    return { kind: "created", dish: { ...dish, isActive: true } };
  }

  public async findByNormalizedName(): Promise<Dish | null> {
    return null;
  }
}
