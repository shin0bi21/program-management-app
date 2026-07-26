ALTER TABLE cohort_sessions
    ALTER COLUMN theme DROP NOT NULL;

DROP INDEX uq_cohort_sessions_cohort_theme_start;

CREATE UNIQUE INDEX uq_cohort_sessions_cohort_theme_start
    ON cohort_sessions(cohort_id, theme, starts_at) NULLS NOT DISTINCT;
