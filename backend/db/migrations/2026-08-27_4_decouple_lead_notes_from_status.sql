ALTER TABLE lead_notes
    ALTER COLUMN category TYPE TEXT USING category::TEXT;

UPDATE lead_notes
SET category = 'follow_up';

ALTER TABLE lead_notes
    ALTER COLUMN category SET NOT NULL,
    ADD CONSTRAINT lead_notes_category_check CHECK (category = 'follow_up');
