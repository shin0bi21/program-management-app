INSERT INTO user_role_has_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM user_roles r, user_permissions p
WHERE r.name = 'staff'
  AND p.name IN ('read:settings', 'write:settings')
ON CONFLICT DO NOTHING;
