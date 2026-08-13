import initialSchema from "../../migrations/0001_initial_schema.sql?raw";
import deleteDishRelatedHistory from "../../migrations/0002_delete_dish_related_history.sql?raw";
import recommendationPurpose from "../../migrations/0003_add_recommendation_purpose.sql?raw";

export async function applyInitialSchema(db: D1Database): Promise<void> {
  const statements = initialSchema
    .split(/;\s*$/m)
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0)
    .filter((statement) => !statement.startsWith("PRAGMA"));
  const deleteDishTrigger = deleteDishRelatedHistory
    .replace(/^PRAGMA foreign_keys = ON;\s*/m, "")
    .trim();

  await db.batch([
    ...statements.map((statement) => db.prepare(statement)),
    db.prepare(deleteDishTrigger),
    db.prepare(recommendationPurpose.trim())
  ]);
}

export async function resetDatabase(db: D1Database): Promise<void> {
  await db.batch([
    db.prepare("DELETE FROM conversation_states"),
    db.prepare("DELETE FROM recommendation_events"),
    db.prepare("DELETE FROM cook_events"),
    db.prepare("DELETE FROM dishes")
  ]);
}
