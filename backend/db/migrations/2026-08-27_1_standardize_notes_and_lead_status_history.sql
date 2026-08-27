ALTER TYPE lead_status ADD VALUE 'deferred' BEFORE 'signed_up';
ALTER TYPE lead_status ADD VALUE 'closed' BEFORE 'signed_up';

ALTER TABLE lead_notes
    ADD COLUMN category lead_status;

UPDATE lead_notes note
SET category = lead.status
FROM leads lead
WHERE lead.id = note.lead_id;

ALTER TABLE lead_notes
    ALTER COLUMN category SET NOT NULL;

UPDATE youth_profile_notes
SET details = CASE
    WHEN details IS NULL THEN title
    ELSE title || E'\n\n' || details
END;

ALTER TABLE youth_profile_notes
    DROP CONSTRAINT youth_profile_notes_title_check,
    DROP CONSTRAINT youth_profile_notes_details_check,
    DROP COLUMN title,
    ALTER COLUMN details SET NOT NULL,
    ADD CONSTRAINT youth_profile_notes_details_check CHECK (LENGTH(BTRIM(details)) > 0);

UPDATE session_notes
SET details = CASE
    WHEN details IS NULL THEN title
    ELSE title || E'\n\n' || details
END;

ALTER TABLE session_notes
    DROP CONSTRAINT session_notes_details_check,
    DROP COLUMN title,
    ALTER COLUMN details SET NOT NULL,
    ADD CONSTRAINT session_notes_details_check CHECK (LENGTH(BTRIM(details)) > 0);
