-- ============================================================================
-- BACKUP SYSTEM FOR: 2026-01-31_1_init.sql
-- Generated: 2026-05-07T00:15:56.833Z
-- Tables: user_roles, user_role_has_permissions, users, schools, youth_profiles, addresses, user_has_addresses, contacts, user_has_contacts, youth_worksheets
-- ============================================================================

-- ============================================================================
-- TABLE: user_roles
-- ============================================================================

-- Backup table for user_roles
CREATE TABLE IF NOT EXISTS user_roles_backup (
  _uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  _backup_timestamp TIMESTAMPTZ DEFAULT NOW(),
  _backup_action VARCHAR(10),
  id UUID,
  name VARCHAR(64),
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  created_by UUID,
  updated_by UUID
);

-- BEFORE INSERT trigger for user_roles
DROP FUNCTION IF EXISTS user_roles_before_insert() CASCADE;
CREATE OR REPLACE FUNCTION user_roles_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
  -- Validate NOT NULL: name
  IF NEW.name IS NULL THEN
    RAISE EXCEPTION '[user_roles] name cannot be NULL';
  END IF;
  -- Validate VARCHAR length: name
  IF NEW.name IS NOT NULL AND LENGTH(NEW.name) > 64 THEN
    RAISE EXCEPTION '[user_roles] name exceeds maximum length of 64 characters';
  END IF;
  -- Validate not empty: name
  IF LENGTH(TRIM(NEW.name)) = 0 THEN
    RAISE EXCEPTION '[user_roles] name cannot be empty';
  END IF;

  -- Debug log (optional - comment out in production)
  -- RAISE NOTICE '[DEBUG] Inserting into user_roles: %', NEW;

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trigger_user_roles_before_insert ON user_roles;
CREATE TRIGGER trigger_user_roles_before_insert
BEFORE INSERT ON user_roles
FOR EACH ROW
EXECUTE FUNCTION user_roles_before_insert();

-- BEFORE UPDATE trigger for user_roles
DROP FUNCTION IF EXISTS user_roles_before_update() CASCADE;
CREATE OR REPLACE FUNCTION user_roles_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
  -- Snapshot old state to backup table
  INSERT INTO user_roles_backup (
    _backup_action, id, name, created_at, updated_at, created_by, updated_by
  ) VALUES (
    'UPDATE', OLD.id, OLD.name, OLD.created_at, OLD.updated_at, OLD.created_by, OLD.updated_by
  );

  -- Auto-update updated_at if column exists
  IF TG_TABLE_NAME IN (SELECT table_name FROM information_schema.columns WHERE column_name = 'updated_at' AND table_name = TG_TABLE_NAME) THEN
    NEW.updated_at = NOW();
  END IF;

  -- Debug log (optional - comment out in production)
  -- RAISE NOTICE '[DEBUG] Updating user_roles - OLD: % | NEW: %', OLD, NEW;

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trigger_user_roles_before_update ON user_roles;
CREATE TRIGGER trigger_user_roles_before_update
BEFORE UPDATE ON user_roles
FOR EACH ROW
EXECUTE FUNCTION user_roles_before_update();

-- BEFORE DELETE trigger for user_roles
DROP FUNCTION IF EXISTS user_roles_before_delete() CASCADE;
CREATE OR REPLACE FUNCTION user_roles_before_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
  -- Snapshot before deletion
  INSERT INTO user_roles_backup (
    _backup_action, id, name, created_at, updated_at, created_by, updated_by
  ) VALUES (
    'DELETE', OLD.id, OLD.name, OLD.created_at, OLD.updated_at, OLD.created_by, OLD.updated_by
  );

  -- Debug log (optional - comment out in production)
  -- RAISE NOTICE '[DEBUG] Deleting from user_roles: %', OLD;

  RETURN OLD;
END;
$func$;

DROP TRIGGER IF EXISTS trigger_user_roles_before_delete ON user_roles;
CREATE TRIGGER trigger_user_roles_before_delete
BEFORE DELETE ON user_roles
FOR EACH ROW
EXECUTE FUNCTION user_roles_before_delete();

-- ============================================================================
-- TABLE: user_role_has_permissions
-- ============================================================================

-- Backup table for user_role_has_permissions
CREATE TABLE IF NOT EXISTS user_role_has_permissions_backup (
  _uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  _backup_timestamp TIMESTAMPTZ DEFAULT NOW(),
  _backup_action VARCHAR(10),
  role_id UUID,
  permission_id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  created_by UUID,
  updated_by UUID
);

-- BEFORE INSERT trigger for user_role_has_permissions
DROP FUNCTION IF EXISTS user_role_has_permissions_before_insert() CASCADE;
CREATE OR REPLACE FUNCTION user_role_has_permissions_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
  -- Validate NOT NULL: role_id
  IF NEW.role_id IS NULL THEN
    RAISE EXCEPTION '[user_role_has_permissions] role_id cannot be NULL';
  END IF;
  -- Validate NOT NULL: permission_id
  IF NEW.permission_id IS NULL THEN
    RAISE EXCEPTION '[user_role_has_permissions] permission_id cannot be NULL';
  END IF;

  -- Debug log (optional - comment out in production)
  -- RAISE NOTICE '[DEBUG] Inserting into user_role_has_permissions: %', NEW;

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trigger_user_role_has_permissions_before_insert ON user_role_has_permissions;
CREATE TRIGGER trigger_user_role_has_permissions_before_insert
BEFORE INSERT ON user_role_has_permissions
FOR EACH ROW
EXECUTE FUNCTION user_role_has_permissions_before_insert();

