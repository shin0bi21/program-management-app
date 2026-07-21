CREATE TABLE programs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL UNIQUE,
    CHECK (LENGTH(BTRIM(name)) > 0)
);

INSERT INTO programs (name)
VALUES ('Soft Skills'), ('Job Readiness')
ON CONFLICT (name) DO NOTHING;

ALTER TABLE leads
    ADD COLUMN program_id UUID REFERENCES programs(id) ON DELETE RESTRICT;

ALTER TABLE youth_profiles
    ADD COLUMN program_id UUID REFERENCES programs(id) ON DELETE RESTRICT;

CREATE INDEX idx_leads_program_id ON leads(program_id);
CREATE INDEX idx_youth_profiles_program_id ON youth_profiles(program_id);

INSERT INTO user_permissions (name)
VALUES ('read:programs'), ('write:programs')
ON CONFLICT (name) DO NOTHING;

INSERT INTO user_role_has_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM user_roles r, user_permissions p
WHERE r.name IN ('admin', 'staff')
  AND p.name = 'read:programs'
ON CONFLICT DO NOTHING;

INSERT INTO user_role_has_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM user_roles r, user_permissions p
WHERE r.name = 'admin'
  AND p.name = 'write:programs'
ON CONFLICT DO NOTHING;
