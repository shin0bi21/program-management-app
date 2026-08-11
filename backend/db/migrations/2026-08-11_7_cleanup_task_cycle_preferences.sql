UPDATE user_preferences
SET value = value - 'sorting'
WHERE preference_key = 'task-filters'
  AND value->'sorting'->>'key' = 'cycle';
