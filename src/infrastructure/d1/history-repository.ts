import type { CookEvent, RecommendationEvent } from "../../domain/history";

interface RecommendationEventRow {
  id: string;
  primary_dish_id: string;
  new_idea_json: string | null;
  requested_by_user_id: string;
  created_at: string;
}

export type RecordCookResult =
  | { kind: "created"; event: CookEvent }
  | { kind: "duplicate" };

export class D1HistoryRepository {
  public constructor(private readonly db: D1Database) {}

  public async recordCook(event: CookEvent): Promise<RecordCookResult> {
    const result = await this.db
      .prepare(
        `INSERT INTO cook_events (
          id,
          dish_id,
          cooked_by_user_id,
          cooked_at,
          telegram_callback_query_id
        ) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(telegram_callback_query_id) DO NOTHING`
      )
      .bind(
        event.id,
        event.dishId,
        event.cookedByUserId,
        event.cookedAt,
        event.telegramCallbackQueryId
      )
      .run();

    return result.meta.changes === 0
      ? { kind: "duplicate" }
      : { kind: "created", event };
  }

  public async createRecommendation(event: RecommendationEvent): Promise<RecommendationEvent> {
    const newIdeaJson = normalizeJson(event.newIdeaJson);

    await this.db
      .prepare(
        `INSERT INTO recommendation_events (
          id,
          primary_dish_id,
          new_idea_json,
          requested_by_user_id,
          created_at
        ) VALUES (?, ?, ?, ?, ?)`
      )
      .bind(
        event.id,
        event.primaryDishId,
        newIdeaJson,
        event.requestedByUserId,
        event.createdAt
      )
      .run();

    return { ...event, newIdeaJson };
  }

  public async findRecommendationById(id: string): Promise<RecommendationEvent | null> {
    const row = await this.db
      .prepare(
        `SELECT id, primary_dish_id, new_idea_json, requested_by_user_id, created_at
        FROM recommendation_events
        WHERE id = ?`
      )
      .bind(id)
      .first<RecommendationEventRow>();

    return row === null ? null : toRecommendationEvent(row);
  }
}

function toRecommendationEvent(row: RecommendationEventRow): RecommendationEvent {
  return {
    id: row.id,
    primaryDishId: row.primary_dish_id,
    newIdeaJson: normalizeJson(row.new_idea_json),
    requestedByUserId: row.requested_by_user_id,
    createdAt: row.created_at
  };
}

function normalizeJson(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(value);
    const normalized = JSON.stringify(parsed);

    if (normalized === undefined) {
      throw new Error("JSON serialization produced no value");
    }

    return normalized;
  } catch (error: unknown) {
    throw new InvalidNewIdeaJsonError(error);
  }
}

export class InvalidNewIdeaJsonError extends Error {
  public readonly code = "INVALID_NEW_IDEA_JSON";

  public constructor(cause: unknown) {
    super("new_idea_json must contain valid JSON", { cause });
    this.name = "InvalidNewIdeaJsonError";
  }
}
