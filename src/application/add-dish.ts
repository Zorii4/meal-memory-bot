import type { Dish, NewDish } from "../domain/dish";
import { normalizeDishName } from "../domain/normalize-dish-name";
import { parseDishMessage } from "../domain/parse-dish-message";

const MAX_MESSAGE_LENGTH = 1_500;
const MIN_DISH_NAME_LENGTH = 2;
const MAX_DISH_NAME_LENGTH = 100;

export interface DishRepository {
  create(dish: NewDish): Promise<CreateDishResult>;
  findByNormalizedName(normalizedName: string): Promise<Dish | null>;
}

export type CreateDishResult =
  | { kind: "created"; dish: Dish }
  | { kind: "duplicate" };

export interface AddDishInput {
  message: string;
  userId: string;
}

export interface AddDishDependencies {
  dishes: DishRepository;
  now: Date;
  generateId: () => string;
}

export type AddDishResult =
  | { kind: "created"; dish: Dish }
  | { kind: "duplicate" }
  | { kind: "invalid"; code: AddDishValidationErrorCode };

export type AddDishValidationErrorCode =
  | "EMPTY_MESSAGE"
  | "MESSAGE_TOO_LONG"
  | "NAME_TOO_SHORT"
  | "NAME_TOO_LONG";

export async function addDish(
  input: AddDishInput,
  dependencies: AddDishDependencies
): Promise<AddDishResult> {
  if (input.message.trim().length === 0) {
    return { kind: "invalid", code: "EMPTY_MESSAGE" };
  }

  if (input.message.length > MAX_MESSAGE_LENGTH) {
    return { kind: "invalid", code: "MESSAGE_TOO_LONG" };
  }

  const parsed = parseDishMessage(input.message);
  const name = parsed.name.trim();

  if (name.length < MIN_DISH_NAME_LENGTH) {
    return { kind: "invalid", code: "NAME_TOO_SHORT" };
  }

  if (name.length > MAX_DISH_NAME_LENGTH) {
    return { kind: "invalid", code: "NAME_TOO_LONG" };
  }

  const normalizedName = normalizeDishName(name);
  const existingDish = await dependencies.dishes.findByNormalizedName(normalizedName);

  if (existingDish !== null) {
    return { kind: "duplicate" };
  }

  const createdAt = dependencies.now.toISOString();
  const dish: NewDish = {
    id: dependencies.generateId(),
    name,
    normalizedName,
    details: parsed.details,
    source: "user",
    createdByUserId: input.userId,
    createdAt,
    updatedAt: createdAt
  };

  return dependencies.dishes.create(dish);
}
