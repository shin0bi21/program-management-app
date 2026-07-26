CREATE TYPE program_roster_mode AS ENUM ('enrolled', 'open');

ALTER TABLE programs
    ADD COLUMN roster_mode program_roster_mode NOT NULL DEFAULT 'enrolled';

UPDATE programs
SET roster_mode = 'open'
WHERE name = 'Drop In';
