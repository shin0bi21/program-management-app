CREATE TABLE lead_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    details TEXT NOT NULL CHECK (LENGTH(BTRIM(details)) > 0),
    LIKE base_table INCLUDING ALL
);

CREATE INDEX idx_lead_notes_lead_id_created_at
    ON lead_notes(lead_id, created_at DESC);

ALTER TABLE lead_notes
    ADD CONSTRAINT fk_lead_notes_created_by
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_lead_notes_updated_by
        FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
