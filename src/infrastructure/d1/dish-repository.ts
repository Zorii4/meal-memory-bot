import type { Dish, DishSource, NewDish } from "../../domain/dish";

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