-- BEFORE UPDATE trigger for user_role_has_permissions
DROP FUNCTION IF EXISTS user_role_has_permissions_before_update() CASCADE;
CREATE OR REPLACE FUNCTION user_role_has_permissions_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
  -- Snapshot old state to backup table
  INSERT INTO user_role_has_permissions_backup (
    _backup_action, role_id, permission_id, created_at, updated_at, created_by, updated_by
  ) VALUES (
    'UPDATE', OLD.role_id, OLD.permission_id, OLD.created_at, OLD.updated_at, OLD.created_by, OLD.updated_by
  );

  -- Auto-update updated_at if column exists
  IF TG_TABLE_NAME IN (SELECT table_name FROM information_schema.columns WHERE column_name = 'updated_at' AND table_name = TG_TABLE_NAME) THEN
    NEW.updated_at = NOW();
  END IF;

  -- Debug log (optional - comment out in production)
  -- RAISE NOTICE '[DEBUG] Updating user_role_has_permissions - OLD: % | NEW: %', OLD, NEW;

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trigger_user_role_has_permissions_before_update ON user_role_has_permissions;
CREATE TRIGGER trigger_user_role_has_permissions_before_update
BEFORE UPDATE ON user_role_has_permissions
FOR EACH ROW
EXECUTE FUNCTION user_role_has_permissions_before_update();

-- BEFORE DELETE trigger for user_role_has_permissions
DROP FUNCTION IF EXISTS user_role_has_permissions_before_delete() CASCADE;
CREATE OR REPLACE FUNCTION user_role_has_permissions_before_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
  -- Snapshot before deletion
  INSERT INTO user_role_has_permissions_backup (
    _backup_action, role_id, permission_id, created_at, updated_at, created_by, updated_by
  ) VALUES (
    'DELETE', OLD.role_id, OLD.permission_id, OLD.created_at, OLD.updated_at, OLD.created_by, OLD.updated_by
  );

  -- Debug log (optional - comment out in production)
  -- RAISE NOTICE '[DEBUG] Deleting from user_role_has_permissions: %', OLD;

  RETURN OLD;
END;
$func$;

DROP TRIGGER IF EXISTS trigger_user_role_has_permissions_before_delete ON user_role_has_permissions;
CREATE TRIGGER trigger_user_role_has_permissions_before_delete
BEFORE DELETE ON user_role_has_permissions
FOR EACH ROW
EXECUTE FUNCTION user_role_has_permissions_before_delete();

-- ============================================================================
-- TABLE: users
-- ============================================================================

-- Backup table for users
CREATE TABLE IF NOT EXISTS users_backup (
  _uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  _backup_timestamp TIMESTAMPTZ DEFAULT NOW(),
  _backup_action VARCHAR(10),
  id UUID,
  role_id UUID,
  first_name VARCHAR(120),
  last_name VARCHAR(120),
  active BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  created_by UUID,
  updated_by UUID
);

-- BEFORE INSERT trigger for users
DROP FUNCTION IF EXISTS users_before_insert() CASCADE;
CREATE OR REPLACE FUNCTION users_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
  -- Validate NOT NULL: role_id
  IF NEW.role_id IS NULL THEN
    RAISE EXCEPTION '[users] role_id cannot be NULL';
  END IF;
  -- Validate NOT NULL: first_name
  IF NEW.first_name IS NULL THEN
    RAISE EXCEPTION '[users] first_name cannot be NULL';
  END IF;
  -- Validate VARCHAR length: first_name
  IF NEW.first_name IS NOT NULL AND LENGTH(NEW.first_name) > 120 THEN
    RAISE EXCEPTION '[users] first_name exceeds maximum length of 120 characters';
  END IF;
  -- Validate not empty: first_name
  IF LENGTH(TRIM(NEW.first_name)) = 0 THEN
    RAISE EXCEPTION '[users] first_name cannot be empty';
  END IF;
  -- Validate NOT NULL: last_name
  IF NEW.last_name IS NULL THEN
    RAISE EXCEPTION '[users] last_name cannot be NULL';
  END IF;
  -- Validate VARCHAR length: last_name
  IF NEW.last_name IS NOT NULL AND LENGTH(NEW.last_name) > 120 THEN
    RAISE EXCEPTION '[users] last_name exceeds maximum length of 120 characters';
  END IF;
  -- Validate not empty: last_name
  IF LENGTH(TRIM(NEW.last_name)) = 0 THEN
    RAISE EXCEPTION '[users] last_name cannot be empty';
  END IF;

  -- Debug log (optional - comment out in production)
  -- RAISE NOTICE '[DEBUG] Inserting into users: %', NEW;

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trigger_users_before_insert ON users;
CREATE TRIGGER trigger_users_before_insert
BEFORE INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION users_before_insert();

-- BEFORE UPDATE trigger for users
DROP FUNCTION IF EXISTS users_before_update() CASCADE;
CREATE OR REPLACE FUNCTION users_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
  -- Snapshot old state to backup table
  INSERT INTO users_backup (
    _backup_action, id, role_id, first_name, last_name, active, created_at, updated_at, created_by, updated_by
  ) VALUES (
    'UPDATE', OLD.id, OLD.role_id, OLD.first_name, OLD.last_name, OLD.active, OLD.created_at, OLD.updated_at, OLD.created_by, OLD.updated_by
  );

  -- Auto-update updated_at if column exists
  IF TG_TABLE_NAME IN (SELECT table_name FROM information_schema.columns WHERE column_name = 'updated_at' AND table_name = TG_TABLE_NAME) THEN
    NEW.updated_at = NOW();
  END IF;

  -- Debug log (optional - comment out in production)
  -- RAISE NOTICE '[DEBUG] Updating users - OLD: % | NEW: %', OLD, NEW;

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trigger_users_before_update ON users;
CREATE TRIGGER trigger_users_before_update
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION users_before_update();

