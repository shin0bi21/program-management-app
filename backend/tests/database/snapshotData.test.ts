import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { dumpDatabase, snapshotData } from '../../db/scripts/helpers/snapshot-data';

jest.mock('node:child_process', () => ({ spawnSync: jest.fn() }));

const command = jest.mocked(spawnSync);
const databaseUrl = 'postgresql://snapshot_user:fake%20password@localhost:5433/snapshot_test?sslmode=require';
const directories: string[] = [];

function fixture(): { root: string; output: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'snapshot-data-'));
  directories.push(root);
  return { root, output: path.join(root, 'recovery.dump') };
}

function result(status = 0, stderr = ''): ReturnType<typeof spawnSync> {
  return { status, stderr, stdout: '', pid: 1, output: [], signal: null } as unknown as ReturnType<typeof spawnSync>;
}

beforeEach(() => {
  command.mockImplementation((program, _args, options) => {
    if (program === 'pg_dump' && Array.isArray(options?.stdio) && typeof options.stdio[1] === 'number') {
      fs.writeFileSync(options.stdio[1], 'verified archive contents');
    }
    return result();
  });
});

afterEach(() => {
  command.mockReset();
  for (const directory of directories.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

it('publishes a complete private archive only after offline verification', () => {
  const { root, output } = fixture();
  fs.chmodSync(root, 0o755);

  snapshotData({ databaseUrl, outputFile: output });

  expect(fs.readFileSync(output, 'utf8')).toBe('verified archive contents');
  expect(fs.statSync(output).mode & 0o777).toBe(0o600);
  expect(fs.statSync(root).mode & 0o777).toBe(0o755);
  expect(fs.readdirSync(root)).toEqual(['recovery.dump']);
  expect(command.mock.calls.map(call => call[0])).toEqual(['pg_dump', 'pg_restore']);
  const dump = command.mock.calls[0];
  expect(dump[1]).toEqual(['--format=custom', '--no-owner', '--no-acl', '--no-tablespaces']);
  expect(dump[2]?.env).toMatchObject({
    PGHOST: 'localhost', PGPORT: '5433', PGUSER: 'snapshot_user',
    PGPASSWORD: 'fake password', PGDATABASE: 'snapshot_test', PGSSLMODE: 'require',
  });
  expect(command.mock.calls[1][1]?.[0]).toBe('--list');
});

it('creates a private output directory without changing existing parent permissions', () => {
  const { root } = fixture();
  const directory = path.join(root, 'private-snapshot');
  snapshotData({ databaseUrl, outputFile: path.join(directory, 'recovery.dump') });
  expect(fs.statSync(directory).mode & 0o777).toBe(0o700);
});

it('refuses to overwrite a previous snapshot without invoking PostgreSQL tools', () => {
  const { output } = fixture();
  fs.writeFileSync(output, 'previous archive');

  expect(() => snapshotData({ databaseUrl, outputFile: output })).toThrow(/already exists/);
  expect(fs.readFileSync(output, 'utf8')).toBe('previous archive');
  expect(command).not.toHaveBeenCalled();
});

it('removes a failed dump and retains details only in private diagnostics', () => {
  const { root, output } = fixture();
  command.mockReturnValue(result(1, 'private PostgreSQL failure detail'));

  expect(() => snapshotData({ databaseUrl, outputFile: output })).toThrow('Snapshot failed; private diagnostics retained beside the output');
  expect(fs.existsSync(output)).toBe(false);
  const files = fs.readdirSync(root);
  expect(files.length).toBeGreaterThan(0);
  expect(files.every(file => file.endsWith('.log'))).toBe(true);
  for (const file of files) expect(fs.statSync(path.join(root, file)).mode & 0o777).toBe(0o600);
  expect(files.some(file => fs.readFileSync(path.join(root, file), 'utf8').includes('private PostgreSQL failure detail'))).toBe(true);
  expect(command).toHaveBeenCalledTimes(1);
});

it('never publishes an archive that fails pg_restore verification', () => {
  const { root, output } = fixture();
  command.mockImplementationOnce((_program, _args, options) => {
    if (Array.isArray(options?.stdio) && typeof options.stdio[1] === 'number') {
      fs.writeFileSync(options.stdio[1], 'invalid archive');
    }
    return result();
  }).mockReturnValueOnce(result(1, 'invalid archive detail'));

  expect(() => snapshotData({ databaseUrl, outputFile: output })).toThrow(/Snapshot failed/);
  expect(fs.existsSync(output)).toBe(false);
  expect(fs.readdirSync(root).every(file => file.endsWith('.log'))).toBe(true);
});

it('shares the private dump primitive with caller-selected schema/data flags', () => {
  const { output } = fixture();
  dumpDatabase(databaseUrl, output, ['--schema-only', '--no-owner']);
  expect(command).toHaveBeenCalledTimes(1);
  expect(command.mock.calls[0][1]).toEqual(['--schema-only', '--no-owner']);
  expect(fs.statSync(output).mode & 0o777).toBe(0o600);
  expect(() => dumpDatabase(databaseUrl, output, ['--data-only'])).toThrow(/Database export failed/);
  expect(fs.readFileSync(output, 'utf8')).toBe('verified archive contents');
});
