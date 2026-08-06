CREATE TABLE session_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES cohort_sessions(id) ON DELETE RESTRICT,
    title VARCHAR(160) NOT NULL,
    description TEXT,
    storage_key TEXT NOT NULL UNIQUE,
    original_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    LIKE base_table INCLUDING ALL,
    CHECK (LENGTH(BTRIM(title)) > 0),
    CHECK (LENGTH(BTRIM(original_filename)) > 0),
    CHECK (file_size > 0)
);

CREATE INDEX idx_session_attachments_session_id
    ON session_attachments(session_id, created_at DESC);

ALTER TABLE session_attachments
    ADD CONSTRAINT fk_session_attachments_created_by
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_session_attachments_updated_by
        FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE session_attachment_has_youth (
    attachment_id UUID NOT NULL REFERENCES session_attachments(id) ON DELETE CASCADE,
    youth_id UUID NOT NULL REFERENCES youth_profiles(user_id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (attachment_id, youth_id)
);

CREATE INDEX idx_session_attachment_has_youth_youth_id
    ON session_attachment_has_youth(youth_id);

CREATE OR REPLACE FUNCTION enforce_session_attachment_has_youth_in_roster()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM session_attachments sa
        INNER JOIN cohort_sessions cs ON cs.id = sa.session_id
        INNER JOIN program_cohorts pc ON pc.id = cs.cohort_id
        INNER JOIN programs p ON p.id = pc.program_id
        WHERE sa.id = NEW.attachment_id
          AND (
            (
                p.roster_mode = 'enrolled'
                AND EXISTS (
                    SELECT 1
                    FROM cohort_enrollments ce
                    WHERE ce.cohort_id = cs.cohort_id
                      AND ce.youth_id = NEW.youth_id
                      AND ce.enrolled_on <= (cs.starts_at AT TIME ZONE 'America/Toronto')::date
                      AND (
                          ce.withdrawn_on IS NULL
                          OR ce.withdrawn_on > (cs.starts_at AT TIME ZONE 'America/Toronto')::date
                      )
                )
            )
            OR (
                p.roster_mode = 'open'
                AND EXISTS (
                    SELECT 1
                    FROM attendance_records ar
                    WHERE ar.session_id = cs.id
                      AND ar.youth_id = NEW.youth_id
                      AND ar.status = 'present'
                )
            )
          )
    ) THEN
        RAISE EXCEPTION 'Session attachments can only reference youth in the session roster'
            USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER session_attachment_has_youth_in_roster
BEFORE INSERT OR UPDATE OF attachment_id, youth_id
ON session_attachment_has_youth
FOR EACH ROW
EXECUTE FUNCTION enforce_session_attachment_has_youth_in_roster();
