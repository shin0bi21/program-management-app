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
    version VARCHAR(255) NOT NULL UNIQUE, -- filename (e.g., '2026-01-30_init.sql')
    name TEXT,                            -- description
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    checksum VARCHAR(64)                  -- optional SHA-256 for integrity
);

CREATE INDEX idx_schema_migrations_version ON schema_migrations(version);
CREATE INDEX idx_schema_migrations_applied_at ON schema_migrations(applied_at DESC);

-- ============================================================================
-- AUDIT LOG
-- ============================================================================

-- Records all INSERT / UPDATE / DELETE mutations through the application
-- with actor identity and full before/after data.
-- transaction_id groups all changes made in one API request (supports undo).
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL,
    user_id UUID,
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(10) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_data JSONB,
    new_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_transaction_id ON audit_log(transaction_id);
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_record ON audit_log(table_name, record_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);

-- ============================================================================
-- AUTH LOG
-- ============================================================================

-- Records all security-relevant auth events (login attempts, 2FA, token reuse, etc.)
-- Append-only — never updated. Written fire-and-forget from authLogService.
CREATE TABLE IF NOT EXISTS auth_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event VARCHAR(50) NOT NULL CHECK (event IN (
        'login_success', 'login_failure', 'account_locked',
        '2fa_sent', '2fa_resent', '2fa_verified', '2fa_failed',
        'trusted_device_added',
        'logout',
        'password_reset_requested', 'password_reset_completed',
        'token_reuse_detected'
    )),
    user_id UUID,
    email TEXT,
    ip_hash TEXT,
    device_fingerprint_hash TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_auth_log_user_id ON auth_log(user_id);
CREATE INDEX idx_auth_log_event ON auth_log(event);
CREATE INDEX idx_auth_log_created_at ON auth_log(created_at DESC);
CREATE INDEX idx_auth_log_ip_hash ON auth_log(ip_hash);

-- Advisory lock for preventing concurrent migrations (PostgreSQL-specific)
-- Lock ID 123456789 is arbitrary but consistent
-- Usage: SELECT pg_advisory_lock(123456789); ... run migration ... SELECT pg_advisory_unlock(123456789);

-- ============================================================================
-- POSTGRESQL ENUM TYPES
-- ============================================================================

-- (permission_level enum removed — replaced by user_roles / user_permissions tables)

-- Contact types (replaces lookup table pattern)
CREATE TYPE contact_type AS ENUM ('parent', 'sibling', 'guardian', 'emergency');

-- School types
CREATE TYPE school_type AS ENUM ('grade_school', 'middle_school', 'high_school');

-- School boards
CREATE TYPE school_board AS ENUM ('public', 'catholic');

-- Age groups for youth profiles
CREATE TYPE age_group AS ENUM ('junior_youth', 'senior_youth');

-- ============================================================================
-- BASE TABLE PATTERN
-- ============================================================================

-- Base table with audit columns only (not for data storage, template only)
-- ID should ALWAYS be defined first in each table, then custom columns, then LIKE base_table for audit columns
CREATE TABLE IF NOT EXISTS base_table (
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID
);

-- Note: Always structure tables with ID FIRST, custom columns, then audit columns via LIKE
-- Example:
--   CREATE TABLE new_table (
--       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--       custom_column VARCHAR(255),
--       LIKE base_table INCLUDING ALL
--   );

-- ============================================================================
-- USERS SCHEMA
-- ============================================================================

-- 1. Roles & Permissions
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(64) NOT NULL UNIQUE,
    LIKE base_table INCLUDING ALL
);

CREATE TABLE IF NOT EXISTS user_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(128) NOT NULL UNIQUE,
    LIKE base_table INCLUDING ALL
);

CREATE TABLE IF NOT EXISTS user_role_has_permissions (
    role_id UUID NOT NULL REFERENCES user_roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES user_permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_by UUID
);

CREATE INDEX idx_user_role_has_permissions_role_id ON user_role_has_permissions(role_id);
CREATE INDEX idx_user_role_has_permissions_permission_id ON user_role_has_permissions(permission_id);
CREATE INDEX idx_user_roles_created_by ON user_roles(created_by);
CREATE INDEX idx_user_permissions_created_by ON user_permissions(created_by);
CREATE INDEX idx_urhp_created_by ON user_role_has_permissions(created_by);

-- Seed roles
INSERT INTO user_roles (name) VALUES ('admin'), ('staff'), ('youth') ON CONFLICT (name) DO NOTHING;

-- Seed permissions
INSERT INTO user_permissions (name) VALUES
  ('read:staff'),
  ('write:staff'),
  ('read:youth_profiles'),
  ('write:youth_profiles'),
  ('read:schools'),
  ('read:settings'),
  ('write:settings')
ON CONFLICT (name) DO NOTHING;

