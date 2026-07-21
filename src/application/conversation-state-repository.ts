import type { ConversationState } from "../domain/conversation-state";

export interface ConversationStateRepository {
  save(state: ConversationState): Promise<ConversationState>;
  findByUserId(telegramUserId: string): Promise<ConversationState | null>;
  clear(telegramUserId: string): Promise<boolean>;
}
