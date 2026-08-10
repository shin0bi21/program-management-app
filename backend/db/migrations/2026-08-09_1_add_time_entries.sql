CREATE TABLE time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  program_id UUID REFERENCES programs(id) ON DELETE RESTRICT,
  cohort_id UUID REFERENCES program_cohorts(id) ON DELETE RESTRICT,
  task TEXT NOT NULL CHECK (task IN ('programming', 'planning_prep', 'meeting', 'administration', 'promotion', 'maintenance', 'other')),
  work_date DATE NOT NULL,
  hours NUMERIC(5, 2) NOT NULL CHECK (hours > 0 AND hours <= 24),
  note TEXT NOT NULL CHECK (length(trim(note)) > 0),
  LIKE base_table INCLUDING ALL
);

ALTER TABLE time_entries
  ADD CONSTRAINT fk_time_entries_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_time_entries_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX idx_time_entries_staff_date ON time_entries(staff_id, work_date);
CREATE INDEX idx_time_entries_task_date ON time_entries(task, work_date);
CREATE INDEX idx_time_entries_program_date ON time_entries(program_id, work_date);
CREATE INDEX idx_time_entries_cohort_date ON time_entries(cohort_id, work_date)
WHERE cohort_id IS NOT NULL;

INSERT INTO user_permissions (name)
VALUES ('read:timesheets'), ('write:timesheets')
ON CONFLICT (name) DO NOTHING;

INSERT INTO user_role_has_permissions (role_id, permission_id)
SELECT role.id, permission.id
FROM user_roles role
CROSS JOIN user_permissions permission
WHERE role.name IN ('admin', 'staff')
  AND permission.name IN ('read:timesheets', 'write:timesheets')
ON CONFLICT DO NOTHING;
