ALTER TABLE time_entries RENAME COLUMN task TO category;
ALTER TABLE time_entries RENAME CONSTRAINT time_entries_task_check TO time_entries_category_check;
ALTER INDEX idx_time_entries_task_date RENAME TO idx_time_entries_category_date;

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  details TEXT,
  category TEXT NOT NULL CHECK (category IN ('program_delivery', 'planning_prep', 'meeting', 'administration', 'outreach', 'maintenance', 'other')),
  staff_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  program_id UUID REFERENCES programs(id) ON DELETE RESTRICT,
  cycle_id UUID NOT NULL REFERENCES program_cycles(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'completed', 'cancelled')),
  start_date DATE NOT NULL,
  due_date DATE NOT NULL,
  completed_at TIMESTAMPTZ,
  LIKE base_table INCLUDING ALL,
  CONSTRAINT tasks_date_order_check CHECK (start_date <= due_date)
);

ALTER TABLE tasks
  ADD CONSTRAINT fk_tasks_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_tasks_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE time_entries
  ADD COLUMN task_id UUID REFERENCES tasks(id) ON DELETE RESTRICT;

CREATE INDEX idx_tasks_category_status ON tasks(category, status);
CREATE INDEX idx_tasks_staff ON tasks(staff_id, start_date, due_date);
CREATE INDEX idx_tasks_program ON tasks(program_id) WHERE program_id IS NOT NULL;
CREATE INDEX idx_tasks_date_range ON tasks(start_date, due_date);
CREATE INDEX idx_time_entries_task_id ON time_entries(task_id) WHERE task_id IS NOT NULL;

UPDATE user_preferences
SET value = (value - 'tasks') || jsonb_build_object('categories', COALESCE(value->'tasks', '[]'::jsonb))
WHERE preference_key = 'timesheet-filters' AND value ? 'tasks';

UPDATE user_preferences
SET value = jsonb_set(
  value,
  '{columnWidths}',
  ((value->'columnWidths') - 'assignees'::text)
    || CASE WHEN value->'columnWidths' ? 'assignees'
      THEN jsonb_build_object('assignee', value->'columnWidths'->'assignees')
      ELSE '{}'::jsonb
    END
)
WHERE preference_key = 'task-filters'
  AND value ? 'columnWidths';

INSERT INTO user_permissions (name)
VALUES ('read:tasks'), ('write:tasks')
ON CONFLICT (name) DO NOTHING;

INSERT INTO user_role_has_permissions (role_id, permission_id)
SELECT role.id, permission.id
FROM user_roles role
CROSS JOIN user_permissions permission
WHERE role.name IN ('admin', 'staff')
  AND permission.name IN ('read:tasks', 'write:tasks')
ON CONFLICT DO NOTHING;
