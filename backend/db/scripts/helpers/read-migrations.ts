/**
 * Migration catalog shared by the schema runner and collapse workflow.
 * Resolves ledger versions against backend/db, validates baseline artifacts,
 * and orders schema/data migrations in one stream. It never connects to a DB.
 */

// ============================================================================
// 1. Imports
// ============================================================================

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// ============================================================================
// 2. Baseline and ledger contracts
// ============================================================================

export type InitFiles = {
  readonly schema: 'schema/init.sql';
  readonly data: 'data/init.sql';
};

export interface AppliedMigration {
  version: string;
  checksum: string | null;
}

export interface Baseline {
  format: 1;
  id: string;
  files: Record<InitFiles[keyof InitFiles], string>;
  replaces: AppliedMigration[];
  seedTables: string[];
}

export const INIT_FILES: InitFiles = {
  schema: 'schema/init.sql',
  data: 'data/init.sql',
};

const initFilePaths = Object.values(INIT_FILES);

// ============================================================================
// 3. Checksums and ledger paths
// ============================================================================

export function calculateChecksum(filepath: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(filepath)).digest('hex');
}

function isValidMigrationFilename(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9_.-]*\.sql$/.test(value);
}

export function migrationFilePath(root: string, version: string): string {
  if (initFilePaths.some(file => file === version)) return path.join(root, version);

  const current = /^(schema|data)\/migrations\/([^/]+)$/.exec(version);
  if (current && isValidMigrationFilename(current[2])) return path.join(root, version);
  if (isValidMigrationFilename(version)) return path.join(root, 'migrations', version);

  throw new Error(`Invalid migration version: ${version}`);
}

// ============================================================================
// 4. Baseline validation
// ============================================================================

export function validateSeedTables(tables: unknown): string[] {
  if (!Array.isArray(tables) || tables.length === 0
    || tables.some(table => typeof table !== 'string'
      || !/^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$/.test(table)
      || table === 'public.schema_migrations')) {
    throw new Error('Seed tables must be explicit schema.table identifiers excluding the ledger');
  }

  return tables;
}

export function readBaseline(root: string): Baseline | null {
  const filename = path.join(root, 'baseline.json');
  if (!fs.existsSync(filename)) return null;

  const baseline = JSON.parse(fs.readFileSync(filename, 'utf8')) as Baseline;
  if (baseline.format !== 1 || typeof baseline.id !== 'string' || !baseline.id
    || !baseline.files || Object.keys(baseline.files).length !== initFilePaths.length
    || !Array.isArray(baseline.replaces)) {
    throw new Error('Invalid database baseline manifest');
  }

  validateSeedTables(baseline.seedTables);

  for (const version of initFilePaths) {
    const checksum = baseline.files[version];
    if (typeof checksum !== 'string' || !/^[a-f0-9]{64}$/.test(checksum)
      || calculateChecksum(migrationFilePath(root, version)) !== checksum) {
      throw new Error(`Baseline checksum mismatch: ${version}`);
    }
  }

  const replacedVersions = new Set<string>();
  for (const replaced of baseline.replaces) {
    if (!replaced || typeof replaced.version !== 'string'
      || (replaced.checksum !== null && (typeof replaced.checksum !== 'string' || !/^[a-f0-9]{64}$/.test(replaced.checksum)))) {
      throw new Error('Invalid replaced migration in baseline manifest');
    }
    migrationFilePath(root, replaced.version);
    if (replacedVersions.has(replaced.version)) throw new Error(`Duplicate replaced migration: ${replaced.version}`);
    replacedVersions.add(replaced.version);
  }

  return baseline;
}

// ============================================================================
// 5. File discovery and execution order
// ============================================================================

function listSqlFiles(root: string, directory: string): string[] {
  const fullPath = path.join(root, directory);
  if (!fs.existsSync(fullPath)) return [];

  return fs.readdirSync(fullPath).filter(file => file.endsWith('.sql')).map(file => {
    if (!isValidMigrationFilename(file) || !fs.lstatSync(path.join(fullPath, file)).isFile()) {
      throw new Error(`Invalid migration file: ${directory}/${file}`);
    }
    return directory === 'migrations' ? file : `${directory}/${file}`;
  });
}

export function listMigrationFiles(root: string): string[] {
  const baseline = readBaseline(root);
  const legacy = listSqlFiles(root, 'migrations');
  if (baseline && legacy.length) throw new Error('A baseline cannot coexist with legacy migration files');
  if (!baseline && initFilePaths.some(file => fs.existsSync(path.join(root, file)))) {
    throw new Error('Init files require a complete baseline.json manifest');
  }

  const incremental = [
    ...legacy,
    ...listSqlFiles(root, 'schema/migrations'),
    ...listSqlFiles(root, 'data/migrations'),
  ];
  
  const names = new Set<string>();
  for (const version of incremental) {
    const name = path.basename(version);
    if (names.has(name)) throw new Error(`Migration filenames must be unique across schema and data: ${name}`);
    names.add(name);
  }

  incremental.sort((left, right) => {
    const a = path.basename(left);
    const b = path.basename(right);
    return a < b ? -1 : a > b ? 1 : 0;
  });
  return [...(baseline ? initFilePaths : []), ...incremental];
}

// ============================================================================
// 6. Applied-history validation
// ============================================================================

export function validateAppliedMigrations(root: string, records: AppliedMigration[]): string[] {
  const files = new Set(listMigrationFiles(root));
  const errors: string[] = [];

  for (const record of records) {
    if (!files.has(record.version)) {
      errors.push(`${record.version}: applied file is missing; use the explicit collapse workflow to replace migration history`);
      continue;
    }
    if (record.checksum !== null && calculateChecksum(migrationFilePath(root, record.version)) !== record.checksum) {
      errors.push(`${record.version}: checksum differs from the applied migration`);
    }
  }

  return errors;
}
