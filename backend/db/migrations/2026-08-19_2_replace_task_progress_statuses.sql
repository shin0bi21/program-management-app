ALTER TABLE tasks DROP CONSTRAINT tasks_status_check;

UPDATE tasks
SET status = 'open'
WHERE status IN ('todo', 'in_progress');

ALTER TABLE tasks
  ALTER COLUMN status SET DEFAULT 'open',
  ADD CONSTRAINT tasks_status_check
    CHECK (status IN ('open', 'completed', 'cancelled'));

UPDATE user_preferences
SET value = jsonb_set(
  value,
  '{statuses}',
  ((value->'statuses') - 'todo' - 'in_progress') || '["upcoming", "active", "overdue"]'::jsonb
)
WHERE preference_key = 'task-filters'
  AND jsonb_typeof(value->'statuses') = 'array'
  AND ((value->'statuses') ? 'todo' OR (value->'statuses') ? 'in_progress');
