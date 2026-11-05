import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import postgres from 'postgres';
import { calculateChecksum } from '../../db/scripts/helpers/read-migrations';
import { sql } from '../shared/db';

const backendRoot = path.resolve(__dirname, '../..');
const temporaryRoots: string[] = [];
const temporaryTables: string[] = [];

// Each CLI has a 15-second bound; some cases compare two CLI invocations.
jest.setTimeout(40000);

afterEach(async () => {
  try {
    // A regression that accidentally executes pending SQL must still clean up.
    for (const table of temporaryTables.splice(0)) await sql`DROP TABLE IF EXISTS ${sql(table)}`;
  } finally {
    for (const root of temporaryRoots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
  }
});

function migrationFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dry-run-migrations-'));
  temporaryRoots.push(root);

  // Use the current init so the fixture matches the test database's ledger.
  for (const filename of ['baseline.json', 'schema/init.sql', 'data/init.sql']) {
    const target = path.join(root, filename);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(backendRoot, 'db', filename), target);
  }
  return root;
}

function addPendingMigration(root: string) {
  const table = `dry_run_${crypto.randomUUID().replace(/-/g, '')}`;
  temporaryTables.push(table);
  const version = `schema/migrations/2099-01-01_1_${table}.sql`;
  fs.mkdirSync(path.dirname(path.join(root, version)), { recursive: true });
  fs.writeFileSync(path.join(root, version), `CREATE TABLE public.${table} (id integer PRIMARY KEY);\n`);
  return { table, version };
}

function runMigrations(root: string, args: string[]) {
  // Match the tsx runtime used by db:migrate; build checks own type checking.
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'db/scripts/update_schemas.ts', ...args], {
    cwd: backendRoot,
    env: { ...process.env, MIGRATION_FILES_ROOT: root },
    encoding: 'utf8',
    timeout: 15000,
  });
  expect(result.error).toBeUndefined();
  expect(result.signal).toBeNull();
  return { status: result.status, output: result.stdout + result.stderr };
}

async function readLedger() {
  return [...await sql`SELECT * FROM schema_migrations ORDER BY version`];
}

async function expectPendingUntouched(table: string, ledger: Awaited<ReturnType<typeof readLedger>>) {
  const [relation] = await sql<{ relation: string | null }[]>`SELECT to_regclass(${`public.${table}`})::text AS relation`;
  expect(relation.relation).toBeNull();
  expect(await readLedger()).toEqual(ledger);
}

it('reports the current state without acquiring the migration lock or changing the ledger', async () => {
  const root = migrationFixture();
  const ledger = await readLedger();
  const holder = postgres(process.env.DATABASE_URL!, { max: 1 });

  try {
    await holder`SELECT pg_advisory_lock(123456789)`;
    const result = runMigrations(root, ['--dry-run']);

    expect(result.status).toBe(0);
    expect(result.output).toMatch(/0 pending, 0 drift errors/);
    expect(result.output).not.toMatch(/Generating Types/);
    expect(await readLedger()).toEqual(ledger);
  } finally {
    // Closing the dedicated session releases its session-level advisory lock.
    await holder.end({ timeout: 5 });
  }
});

it('reports pending SQL without executing it and makes --check fail while preserving database state', async () => {
  const root = migrationFixture();
  const { table, version } = addPendingMigration(root);
  const ledger = await readLedger();

  const report = runMigrations(root, ['--dry-run']);
  expect(report.status).toBe(0);
  expect(report.output).toContain(version);
  expect(report.output).toMatch(/1 pending, 0 drift errors/);
  await expectPendingUntouched(table, ledger);

  const check = runMigrations(root, ['--dry-run', '--check']);
  expect(check.status).toBe(1);
  expect(check.output).toContain(version);
  await expectPendingUntouched(table, ledger);
});

it('rejects applied checksum drift even when the changed init matches its manifest', async () => {
  const root = migrationFixture();
  const ledger = await readLedger();
  const schemaPath = path.join(root, 'schema/init.sql');
  const manifestPath = path.join(root, 'baseline.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  fs.appendFileSync(schemaPath, '\n-- Deliberately changed bytes for checksum drift detection.\n');
  manifest.files['schema/init.sql'] = calculateChecksum(schemaPath);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));

  const result = runMigrations(root, ['--dry-run']);

  expect(result.status).toBe(1);
  expect(result.output).toMatch(/checksum/i);
  expect(result.output).toContain('schema/init.sql');
  expect(await readLedger()).toEqual(ledger);
});

it.each([
  { args: ['--check'], error: '--check requires --dry-run' },
  { args: ['--unknown'], error: 'Unknown argument: --unknown' },
])('rejects $args before executing pending SQL', async ({ args, error }) => {
  const root = migrationFixture();
  const { table } = addPendingMigration(root);
  const ledger = await readLedger();

  const result = runMigrations(root, args);

  expect(result.status).toBe(1);
  expect(result.output).toContain(error);
  await expectPendingUntouched(table, ledger);
});
