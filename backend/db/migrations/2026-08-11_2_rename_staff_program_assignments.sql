ALTER TABLE staff_program_assignments
  RENAME TO user_program_assignments;

ALTER TABLE user_program_assignments
  RENAME COLUMN staff_id TO user_id;

ALTER TABLE user_program_assignments
  RENAME CONSTRAINT staff_program_assignments_pkey TO user_program_assignments_pkey;

ALTER INDEX idx_staff_program_assignments_program_id
  RENAME TO idx_user_program_assignments_program_id;
