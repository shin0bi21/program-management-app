DROP INDEX IF EXISTS idx_schools_board;

ALTER TABLE schools
    DROP COLUMN IF EXISTS board,
    DROP COLUMN IF EXISTS address,
    DROP COLUMN IF EXISTS postal_code;

DROP TYPE IF EXISTS school_board;
