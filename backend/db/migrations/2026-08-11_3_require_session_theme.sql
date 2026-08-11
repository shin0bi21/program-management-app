UPDATE cohort_sessions
SET theme = 'Untitled Session'
WHERE theme IS NULL OR BTRIM(theme) = '';

ALTER TABLE cohort_sessions
    ALTER COLUMN theme SET NOT NULL,
    ADD CONSTRAINT cohort_sessions_theme_nonempty_check
        CHECK (BTRIM(theme) <> '');
