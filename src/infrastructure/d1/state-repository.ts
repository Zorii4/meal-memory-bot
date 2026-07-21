import type { ConversationState, ConversationStateName } from "../../domain/conversation-state";

interface ConversationStateRow {
  telegram_user_id: string;
  state: ConversationStateName;
  expires_at: string;
  updated_at: string;
}

export class D1StateRepository {
  public constructor(private readonly db: D1Database) {}

  public async save(state: ConversationState): Promise<ConversationState> {
    await this.db
      .prepare(
        `INSERT INTO conversation_states (
          telegram_user_id,
          state,
          expires_at,
          updated_at
        ) VALUES (?, ?, ?, ?)
        ON CONFLICT(telegram_user_id) DO UPDATE SET
          state = excluded.state,
          expires_at = excluded.expires_at,
          updated_at = excluded.updated_at`
      )
      .bind(state.telegramUserId, state.state, state.expiresAt, state.updatedAt)
      .run();

    return state;
  }

  public async findByUserId(telegramUserId: string): Promise<ConversationState | null> {
    const row = await this.db
      .prepare(
        `SELECT telegram_user_id, state, expires_at, updated_at
        FROM conversation_states
        WHERE telegram_user_id = ?`
      )
      .bind(telegramUserId)
      .first<ConversationStateRow>();

    return row === null ? null : toConversationState(row);
  }

  public async clear(telegramUserId: string): Promise<boolean> {
    const result = await this.db
      .prepare("DELETE FROM conversation_states WHERE telegram_user_id = ?")
      .bind(telegramUserId)
      .run();

    return result.meta.changes > 0;
  }
}

function toConversationState(row: ConversationStateRow): ConversationState {
  return {
    telegramUserId: row.telegram_user_id,
    state: row.state,
    expiresAt: row.expires_at,
    updatedAt: row.updated_at
  };
}
