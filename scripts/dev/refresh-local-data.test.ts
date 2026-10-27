import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';

const source = dirname(fileURLToPath(import.meta.url));
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });

function setup(failure = '') {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'refresh-local-data-test-')));
  roots.push(root);
  const repo = join(root, 'repo with spaces');
  const scripts = join(repo, 'scripts/dev');
  const bin = join(root, 'bin');
  const temporary = join(root, 'tmp');
  for (const dir of [scripts, bin, temporary]) mkdirSync(dir, { recursive: true });
  for (const file of ['refresh-local-data.sh', 'download-data-snapshot.sh']) copyFileSync(join(source, file), join(scripts, file));
  writeFileSync(join(repo, 'docker-compose.yml'), 'services: {}\n');
  const originalEnv = 'JWT_SECRET=old-local-key\nREFRESH_SECRET=old-refresh-key\nADMIN_EMAIL=local@example.test\nUNRELATED=value\n';
  writeFileSync(join(repo, '.env'), originalEnv, { mode: 0o600 });
  const log = join(root, 'commands');
  const docker = join(bin, 'docker');
  writeFileSync(docker, `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
const input = fs.readFileSync(0, 'utf8');
fs.appendFileSync(process.env.MOCK_LOG, JSON.stringify({ args, input }) + '\\n');
const text = args.join(' ');
const failure = process.env.MOCK_FAILURE;
if (args[0] === 'context') { console.log(failure === 'remote' ? 'ssh://production' : 'unix:///local/docker.sock'); process.exit(0); }
if (text.includes('printf "%s" "$POSTGRES_DB"')) { process.stdout.write('app_local'); process.exit(0); }
if (text.includes(' run ') && text.includes('ADMIN_EMAIL')) process.exit(failure === 'preflight' ? 1 : 0);
if (text.includes('http://127.0.0.1:5001/health') && failure === 'health') {
  const state = process.env.MOCK_LOG + '.health';
  const attempts = fs.existsSync(state) ? Number(fs.readFileSync(state, 'utf8')) : 0;
  fs.writeFileSync(state, String(attempts + 1));
  process.exit(attempts < 30 ? 1 : 0);
}
if (text.includes('pg_restore --list')) process.exit(failure === 'archive' ? 1 : 0);
if (text.includes('pg_restore --exit-on-error')) process.exit(failure === 'restore' ? 1 : 0);
if (text.includes(' run ') && text.includes('prepare-local-snapshot.ts')) process.exit(failure === 'prepare' ? 1 : 0);
if (text.includes('old_name=local_snapshot_') && !text.includes('old_name=local_snapshot_backup_') && failure === 'rename') process.exit(1);
process.exit(0);
`);
  chmodSync(docker, 0o755);
  const ssh = join(bin, 'ssh');
  writeFileSync(ssh, '#!/bin/bash\ncat >/dev/null\n[ "$MOCK_FAILURE" != download ] || exit 1\nprintf PGDMPmock-archive\n');
  chmodSync(ssh, 0o755);
  writeFileSync(join(bin, 'sleep'), '#!/bin/bash\nexit 0\n');
  chmodSync(join(bin, 'sleep'), 0o755);
  const env: NodeJS.ProcessEnv = { ...process.env, PATH: `${bin}:${process.env.PATH}`, TMPDIR: temporary, MOCK_LOG: log, MOCK_FAILURE: failure };
  delete env.DOCKER_HOST;
  const run = (mode?: string, extraEnv = {}) => spawnSync('/bin/bash', [join(scripts, 'refresh-local-data.sh'), '--host', 'ubuntu@production.example', ...(mode ? [mode] : [])], { env: { ...env, ...extraEnv }, encoding: 'utf8' });
  const commands = () => existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').map(line => JSON.parse(line) as { args: string[]; input: string }) : [];
  return { repo, run, commands, temporary, originalEnv };
}

test('requires an explicit mode and refuses remote Docker before downloading', () => {
  const first = setup();
  assert.notEqual(first.run().status, 0);
  assert.deepEqual(first.commands(), []);
  assert.notEqual(first.run('--apply', { DOCKER_HOST: 'tcp://remote:2375' }).status, 0);
  assert.deepEqual(first.commands(), []);
  const remote = setup('remote');
  assert.notEqual(remote.run('--apply').status, 0);
  assert.equal(remote.commands().length, 1);
});

