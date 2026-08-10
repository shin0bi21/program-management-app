ALTER TABLE time_entries ADD COLUMN cycle_id UUID;

UPDATE time_entries entry
SET cycle_id = cohort.cycle_id
FROM program_cohorts cohort
WHERE cohort.id = entry.cohort_id;

ALTER TABLE time_entries
  ALTER COLUMN cycle_id SET NOT NULL,
  ADD CONSTRAINT fk_time_entries_cycle FOREIGN KEY (cycle_id) REFERENCES program_cycles(id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_time_entries_program_cycle FOREIGN KEY (program_id, cycle_id) REFERENCES program_cohorts(program_id, cycle_id) ON DELETE RESTRICT,
  DROP COLUMN cohort_id;

CREATE INDEX idx_time_entries_cycle_date ON time_entries(cycle_id, work_date);