-- BEFORE DELETE trigger for users
DROP FUNCTION IF EXISTS users_before_delete() CASCADE;
CREATE OR REPLACE FUNCTION users_before_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
  -- Snapshot before deletion
  INSERT INTO users_backup (
    _backup_action, id, role_id, first_name, last_name, active, created_at, updated_at, created_by, updated_by
  ) VALUES (
    'DELETE', OLD.id, OLD.role_id, OLD.first_name, OLD.last_name, OLD.active, OLD.created_at, OLD.updated_at, OLD.created_by, OLD.updated_by
  );

  -- Debug log (optional - comment out in production)
  -- RAISE NOTICE '[DEBUG] Deleting from users: %', OLD;

  RETURN OLD;
END;
$func$;

DROP TRIGGER IF EXISTS trigger_users_before_delete ON users;
CREATE TRIGGER trigger_users_before_delete
BEFORE DELETE ON users
FOR EACH ROW
EXECUTE FUNCTION users_before_delete();

-- ============================================================================
-- TABLE: schools
-- ============================================================================

-- Backup table for schools
CREATE TABLE IF NOT EXISTS schools_backup (
  _uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  _backup_timestamp TIMESTAMPTZ DEFAULT NOW(),
  _backup_action VARCHAR(10),
  id UUID,
  name VARCHAR(255),
  address VARCHAR(255),
  school_type school_type,
  board school_board,
  postal_code VARCHAR(20),
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  created_by UUID,
  updated_by UUID
);

-- BEFORE INSERT trigger for schools
DROP FUNCTION IF EXISTS schools_before_insert() CASCADE;
CREATE OR REPLACE FUNCTION schools_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
  -- Validate NOT NULL: name
  IF NEW.name IS NULL THEN
    RAISE EXCEPTION '[schools] name cannot be NULL';
  END IF;
  -- Validate VARCHAR length: name
  IF NEW.name IS NOT NULL AND LENGTH(NEW.name) > 255 THEN
    RAISE EXCEPTION '[schools] name exceeds maximum length of 255 characters';
  END IF;
  -- Validate not empty: name
  IF LENGTH(TRIM(NEW.name)) = 0 THEN
    RAISE EXCEPTION '[schools] name cannot be empty';
  END IF;
  -- Validate NOT NULL: address
  IF NEW.address IS NULL THEN
    RAISE EXCEPTION '[schools] address cannot be NULL';
  END IF;
  -- Validate VARCHAR length: address
  IF NEW.address IS NOT NULL AND LENGTH(NEW.address) > 255 THEN
    RAISE EXCEPTION '[schools] address exceeds maximum length of 255 characters';
  END IF;
  -- Validate not empty: address
  IF LENGTH(TRIM(NEW.address)) = 0 THEN
    RAISE EXCEPTION '[schools] address cannot be empty';
  END IF;
  -- Validate NOT NULL: school_type
  IF NEW.school_type IS NULL THEN
    RAISE EXCEPTION '[schools] school_type cannot be NULL';
  END IF;
  -- Validate VARCHAR length: postal_code
  IF NEW.postal_code IS NOT NULL AND LENGTH(NEW.postal_code) > 20 THEN
    RAISE EXCEPTION '[schools] postal_code exceeds maximum length of 20 characters';
  END IF;

  -- Debug log (optional - comment out in production)
  -- RAISE NOTICE '[DEBUG] Inserting into schools: %', NEW;

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trigger_schools_before_insert ON schools;
CREATE TRIGGER trigger_schools_before_insert
BEFORE INSERT ON schools
FOR EACH ROW
EXECUTE FUNCTION schools_before_insert();

-- BEFORE UPDATE trigger for schools
DROP FUNCTION IF EXISTS schools_before_update() CASCADE;
CREATE OR REPLACE FUNCTION schools_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
  -- Snapshot old state to backup table
  INSERT INTO schools_backup (
    _backup_action, id, name, address, school_type, board, postal_code, created_at, updated_at, created_by, updated_by
  ) VALUES (
    'UPDATE', OLD.id, OLD.name, OLD.address, OLD.school_type, OLD.board, OLD.postal_code, OLD.created_at, OLD.updated_at, OLD.created_by, OLD.updated_by
  );

  -- Auto-update updated_at if column exists
  IF TG_TABLE_NAME IN (SELECT table_name FROM information_schema.columns WHERE column_name = 'updated_at' AND table_name = TG_TABLE_NAME) THEN
    NEW.updated_at = NOW();
  END IF;

  -- Debug log (optional - comment out in production)
  -- RAISE NOTICE '[DEBUG] Updating schools - OLD: % | NEW: %', OLD, NEW;

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trigger_schools_before_update ON schools;
CREATE TRIGGER trigger_schools_before_update
BEFORE UPDATE ON schools
FOR EACH ROW
EXECUTE FUNCTION schools_before_update();

-- BEFORE DELETE trigger for schools
DROP FUNCTION IF EXISTS schools_before_delete() CASCADE;
CREATE OR REPLACE FUNCTION schools_before_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
  -- Snapshot before deletion
  INSERT INTO schools_backup (
    _backup_action, id, name, address, school_type, board, postal_code, created_at, updated_at, created_by, updated_by
  ) VALUES (
    'DELETE', OLD.id, OLD.name, OLD.address, OLD.school_type, OLD.board, OLD.postal_code, OLD.created_at, OLD.updated_at, OLD.created_by, OLD.updated_by
  );

  -- Debug log (optional - comment out in production)
  -- RAISE NOTICE '[DEBUG] Deleting from schools: %', OLD;

  RETURN OLD;
