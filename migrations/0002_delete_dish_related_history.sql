PRAGMA foreign_keys = ON;

CREATE TRIGGER delete_related_dish_history
BEFORE DELETE ON dishes
FOR EACH ROW
BEGIN
  DELETE FROM cook_events WHERE dish_id = OLD.id;
  DELETE FROM recommendation_events WHERE primary_dish_id = OLD.id;
END;
