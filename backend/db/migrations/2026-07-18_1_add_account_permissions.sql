INSERT INTO user_permissions (name)
VALUES ('read:accounts'), ('write:accounts')
ON CONFLICT (name) DO NOTHING;

INSERT INTO user_role_has_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM user_roles r, user_permissions p
WHERE r.name IN ('admin', 'staff')
  AND p.name IN ('read:accounts', 'write:accounts')
ON CONFLICT DO NOTHING;

DELETE FROM user_role_has_permissions
WHERE permission_id IN (
  SELECT id
  FROM user_permissions
  WHERE name IN ('read:staff', 'write:staff')
);

DELETE FROM user_permissions
WHERE name IN ('read:staff', 'write:staff');
