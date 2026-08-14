import type { UserGuideMessage, UserGuideRepository } from "../../application/user-guide-repository";

interface UserGuideMessageRow {
  telegram_user_id: string;
  chat_id: string;
  message_id: number;
}

export class D1UserGuideRepository implements UserGuideRepository {
  public constructor(private readonly db: D1Database) {}

  public async findByUserId(telegramUserId: string): Promise<UserGuideMessage | null> {
    const row = await this.db
      .prepare(
        `SELECT telegram_user_id, chat_id, message_id
        FROM user_guide_messages
        WHERE telegram_user_id = ?`
      )
      .bind(telegramUserId)
      .first<UserGuideMessageRow>();

    return row === null
      ? null
      : { telegramUserId: row.telegram_user_id, chatId: row.chat_id, messageId: row.message_id };
  }

  public async save(message: UserGuideMessage): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO user_guide_messages (telegram_user_id, chat_id, message_id)
        VALUES (?, ?, ?)
        ON CONFLICT(telegram_user_id) DO UPDATE SET
          chat_id = excluded.chat_id,
          message_id = excluded.message_id`
      )
      .bind(message.telegramUserId, message.chatId, message.messageId)
      .run();
  }
}
