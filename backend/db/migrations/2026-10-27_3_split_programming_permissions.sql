INSERT INTO user_permissions (name)
VALUES ('write:enrollments')
ON CONFLICT (name) DO NOTHING;

INSERT INTO user_role_has_permissions (role_id, permission_id)
SELECT grant_row.role_id, replacement.id
FROM user_role_has_permissions grant_row
JOIN user_permissions previous ON previous.id = grant_row.permission_id
JOIN user_permissions replacement ON replacement.name = CASE previous.name
  WHEN 'read:cohorts' THEN 'read:programs'
  WHEN 'write:cohorts' THEN 'write:enrollments'
END
WHERE previous.name IN ('read:cohorts', 'write:cohorts')
ON CONFLICT DO NOTHING;

DELETE FROM user_permissions WHERE name IN ('read:cohorts', 'write:cohorts');
