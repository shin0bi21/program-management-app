INSERT INTO user_roles (name)
VALUES ('project_manager')
ON CONFLICT (name) DO NOTHING;

INSERT INTO user_role_has_permissions (role_id, permission_id)
SELECT manager.id, staff_grant.permission_id
FROM user_roles manager
CROSS JOIN user_roles staff
JOIN user_role_has_permissions staff_grant ON staff_grant.role_id = staff.id
WHERE manager.name = 'project_manager' AND staff.name = 'staff'
ON CONFLICT DO NOTHING;

INSERT INTO user_role_has_permissions (role_id, permission_id)
SELECT role.id, permission.id
FROM user_roles role
CROSS JOIN user_permissions permission
WHERE role.name = 'project_manager' AND permission.name = 'write:programs'
ON CONFLICT DO NOTHING;