-- Seed role → permission assignments
INSERT INTO user_role_has_permissions (role_id, permission_id)
SELECT r.id, p.id FROM user_roles r, user_permissions p
WHERE r.name = 'admin' AND p.name IN ('read:staff', 'write:staff', 'read:youth_profiles', 'write:youth_profiles', 'read:schools', 'read:settings', 'write:settings')
ON CONFLICT DO NOTHING;

INSERT INTO user_role_has_permissions (role_id, permission_id)
SELECT r.id, p.id FROM user_roles r, user_permissions p
WHERE r.name = 'staff' AND p.name IN ('read:youth_profiles', 'write:youth_profiles', 'read:schools')
ON CONFLICT DO NOTHING;

-- youth role has no permissions (intentional — empty set for now)

-- 2. Users Table (Profile Data Only)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES user_roles(id),
    first_name VARCHAR(120) NOT NULL,
    last_name VARCHAR(120) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    LIKE base_table INCLUDING ALL,
    CHECK (LENGTH(TRIM(first_name)) > 0),
    CHECK (LENGTH(TRIM(last_name)) > 0)
);

CREATE INDEX idx_users_role_id ON users(role_id);
CREATE INDEX idx_users_active ON users(active);

COMMENT ON COLUMN users.active IS 'Active status: true for current cohort youth and enabled staff logins';

-- 3. User Credentials Table (Authentication Data)
CREATE TABLE IF NOT EXISTS user_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- 4. Schools Table (Reference Data)
CREATE TABLE IF NOT EXISTS schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    address VARCHAR(255) NOT NULL,
    school_type school_type NOT NULL,
    board school_board,
    postal_code VARCHAR(20),
    LIKE base_table INCLUDING ALL
);

CREATE INDEX idx_schools_name ON schools(name);
CREATE INDEX idx_schools_type ON schools(school_type);
CREATE INDEX idx_schools_board ON schools(board);

-- 5. Youth Profiles Table (Youth-Specific Data)
CREATE TABLE IF NOT EXISTS youth_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    date_of_birth DATE,
    school_id UUID,
    grade_level SMALLINT,
    age_group age_group,
    LIKE base_table INCLUDING ALL,
    -- Date of birth must be in the past
    CHECK (date_of_birth IS NULL OR date_of_birth < CURRENT_DATE),
    -- Grade must be between 0 (Kindergarten) and 12
    CHECK (grade_level IS NULL OR grade_level BETWEEN 0 AND 12)
);

CREATE INDEX idx_youth_profiles_user_id ON youth_profiles(user_id);
CREATE INDEX idx_youth_profiles_school_id ON youth_profiles(school_id);

-- 6. Password Reset Tokens Table
CREATE TABLE IF NOT EXISTS user_password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_password_reset_token ON user_password_reset_tokens(token);
CREATE INDEX idx_user_password_reset_user ON user_password_reset_tokens(user_id);

-- ============================================================================
-- 2FA SYSTEM
-- ============================================================================

-- 2FA Verification Codes
CREATE TABLE IF NOT EXISTS user_auth_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code VARCHAR(6) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_code CHECK (code ~ '^[0-9]{6}$')
);

CREATE INDEX idx_user_auth_codes_user_id ON user_auth_codes(user_id);
CREATE INDEX idx_user_auth_codes_code ON user_auth_codes(code);

-- Trusted Devices (Remember this device for 30 days)
CREATE TABLE IF NOT EXISTS user_trusted_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_hash VARCHAR(255) NOT NULL,
    device_name VARCHAR(255),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, device_hash)
);

CREATE INDEX idx_user_trusted_devices_user_id ON user_trusted_devices(user_id);
CREATE INDEX idx_user_trusted_devices_hash ON user_trusted_devices(device_hash);
CREATE INDEX idx_user_trusted_devices_expires ON user_trusted_devices(expires_at);

-- ============================================================================
-- TOKEN SECURITY (Refresh Token Rotation & Blacklist)
-- ============================================================================

-- Refresh Tokens Table (for token rotation and family tracking)
CREATE TABLE IF NOT EXISTS user_refresh_tokens (
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
    FOREIGN KEY (replaced_by) REFERENCES user_refresh_tokens(id) ON DELETE SET NULL
);

CREATE INDEX idx_user_refresh_tokens_user_id ON user_refresh_tokens(user_id);
CREATE INDEX idx_user_refresh_tokens_jti ON user_refresh_tokens(jti);
CREATE INDEX idx_user_refresh_tokens_token_hash ON user_refresh_tokens(token_hash);
CREATE INDEX idx_user_refresh_tokens_family ON user_refresh_tokens(token_family);
CREATE INDEX idx_user_refresh_tokens_expires ON user_refresh_tokens(expires_at);

