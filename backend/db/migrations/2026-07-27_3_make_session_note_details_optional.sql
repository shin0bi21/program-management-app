ALTER TABLE session_notes
    ALTER COLUMN details DROP NOT NULL,
    DROP CONSTRAINT session_notes_details_check,
    ADD CONSTRAINT session_notes_details_check
        CHECK (details IS NULL OR LENGTH(BTRIM(details)) > 0);
