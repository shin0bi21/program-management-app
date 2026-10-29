import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';

const script = resolve(dirname(fileURLToPath(import.meta.url)), 'download-data-snapshot.sh');
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function setup(mode = 'success') {
  const root = mkdtempSync(join(tmpdir(), 'data-snapshot-test-'));
  roots.push(root);
  const bin = join(root, 'bin');
  const destination = join(root, 'private folder');
  mkdirSync(bin);
  mkdirSync(destination);
  const ssh = join(bin, 'ssh');
  writeFileSync(ssh, `#!/bin/bash
printf '%s\\0' "$@" > "$MOCK_ARGUMENTS"
cat > "$MOCK_REMOTE_SCRIPT"
if [ "$MOCK_MODE" = failure ]; then printf 'PGDMPpartial'; exit 1; fi
if [ "$MOCK_MODE" = invalid ]; then printf 'not a database'; exit 0; fi
printf 'PGDMPmock database archive'
`);
  chmodSync(ssh, 0o755);
  const argumentsPath = join(root, 'arguments');
  const remotePath = join(root, 'remote-script');
  const env = {
    ...process.env,
    PATH: `${bin}:${process.env.PATH}`,
    MOCK_MODE: mode,
    MOCK_ARGUMENTS: argumentsPath,
    MOCK_REMOTE_SCRIPT: remotePath,
  };
  const run = (args: string[] = []) => spawnSync('/bin/bash', [script, '--host', 'ubuntu@server.example', '--destination', destination, ...args], { env, encoding: 'utf8' });
  return { destination, run, argumentsPath, remotePath, env };
}

test('streams over SSH, preserves literal paths, publishes private unique files and a valid checksum', () => {
  const { destination, run, argumentsPath, remotePath } = setup();
  const identity = '/private/key with spaces $(no-execution).pem';
  const first = run(['--identity', identity]);
  assert.equal(first.status, 0, first.stderr);
  assert.deepEqual(readFileSync(argumentsPath, 'utf8').split('\0').slice(0, -1), [
    '-T', '-o', 'BatchMode=yes', '-i', identity, 'ubuntu@server.example', 'sh -s -- myapp_db',
  ]);
  const remoteScript = readFileSync(remotePath, 'utf8');
  assert.match(remoteScript, /pg_dump --format=custom --no-owner --no-acl/);
  assert.match(remoteScript, /POSTGRES_USER/);
  assert.doesNotMatch(remoteScript, /pg_restore|DROP DATABASE|sudo/);

  const files = readdirSync(destination);
  assert.equal(files.length, 3);
  const archive = files.find(file => file.endsWith('.dump'))!;
  assert.equal(readFileSync(join(destination, archive), 'utf8'), 'PGDMPmock database archive');
  for (const file of files) assert.equal(statSync(join(destination, file)).mode & 0o777, 0o600);
  assert.match(readFileSync(join(destination, `${archive}.txt`), 'utf8'), /Raw live data; not anonymized/);
  execFileSync('shasum', ['-a', '256', '-c', `${archive}.sha256`], { cwd: destination });

  const second = run();
  assert.equal(second.status, 0, second.stderr);
  assert.equal(readdirSync(destination).length, 6);
  assert.equal(readFileSync(join(destination, archive), 'utf8'), 'PGDMPmock database archive');
});

test('cleans partial files when SSH or pg_dump fails', () => {
  const { destination, run } = setup('failure');
  const result = run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Snapshot download failed/);
  assert.deepEqual(readdirSync(destination), []);
});

test('rejects a successful SSH response that is not an archive', () => {
  const { destination, run } = setup('invalid');
  const result = run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /not a PostgreSQL custom archive/);
  assert.deepEqual(readdirSync(destination), []);
});

test('rejects remote argument injection before connecting', () => {
  const { run, argumentsPath, destination } = setup();
  for (const args of [['--host', '-oProxyCommand=bad'], ['--container', 'db; touch bad']]) {
    const result = run(args);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Invalid/);
    assert.equal(existsSync(argumentsPath), false);
    assert.deepEqual(readdirSync(destination), []);
  }
});

test('requires an external existing destination before connecting', () => {
  const { run, argumentsPath } = setup();
  const result = run(['--destination', dirname(script)]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /outside this repository/);
  assert.equal(existsSync(argumentsPath), false);
});
