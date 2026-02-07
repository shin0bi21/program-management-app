-- ============================================================================
-- DATABASE INITIALIZATION
-- Created: 2026-01-30
-- ============================================================================
-- Contains all foundational tables for the youth services application

-- ============================================================================
-- EXTENSIONS
-- ============================================================================

-- Enable pgcrypto for gen_random_uuid() function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- MIGRATION TRACKING (PostgreSQL-Native)
-- ============================================================================

-- Track applied migrations in the database itself
CREATE TABLE IF NOT EXISTS schema_migrations (
  id SERIAL PRIMARY KEY,
  version VARCHAR(255) NOT NULL UNIQUE,  -- filename (e.g., '2026-01-30_init.sql')
  name TEXT,                              -- description
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checksum VARCHAR(64)                    -- optional SHA-256 for integrity
);

CREATE INDEX idx_schema_migrations_version ON schema_migrations(version);
CREATE INDEX idx_schema_migrations_applied_at ON schema_migrations(applied_at DESC);

-- Track backup infrastructure generation
CREATE TABLE IF NOT EXISTS schema_backup_tracking (
  id SERIAL PRIMARY KEY,
  table_name VARCHAR(255) NOT NULL UNIQUE,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  migration_version VARCHAR(255)
);

-- Advisory lock for preventing concurrent migrations (PostgreSQL-specific)
-- Lock ID 123456789 is arbitrary but consistent
-- Usage: SELECT pg_advisory_lock(123456789); ... run migration ... SELECT pg_advisory_unlock(123456789);

-- ============================================================================
-- POSTGRESQL ENUM TYPES
-- ============================================================================

-- Permission levels (replaces lookup table pattern)
CREATE TYPE permission_level AS ENUM ('youth', 'staff', 'admin');

-- Contact types (replaces lookup table pattern)
CREATE TYPE contact_type AS ENUM ('parent', 'sibling', 'guardian', 'emergency');

-- ============================================================================
-- BASE TABLE PATTERN
-- ============================================================================

-- Base table with common columns (not for data storage, template only)
CREATE TABLE IF NOT EXISTS base_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

-- Note: Use "LIKE base_table INCLUDING ALL" when creating new tables
-- Example:
--   CREATE TABLE new_table (
--     LIKE base_table INCLUDING ALL,
--     custom_column VARCHAR(255)
--   );

-- ============================================================================
-- USERS SCHEMA
-- ============================================================================

-- 1. User Groups (kept as table since groups can be dynamic)
CREATE TABLE IF NOT EXISTS user_groups (
  name VARCHAR(50) NOT NULL UNIQUE,
  LIKE base_table INCLUDING ALL
);

-- 2. Users Table (Profile Data Only)
CREATE TABLE IF NOT EXISTS users (
  permission permission_level NOT NULL DEFAULT 'youth',
  group_id UUID,
  first_name VARCHAR(120) NOT NULL,
  last_name VARCHAR(120) NOT NULL,
  LIKE base_table INCLUDING ALL,
  FOREIGN KEY (group_id) REFERENCES user_groups(id) ON DELETE SET NULL,
  -- Check constraints
  CHECK (LENGTH(TRIM(first_name)) > 0),
  CHECK (LENGTH(TRIM(last_name)) > 0)
);

CREATE INDEX idx_users_permission ON users(permission);
CREATE INDEX idx_users_group_id ON users(group_id);

-- 3. User Credentials Table (Authentication Data)
CREATE TABLE IF NOT EXISTS user_credentials (
  user_id UUID NOT NULL UNIQUE,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  last_login TIMESTAMPTZ,
  failed_login_attempts SMALLINT DEFAULT 0,
  locked_until TIMESTAMPTZ,
  LIKE base_table INCLUDING ALL,
  -- Email format validation (PostgreSQL regex)
  CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  -- Failed attempts must be non-negative
  CHECK (failed_login_attempts >= 0)
);

