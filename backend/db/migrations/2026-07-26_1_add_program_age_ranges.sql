ALTER TABLE programs
  ADD COLUMN min_age SMALLINT,
  ADD COLUMN max_age SMALLINT,
  ADD CONSTRAINT programs_age_range_check CHECK (
    (min_age IS NULL AND max_age IS NULL)
    OR (
      min_age IS NOT NULL
      AND max_age IS NOT NULL
      AND min_age >= 0
      AND max_age <= 30
      AND min_age <= max_age
    )
  );

UPDATE programs
SET min_age = 12, max_age = 15
WHERE LOWER(name) = 'soft skills';

UPDATE programs
SET min_age = 16, max_age = 19
WHERE LOWER(name) = 'job readiness';