END;
$func$;

DROP TRIGGER IF EXISTS trigger_schools_before_delete ON schools;
CREATE TRIGGER trigger_schools_before_delete
BEFORE DELETE ON schools
FOR EACH ROW
EXECUTE FUNCTION schools_before_delete();

-- ============================================================================
-- TABLE: youth_profiles
-- ============================================================================

-- Backup table for youth_profiles
CREATE TABLE IF NOT EXISTS youth_profiles_backup (
  _uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  _backup_timestamp TIMESTAMPTZ DEFAULT NOW(),
  _backup_action VARCHAR(10),
  id UUID,
  user_id UUID,
  date_of_birth DATE,
  school_id UUID,
  grade_level SMALLINT,
  age_group age_group,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  created_by UUID,
  updated_by UUID
);

-- BEFORE INSERT trigger for youth_profiles
DROP FUNCTION IF EXISTS youth_profiles_before_insert() CASCADE;
CREATE OR REPLACE FUNCTION youth_profiles_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
  -- Validate NOT NULL: user_id
  IF NEW.user_id IS NULL THEN
    RAISE EXCEPTION '[youth_profiles] user_id cannot be NULL';
  END IF;

  -- Debug log (optional - comment out in production)
  -- RAISE NOTICE '[DEBUG] Inserting into youth_profiles: %', NEW;

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trigger_youth_profiles_before_insert ON youth_profiles;
CREATE TRIGGER trigger_youth_profiles_before_insert
BEFORE INSERT ON youth_profiles
FOR EACH ROW
EXECUTE FUNCTION youth_profiles_before_insert();

-- BEFORE UPDATE trigger for youth_profiles
DROP FUNCTION IF EXISTS youth_profiles_before_update() CASCADE;
CREATE OR REPLACE FUNCTION youth_profiles_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
  -- Snapshot old state to backup table
  INSERT INTO youth_profiles_backup (
    _backup_action, id, user_id, date_of_birth, school_id, grade_level, age_group, created_at, updated_at, created_by, updated_by
  ) VALUES (
    'UPDATE', OLD.id, OLD.user_id, OLD.date_of_birth, OLD.school_id, OLD.grade_level, OLD.age_group, OLD.created_at, OLD.updated_at, OLD.created_by, OLD.updated_by
  );

  -- Auto-update updated_at if column exists
  IF TG_TABLE_NAME IN (SELECT table_name FROM information_schema.columns WHERE column_name = 'updated_at' AND table_name = TG_TABLE_NAME) THEN
    NEW.updated_at = NOW();
  END IF;

  -- Debug log (optional - comment out in production)
  -- RAISE NOTICE '[DEBUG] Updating youth_profiles - OLD: % | NEW: %', OLD, NEW;

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trigger_youth_profiles_before_update ON youth_profiles;
CREATE TRIGGER trigger_youth_profiles_before_update
BEFORE UPDATE ON youth_profiles
FOR EACH ROW
EXECUTE FUNCTION youth_profiles_before_update();

-- BEFORE DELETE trigger for youth_profiles
DROP FUNCTION IF EXISTS youth_profiles_before_delete() CASCADE;
CREATE OR REPLACE FUNCTION youth_profiles_before_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
  -- Snapshot before deletion
  INSERT INTO youth_profiles_backup (
    _backup_action, id, user_id, date_of_birth, school_id, grade_level, age_group, created_at, updated_at, created_by, updated_by
  ) VALUES (
    'DELETE', OLD.id, OLD.user_id, OLD.date_of_birth, OLD.school_id, OLD.grade_level, OLD.age_group, OLD.created_at, OLD.updated_at, OLD.created_by, OLD.updated_by
  );

  -- Debug log (optional - comment out in production)
  -- RAISE NOTICE '[DEBUG] Deleting from youth_profiles: %', OLD;

  RETURN OLD;
END;
$func$;

DROP TRIGGER IF EXISTS trigger_youth_profiles_before_delete ON youth_profiles;
CREATE TRIGGER trigger_youth_profiles_before_delete
BEFORE DELETE ON youth_profiles
FOR EACH ROW
EXECUTE FUNCTION youth_profiles_before_delete();

-- ============================================================================
-- TABLE: addresses
-- ============================================================================

-- Backup table for addresses
CREATE TABLE IF NOT EXISTS addresses_backup (
  _uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  _backup_timestamp TIMESTAMPTZ DEFAULT NOW(),
  _backup_action VARCHAR(10),
  id UUID,
  address VARCHAR(255),
  city VARCHAR(100),
  province VARCHAR(100),
  postal_code VARCHAR(20),
  country VARCHAR(100),
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  created_by UUID,
  updated_by UUID
);

