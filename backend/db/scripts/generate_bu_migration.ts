#!/usr/bin/env node

/**
 * BACKUP MIGRATION GENERATOR
 * 
 * Scans db/migrations/ for SQL files and generates backup infrastructure
 * (backup tables, triggers, procedures) for tables that need audit trails.
 * 
 * Usage:
 *   npx tsx db/scripts/generate_bu_migration.ts [migration-file.sql]
 *   npx tsx db/scripts/generate_bu_migration.ts  # processes all files
 */

import postgres from 'postgres';
import fs from 'fs';
import path from 'path';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable not set');
  process.exit(1);
}

const sql = postgres(DATABASE_URL);

// Tables that should NOT get backup infrastructure
const EXCLUDED_TABLES = [
  'base_table',           // Template - never contains data
  'user_permissions',      // Infrastructure - lookup table
  'user_groups',          // Infrastructure - lookup table  
  'contact_types_base',   // Infrastructure - lookup table
  'user_credentials',     // Security - sensitive auth data
  'password_reset_tokens', // Security - temporary tokens
  'auth_codes',           // Security - temporary 2FA codes
  'trusted_devices',      // Security - device tracking
  'refresh_tokens',       // Security - token rotation
  'token_blacklist',      // Security - invalidated tokens
  'schema_migrations',     // Infrastructure - migration tracking
  'schema_backup_tracking' // Infrastructure - backup tracking
];

// Types
interface TrackingData {
  last_run: string | null;
  migrations_processed: string[];
}

interface TableRow {
  table_name: string;
}

interface ColumnInfo {
  column_name: string;
  data_type: string;
  udt_name: string;
  character_maximum_length: number | null;
  is_nullable: string;
  column_default: string | null;
}

const targetFile = process.argv[2]; // optional specific file

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

// Get processed migrations from database
async function getProcessedMigrations(): Promise<string[]> {
  try {
    const result = await sql<{ table_name: string }[]>`
      SELECT DISTINCT table_name FROM schema_backup_tracking
    `;
    return result.map(r => r.table_name);
  } catch (error) {
    // schema_backup_tracking table doesn't exist yet
    return [];
  }
}

// Record backup infrastructure as generated
async function recordBackupGeneration(tableName: string, migrationVersion: string): Promise<void> {
  await sql`
    INSERT INTO schema_backup_tracking (table_name, migration_version)
    VALUES (${tableName}, ${migrationVersion})
    ON CONFLICT (table_name) DO UPDATE 
    SET generated_at = NOW(), migration_version = EXCLUDED.migration_version
  `;
}

// Extract table names from SQL file
function extractTableNames(sqlContent: string): string[] {
  const tables: string[] = [];
  
  // Remove SQL comments first
  const withoutLineComments = sqlContent.replace(/--.*$/gm, '');
  const withoutBlockComments = withoutLineComments.replace(/\/\*[\s\S]*?\*\//g, '');
  
  const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z_][a-zA-Z0-9_]*)/gi;
  let match;
  
  while ((match = createTableRegex.exec(withoutBlockComments)) !== null) {
    const tableName = match[1].toLowerCase();
    // Exclude backup tables, system tables, and explicitly excluded tables
    if (!tableName.endsWith('_backup') && 
        !tableName.startsWith('pg_') && 
        !EXCLUDED_TABLES.includes(tableName)) {
      tables.push(tableName);
    }
  }
  
  return tables;
}

// Get columns for a table from database
async function getColumns(tableName: string): Promise<ColumnInfo[]> {
  return await sql<ColumnInfo[]>`
    SELECT 
      column_name,
      data_type,
      udt_name,
      character_maximum_length,
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ${tableName}
    ORDER BY ordinal_position
  `;
}

// Generate backup table SQL
function generateBackupTable(tableName: string, columns: ColumnInfo[]): string {
  const columnDefs = columns.map(col => {
    let type = col.data_type.toUpperCase();
    if (col.data_type === 'character varying') {
      type = `VARCHAR(${col.character_maximum_length})`;
    } else if (col.data_type === 'timestamp with time zone') {
      type = 'TIMESTAMPTZ';
    } else if (col.data_type === 'timestamp without time zone') {
      type = 'TIMESTAMP';
    } else if (col.data_type === 'bytea') {
      type = 'BYTEA';
    } else if (col.data_type === 'uuid') {
      type = 'UUID';
    } else if (col.data_type === 'USER-DEFINED') {
      // Use the actual type name for enums and other user-defined types
      type = col.udt_name || 'TEXT'; // Fallback to TEXT if udt_name is undefined
    } else if (col.data_type === 'jsonb') {
      type = 'JSONB';
    } else if (col.data_type === 'integer') {
      type = 'INTEGER';
    } else if (col.data_type === 'smallint') {
      type = 'SMALLINT';
    } else if (col.data_type === 'boolean') {
      type = 'BOOLEAN';
    } else if (col.data_type === 'date') {
      type = 'DATE';
    } else if (col.data_type === 'text') {
      type = 'TEXT';
    } else if (col.data_type === 'serial') {
      type = 'INTEGER';
    }
    return `  ${col.column_name} ${type}`;
  }).join(',\n');

  return `-- Backup table for ${tableName}
CREATE TABLE IF NOT EXISTS ${tableName}_backup (
  _uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  _backup_timestamp TIMESTAMPTZ DEFAULT NOW(),
  _backup_action VARCHAR(10),
${columnDefs}
);

`;
}

