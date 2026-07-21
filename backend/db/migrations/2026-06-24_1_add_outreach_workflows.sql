CREATE TYPE discovery_source AS ENUM (
    'online',
    'friend_family',
    'school',
    'community_outreach',
    'other'
);

CREATE TABLE expressions_of_interest (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    youth_first_name VARCHAR(120) NOT NULL,
    youth_last_name VARCHAR(120) NOT NULL,
    age SMALLINT NOT NULL CHECK (age BETWEEN 5 AND 24),
    school VARCHAR(255) NOT NULL,
    contact_first_name VARCHAR(120) NOT NULL,
    contact_last_name VARCHAR(120) NOT NULL,
    contact_phone_number VARCHAR(40) NOT NULL,
    contact_relationship contact_type NOT NULL,
    discovery_source discovery_source NOT NULL,
    notes TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'new'
        CHECK (status IN ('new', 'reviewed', 'contacted', 'converted', 'signed_up', 'lost', 'spam')),
    status_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    LIKE base_table INCLUDING ALL,
    CHECK (LENGTH(BTRIM(youth_first_name)) > 0),
    CHECK (LENGTH(BTRIM(youth_last_name)) > 0),
    CHECK (LENGTH(BTRIM(school)) > 0),
    CHECK (LENGTH(BTRIM(contact_first_name)) > 0),
    CHECK (LENGTH(BTRIM(contact_last_name)) > 0),
    CHECK (LENGTH(BTRIM(contact_phone_number)) > 0)
);

CREATE INDEX idx_expressions_of_interest_created_at
    ON expressions_of_interest(created_at DESC);
CREATE INDEX idx_expressions_of_interest_status
    ON expressions_of_interest(status);
CREATE INDEX idx_expressions_of_interest_discovery_source
    ON expressions_of_interest(discovery_source);

CREATE TYPE lead_origin AS ENUM ('expression_of_interest', 'staff_created');
CREATE TYPE lead_status AS ENUM ('new', 'contacted', 'qualified', 'signed_up', 'lost', 'ineligible');

CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    origin lead_origin NOT NULL,
    expression_of_interest_id UUID UNIQUE REFERENCES expressions_of_interest(id) ON DELETE RESTRICT,
    youth_first_name VARCHAR(120) NOT NULL,
    youth_last_name VARCHAR(120) NOT NULL,
    age SMALLINT NOT NULL CHECK (age BETWEEN 5 AND 24),
    school VARCHAR(255) NOT NULL,
    contact_first_name VARCHAR(120) NOT NULL,
    contact_last_name VARCHAR(120) NOT NULL,
    contact_phone_number VARCHAR(40) NOT NULL,
    contact_relationship contact_type NOT NULL,
    discovery_source discovery_source NOT NULL,
    notes TEXT,
    status lead_status NOT NULL DEFAULT 'new',
    status_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    LIKE base_table INCLUDING ALL,
    CHECK (LENGTH(BTRIM(youth_first_name)) > 0),
    CHECK (LENGTH(BTRIM(youth_last_name)) > 0),
    CHECK (LENGTH(BTRIM(school)) > 0),
    CHECK (LENGTH(BTRIM(contact_first_name)) > 0),
    CHECK (LENGTH(BTRIM(contact_last_name)) > 0),
    CHECK (LENGTH(BTRIM(contact_phone_number)) > 0),
    CHECK (
        (origin = 'expression_of_interest' AND expression_of_interest_id IS NOT NULL)
        OR (origin = 'staff_created' AND expression_of_interest_id IS NULL)
    )
);

CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_origin ON leads(origin);
CREATE INDEX idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX idx_leads_created_by ON leads(created_by);

INSERT INTO user_permissions (name)
VALUES ('read:outreach'), ('write:outreach')
ON CONFLICT (name) DO NOTHING;

INSERT INTO user_role_has_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM user_roles r, user_permissions p
WHERE r.name IN ('admin', 'staff')
  AND p.name IN ('read:outreach', 'write:outreach')
ON CONFLICT DO NOTHING;
