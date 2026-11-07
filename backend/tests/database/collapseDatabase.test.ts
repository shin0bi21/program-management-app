import childProcess, { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { collapse } from '../../db/scripts/collapse-database';
import { calculateChecksum, readBaseline } from '../../db/scripts/helpers/read-migrations';

const fixtures: Array<{ root: string; target: string; work: string }> = [];
const connection = new URL(process.env.DATABASE_URL!);
const initFiles = ['schema/init.sql', 'data/init.sql'];
const increment = 'schema/migrations/2026-01-01_1_add_note.sql';

beforeAll(() => {
  // The worker renames databases: restrict all fixture administration to the test server.
  if (!['db_test', 'localhost', '127.0.0.1', '[::1]'].includes(connection.hostname)
    || !decodeURIComponent(connection.pathname).endsWith('_test')
    || connection.search) {
    throw new Error('Collapse tests require a local test database URL without connection overrides');
  }
});

function command(program: string, database: string, args: string[], input?: string): string {
  return execFileSync(program, args, {
    input, encoding: 'utf8', timeout: 15000,
    env: {
      ...process.env, PGHOST: connection.hostname, PGPORT: connection.port || '5432',
      PGUSER: decodeURIComponent(connection.username), PGPASSWORD: decodeURIComponent(connection.password),
      PGDATABASE: database,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}

function query(database: string, sql: string): string {
  return command('psql', database, ['-X', '-qAt', '--set=ON_ERROR_STOP=1'], sql);
}

function fileContents(directory: string): Record<string, string> {
  return Object.fromEntries(fs.readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => {
      const filename = path.join(entry.parentPath, entry.name);
      return [path.relative(directory, filename), fs.readFileSync(filename, 'utf8')];
    }));
}

function fileModes(directory: string): Record<string, number> {
  return Object.fromEntries(fs.readdirSync(directory, { recursive: true, withFileTypes: true }).map(entry => {
    const filename = path.join(entry.parentPath, entry.name);
    return [path.relative(directory, filename), fs.statSync(filename).mode & 0o7777];
  }));
}

function fixture(reuse = false) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'collapse-worker-test-'));
  const target = `worker_test_${randomBytes(8).toString('hex')}`;
  const files = path.join(root, 'files');
  const work = path.join(root, 'work');
  fixtures.push({ root, target, work });

  const write = (filename: string, contents: string) => {
    fs.mkdirSync(path.dirname(path.join(files, filename)), { recursive: true });
    fs.writeFileSync(path.join(files, filename), contents);
  };
  write(initFiles[0], `
    CREATE TABLE schema_migrations (id bigserial PRIMARY KEY, version text UNIQUE NOT NULL, name text NOT NULL, checksum text);
    CREATE TABLE roles (id integer PRIMARY KEY, label text NOT NULL);
    CREATE TABLE records (id bigserial PRIMARY KEY, role_id integer REFERENCES roles(id), payload jsonb NOT NULL);
  `);
  write(initFiles[1], "INSERT INTO roles VALUES (1, 'fresh install');");
  write(increment, 'ALTER TABLE records ADD COLUMN note text;');

  query('postgres', `CREATE DATABASE "${target}" TEMPLATE template0;`);
  query(target, fs.readFileSync(path.join(files, initFiles[0]), 'utf8'));
  query(target, fs.readFileSync(path.join(files, increment), 'utf8'));
  query(target, `
    INSERT INTO roles VALUES (7, 'existing environment');
    INSERT INTO records (role_id, payload, note) VALUES
      (7, '{"text":"preserve me","nested":[1,null]}', 'existing note'),
      (7, '{"text":"second row"}', NULL);
    SELECT setval('records_id_seq', 40, false);
  `);

  const history = [...initFiles, increment].map(version => ({
    version, checksum: calculateChecksum(path.join(files, version)),
  })).sort((a, b) => a.version.localeCompare(b.version));
  for (const row of history) {
    query(target, `INSERT INTO schema_migrations (version, name, checksum) VALUES ('${row.version}', '${row.version}', '${row.checksum}');`);
  }
  if (reuse) {
    write(initFiles[0], command('pg_dump', target, ['--schema-only', '--no-owner', '--no-acl', '--no-tablespaces']) + '\n');
    fs.rmSync(path.join(files, increment));
  }
  write('baseline.json', JSON.stringify({
    format: 1, id: 'reviewed-fixture', replaces: reuse ? history : [], seedTables: ['public.roles'],
    files: Object.fromEntries(initFiles.map(file => [file, calculateChecksum(path.join(files, file))])),
  }));
  for (const [filename, mode] of Object.entries({
    '': 0o755, schema: 0o755, 'schema/migrations': 0o750, data: 0o750,
    'schema/init.sql': 0o644, 'data/init.sql': 0o640, 'baseline.json': 0o644,
    ...(!reuse ? { [increment]: 0o640 } : {}),
  })) fs.chmodSync(path.join(files, filename), mode);

  const run = (phase: 'prepare' | 'commit' | 'rollback' | 'cleanup') => {
    const previous = { DATABASE_URL: process.env.DATABASE_URL, MIGRATION_FILES_ROOT: process.env.MIGRATION_FILES_ROOT };
    const targetUrl = new URL(connection);
    targetUrl.pathname = `/${target}`;
    process.env.DATABASE_URL = targetUrl.href;
    process.env.MIGRATION_FILES_ROOT = files;
    try {
      collapse({ phase, work, reuse });
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  };
  const contents = () => query(target, `SELECT json_build_object(
    'roles', (SELECT json_agg(r ORDER BY id) FROM roles r),
    'records', (SELECT json_agg(r ORDER BY id) FROM records r),
    'sequence', (SELECT json_build_object('last_value', last_value, 'is_called', is_called) FROM records_id_seq));`);
  const ledger = () => JSON.parse(query(target, 'SELECT json_agg(r ORDER BY version) FROM (SELECT version, checksum FROM schema_migrations) r;'));
  const state = () => JSON.parse(fs.readFileSync(path.join(work, 'state.json'), 'utf8')) as {
    id: string; capture: string; stage: string; backup: string; phase: string;
  };
  return { target, files, work, run, contents, ledger, state, history };
}

afterEach(() => {
  jest.restoreAllMocks();
  for (const { root, target, work } of fixtures.splice(0)) {
    const databases = [target];
    const stateFile = path.join(work, 'state.json');
    if (fs.existsSync(stateFile)) {
      const state = JSON.parse(fs.readFileSync(stateFile, 'utf8')) as { id: string };
      if (!/^[a-f0-9]{16}$/.test(state.id)) throw new Error('Invalid disposable recovery database ID');
      databases.push(...['capture', 'stage', 'backup', 'schema'].map(kind => `collapse_${kind}_${state.id}`));
    }
    for (const database of databases) query('postgres', `DROP DATABASE IF EXISTS "${database}" WITH (FORCE);`);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

it.each([false, true])('preserves rows and sequences through prepare and commit (reuse=%s)', reuse => {
  const test = fixture(reuse);
  const contents = test.contents();
  const originalFiles = fileContents(test.files);
  const originalModes = fileModes(test.files);

  test.run('prepare');

  expect(test.contents()).toBe(contents);
  expect(query(test.target, 'SHOW default_transaction_read_only;')).toBe('on');
  expect(fileContents(test.files)).toEqual(originalFiles);
  const freshSeed = reuse ? '1|fresh install' : '7|existing environment';
  expect(query(test.state().capture, 'SELECT id, label FROM roles;')).toBe(freshSeed);
  expect(query(test.state().capture, 'SELECT count(*) FROM records;')).toBe('0');
  expect(fs.statSync(test.work).mode & 0o777).toBe(0o700);
  for (const filename of ['state.json', 'recovery.dump', 'data.sql']) {
    expect(fs.statSync(path.join(test.work, filename)).mode & 0o777).toBe(0o600);
  }

  const previousUmask = process.umask(0o077);
  try { test.run('commit'); }
  finally { process.umask(previousUmask); }

  expect(test.contents()).toBe(contents);
  expect(query(test.target, "INSERT INTO records (role_id, payload) VALUES (7, '{}') RETURNING id;")).toBe('40');
  expect(test.ledger()).toEqual(initFiles.map(version => ({
    version, checksum: calculateChecksum(path.join(test.files, version)),
  })).sort((a, b) => a.version.localeCompare(b.version)));
  expect(readBaseline(test.files)?.replaces).toEqual(test.history);
  if (reuse) {
    expect(fileContents(test.files)).toEqual(originalFiles);
    expect(fileModes(test.files)).toEqual(originalModes);
  } else {
    expect(fs.existsSync(path.join(test.files, increment))).toBe(false);
    const { [increment]: retiredMode, ...retainedModes } = originalModes;
    expect(retiredMode).toBe(0o640);
    expect(fileModes(test.files)).toEqual({
      ...retainedModes, 'schema/migrations/.gitkeep': 0o644,
      'data/migrations': 0o755, 'data/migrations/.gitkeep': 0o644,
    });
  }

  test.run('cleanup');
  expect(query('postgres', `SELECT datname FROM pg_database WHERE datname = '${test.state().backup}';`)).toBe(test.state().backup);
  expect(query('postgres', `SELECT count(*) FROM pg_database WHERE datname IN ('${test.state().capture}', '${test.state().stage}');`)).toBe('0');
}, 30000);

function reviseReviewedSchema(files: string, transform: (sql: string) => string): void {
  const schemaFile = path.join(files, initFiles[0]);
  fs.writeFileSync(schemaFile, transform(fs.readFileSync(schemaFile, 'utf8')));

  const manifestFile = path.join(files, 'baseline.json');
  const baseline = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  baseline.files[initFiles[0]] = calculateChecksum(schemaFile);
  fs.writeFileSync(manifestFile, JSON.stringify(baseline));
}

it('reuses equivalent reviewed SQL despite different dump formatting', () => {
  const test = fixture(true);
  reviseReviewedSchema(test.files, sql => sql.replaceAll('CREATE TABLE', 'CREATE  TABLE').replaceAll('\n\n', '\n\n\n'));
  const contents = test.contents();
  const files = fileContents(test.files);

  test.run('prepare');
  test.run('commit');

  expect(test.contents()).toBe(contents);
  expect(fileContents(test.files)).toEqual(files);
  expect(test.state().phase).toBe('committed');
  test.run('cleanup');
}, 30000);

it('removes the schema reference database after a comparison restore fails', () => {
  const test = fixture(true);
  const contents = test.contents();
  const spawn = childProcess.spawnSync;
  let injected = false;

  jest.spyOn(childProcess, 'spawnSync').mockImplementation((program, args, options) => {
    if (!injected && program === 'psql' && options?.env?.PGDATABASE?.startsWith('collapse_schema_') && args?.includes('-f')) {
      injected = true;
      throw new Error('Injected comparison restore failure');
    }
    return spawn(program, args!, options!);
  });

  expect(() => test.run('prepare')).toThrow('Injected comparison restore failure');

  expect(test.state().phase).toBe('rolled-back');
  expect(test.contents()).toBe(contents);
  expect(query('postgres', `SELECT count(*) FROM pg_database WHERE datname = 'collapse_schema_${test.state().id}';`)).toBe('0');
  test.run('cleanup');
}, 30000);

it.each(['history', 'schema'])('rejects %s drift without replacing the source or files', drift => {
  const test = fixture(true);
  if (drift === 'history') query(test.target, "UPDATE schema_migrations SET checksum = repeat('0', 64);");
  else query(test.target, 'ALTER TABLE records ADD COLUMN unreviewed text;');
  const contents = test.contents();
  const files = fileContents(test.files);
  const oid = query('postgres', `SELECT oid FROM pg_database WHERE datname = '${test.target}';`);

  expect(() => test.run('prepare')).toThrow(drift === 'history' ? /history does not match/ : /schema differs/);

  expect(test.state().phase).toBe('rolled-back');
  expect(test.contents()).toBe(contents);
  expect(query('postgres', `SELECT oid FROM pg_database WHERE datname = '${test.target}';`)).toBe(oid);
  expect(query(test.target, 'SHOW default_transaction_read_only;')).toBe('off');
  expect(fileContents(test.files)).toEqual(files);
  test.run('cleanup');
}, 30000);

it('restores the original database and migration files when publication fails partway through commit', () => {
  const test = fixture();
  const contents = test.contents();
  const files = fileContents(test.files);
  const modes = fileModes(test.files);
  const oid = query('postgres', `SELECT oid FROM pg_database WHERE datname = '${test.target}';`);
  test.run('prepare');

  const write = fs.writeFileSync;
  let injected = false;
  jest.spyOn(fs, 'writeFileSync').mockImplementation((destination, contents, options) => {
    write(destination, contents, options);
    if (!injected && destination === path.join(test.files, 'data', 'init.sql')) {
      injected = true;
      throw new Error('Injected publication failure');
    }
  });

  const previousUmask = process.umask(0o077);
  try { expect(() => test.run('commit')).toThrow('Injected publication failure'); }
  finally { process.umask(previousUmask); }

  expect(test.state().phase).toBe('rolled-back');
  expect(query('postgres', `SELECT oid FROM pg_database WHERE datname = '${test.target}';`)).toBe(oid);
  expect(test.contents()).toBe(contents);
  expect(test.ledger()).toEqual(test.history);
  expect(fileContents(test.files)).toEqual(files);
  expect(fileModes(test.files)).toEqual(modes);
  expect(query(test.target, "INSERT INTO records (role_id, payload) VALUES (7, '{}') RETURNING id;")).toBe('40');
  test.run('cleanup');
}, 30000);

it.each(['before', 'after'])('keeps the committed database when activation fails %s SQL completes', failure => {
  const test = fixture();
  test.run('prepare');
  const candidateOid = query('postgres', `SELECT oid FROM pg_database WHERE datname = '${test.target}';`);
  const spawn = childProcess.spawnSync;
  let injected = false;
  jest.spyOn(childProcess, 'spawnSync').mockImplementation((program, args, options) => {
    const activation = program === 'psql' && String(options?.input).includes('RESET default_transaction_read_only');
    if (!injected && activation) {
      injected = true;
      if (failure === 'after') spawn(program, args!, options!);
      throw new Error('Interrupted activation');
    }
    return spawn(program, args!, options!);
  });

  expect(() => test.run('commit')).toThrow('Interrupted activation');
  expect(test.state().phase).toBe('committed');
  expect(() => test.run('rollback')).toThrow('A committed collapse cannot be rolled back automatically');
  expect(query('postgres', `SELECT oid FROM pg_database WHERE datname = '${test.target}';`)).toBe(candidateOid);
  if (failure === 'after') {
    expect(query(test.target, "INSERT INTO records (role_id, payload) VALUES (7, '{\"afterCommit\":true}') RETURNING id;")).toBe('40');
  } else {
    expect(query('postgres', `SELECT datallowconn FROM pg_database WHERE datname = '${test.target}';`)).toBe('f');
  }

  test.run('commit');

  expect(query(test.target, 'SHOW default_transaction_read_only;')).toBe('off');
  if (failure === 'before') query(test.target, "INSERT INTO records (role_id, payload) VALUES (7, '{\"afterCommit\":true}');");
  expect(() => test.run('rollback')).toThrow('A committed collapse cannot be rolled back automatically');
  expect(query(test.target, "SELECT count(*) FROM records WHERE payload = '{\"afterCommit\":true}';")).toBe('1');
  test.run('cleanup');
}, 30000);
