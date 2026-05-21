-- ── Drop school_type column ────────────────────────────────────────────────
DROP INDEX IF EXISTS idx_schools_type;
ALTER TABLE schools DROP COLUMN IF EXISTS school_type;
DROP TYPE IF EXISTS school_type CASCADE;
ALTER TABLE schools ALTER COLUMN address DROP NOT NULL;

-- ── Add write:schools permission → admin + staff ───────────────────────────
INSERT INTO user_permissions (name)
VALUES ('write:schools')
ON CONFLICT (name) DO NOTHING;

INSERT INTO user_role_has_permissions (role_id, permission_id)
SELECT r.id, p.id FROM user_roles r, user_permissions p
WHERE r.name IN ('admin', 'staff') AND p.name = 'write:schools'
ON CONFLICT DO NOTHING;
