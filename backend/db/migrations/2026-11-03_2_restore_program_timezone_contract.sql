-- The restored settings migration removed a column still required by program scheduling.
-- Keep the historical migration intact and restore the current fixed-timezone contract.
CREATE TYPE program_timezone AS ENUM ('America/Toronto');

ALTER TABLE programs
  ADD COLUMN timezone program_timezone NOT NULL DEFAULT 'America/Toronto'::program_timezone;
