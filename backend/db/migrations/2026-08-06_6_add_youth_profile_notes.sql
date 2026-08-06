CREATE TABLE youth_profile_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    youth_id UUID NOT NULL REFERENCES youth_profiles(user_id) ON DELETE CASCADE,
    category VARCHAR(32) NOT NULL,
    title VARCHAR(160),
    details TEXT NOT NULL,
    LIKE base_table INCLUDING ALL,
    CHECK (category IN ('general', 'health', 'preference')),
    CHECK (title IS NULL OR LENGTH(BTRIM(title)) > 0),
    CHECK (LENGTH(BTRIM(details)) > 0)
);
CREATE INDEX idx_youth_profile_notes_youth_id ON youth_profile_notes(youth_id, created_at DESC);
ALTER TABLE youth_profile_notes
    ADD CONSTRAINT fk_youth_profile_notes_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_youth_profile_notes_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

INSERT INTO youth_profile_notes (youth_id, category, title, details, created_by, updated_by, created_at, updated_at)
SELECT user_id, 'general', 'Migrated profile note', BTRIM(notes), created_by, updated_by, created_at, updated_at
FROM youth_profiles
WHERE notes IS NOT NULL AND LENGTH(BTRIM(notes)) > 0;

ALTER TABLE youth_profiles DROP COLUMN notes;
