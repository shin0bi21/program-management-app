-- Rename broad youth permissions to scoped youth_profiles permissions.
-- This enables future permissions (read:youth_attendance, write:youth_attendance, etc.)
-- to be added as separate entries with their own role assignments.

UPDATE user_permissions
SET name = 'read:youth_profiles'
WHERE name = 'read:youth';

UPDATE user_permissions
SET name = 'write:youth_profiles'
WHERE name = 'write:youth';
