-- Separate youth program participation from login account status.
--
-- users.status remains unchanged for now and will continue to represent the
-- account lifecycle until account state is moved to user_credentials.

CREATE TYPE youth_participation_status AS ENUM ('active', 'inactive');

ALTER TABLE youth_profiles
ADD COLUMN status youth_participation_status;

-- Preserve the participation state currently exposed by the youth API.
-- Any non-active users state maps to inactive participation; in particular,
-- an account invitation must not imply active youth participation.
UPDATE youth_profiles yp
SET status = CASE
    WHEN u.status = 'active' THEN 'active'::youth_participation_status
    ELSE 'inactive'::youth_participation_status
END
FROM users u
WHERE u.id = yp.user_id;

ALTER TABLE youth_profiles
ALTER COLUMN status SET DEFAULT 'active',
ALTER COLUMN status SET NOT NULL;

CREATE INDEX idx_youth_profiles_status ON youth_profiles(status);
