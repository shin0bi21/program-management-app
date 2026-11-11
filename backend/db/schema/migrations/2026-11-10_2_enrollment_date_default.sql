-- Enrollment dates follow the same date-only current-day rule as withdrawal and eligibility.
ALTER TABLE public.program_enrollments
  ALTER COLUMN enrolled_on SET DEFAULT CURRENT_DATE;
