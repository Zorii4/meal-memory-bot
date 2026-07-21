import type { Dish, DishSource, DishStatistics, NewDish } from "../../domain/dish";

interface DishRow {
  id: string;
  name: string;
  normalized_name: string;
  details: string | null;
  source: DishSource;
  is_active: number;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
}

interface DishStatisticsRow extends DishRow {
  last_cooked_at: string | null;
  times_cooked: number;
  last_recommended_at: string | null;
}

export type CreateDishResult =
  | { kind: "created"; dish: Dish }
  | { kind: "duplicate" };

export class D1DishRepository {
  public constructor(private readonly db: D1Database) {}

  public async create(dish: NewDish): Promise<CreateDishResult> {
    const result = await this.db
      .prepare(
        `INSERT INTO dishes (
          id,
          name,
          normalized_name,
          details,
          source,
          created_by_user_id,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(normalized_name) DO NOTHING`
      )
      .bind(
        dish.id,
        dish.name,
        dish.normalizedName,
        dish.details,
        dish.source,
        dish.createdByUserId,
        dish.createdAt,
        dish.updatedAt
      )
      .run();

    if (result.meta.changes === 0) {
      return { kind: "duplicate" };
    }

    return {
      kind: "created",
      dish: {
        ...dish,
        isActive: true
      }
    };
  }

  public async findByNormalizedName(normalizedName: string): Promise<Dish | null> {
    const row = await this.db
      .prepare(
        `SELECT
          id,
          name,
          normalized_name,
          details,
          source,
          is_active,
          created_by_user_id,
          created_at,
          updated_at
        FROM dishes
        WHERE normalized_name = ?`
      )
      .bind(normalizedName)
      .first<DishRow>();

    return row === null ? null : toDish(row);
  }

  public async listActiveWithStatistics(): Promise<DishStatistics[]> {
    const result = await this.db
      .prepare(
        `SELECT
          dishes.id,
          dishes.name,
          dishes.normalized_name,
          dishes.details,
          dishes.source,
          dishes.is_active,
          dishes.created_by_user_id,
          dishes.created_at,
          dishes.updated_at,
          MAX(cook_events.cooked_at) AS last_cooked_at,
          COUNT(DISTINCT cook_events.id) AS times_cooked,
          MAX(recommendation_events.created_at) AS last_recommended_at
        FROM dishes
        LEFT JOIN cook_events ON cook_events.dish_id = dishes.id
        LEFT JOIN recommendation_events
          ON recommendation_events.primary_dish_id = dishes.id
        WHERE dishes.is_active = 1
        GROUP BY
          dishes.id,
          dishes.name,
          dishes.normalized_name,
          dishes.details,
          dishes.source,
          dishes.is_active,
          dishes.created_by_user_id,
          dishes.created_at,
          dishes.updated_at`
      )
      .all<DishStatisticsRow>();

    return result.results.map(toDishStatistics);
  }
}

function toDish(row: DishRow): Dish {
  return {
    id: row.id,
    name: row.name,
    normalizedName: row.normalized_name,
    details: row.details,
    source: row.source,
    isActive: row.is_active === 1,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toDishStatistics(row: DishStatisticsRow): DishStatistics {
  return {
    ...toDish(row),
    lastCookedAt: row.last_cooked_at,
    timesCooked: row.times_cooked,
    lastRecommendedAt: row.last_recommended_at
  };
}
