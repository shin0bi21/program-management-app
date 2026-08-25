UPDATE user_preferences
SET value = jsonb_set(value, '{view}', '"table"'),
    updated_at = NOW()
WHERE preference_key = 'task-preferences'
  AND value->>'view' = 'list';