-- BEFORE INSERT trigger for addresses
DROP FUNCTION IF EXISTS addresses_before_insert() CASCADE;
CREATE OR REPLACE FUNCTION addresses_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
  -- Validate NOT NULL: address
  IF NEW.address IS NULL THEN
    RAISE EXCEPTION '[addresses] address cannot be NULL';
  END IF;
  -- Validate VARCHAR length: address
  IF NEW.address IS NOT NULL AND LENGTH(NEW.address) > 255 THEN
    RAISE EXCEPTION '[addresses] address exceeds maximum length of 255 characters';
  END IF;
  -- Validate not empty: address
  IF LENGTH(TRIM(NEW.address)) = 0 THEN
    RAISE EXCEPTION '[addresses] address cannot be empty';
  END IF;
  -- Validate NOT NULL: city
  IF NEW.city IS NULL THEN
    RAISE EXCEPTION '[addresses] city cannot be NULL';
  END IF;
  -- Validate VARCHAR length: city
  IF NEW.city IS NOT NULL AND LENGTH(NEW.city) > 100 THEN
    RAISE EXCEPTION '[addresses] city exceeds maximum length of 100 characters';
  END IF;
  -- Validate not empty: city
  IF LENGTH(TRIM(NEW.city)) = 0 THEN
    RAISE EXCEPTION '[addresses] city cannot be empty';
  END IF;
  -- Validate NOT NULL: province
  IF NEW.province IS NULL THEN
    RAISE EXCEPTION '[addresses] province cannot be NULL';
  END IF;
  -- Validate VARCHAR length: province
  IF NEW.province IS NOT NULL AND LENGTH(NEW.province) > 100 THEN
    RAISE EXCEPTION '[addresses] province exceeds maximum length of 100 characters';
  END IF;
  -- Validate not empty: province
  IF LENGTH(TRIM(NEW.province)) = 0 THEN
    RAISE EXCEPTION '[addresses] province cannot be empty';
  END IF;
  -- Validate NOT NULL: postal_code
  IF NEW.postal_code IS NULL THEN
    RAISE EXCEPTION '[addresses] postal_code cannot be NULL';
  END IF;
  -- Validate VARCHAR length: postal_code
  IF NEW.postal_code IS NOT NULL AND LENGTH(NEW.postal_code) > 20 THEN
    RAISE EXCEPTION '[addresses] postal_code exceeds maximum length of 20 characters';
  END IF;
  -- Validate not empty: postal_code
  IF LENGTH(TRIM(NEW.postal_code)) = 0 THEN
    RAISE EXCEPTION '[addresses] postal_code cannot be empty';
  END IF;

  -- Debug log (optional - comment out in production)
  -- RAISE NOTICE '[DEBUG] Inserting into addresses: %', NEW;

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trigger_addresses_before_insert ON addresses;
CREATE TRIGGER trigger_addresses_before_insert
BEFORE INSERT ON addresses
FOR EACH ROW
EXECUTE FUNCTION addresses_before_insert();

-- BEFORE UPDATE trigger for addresses
DROP FUNCTION IF EXISTS addresses_before_update() CASCADE;
CREATE OR REPLACE FUNCTION addresses_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
  -- Snapshot old state to backup table
  INSERT INTO addresses_backup (
    _backup_action, id, address, city, province, postal_code, country, created_at, updated_at, created_by, updated_by
  ) VALUES (
    'UPDATE', OLD.id, OLD.address, OLD.city, OLD.province, OLD.postal_code, OLD.country, OLD.created_at, OLD.updated_at, OLD.created_by, OLD.updated_by
  );

  -- Auto-update updated_at if column exists
  IF TG_TABLE_NAME IN (SELECT table_name FROM information_schema.columns WHERE column_name = 'updated_at' AND table_name = TG_TABLE_NAME) THEN
    NEW.updated_at = NOW();
  END IF;

  -- Debug log (optional - comment out in production)
  -- RAISE NOTICE '[DEBUG] Updating addresses - OLD: % | NEW: %', OLD, NEW;

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trigger_addresses_before_update ON addresses;
CREATE TRIGGER trigger_addresses_before_update
BEFORE UPDATE ON addresses
FOR EACH ROW
EXECUTE FUNCTION addresses_before_update();

-- BEFORE DELETE trigger for addresses
DROP FUNCTION IF EXISTS addresses_before_delete() CASCADE;
CREATE OR REPLACE FUNCTION addresses_before_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
  -- Snapshot before deletion
  INSERT INTO addresses_backup (
    _backup_action, id, address, city, province, postal_code, country, created_at, updated_at, created_by, updated_by
  ) VALUES (
    'DELETE', OLD.id, OLD.address, OLD.city, OLD.province, OLD.postal_code, OLD.country, OLD.created_at, OLD.updated_at, OLD.created_by, OLD.updated_by
  );

  -- Debug log (optional - comment out in production)
  -- RAISE NOTICE '[DEBUG] Deleting from addresses: %', OLD;

  RETURN OLD;
END;
$func$;

DROP TRIGGER IF EXISTS trigger_addresses_before_delete ON addresses;
CREATE TRIGGER trigger_addresses_before_delete
BEFORE DELETE ON addresses
FOR EACH ROW
EXECUTE FUNCTION addresses_before_delete();

-- ============================================================================
-- TABLE: user_has_addresses
-- ============================================================================

-- Backup table for user_has_addresses
CREATE TABLE IF NOT EXISTS user_has_addresses_backup (
  _uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  _backup_timestamp TIMESTAMPTZ DEFAULT NOW(),
  _backup_action VARCHAR(10),
  id UUID,
  user_id UUID,
  address_id UUID,
  active BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  created_by UUID,
  updated_by UUID
);

