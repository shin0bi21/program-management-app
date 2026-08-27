UPDATE session_notes
SET category = 'general'
WHERE category = 'follow_up';

ALTER TABLE session_notes
    DROP CONSTRAINT session_notes_category_check,
    ADD CONSTRAINT session_notes_category_check
        CHECK (category IN ('general', 'attendance', 'behaviour', 'achievement'));
