-- Account lifecycle belongs to credentials, independently of profile or
-- participation state stored elsewhere.

CREATE TYPE account_status AS ENUM ('invited', 'active', 'inactive');

ALTER TABLE user_credentials
ADD COLUMN status account_status;

-- Preserve the current account state for every credential-bearing user.
UPDATE user_credentials uc
SET status = u.status::text::account_status
FROM users u
WHERE u.id = uc.user_id;

ALTER TABLE user_credentials
ALTER COLUMN status SET DEFAULT 'invited',
ALTER COLUMN status SET NOT NULL;

CREATE INDEX idx_user_credentials_status ON user_credentials(status);
