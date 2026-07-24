-- A lead can express interest in a program without being enrolled. Cohort
-- enrollment is chosen separately when the lead becomes a youth profile.
ALTER TABLE leads
    RENAME COLUMN program_id TO program_of_interest_id;

ALTER INDEX idx_leads_program_id
    RENAME TO idx_leads_program_of_interest_id;
