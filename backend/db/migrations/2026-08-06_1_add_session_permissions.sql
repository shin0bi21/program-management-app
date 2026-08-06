INSERT INTO user_permissions (name)
VALUES ('read:sessions'), ('write:sessions')
ON CONFLICT (name) DO NOTHING;

INSERT INTO user_role_has_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM user_roles r, user_permissions p
WHERE r.name IN ('admin', 'staff')
  AND p.name IN ('read:sessions', 'write:sessions')
ON CONFLICT DO NOTHING;