-- BEFORE INSERT trigger for user_has_addresses
DROP FUNCTION IF EXISTS user_has_addresses_before_insert() CASCADE;
CREATE OR REPLACE FUNCTION user_has_addresses_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
  -- Validate NOT NULL: user_id
  IF NEW.user_id IS NULL THEN
    RAISE EXCEPTION '[user_has_addresses] user_id cannot be NULL';
  END IF;
  -- Validate NOT NULL: address_id
  IF NEW.address_id IS NULL THEN
    RAISE EXCEPTION '[user_has_addresses] address_id cannot be NULL';
  END IF;

  -- Debug log (optional - comment out in production)
  -- RAISE NOTICE '[DEBUG] Inserting into user_has_addresses: %', NEW;

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trigger_user_has_addresses_before_insert ON user_has_addresses;
CREATE TRIGGER trigger_user_has_addresses_before_insert
BEFORE INSERT ON user_has_addresses
FOR EACH ROW
EXECUTE FUNCTION user_has_addresses_before_insert();

-- BEFORE UPDATE trigger for user_has_addresses
DROP FUNCTION IF EXISTS user_has_addresses_before_update() CASCADE;
CREATE OR REPLACE FUNCTION user_has_addresses_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
  -- Snapshot old state to backup table
  INSERT INTO user_has_addresses_backup (
    _backup_action, id, user_id, address_id, active, created_at, updated_at, created_by, updated_by
  ) VALUES (
    'UPDATE', OLD.id, OLD.user_id, OLD.address_id, OLD.active, OLD.created_at, OLD.updated_at, OLD.created_by, OLD.updated_by
  );

  -- Auto-update updated_at if column exists
  IF TG_TABLE_NAME IN (SELECT table_name FROM information_schema.columns WHERE column_name = 'updated_at' AND table_name = TG_TABLE_NAME) THEN
    NEW.updated_at = NOW();
  END IF;

  -- Debug log (optional - comment out in production)
  -- RAISE NOTICE '[DEBUG] Updating user_has_addresses - OLD: % | NEW: %', OLD, NEW;

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trigger_user_has_addresses_before_update ON user_has_addresses;
CREATE TRIGGER trigger_user_has_addresses_before_update
BEFORE UPDATE ON user_has_addresses
FOR EACH ROW
EXECUTE FUNCTION user_has_addresses_before_update();

-- BEFORE DELETE trigger for user_has_addresses
DROP FUNCTION IF EXISTS user_has_addresses_before_delete() CASCADE;
CREATE OR REPLACE FUNCTION user_has_addresses_before_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
  -- Snapshot before deletion
  INSERT INTO user_has_addresses_backup (
    _backup_action, id, user_id, address_id, active, created_at, updated_at, created_by, updated_by
  ) VALUES (
    'DELETE', OLD.id, OLD.user_id, OLD.address_id, OLD.active, OLD.created_at, OLD.updated_at, OLD.created_by, OLD.updated_by
  );

  -- Debug log (optional - comment out in production)
  -- RAISE NOTICE '[DEBUG] Deleting from user_has_addresses: %', OLD;

  RETURN OLD;
END;
$func$;

DROP TRIGGER IF EXISTS trigger_user_has_addresses_before_delete ON user_has_addresses;
CREATE TRIGGER trigger_user_has_addresses_before_delete
BEFORE DELETE ON user_has_addresses
FOR EACH ROW
EXECUTE FUNCTION user_has_addresses_before_delete();

-- ============================================================================
-- TABLE: contacts
-- ============================================================================

-- Backup table for contacts
CREATE TABLE IF NOT EXISTS contacts_backup (
  _uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  _backup_timestamp TIMESTAMPTZ DEFAULT NOW(),
  _backup_action VARCHAR(10),
  id UUID,
  first_name VARCHAR(120),
  last_name VARCHAR(120),
  phone_number VARCHAR(50),
  type contact_type,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  created_by UUID,
  updated_by UUID
);

-- BEFORE INSERT trigger for contacts
DROP FUNCTION IF EXISTS contacts_before_insert() CASCADE;
CREATE OR REPLACE FUNCTION contacts_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
  -- Validate NOT NULL: first_name
  IF NEW.first_name IS NULL THEN
    RAISE EXCEPTION '[contacts] first_name cannot be NULL';
  END IF;
  -- Validate VARCHAR length: first_name
  IF NEW.first_name IS NOT NULL AND LENGTH(NEW.first_name) > 120 THEN
    RAISE EXCEPTION '[contacts] first_name exceeds maximum length of 120 characters';
  END IF;
  -- Validate not empty: first_name
  IF LENGTH(TRIM(NEW.first_name)) = 0 THEN
    RAISE EXCEPTION '[contacts] first_name cannot be empty';
  END IF;
  -- Validate NOT NULL: last_name
  IF NEW.last_name IS NULL THEN
    RAISE EXCEPTION '[contacts] last_name cannot be NULL';
  END IF;
  -- Validate VARCHAR length: last_name
  IF NEW.last_name IS NOT NULL AND LENGTH(NEW.last_name) > 120 THEN
    RAISE EXCEPTION '[contacts] last_name exceeds maximum length of 120 characters';
  END IF;
  -- Validate not empty: last_name
  IF LENGTH(TRIM(NEW.last_name)) = 0 THEN
    RAISE EXCEPTION '[contacts] last_name cannot be empty';
  END IF;
  -- Validate VARCHAR length: phone_number
  IF NEW.phone_number IS NOT NULL AND LENGTH(NEW.phone_number) > 50 THEN
    RAISE EXCEPTION '[contacts] phone_number exceeds maximum length of 50 characters';
  END IF;

  -- Debug log (optional - comment out in production)
  -- RAISE NOTICE '[DEBUG] Inserting into contacts: %', NEW;

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trigger_contacts_before_insert ON contacts;
CREATE TRIGGER trigger_contacts_before_insert
BEFORE INSERT ON contacts
FOR EACH ROW
EXECUTE FUNCTION contacts_before_insert();

