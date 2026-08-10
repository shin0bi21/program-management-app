ALTER TABLE time_entries DROP CONSTRAINT time_entries_task_check;

UPDATE time_entries
SET task = 'outreach'
WHERE task = 'promotion';

ALTER TABLE time_entries
  ADD CONSTRAINT time_entries_task_check
  CHECK (task IN ('programming', 'planning_prep', 'meeting', 'administration', 'outreach', 'maintenance', 'other'));