test('validate-only prepares a disposable local import without stopping or replacing the current database', () => {
  const { repo, run, commands, temporary, originalEnv } = setup();
  const result = run('--validate-only');
  assert.equal(result.status, 0, result.stderr);
  const calls = commands();
  assert.ok(calls.some(call => call.args.join(' ').includes('pg_restore --exit-on-error')));
  assert.ok(calls.some(call => call.args.join(' ').includes('prepare-local-snapshot.ts')));
  assert.ok(calls.some(call => call.args.join(' ').includes('dropdb')));
  assert.ok(!calls.some(call => call.args.includes('stop') || call.input.includes('RENAME TO')));
  for (const call of calls.filter(call => call.args[0] === 'compose')) {
    assert.ok(call.args.includes(join(repo, 'docker-compose.yml')));
  }
  assert.equal(readFileSync(join(repo, '.env'), 'utf8'), originalEnv);
  assert.deepEqual(readdirSync(temporary), []);
});

for (const failure of ['preflight', 'download', 'archive', 'restore', 'prepare']) {
  test(`${failure} failure leaves the current database and environment unchanged`, () => {
    const { repo, run, commands, temporary, originalEnv } = setup(failure);
    assert.notEqual(run('--apply').status, 0);
    assert.ok(!commands().some(call => call.args.includes('stop') || call.input.includes('RENAME TO')));
    assert.equal(readFileSync(join(repo, '.env'), 'utf8'), originalEnv);
    assert.deepEqual(readdirSync(temporary), []);
  });
}

test('apply retains the old database, rotates only local signing keys, and recreates the backend', () => {
  const { repo, run, commands, temporary } = setup();
  const result = run('--apply');
  assert.equal(result.status, 0, result.stderr);
  const calls = commands();
  assert.ok(calls.some(call => call.args.includes('old_name=app_local') && call.args.some(arg => arg.startsWith('new_name=local_snapshot_backup_'))));
  assert.ok(calls.some(call => call.args.some(arg => arg.startsWith('old_name=local_snapshot_')) && call.args.includes('new_name=app_local')));
  assert.ok(calls.some(call => call.args.includes('--force-recreate')));
  assert.ok(!calls.some(call => call.args.join(' ').includes('dropdb')));
  const changedEnv = readFileSync(join(repo, '.env'), 'utf8');
  assert.match(changedEnv, /JWT_SECRET=[a-f0-9]{96}/);
  assert.match(changedEnv, /REFRESH_SECRET=[a-f0-9]{96}/);
  assert.match(changedEnv, /UNRELATED=value/);
  assert.deepEqual(readdirSync(temporary), []);
});

test('failed staged rename restores the original database name and environment', () => {
  const { repo, run, commands, temporary, originalEnv } = setup('rename');
  const result = run('--apply');
  assert.notEqual(result.status, 0);
  assert.ok(commands().some(call => call.args.some(arg => arg.startsWith('old_name=local_snapshot_backup_')) && call.args.includes('new_name=app_local')));
  assert.ok(commands().some(call => call.args.includes('--force-recreate')));
  assert.equal(readFileSync(join(repo, '.env'), 'utf8'), originalEnv);
  assert.deepEqual(readdirSync(temporary), []);
});

test('a failed new-backend health check restores the old database and signing keys', () => {
  const { repo, run, commands, temporary, originalEnv } = setup('health');
  const result = run('--apply');
  assert.notEqual(result.status, 0);
  const calls = commands();
  assert.ok(calls.some(call => call.args.includes('old_name=app_local') && call.args.some(arg => arg.startsWith('new_name=local_snapshot_'))));
  assert.ok(calls.some(call => call.args.some(arg => arg.startsWith('old_name=local_snapshot_backup_')) && call.args.includes('new_name=app_local')));
  assert.equal(readFileSync(join(repo, '.env'), 'utf8'), originalEnv);
  assert.deepEqual(readdirSync(temporary), []);
});