-- BEFORE UPDATE trigger for contacts
DROP FUNCTION IF EXISTS contacts_before_update() CASCADE;
CREATE OR REPLACE FUNCTION contacts_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
  -- Snapshot old state to backup table
  INSERT INTO contacts_backup (
    _backup_action, id, first_name, last_name, phone_number, type, created_at, updated_at, created_by, updated_by
  ) VALUES (
    'UPDATE', OLD.id, OLD.first_name, OLD.last_name, OLD.phone_number, OLD.type, OLD.created_at, OLD.updated_at, OLD.created_by, OLD.updated_by
  );

  -- Auto-update updated_at if column exists
  IF TG_TABLE_NAME IN (SELECT table_name FROM information_schema.columns WHERE column_name = 'updated_at' AND table_name = TG_TABLE_NAME) THEN
    NEW.updated_at = NOW();
  END IF;

  -- Debug log (optional - comment out in production)
  -- RAISE NOTICE '[DEBUG] Updating contacts - OLD: % | NEW: %', OLD, NEW;

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trigger_contacts_before_update ON contacts;
CREATE TRIGGER trigger_contacts_before_update
BEFORE UPDATE ON contacts
FOR EACH ROW
EXECUTE FUNCTION contacts_before_update();

-- BEFORE DELETE trigger for contacts
DROP FUNCTION IF EXISTS contacts_before_delete() CASCADE;
CREATE OR REPLACE FUNCTION contacts_before_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
  -- Snapshot before deletion
  INSERT INTO contacts_backup (
    _backup_action, id, first_name, last_name, phone_number, type, created_at, updated_at, created_by, updated_by
  ) VALUES (
    'DELETE', OLD.id, OLD.first_name, OLD.last_name, OLD.phone_number, OLD.type, OLD.created_at, OLD.updated_at, OLD.created_by, OLD.updated_by
  );

  -- Debug log (optional - comment out in production)
  -- RAISE NOTICE '[DEBUG] Deleting from contacts: %', OLD;

  RETURN OLD;
END;
$func$;

DROP TRIGGER IF EXISTS trigger_contacts_before_delete ON contacts;
CREATE TRIGGER trigger_contacts_before_delete
BEFORE DELETE ON contacts
FOR EACH ROW
EXECUTE FUNCTION contacts_before_delete();

-- ============================================================================
-- TABLE: user_has_contacts
-- ============================================================================

-- Backup table for user_has_contacts
CREATE TABLE IF NOT EXISTS user_has_contacts_backup (
  _uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  _backup_timestamp TIMESTAMPTZ DEFAULT NOW(),
  _backup_action VARCHAR(10),
  user_id UUID,
  contact_id UUID,
  active BOOLEAN,
  assigned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  created_by UUID,
  updated_by UUID
);

-- BEFORE INSERT trigger for user_has_contacts
DROP FUNCTION IF EXISTS user_has_contacts_before_insert() CASCADE;
CREATE OR REPLACE FUNCTION user_has_contacts_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
  -- Validate NOT NULL: user_id
  IF NEW.user_id IS NULL THEN
    RAISE EXCEPTION '[user_has_contacts] user_id cannot be NULL';
  END IF;
  -- Validate NOT NULL: contact_id
  IF NEW.contact_id IS NULL THEN
    RAISE EXCEPTION '[user_has_contacts] contact_id cannot be NULL';
  END IF;

  -- Debug log (optional - comment out in production)
  -- RAISE NOTICE '[DEBUG] Inserting into user_has_contacts: %', NEW;

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trigger_user_has_contacts_before_insert ON user_has_contacts;
CREATE TRIGGER trigger_user_has_contacts_before_insert
BEFORE INSERT ON user_has_contacts
FOR EACH ROW
EXECUTE FUNCTION user_has_contacts_before_insert();

-- BEFORE UPDATE trigger for user_has_contacts
DROP FUNCTION IF EXISTS user_has_contacts_before_update() CASCADE;
CREATE OR REPLACE FUNCTION user_has_contacts_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
  -- Snapshot old state to backup table
  INSERT INTO user_has_contacts_backup (
    _backup_action, user_id, contact_id, active, assigned_at, created_at, updated_at, created_by, updated_by
  ) VALUES (
    'UPDATE', OLD.user_id, OLD.contact_id, OLD.active, OLD.assigned_at, OLD.created_at, OLD.updated_at, OLD.created_by, OLD.updated_by
  );

  -- Auto-update updated_at if column exists
  IF TG_TABLE_NAME IN (SELECT table_name FROM information_schema.columns WHERE column_name = 'updated_at' AND table_name = TG_TABLE_NAME) THEN
    NEW.updated_at = NOW();
  END IF;

  -- Debug log (optional - comment out in production)
  -- RAISE NOTICE '[DEBUG] Updating user_has_contacts - OLD: % | NEW: %', OLD, NEW;

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trigger_user_has_contacts_before_update ON user_has_contacts;
CREATE TRIGGER trigger_user_has_contacts_before_update
BEFORE UPDATE ON user_has_contacts
FOR EACH ROW
EXECUTE FUNCTION user_has_contacts_before_update();

-- BEFORE DELETE trigger for user_has_contacts
DROP FUNCTION IF EXISTS user_has_contacts_before_delete() CASCADE;
CREATE OR REPLACE FUNCTION user_has_contacts_before_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
  -- Snapshot before deletion
  INSERT INTO user_has_contacts_backup (
    _backup_action, user_id, contact_id, active, assigned_at, created_at, updated_at, created_by, updated_by
  ) VALUES (
    'DELETE', OLD.user_id, OLD.contact_id, OLD.active, OLD.assigned_at, OLD.created_at, OLD.updated_at, OLD.created_by, OLD.updated_by
  );

  -- Debug log (optional - comment out in production)
  -- RAISE NOTICE '[DEBUG] Deleting from user_has_contacts: %', OLD;

  RETURN OLD;
