ALTER TABLE recommendation_events
  ADD COLUMN new_idea_dish_id TEXT REFERENCES dishes(id) ON DELETE CASCADE;

UPDATE recommendation_events
SET new_idea_dish_id = (
  SELECT dishes.id
  FROM dishes
  WHERE dishes.source = 'ai'
    AND dishes.name = json_extract(recommendation_events.new_idea_json, '$.name')
  ORDER BY dishes.created_at ASC, dishes.id ASC
  LIMIT 1
)
WHERE new_idea_json IS NOT NULL
  AND json_valid(new_idea_json) = 1;

CREATE INDEX idx_recommendation_events_new_idea_dish_id
  ON recommendation_events (new_idea_dish_id);
