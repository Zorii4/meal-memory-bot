import type { ConversationStateRepository } from "./conversation-state-repository";

export type { ConversationStateRepository } from "./conversation-state-repository";

export interface CancelConversationDependencies {
  states: ConversationStateRepository;
}

export async function cancelConversation(
  telegramUserId: string,
  dependencies: CancelConversationDependencies
): Promise<void> {
  await dependencies.states.clear(telegramUserId);
}