CREATE INDEX idx_user_credentials_email ON user_credentials(email);
CREATE INDEX idx_user_credentials_user_id ON user_credentials(user_id);

-- 4. Youth Profiles Table (Youth-Specific Data)
CREATE TABLE IF NOT EXISTS youth_profiles (
  user_id UUID NOT NULL UNIQUE,
  date_of_birth DATE,
  school_name VARCHAR(255),
  grade_level VARCHAR(50),
  LIKE base_table INCLUDING ALL,
  -- Date of birth must be in the past
  CHECK (date_of_birth IS NULL OR date_of_birth < CURRENT_DATE)
);

CREATE INDEX idx_youth_profiles_user_id ON youth_profiles(user_id);

-- 5. Password Reset Tokens Table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_password_reset_token ON password_reset_tokens(token);
CREATE INDEX idx_password_reset_user ON password_reset_tokens(user_id);

-- ============================================================================
-- 2FA SYSTEM
-- ============================================================================

-- 2FA Verification Codes
CREATE TABLE IF NOT EXISTS auth_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code VARCHAR(6) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_code CHECK (code ~ '^[0-9]{6}$')
);

CREATE INDEX idx_auth_codes_user_id ON auth_codes(user_id);
CREATE INDEX idx_auth_codes_code ON auth_codes(code);

-- Trusted Devices (Remember this device for 30 days)
CREATE TABLE IF NOT EXISTS trusted_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_hash VARCHAR(255) NOT NULL,
    device_name VARCHAR(255),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, device_hash)
);

CREATE INDEX idx_trusted_devices_user_id ON trusted_devices(user_id);
CREATE INDEX idx_trusted_devices_hash ON trusted_devices(device_hash);
CREATE INDEX idx_trusted_devices_expires ON trusted_devices(expires_at);

-- ============================================================================
-- TOKEN SECURITY (Refresh Token Rotation & Blacklist)
-- ============================================================================

-- Refresh Tokens Table (for token rotation and family tracking)
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    jti VARCHAR(255) NOT NULL UNIQUE,  -- JWT ID for token identification
    token_hash VARCHAR(255) NOT NULL,  -- SHA-256 hash of the token
    token_family UUID NOT NULL,        -- Track token families to detect theft
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    replaced_by UUID,                  -- Points to new token's ID (not JTI)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (replaced_by) REFERENCES refresh_tokens(id) ON DELETE SET NULL
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_jti ON refresh_tokens(jti);
CREATE INDEX idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_family ON refresh_tokens(token_family);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at);

-- Token Blacklist Table (for invalidated access tokens)
CREATE TABLE IF NOT EXISTS token_blacklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jti VARCHAR(255) NOT NULL UNIQUE,  -- JWT ID of the blacklisted token
    user_id UUID NOT NULL,
    token_hash VARCHAR(255) NOT NULL,  -- SHA-256 hash for quick lookup
    expires_at TIMESTAMPTZ NOT NULL,   -- When token naturally expires (for cleanup)
    blacklisted_at TIMESTAMPTZ DEFAULT NOW(),
    reason VARCHAR(255)                -- 'logout', 'password_change', 'security', etc.
);

CREATE INDEX idx_token_blacklist_jti ON token_blacklist(jti);
CREATE INDEX idx_token_blacklist_token_hash ON token_blacklist(token_hash);
CREATE INDEX idx_token_blacklist_user_id ON token_blacklist(user_id);
CREATE INDEX idx_token_blacklist_expires ON token_blacklist(expires_at);

-- ============================================================================
-- CONTACTS SYSTEM
-- ============================================================================

