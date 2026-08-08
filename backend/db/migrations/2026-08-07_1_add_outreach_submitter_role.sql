CREATE TYPE outreach_submitter_role AS ENUM ('youth', 'parent', 'guardian');

ALTER TABLE expressions_of_interest
    ADD COLUMN submitted_by_role outreach_submitter_role;

ALTER TABLE leads
    ADD COLUMN submitted_by_role outreach_submitter_role;

COMMENT ON COLUMN expressions_of_interest.submitted_by_role IS
    'Who completed the public expression-of-interest form; null only for legacy records.';

COMMENT ON COLUMN leads.submitted_by_role IS
    'Submitter copied from the originating expression of interest; null for staff-created or legacy leads.';
