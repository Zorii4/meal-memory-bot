export interface UserGuideMessage {
  telegramUserId: string;
  chatId: string;
  messageId: number;
}

export interface UserGuideRepository {
  findByUserId(telegramUserId: string): Promise<UserGuideMessage | null>;
  save(message: UserGuideMessage): Promise<void>;
}
