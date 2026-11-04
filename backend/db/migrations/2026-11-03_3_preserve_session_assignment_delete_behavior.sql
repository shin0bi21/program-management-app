ALTER TABLE program_sessions
  DROP CONSTRAINT fk_program_sessions_assignment,
  ADD CONSTRAINT fk_program_sessions_assignment FOREIGN KEY (program_id, cycle_id)
    REFERENCES program_cycle_assignments(program_id, cycle_id) ON DELETE CASCADE;
