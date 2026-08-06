ALTER TABLE youth_profile_notes
    DROP CONSTRAINT youth_profile_notes_details_check,
    DROP CONSTRAINT youth_profile_notes_title_check;

ALTER TABLE youth_profile_notes
    ALTER COLUMN title TYPE TEXT,
    ALTER COLUMN title SET NOT NULL,
    ALTER COLUMN details DROP NOT NULL;

UPDATE youth_profile_notes
SET title = details,
    details = NULL
WHERE title = 'Profile note';

ALTER TABLE youth_profile_notes
    ADD CONSTRAINT youth_profile_notes_title_check CHECK (LENGTH(BTRIM(title)) > 0),
    ADD CONSTRAINT youth_profile_notes_details_check CHECK (details IS NULL OR LENGTH(BTRIM(details)) > 0);