// Generate BEFORE INSERT trigger
function generateBeforeInsertTrigger(tableName: string, columns: ColumnInfo[]): string {
  const validations = columns
    .filter(col => !col.column_default && !['id', 'created_at', 'updated_at', 'created_by', 'updated_by'].includes(col.column_name))
    .map(col => {
      const checks = [];
      
      if (col.is_nullable === 'NO') {
        checks.push(`  -- Validate NOT NULL: ${col.column_name}
  IF NEW.${col.column_name} IS NULL THEN
    RAISE EXCEPTION '[${tableName}] ${col.column_name} cannot be NULL';
  END IF;`);
      }
      
      if (col.data_type === 'character varying' && col.character_maximum_length) {
        checks.push(`  -- Validate VARCHAR length: ${col.column_name}
  IF NEW.${col.column_name} IS NOT NULL AND LENGTH(NEW.${col.column_name}) > ${col.character_maximum_length} THEN
    RAISE EXCEPTION '[${tableName}] ${col.column_name} exceeds maximum length of ${col.character_maximum_length} characters';
  END IF;`);
      }
      
      if (col.is_nullable === 'NO' && col.data_type === 'character varying') {
        checks.push(`  -- Validate not empty: ${col.column_name}
  IF LENGTH(TRIM(NEW.${col.column_name})) = 0 THEN
    RAISE EXCEPTION '[${tableName}] ${col.column_name} cannot be empty';
  END IF;`);
      }
      
      return checks.join('\n');
    })
    .filter(v => v)
    .join('\n');

  return `-- BEFORE INSERT trigger for ${tableName}
DROP FUNCTION IF EXISTS ${tableName}_before_insert() CASCADE;
CREATE OR REPLACE FUNCTION ${tableName}_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
${validations}

  -- Debug log (optional - comment out in production)
  -- RAISE NOTICE '[DEBUG] Inserting into ${tableName}: %', NEW;

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trigger_${tableName}_before_insert ON ${tableName};
CREATE TRIGGER trigger_${tableName}_before_insert
BEFORE INSERT ON ${tableName}
FOR EACH ROW
EXECUTE FUNCTION ${tableName}_before_insert();

`;
}

// Generate BEFORE UPDATE trigger
function generateBeforeUpdateTrigger(tableName: string, columns: ColumnInfo[]): string {
  const columnNames = columns.map(c => c.column_name).join(', ');
  const oldValues = columns.map(c => `OLD.${c.column_name}`).join(', ');

  return `-- BEFORE UPDATE trigger for ${tableName}
DROP FUNCTION IF EXISTS ${tableName}_before_update() CASCADE;
CREATE OR REPLACE FUNCTION ${tableName}_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
  -- Snapshot old state to backup table
  INSERT INTO ${tableName}_backup (
    _backup_action, ${columnNames}
  ) VALUES (
    'UPDATE', ${oldValues}
  );

  -- Auto-update updated_at if column exists
  IF TG_TABLE_NAME IN (SELECT table_name FROM information_schema.columns WHERE column_name = 'updated_at' AND table_name = TG_TABLE_NAME) THEN
    NEW.updated_at = NOW();
  END IF;

  -- Debug log (optional - comment out in production)
  -- RAISE NOTICE '[DEBUG] Updating ${tableName} - OLD: % | NEW: %', OLD, NEW;

  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS trigger_${tableName}_before_update ON ${tableName};
CREATE TRIGGER trigger_${tableName}_before_update
BEFORE UPDATE ON ${tableName}
FOR EACH ROW
EXECUTE FUNCTION ${tableName}_before_update();

`;
}

// Generate BEFORE DELETE trigger
function generateBeforeDeleteTrigger(tableName: string, columns: ColumnInfo[]): string {
  const columnNames = columns.map(c => c.column_name).join(', ');
  const oldValues = columns.map(c => `OLD.${c.column_name}`).join(', ');

  return `-- BEFORE DELETE trigger for ${tableName}
DROP FUNCTION IF EXISTS ${tableName}_before_delete() CASCADE;
CREATE OR REPLACE FUNCTION ${tableName}_before_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $func$
BEGIN
  -- Snapshot before deletion
  INSERT INTO ${tableName}_backup (
    _backup_action, ${columnNames}
  ) VALUES (
    'DELETE', ${oldValues}
  );

  -- Debug log (optional - comment out in production)
  -- RAISE NOTICE '[DEBUG] Deleting from ${tableName}: %', OLD;

  RETURN OLD;
END;
$func$;

DROP TRIGGER IF EXISTS trigger_${tableName}_before_delete ON ${tableName};
CREATE TRIGGER trigger_${tableName}_before_delete
BEFORE DELETE ON ${tableName}
FOR EACH ROW
EXECUTE FUNCTION ${tableName}_before_delete();

`;
}