-- System Revoked Tokens Table (for invalidated access tokens)
CREATE TABLE IF NOT EXISTS system_revoked_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jti VARCHAR(255) NOT NULL UNIQUE,  -- JWT ID of the blacklisted token
    user_id UUID NOT NULL,
    token_hash VARCHAR(255) NOT NULL,  -- SHA-256 hash for quick lookup
    expires_at TIMESTAMPTZ NOT NULL,   -- When token naturally expires (for cleanup)
    blacklisted_at TIMESTAMPTZ DEFAULT NOW(),
    reason VARCHAR(255)                -- 'logout', 'password_change', 'security', etc.
);

CREATE INDEX idx_system_revoked_tokens_jti ON system_revoked_tokens(jti);
CREATE INDEX idx_system_revoked_tokens_token_hash ON system_revoked_tokens(token_hash);
CREATE INDEX idx_system_revoked_tokens_user_id ON system_revoked_tokens(user_id);
CREATE INDEX idx_system_revoked_tokens_expires ON system_revoked_tokens(expires_at);

-- ============================================================================
-- ADDRESSES SYSTEM
-- ============================================================================

-- Addresses Table (shared by users, contacts, etc.)
CREATE TABLE IF NOT EXISTS addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    address VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    province VARCHAR(100) NOT NULL,
    postal_code VARCHAR(20) NOT NULL,
    country VARCHAR(100) NOT NULL DEFAULT 'Canada',
    LIKE base_table INCLUDING ALL,
    -- Validation
    CHECK (LENGTH(TRIM(address)) > 0),
    CHECK (LENGTH(TRIM(city)) > 0),
    CHECK (LENGTH(TRIM(province)) > 0),
    CHECK (LENGTH(TRIM(postal_code)) > 0)
);

CREATE INDEX idx_addresses_postal_code ON addresses(postal_code);
CREATE INDEX idx_addresses_city ON addresses(city);

-- User Has Addresses Junction
CREATE TABLE IF NOT EXISTS user_has_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    address_id UUID NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    LIKE base_table INCLUDING ALL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (address_id) REFERENCES addresses(id) ON DELETE CASCADE,
    UNIQUE(user_id, address_id)
);

CREATE INDEX idx_user_has_addresses_user_id ON user_has_addresses(user_id);
CREATE INDEX idx_user_has_addresses_address_id ON user_has_addresses(address_id);
CREATE INDEX idx_user_has_addresses_active ON user_has_addresses(active);

-- ============================================================================
-- CONTACTS SYSTEM
-- ============================================================================

-- 6. Contacts (using contact_type enum)
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    active BOOLEAN NOT NULL DEFAULT true,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,
    PRIMARY KEY (user_id, contact_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
);

CREATE INDEX idx_user_has_contacts_active ON user_has_contacts(active);

-- ============================================================================
-- YOUTH WORKSHEETS
-- ============================================================================

-- 8. Youth Worksheets (File uploads and assignments)
CREATE TABLE IF NOT EXISTS youth_worksheets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    youth_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    file_data BYTEA,
    file_size INTEGER,
    file_type VARCHAR(100),
    note TEXT,
    metadata JSONB DEFAULT '{}', -- Flexible JSON for tags, categories, etc.
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

ALTER TABLE youth_profiles 
ADD CONSTRAINT fk_youth_profiles_school FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE SET NULL;

ALTER TABLE user_password_reset_tokens 
ADD CONSTRAINT fk_user_password_reset_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE system_revoked_tokens 
ADD CONSTRAINT fk_system_revoked_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Add audit FKs (created_by/updated_by) back to users
ALTER TABLE users 
ADD CONSTRAINT fk_users_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
ADD CONSTRAINT fk_users_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE user_credentials 
ADD CONSTRAINT fk_creds_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
ADD CONSTRAINT fk_creds_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE youth_profiles 
ADD CONSTRAINT fk_youth_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
ADD CONSTRAINT fk_youth_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE schools 
ADD CONSTRAINT fk_schools_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
ADD CONSTRAINT fk_schools_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE contacts 
ADD CONSTRAINT fk_contacts_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
ADD CONSTRAINT fk_contacts_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE user_has_contacts 
ADD CONSTRAINT fk_uhc_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
ADD CONSTRAINT fk_uhc_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE youth_worksheets 
ADD CONSTRAINT fk_worksheets_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
ADD CONSTRAINT fk_worksheets_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE addresses
ADD CONSTRAINT fk_addresses_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
ADD CONSTRAINT fk_addresses_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE user_has_addresses
ADD CONSTRAINT fk_uha_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
ADD CONSTRAINT fk_uha_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE user_roles
ADD CONSTRAINT fk_user_roles_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
ADD CONSTRAINT fk_user_roles_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE user_permissions
ADD CONSTRAINT fk_user_permissions_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
ADD CONSTRAINT fk_user_permissions_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE user_role_has_permissions
ADD CONSTRAINT fk_urhp_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
ADD CONSTRAINT fk_urhp_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

-- ============================================================================
-- SEED DATA
-- ============================================================================

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
