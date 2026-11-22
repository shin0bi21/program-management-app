/**
 * Migration catalog shared by the schema runner and collapse workflow.
 * Resolves ledger versions against backend/db, validates baseline artifacts,
 * and orders schema/data migrations in one stream. It never connects to a DB.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

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

/**
 * Returns init files followed by increments in filename order; inconsistent layouts and duplicate filenames throw.
 * @example listMigrationFiles('/empty/db') // [] when no manifest, init, or migration files exist
 */
export function listMigrationFiles(root: string): string[] {
  // 1. Require a consistent baseline or legacy layout.
  const baseline = readBaseline(root);
  const legacy = listSqlFiles(root, 'migrations');
  if (baseline && legacy.length) throw new Error('A baseline cannot coexist with legacy migration files');
  if (!baseline && initFilePaths.some(file => fs.existsSync(path.join(root, file)))) {
    throw new Error('Init files require a complete baseline.json manifest');
  }

  // 2. Gather schema, data, and legacy files into one incremental stream.
  const incremental = [
    ...legacy,
    ...listSqlFiles(root, 'schema/migrations'),
    ...listSqlFiles(root, 'data/migrations'),
  ];

  // 3. Reject duplicate filenames across schema and data directories.
  const names = new Set<string>();
  for (const version of incremental) {
    const name = path.basename(version);
    if (names.has(name)) throw new Error(`Migration filenames must be unique across schema and data: ${name}`);
    names.add(name);
  }

  // 4. Order by filename and place baseline init files before all increments.
  incremental.sort((left, right) => {
    const leftName = path.basename(left);
    const rightName = path.basename(right);
    if (leftName === rightName) return 0;
    return leftName < rightName ? -1 : 1;
  });
  return [...(baseline ? initFilePaths : []), ...incremental];
}

/**
 * Reads and verifies a baseline manifest and init checksums; absent manifests return null and invalid artifacts throw.
 * @example readBaseline('/empty/db') // null when baseline.json does not exist
 */
export function readBaseline(root: string): Baseline | null {
  // 1. Return no baseline when the manifest is absent.
  const filename = path.join(root, 'baseline.json');
  if (!fs.existsSync(filename)) return null;

  // 2. Validate manifest structure and the explicit seed table selection.
  const baseline = JSON.parse(fs.readFileSync(filename, 'utf8')) as Baseline;
  if (baseline.format !== 1 || typeof baseline.id !== 'string' || !baseline.id
    || !baseline.files || Object.keys(baseline.files).length !== initFilePaths.length
    || !Array.isArray(baseline.replaces)) {
    throw new Error('Invalid database baseline manifest');
  }

  validateSeedTables(baseline.seedTables);

  // 3. Verify each init file against its recorded checksum.
  for (const version of initFilePaths) {
    const checksum = baseline.files[version];
    if (typeof checksum !== 'string' || !/^[a-f0-9]{64}$/.test(checksum)
      || calculateChecksum(migrationFilePath(root, version)) !== checksum) {
      throw new Error(`Baseline checksum mismatch: ${version}`);
    }
  }

  // 4. Validate replaced migration paths, checksums, and uniqueness.
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

/**
 * Validates a nonempty list of simple schema.table names excluding the migration ledger; invalid values throw.
 * @example validateSeedTables(['public.user_roles']) // ['public.user_roles']
 */
export function validateSeedTables(tables: unknown): string[] {
  if (!Array.isArray(tables) || tables.length === 0
    || tables.some(table => typeof table !== 'string'
      || !/^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$/.test(table)
      || table === 'public.schema_migrations')) {
    throw new Error('Seed tables must be explicit schema.table identifiers excluding the ledger');
  }

  return tables;
}

/**
 * Hashes the complete file bytes as SHA-256 hexadecimal; filesystem errors propagate.
 * @example calculateChecksum('/repo/backend/db/schema/init.sql') // 64 lowercase hexadecimal characters
 */
export function calculateChecksum(filepath: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(filepath)).digest('hex');
}

/**
 * Resolves a known init, schema/data increment, or legacy filename under the supplied database root; other versions throw.
 * @example migrationFilePath('/repo/db', '001_init.sql') // '/repo/db/migrations/001_init.sql'
 */
export function migrationFilePath(root: string, version: string): string {
  // 1. Accept known init files before checking incremental migration layouts.
  if (initFilePaths.some(file => file === version)) return path.join(root, version);

  // 2. Validate current schema/data paths or a single legacy filename.
  const current = /^(schema|data)\/migrations\/([^/]+)$/.exec(version);
  if (current && isValidMigrationFilename(current[2])) return path.join(root, version);
  if (isValidMigrationFilename(version)) return path.join(root, 'migrations', version);

  // 3. Reject all other layouts, including escaping paths.
  throw new Error(`Invalid migration version: ${version}`);
}

/**
 * Accepts a single SQL filename without directory separators or leading punctuation.
 * @example isValidMigrationFilename('../init.sql') // false
 */
function isValidMigrationFilename(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9_.-]*\.sql$/.test(value);
}

/**
 * Lists validated regular SQL files in a database-relative directory; missing directories yield an empty list.
 * @example listSqlFiles('/repo/db', 'schema/migrations') // versions prefixed with schema/migrations/
 */
function listSqlFiles(root: string, directory: string): string[] {
  // 1. Skip optional migration directories that do not exist.
  const fullPath = path.join(root, directory);
  if (!fs.existsSync(fullPath)) return [];

  // 2. Accept only regular SQL files with valid migration names.
  return fs.readdirSync(fullPath).filter(file => file.endsWith('.sql')).map(file => {
    if (!isValidMigrationFilename(file) || !fs.lstatSync(path.join(fullPath, file)).isFile()) {
      throw new Error(`Invalid migration file: ${directory}/${file}`);
    }
    return directory === 'migrations' ? file : `${directory}/${file}`;
  });
}

/**
 * Compares applied versions and non-null checksums with repository files, returning drift descriptions without mutation.
 * @example validateAppliedMigrations('/empty/db', []) // []
 */
export function validateAppliedMigrations(root: string, records: AppliedMigration[]): string[] {
  // 1. Resolve the complete valid repository catalog.
  const files = new Set(listMigrationFiles(root));
  const errors: string[] = [];

  // 2. Report missing or changed applied files without modifying history.
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
