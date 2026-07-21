PRAGMA foreign_keys = ON;

CREATE TABLE dishes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL UNIQUE,
  details TEXT,
  source TEXT NOT NULL CHECK (source IN ('user', 'ai')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE cook_events (
  id TEXT PRIMARY KEY,
  dish_id TEXT NOT NULL,
  cooked_by_user_id TEXT NOT NULL,
  cooked_at TEXT NOT NULL,
  telegram_callback_query_id TEXT UNIQUE,
  FOREIGN KEY (dish_id) REFERENCES dishes(id)
);

CREATE INDEX idx_cook_events_dish_id_cooked_at
  ON cook_events (dish_id, cooked_at DESC);

CREATE TABLE recommendation_events (
  id TEXT PRIMARY KEY,
  primary_dish_id TEXT NOT NULL,
  new_idea_json TEXT CHECK (new_idea_json IS NULL OR json_valid(new_idea_json)),
  requested_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (primary_dish_id) REFERENCES dishes(id)
);

CREATE INDEX idx_recommendation_events_created_at
  ON recommendation_events (created_at DESC);

CREATE TABLE conversation_states (
  telegram_user_id TEXT PRIMARY KEY,
  state TEXT NOT NULL CHECK (state = 'awaiting_dish'),
  expires_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
