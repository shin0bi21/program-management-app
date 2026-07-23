ALTER TABLE youth_profiles
    ADD COLUMN notes TEXT;

ALTER TABLE leads
    ALTER COLUMN status DROP DEFAULT;

ALTER TYPE lead_status RENAME TO lead_status_previous;
CREATE TYPE lead_status AS ENUM (
    'new',
    'contacted',
    'eligible',
    'ineligible',
    'signed_up'
);

ALTER TABLE leads
    ALTER COLUMN status TYPE lead_status
    USING (
        CASE status::TEXT
            WHEN 'qualified' THEN 'eligible'
            WHEN 'lost' THEN 'ineligible'
            ELSE status::TEXT
        END
    )::lead_status;

ALTER TABLE leads
    ALTER COLUMN status SET DEFAULT 'new';

DROP TYPE lead_status_previous;

ALTER TABLE leads
    ADD COLUMN converted_youth_id UUID UNIQUE
    REFERENCES youth_profiles(user_id) ON DELETE SET NULL;

CREATE INDEX idx_leads_converted_youth_id
    ON leads(converted_youth_id);