// Main execution
async function main() {
  console.log(`\n========================================`);
  console.log(`BACKUP MIGRATION GENERATOR (PostgreSQL-Native)`);
  console.log(`========================================\n`);
  console.log(`Excluded tables: ${EXCLUDED_TABLES.join(', ')}\n`);
  
  try {
    // Get tables already processed
    const processedTables = await getProcessedMigrations();
    console.log(`Previously processed tables: ${processedTables.length}`);
    
    // Get migration files
    const allMigrationFiles = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql') && !f.endsWith('_backup.sql'))
      .sort();
    
    // Filter to specific file if provided, otherwise process all
    const filesToProcess = targetFile 
      ? allMigrationFiles.filter(f => f === targetFile)
      : allMigrationFiles;
    
    if (filesToProcess.length === 0) {
      console.log(`\nNo migration files to process.\n`);
      return;
    }
    
    console.log(`\nMigration files to process: ${filesToProcess.length}`);
    filesToProcess.forEach(f => console.log(`  - ${f}`));
    
    // Process each migration file
    for (const migrationFile of filesToProcess) {
      console.log(`\n----------------------------------------`);
      console.log(`Processing: ${migrationFile}`);
      console.log(`----------------------------------------`);
      
      const sqlContent = fs.readFileSync(path.join(MIGRATIONS_DIR, migrationFile), 'utf8');
      const tables = extractTableNames(sqlContent);
      
      if (tables.length === 0) {
        console.log(`  No tables found in ${migrationFile} (or all excluded)`);
        continue;
      }
      
      // Filter out already processed tables unless forcing reprocessing
      const newTables = targetFile ? tables : tables.filter(t => !processedTables.includes(t));
      
      if (newTables.length === 0) {
        console.log(`  All tables already processed`);
        continue;
      }
      
      console.log(`  Tables to process: ${newTables.join(', ')}`);
      
      // Generate backup filename with next sequential number
      // Extract date and base from migration file (e.g., 2026-01-31_1_init.sql)
      const match = migrationFile.match(/^(\d{4}-\d{2}-\d{2})_(\d+)_(.+)\.sql$/);
      if (!match) {
        console.warn(`  Skipping - unexpected filename format: ${migrationFile}`);
        continue;
      }
      
      const [, date, num, name] = match;
      
      // Find next available number for this date
      const existingFiles = fs.readdirSync(MIGRATIONS_DIR)
        .filter(f => f.startsWith(date) && f.endsWith('.sql'));
      
      let nextNum = parseInt(num) + 1;
      while (existingFiles.some(f => f.startsWith(`${date}_${nextNum}_`))) {
        nextNum++;
      }
      
      const backupFilename = `${date}_${nextNum}_${name}_backup.sql`;
      const backupFilepath = path.join(MIGRATIONS_DIR, backupFilename);
      
      const header = `-- ============================================================================
-- BACKUP SYSTEM FOR: ${migrationFile}
-- Generated: ${new Date().toISOString()}
-- Tables: ${newTables.join(', ')}
-- ============================================================================

`;
      
      const tableSections = [];
      for (const tableName of newTables) {
        console.log(`\n  Processing table: ${tableName}`);
        
        // Get columns from database (table must exist first)
        const columns = await getColumns(tableName);
        
        if (columns.length === 0) {
          console.log(`    Table ${tableName} not found in database - apply migration first`);
          continue;
        }
        
        const section = `-- ============================================================================
-- TABLE: ${tableName}
-- ============================================================================

${generateBackupTable(tableName, columns)}${generateBeforeInsertTrigger(tableName, columns)}${generateBeforeUpdateTrigger(tableName, columns)}${generateBeforeDeleteTrigger(tableName, columns)}`;
        
        tableSections.push(section);
        
        console.log(`    Generated backup table`);
        console.log(`    Generated BEFORE INSERT trigger`);
        console.log(`    Generated BEFORE UPDATE trigger`);
        console.log(`    Generated BEFORE DELETE trigger`);
        
        // Record in database
        await recordBackupGeneration(tableName, migrationFile);
      }
      
      // Write backup SQL file
      if (tableSections.length > 0) {
        fs.writeFileSync(backupFilepath, header + tableSections.join(''));
        console.log(`\n  Generated: ${backupFilename}`);
      }
    }
    
    console.log(`\n========================================`);
    console.log(`COMPLETE!`);
    console.log(`========================================\n`);
    console.log(`Next steps:`);
    console.log(`  Apply with: npx tsx db/scripts/update_schemas.ts`);
    console.log(``);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch(async (e) => {
  console.error(e);
  await sql.end({ timeout: 5 });
  process.exit(1);
});
