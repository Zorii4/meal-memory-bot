ALTER TABLE recommendation_events
  ADD COLUMN purpose TEXT NOT NULL DEFAULT 'daily'
  CHECK (purpose IN ('daily', 'similar'));
