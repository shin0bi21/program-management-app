ALTER TABLE expressions_of_interest
    DROP CONSTRAINT cohort_interest_submissions_age_check,
    ADD CONSTRAINT expressions_of_interest_age_check
        CHECK (age BETWEEN 12 AND 19);

ALTER TABLE leads
    DROP CONSTRAINT leads_age_check,
    ADD CONSTRAINT leads_age_check
        CHECK (age BETWEEN 12 AND 19);