END;
$func$;

DROP TRIGGER IF EXISTS trigger_user_has_contacts_before_delete ON user_has_contacts;
CREATE TRIGGER trigger_user_has_contacts_before_delete
BEFORE DELETE ON user_has_contacts
FOR EACH ROW
EXECUTE FUNCTION user_has_contacts_before_delete();

-- ============================================================================
-- TABLE: youth_worksheets
-- ============================================================================

-- Backup table for youth_worksheets
CREATE TABLE IF NOT EXISTS youth_worksheets_backup (
  _uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  _backup_timestamp TIMESTAMPTZ DEFAULT NOW(),
  _backup_action VARCHAR(10),
  id UUID,
  youth_id UUID,
  title VARCHAR(255),
  file_data BYTEA,
  file_size INTEGER,
  file_type VARCHAR(100),
  note TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  created_by UUID,
  updated_by UUID
);

-- BEFORE INSERT trigger for youth_worksheets
DROP FUNCTION IF EXISTS youth_worksheets_before_insert() CASCADE;
CREATE OR REPLACE FUNCTION youth_worksheets_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
  -- Validate NOT NULL: youth_id
  IF NEW.youth_id IS NULL THEN
    RAISE EXCEPTION '[youth_worksheets] youth_id cannot be NULL';
  END IF;
  -- Validate NOT NULL: title
  IF NEW.title IS NULL THEN
    RAISE EXCEPTION '[youth_worksheets] title cannot be NULL';
  END IF;
  -- Validate VARCHAR length: title
  IF NEW.title IS NOT NULL AND LENGTH(NEW.title) > 255 THEN
    RAISE EXCEPTION '[youth_worksheets] title exceeds maximum length of 255 characters';
  END IF;
  -- Validate not empty: title
  IF LENGTH(TRIM(NEW.title)) = 0 THEN
    RAISE EXCEPTION '[youth_worksheets] title cannot be empty';
  END IF;
  -- Validate VARCHAR length: file_type
  IF NEW.file_type IS NOT NULL AND LENGTH(NEW.file_type) > 100 THEN
    RAISE EXCEPTION '[youth_worksheets] file_type exceeds maximum length of 100 characters';
  END IF;

  -- Debug log (optional - comment out in production)
  -- RAISE NOTICE '[DEBUG] Inserting into youth_worksheets: %', NEW;

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trigger_youth_worksheets_before_insert ON youth_worksheets;
CREATE TRIGGER trigger_youth_worksheets_before_insert
BEFORE INSERT ON youth_worksheets
FOR EACH ROW
EXECUTE FUNCTION youth_worksheets_before_insert();

-- BEFORE UPDATE trigger for youth_worksheets
DROP FUNCTION IF EXISTS youth_worksheets_before_update() CASCADE;
CREATE OR REPLACE FUNCTION youth_worksheets_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
  -- Snapshot old state to backup table
  INSERT INTO youth_worksheets_backup (
    _backup_action, id, youth_id, title, file_data, file_size, file_type, note, metadata, created_at, updated_at, created_by, updated_by
  ) VALUES (
    'UPDATE', OLD.id, OLD.youth_id, OLD.title, OLD.file_data, OLD.file_size, OLD.file_type, OLD.note, OLD.metadata, OLD.created_at, OLD.updated_at, OLD.created_by, OLD.updated_by
  );

  -- Auto-update updated_at if column exists
  IF TG_TABLE_NAME IN (SELECT table_name FROM information_schema.columns WHERE column_name = 'updated_at' AND table_name = TG_TABLE_NAME) THEN
    NEW.updated_at = NOW();
  END IF;

  -- Debug log (optional - comment out in production)
  -- RAISE NOTICE '[DEBUG] Updating youth_worksheets - OLD: % | NEW: %', OLD, NEW;

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trigger_youth_worksheets_before_update ON youth_worksheets;
CREATE TRIGGER trigger_youth_worksheets_before_update
BEFORE UPDATE ON youth_worksheets
FOR EACH ROW
EXECUTE FUNCTION youth_worksheets_before_update();

-- BEFORE DELETE trigger for youth_worksheets
DROP FUNCTION IF EXISTS youth_worksheets_before_delete() CASCADE;
CREATE OR REPLACE FUNCTION youth_worksheets_before_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
  -- Snapshot before deletion
  INSERT INTO youth_worksheets_backup (
    _backup_action, id, youth_id, title, file_data, file_size, file_type, note, metadata, created_at, updated_at, created_by, updated_by
  ) VALUES (
    'DELETE', OLD.id, OLD.youth_id, OLD.title, OLD.file_data, OLD.file_size, OLD.file_type, OLD.note, OLD.metadata, OLD.created_at, OLD.updated_at, OLD.created_by, OLD.updated_by
  );

  -- Debug log (optional - comment out in production)
  -- RAISE NOTICE '[DEBUG] Deleting from youth_worksheets: %', OLD;

  RETURN OLD;
END;
$func$;

DROP TRIGGER IF EXISTS trigger_youth_worksheets_before_delete ON youth_worksheets;
CREATE TRIGGER trigger_youth_worksheets_before_delete
BEFORE DELETE ON youth_worksheets
FOR EACH ROW
EXECUTE FUNCTION youth_worksheets_before_delete();

