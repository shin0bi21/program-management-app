ALTER TABLE time_entries DROP CONSTRAINT time_entries_task_check;

UPDATE time_entries
SET task = 'program_delivery'
WHERE task = 'programming';

ALTER TABLE time_entries
  ADD CONSTRAINT time_entries_task_check
  CHECK (task IN ('program_delivery', 'planning_prep', 'meeting', 'administration', 'outreach', 'maintenance', 'other'));
