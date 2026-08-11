ALTER TABLE time_entries
  ADD CONSTRAINT time_entries_program_delivery_link_check
    CHECK (
      category <> 'program_delivery'
      OR task_id IS NOT NULL
      OR session_id IS NOT NULL
    );