-- 6. Contacts (using contact_type enum)
CREATE TABLE IF NOT EXISTS contacts (
  first_name VARCHAR(120) NOT NULL,
  last_name VARCHAR(120) NOT NULL,
  phone_number VARCHAR(50),
  type contact_type NOT NULL DEFAULT 'parent',
  LIKE base_table INCLUDING ALL,
  -- Name validation
  CHECK (LENGTH(TRIM(first_name)) > 0),
  CHECK (LENGTH(TRIM(last_name)) > 0),
  -- Phone format validation (flexible: +1-234-567-8900, (234) 567-8900, 234-567-8900, etc.)
  CHECK (phone_number IS NULL OR phone_number ~ '^[+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$')
);

CREATE INDEX idx_contacts_type ON contacts(type);

-- 7. User Has Contacts Junction
CREATE TABLE IF NOT EXISTS user_has_contacts (
  user_id UUID NOT NULL,
  contact_id UUID NOT NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  PRIMARY KEY (user_id, contact_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
);

-- ============================================================================
-- YOUTH WORKSHEETS
-- ============================================================================

-- 8. Youth Worksheets (File uploads and assignments)
CREATE TABLE IF NOT EXISTS youth_worksheets (
  youth_id UUID NOT NULL,
  title VARCHAR(255) NOT NULL,
  file_data BYTEA,
  file_size INTEGER,
  file_type VARCHAR(100),
  note TEXT,
  metadata JSONB DEFAULT '{}',  -- Flexible JSON for tags, categories, etc.
  LIKE base_table INCLUDING ALL,
  FOREIGN KEY (youth_id) REFERENCES users(id) ON DELETE CASCADE,
  CHECK (LENGTH(TRIM(title)) > 0),
  CHECK (file_size IS NULL OR file_size > 0)
);

CREATE INDEX idx_youth_worksheets_youth_id ON youth_worksheets(youth_id);
CREATE INDEX idx_youth_worksheets_created_at ON youth_worksheets(created_at DESC);
-- GIN index for JSONB metadata querying (PostgreSQL-specific)
CREATE INDEX idx_youth_worksheets_metadata ON youth_worksheets USING GIN (metadata);

-- ============================================================================
-- FOREIGN KEY CONSTRAINTS (Circular Dependencies)
-- ============================================================================

-- Add FKs for tables that depend on users
ALTER TABLE user_credentials 
ADD CONSTRAINT fk_user_credentials_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE youth_profiles 
ADD CONSTRAINT fk_youth_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE password_reset_tokens 
ADD CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE token_blacklist 
ADD CONSTRAINT fk_token_blacklist_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Add audit FKs (created_by/updated_by) back to users
ALTER TABLE user_groups 
ADD CONSTRAINT fk_groups_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
ADD CONSTRAINT fk_groups_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE users 
ADD CONSTRAINT fk_users_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
ADD CONSTRAINT fk_users_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE user_credentials 
ADD CONSTRAINT fk_creds_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
ADD CONSTRAINT fk_creds_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE youth_profiles 
ADD CONSTRAINT fk_youth_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
ADD CONSTRAINT fk_youth_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE contacts 
ADD CONSTRAINT fk_contacts_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
ADD CONSTRAINT fk_contacts_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE user_has_contacts 
ADD CONSTRAINT fk_uhc_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
ADD CONSTRAINT fk_uhc_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE youth_worksheets 
ADD CONSTRAINT fk_worksheets_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
ADD CONSTRAINT fk_worksheets_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Seed user groups (lookup data)
INSERT INTO user_groups (name) VALUES ('Staff'), ('Junior Youth'), ('Senior Youth')
ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name;

-- Note: Admin user creation moved to db/scripts/seed-admin.ts
-- Run after first deployment: npm run seed:admin
-- Requires ADMIN_EMAIL and ADMIN_PASSWORD environment variables

-- ============================================================================
-- BASE COLUMNS PATTERN (for future migrations)
-- ============================================================================
-- Every app table should include these 4 audit columns:
--   created_at TIMESTAMPTZ DEFAULT NOW(),
--   updated_at TIMESTAMPTZ DEFAULT NOW(),
--   created_by UUID,
--   updated_by UUID
--
-- With foreign keys:
--   FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
--   FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
-- ============================================================================
