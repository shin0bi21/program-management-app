ALTER TABLE session_note_youth
    RENAME TO session_note_has_youth;

ALTER TABLE session_note_has_youth
    RENAME CONSTRAINT session_note_youth_pkey TO session_note_has_youth_pkey;

ALTER INDEX idx_session_note_youth_youth_id
    RENAME TO idx_session_note_has_youth_youth_id;

ALTER TRIGGER session_note_youth_in_roster
    ON session_note_has_youth
    RENAME TO session_note_has_youth_in_roster;

ALTER FUNCTION enforce_session_note_youth_in_roster()
    RENAME TO enforce_session_note_has_youth_in_roster;
