-- users is the shared identity record. Participation status belongs to
-- youth_profiles and login account status belongs to user_credentials.

ALTER TABLE users DROP COLUMN status;

DROP TYPE user_status;
