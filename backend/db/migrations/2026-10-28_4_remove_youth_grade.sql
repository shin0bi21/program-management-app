-- Youth eligibility uses date of birth and program age bounds, not school grade.
ALTER TABLE youth_profiles
  DROP COLUMN grade_level,
  DROP COLUMN age_group;

DROP TYPE age_group;
