-- Reset and invitation links already store SHA-256 digests, never raw tokens.
-- Rename the column and its indexes without changing existing links or values.
ALTER TABLE user_password_reset_tokens RENAME COLUMN token TO token_hash;
ALTER TABLE user_password_reset_tokens
  RENAME CONSTRAINT user_password_reset_tokens_token_key TO user_password_reset_tokens_token_hash_key;
ALTER INDEX idx_user_password_reset_token RENAME TO idx_user_password_reset_token_hash;
