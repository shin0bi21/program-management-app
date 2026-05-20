-- Add user_status enum to replace the active boolean on users
-- Maps: active=true -> 'active', active=false + unused token -> 'invited', active=false + no token -> 'inactive'

CREATE TYPE user_status AS ENUM ('invited', 'active', 'inactive');

-- Add nullable first so we can backfill before enforcing NOT NULL
ALTER TABLE users ADD COLUMN status user_status;

-- active=true → 'active'
UPDATE users SET status = 'active' WHERE active = true;

-- active=false + has an unused, unexpired invite token → 'invited'
UPDATE users u SET status = 'invited'
  WHERE u.active = false
  AND EXISTS (
    SELECT 1 FROM user_password_reset_tokens t
    WHERE t.user_id = u.id AND t.used_at IS NULL AND t.expires_at > NOW()
  );

-- active=false + no valid invite token → 'inactive' (deactivated real accounts or expired invites)
UPDATE users SET status = 'inactive'
  WHERE status IS NULL;

ALTER TABLE users ALTER COLUMN status SET NOT NULL;
ALTER TABLE users ALTER COLUMN status SET DEFAULT 'invited';

ALTER TABLE users DROP COLUMN active;
