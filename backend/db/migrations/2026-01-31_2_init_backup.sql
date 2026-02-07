-- ============================================================================
-- BACKUP SYSTEM FOR: 2026-01-31_1_init.sql
-- Generated: 2026-02-05T05:03:11.102Z
-- Tables: users, youth_profiles, contacts, user_has_contacts, youth_worksheets
-- ============================================================================

-- ============================================================================
-- TABLE: users
-- ============================================================================

-- Backup table for users
CREATE TABLE IF NOT EXISTS users_backup (
  _uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  _backup_timestamp TIMESTAMPTZ DEFAULT NOW(),
  _backup_action VARCHAR(10),
  permission permission_level,
  group_id UUID,
  first_name VARCHAR(120),
  last_name VARCHAR(120),
  id UUID,
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
    _backup_action, permission, group_id, first_name, last_name, id, created_at, updated_at, created_by, updated_by
  ) VALUES (
    'UPDATE', OLD.permission, OLD.group_id, OLD.first_name, OLD.last_name, OLD.id, OLD.created_at, OLD.updated_at, OLD.created_by, OLD.updated_by
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
    _backup_action, permission, group_id, first_name, last_name, id, created_at, updated_at, created_by, updated_by
  ) VALUES (
    'DELETE', OLD.permission, OLD.group_id, OLD.first_name, OLD.last_name, OLD.id, OLD.created_at, OLD.updated_at, OLD.created_by, OLD.updated_by
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
-- TABLE: youth_profiles
-- ============================================================================

-- Backup table for youth_profiles
CREATE TABLE IF NOT EXISTS youth_profiles_backup (
  _uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  _backup_timestamp TIMESTAMPTZ DEFAULT NOW(),
  _backup_action VARCHAR(10),
  user_id UUID,
  date_of_birth DATE,
  school_name VARCHAR(255),
  grade_level VARCHAR(50),
  id UUID,
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
  -- Validate VARCHAR length: school_name
  IF NEW.school_name IS NOT NULL AND LENGTH(NEW.school_name) > 255 THEN
    RAISE EXCEPTION '[youth_profiles] school_name exceeds maximum length of 255 characters';
  END IF;
  -- Validate VARCHAR length: grade_level
  IF NEW.grade_level IS NOT NULL AND LENGTH(NEW.grade_level) > 50 THEN
    RAISE EXCEPTION '[youth_profiles] grade_level exceeds maximum length of 50 characters';
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
    _backup_action, user_id, date_of_birth, school_name, grade_level, id, created_at, updated_at, created_by, updated_by
  ) VALUES (
    'UPDATE', OLD.user_id, OLD.date_of_birth, OLD.school_name, OLD.grade_level, OLD.id, OLD.created_at, OLD.updated_at, OLD.created_by, OLD.updated_by
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
    _backup_action, user_id, date_of_birth, school_name, grade_level, id, created_at, updated_at, created_by, updated_by
  ) VALUES (
    'DELETE', OLD.user_id, OLD.date_of_birth, OLD.school_name, OLD.grade_level, OLD.id, OLD.created_at, OLD.updated_at, OLD.created_by, OLD.updated_by
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
-- TABLE: contacts
-- ============================================================================

-- Backup table for contacts
CREATE TABLE IF NOT EXISTS contacts_backup (
  _uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  _backup_timestamp TIMESTAMPTZ DEFAULT NOW(),
  _backup_action VARCHAR(10),
  first_name VARCHAR(120),
  last_name VARCHAR(120),
  phone_number VARCHAR(50),
  type contact_type,
  id UUID,
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
    _backup_action, first_name, last_name, phone_number, type, id, created_at, updated_at, created_by, updated_by
  ) VALUES (
    'UPDATE', OLD.first_name, OLD.last_name, OLD.phone_number, OLD.type, OLD.id, OLD.created_at, OLD.updated_at, OLD.created_by, OLD.updated_by
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
    _backup_action, first_name, last_name, phone_number, type, id, created_at, updated_at, created_by, updated_by
  ) VALUES (
    'DELETE', OLD.first_name, OLD.last_name, OLD.phone_number, OLD.type, OLD.id, OLD.created_at, OLD.updated_at, OLD.created_by, OLD.updated_by
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
    _backup_action, user_id, contact_id, assigned_at, created_at, updated_at, created_by, updated_by
  ) VALUES (
    'UPDATE', OLD.user_id, OLD.contact_id, OLD.assigned_at, OLD.created_at, OLD.updated_at, OLD.created_by, OLD.updated_by
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
    _backup_action, user_id, contact_id, assigned_at, created_at, updated_at, created_by, updated_by
  ) VALUES (
    'DELETE', OLD.user_id, OLD.contact_id, OLD.assigned_at, OLD.created_at, OLD.updated_at, OLD.created_by, OLD.updated_by
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
  youth_id UUID,
  title VARCHAR(255),
  file_data BYTEA,
  file_size INTEGER,
  file_type VARCHAR(100),
  note TEXT,
  metadata JSONB,
  id UUID,
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
    _backup_action, youth_id, title, file_data, file_size, file_type, note, metadata, id, created_at, updated_at, created_by, updated_by
  ) VALUES (
    'UPDATE', OLD.youth_id, OLD.title, OLD.file_data, OLD.file_size, OLD.file_type, OLD.note, OLD.metadata, OLD.id, OLD.created_at, OLD.updated_at, OLD.created_by, OLD.updated_by
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
    _backup_action, youth_id, title, file_data, file_size, file_type, note, metadata, id, created_at, updated_at, created_by, updated_by
  ) VALUES (
    'DELETE', OLD.youth_id, OLD.title, OLD.file_data, OLD.file_size, OLD.file_type, OLD.note, OLD.metadata, OLD.id, OLD.created_at, OLD.updated_at, OLD.created_by, OLD.updated_by
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

