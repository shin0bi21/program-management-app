ALTER TABLE cohort_interest_submissions
    DROP COLUMN email CASCADE,
    DROP COLUMN phone_number CASCADE;

ALTER TABLE leads
    DROP COLUMN response_email CASCADE,
    DROP COLUMN response_phone_number CASCADE;
