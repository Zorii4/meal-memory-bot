export type ConversationStateName = "awaiting_dish";

export interface ConversationState {
  telegramUserId: string;
  state: ConversationStateName;
  expiresAt: string;
  updatedAt: string;
}
