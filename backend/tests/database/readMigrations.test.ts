import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { calculateChecksum, listMigrationFiles, migrationFilePath, readBaseline, validateAppliedMigrations, validateSeedTables } from '../../db/scripts/helpers/read-migrations';

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'read-migrations-'));
  directories.push(root);
  const write = (filename: string, text = 'SELECT 1;') => {
    fs.mkdirSync(path.dirname(path.join(root, filename)), { recursive: true });
    fs.writeFileSync(path.join(root, filename), text);
  };
  const baseline = () => {
    write('schema/init.sql');
    write('data/init.sql');
    const manifest = {
      format: 1, id: 'test-baseline',
      files: { 'schema/init.sql': calculateChecksum(path.join(root, 'schema/init.sql')), 'data/init.sql': calculateChecksum(path.join(root, 'data/init.sql')) },
      replaces: [{ version: 'old.sql', checksum: null }], seedTables: ['public.user_roles'],
    };
    write('baseline.json', JSON.stringify(manifest));
    return manifest;
  };
  return { root, write, baseline };
}

it('legacy history stays ordered and validates missing records even without a checksum', () => {
  const { root, write } = fixture();
  write('migrations/2026-01-02_1_second.sql');
  write('migrations/2026-01-01_1_first.sql');
  assert.deepEqual(listMigrationFiles(root), ['2026-01-01_1_first.sql', '2026-01-02_1_second.sql']);
  assert.equal(validateAppliedMigrations(root, [{ version: 'missing.sql', checksum: null }]).length, 1);
  assert.equal(validateAppliedMigrations(root, [{ version: '2026-01-01_1_first.sql', checksum: '0'.repeat(64) }]).length, 1);
  assert.deepEqual(validateAppliedMigrations(root, [{ version: '2026-01-01_1_first.sql', checksum: calculateChecksum(path.join(root, 'migrations/2026-01-01_1_first.sql')) }]), []);
});

it('fresh init precedes one global sequence across schema and data directories', () => {
  const { root, write, baseline } = fixture();
  baseline();
  write('schema/migrations/2026-02-01_1_add_column.sql');
  write('data/migrations/2026-02-01_2_fill_column.sql');
  write('schema/migrations/2026-02-01_3_require_column.sql');
  assert.deepEqual(listMigrationFiles(root), [
    'schema/init.sql', 'data/init.sql',
    'schema/migrations/2026-02-01_1_add_column.sql', 'data/migrations/2026-02-01_2_fill_column.sql',
    'schema/migrations/2026-02-01_3_require_column.sql',
  ]);
  assert.equal(validateAppliedMigrations(root, [{ version: 'old.sql', checksum: null }]).length, 1);
});

it('init files need a complete matching manifest and cannot coexist with legacy SQL', () => {
  const { root, write, baseline } = fixture();
  write('schema/init.sql');
  assert.throws(() => listMigrationFiles(root), /require a complete/);
  const manifest = baseline();
  write('data/init.sql', 'SELECT 2;');
  assert.throws(() => readBaseline(root), /checksum mismatch/);
  write('data/init.sql');
  assert.deepEqual(readBaseline(root), manifest);
  write('migrations/old.sql');
  assert.throws(() => listMigrationFiles(root), /cannot coexist/);
});

it('unsafe ledger versions and SQL filenames are rejected', () => {
  const { root, write } = fixture();
  for (const version of ['../outside.sql', "name'quote.sql", 'schema/../../outside.sql', '/absolute.sql']) {
    assert.throws(() => migrationFilePath(root, version), /Invalid migration version/);
  }
  write("migrations/name'quote.sql");
  assert.throws(() => listMigrationFiles(root), /Invalid migration file/);
});

it('seed selection and baseline manifests reject malformed tables and migration history', () => {
  const { root, write, baseline } = fixture();
  const manifest = baseline();
  assert.deepEqual(validateSeedTables(['public.user_roles']), ['public.user_roles']);

  for (const tables of [[], null, ['user_roles'], [123], ['public.schema_migrations']]) {
    assert.throws(() => validateSeedTables(tables), /Seed tables must/);
    write('baseline.json', JSON.stringify({ ...manifest, seedTables: tables }));
    assert.throws(() => readBaseline(root), /Seed tables must/);
  }
});
