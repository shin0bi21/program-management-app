ALTER TABLE expressions_of_interest
    DROP CONSTRAINT IF EXISTS cohort_interest_submissions_primary_contact_check,
    DROP COLUMN contact_first_name,
    DROP COLUMN contact_last_name,
    ADD CONSTRAINT expressions_of_interest_primary_contact_check
        CHECK (
            LENGTH(BTRIM(contact_phone_number)) > 0
            AND contact_relationship IS NOT NULL
        );

ALTER TABLE leads
    DROP COLUMN contact_first_name,
    DROP COLUMN contact_last_name;

ALTER TABLE contacts
    DROP COLUMN first_name,
    DROP COLUMN last_name;
