ALTER TABLE time_entries
  ADD COLUMN session_id UUID REFERENCES cohort_sessions(id) ON DELETE RESTRICT;

ALTER TABLE time_entries
  ADD CONSTRAINT time_entries_single_source_check
    CHECK (num_nonnulls(task_id, session_id) <= 1),
  ADD CONSTRAINT time_entries_program_delivery_source_check
    CHECK (session_id IS NULL OR category = 'program_delivery');

CREATE INDEX idx_time_entries_session_id ON time_entries(session_id)
WHERE session_id IS NOT NULL;
