ALTER TABLE lead_notes
    ALTER COLUMN category DROP NOT NULL;

-- Legacy notes predate status history, so their category cannot be inferred honestly.
-- New notes are still category-required at the API boundary.
UPDATE lead_notes
SET category = NULL;
