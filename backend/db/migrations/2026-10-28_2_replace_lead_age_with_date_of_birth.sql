-- Existing ages cannot establish a birth date; retain those leads with an unknown date of birth.
ALTER TABLE leads
  ADD COLUMN date_of_birth DATE,
  DROP COLUMN age;
