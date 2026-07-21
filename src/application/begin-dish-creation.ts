import type { ConversationState } from "../domain/conversation-state";
import type { ConversationStateRepository } from "./conversation-state-repository";

const AWAITING_DISH_DURATION_MS = 15 * 60 * 1_000;

export interface BeginDishCreationDependencies {
  states: ConversationStateRepository;
  now: Date;
}

export async function beginDishCreation(
  telegramUserId: string,
  dependencies: BeginDishCreationDependencies
): Promise<ConversationState> {
  const state: ConversationState = {
    telegramUserId,
    state: "awaiting_dish",
    expiresAt: new Date(dependencies.now.getTime() + AWAITING_DISH_DURATION_MS).toISOString(),
    updatedAt: dependencies.now.toISOString()
  };

  return dependencies.states.save(state);
}
