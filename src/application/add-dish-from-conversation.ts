import {
  addDish,
  type AddDishResult,
  type DishRepository
} from "./add-dish";
import type { ConversationStateRepository } from "./conversation-state-repository";

export interface AddDishFromConversationDependencies {
  dishes: DishRepository;
  states: ConversationStateRepository;
  now: Date;
  generateId: () => string;
}

export type AddDishFromConversationResult =
  | AddDishResult
  | { kind: "not-awaiting-dish" }
  | { kind: "expired" };

export async function addDishFromConversation(
  telegramUserId: string,
  message: string,
  dependencies: AddDishFromConversationDependencies
): Promise<AddDishFromConversationResult> {
  const state = await dependencies.states.findByUserId(telegramUserId);

  if (state === null || state.state !== "awaiting_dish") {
    return { kind: "not-awaiting-dish" };
  }

  if (state.expiresAt <= dependencies.now.toISOString()) {
    await dependencies.states.clear(telegramUserId);
    return { kind: "expired" };
  }

  const result = await addDish(
    { message, userId: telegramUserId },
    {
      dishes: dependencies.dishes,
      now: dependencies.now,
      generateId: dependencies.generateId
    }
  );

  if (result.kind === "created") {
    await dependencies.states.clear(telegramUserId);
  }

  return result;
}
