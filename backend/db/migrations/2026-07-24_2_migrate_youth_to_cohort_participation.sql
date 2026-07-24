DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM youth_worksheets LIMIT 1) THEN
        RAISE EXCEPTION
            'Cannot drop youth_worksheets because it contains data. Archive or migrate its rows first.';
    END IF;
END
$$;

DROP TABLE youth_worksheets;

-- Youth participation and programming are derived from cohort enrollment.
-- Keeping direct profile fields allows the profile and cohort data to disagree.
DROP INDEX IF EXISTS idx_youth_profiles_status;
DROP INDEX IF EXISTS idx_youth_profiles_program_id;

ALTER TABLE youth_profiles
    DROP COLUMN IF EXISTS status,
    DROP COLUMN IF EXISTS program_id;

DROP TYPE IF EXISTS youth_participation_status;
