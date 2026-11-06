import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import test, { type TestContext } from 'node:test';
import { format } from 'node:util';
import { fileURLToPath } from 'node:url';

import { parseArgs, renderLogReport } from './log-report.ts';

const script = fileURLToPath(new URL('./log-report.ts', import.meta.url));
const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const defaults = { match: null, type: null, context: 0 } as const;

test('accepts Docker windows, service selection, and combined filters', () => {
  const options = parseArgs(['--docker', 'backend', 'frontend', '--since', '5m', '--match', 'TypeError', '--type', 'error', '--context', '4']);
  assert.equal(options.docker, true);
  assert.equal(options.stack, null);
  assert.equal(parseArgs(['--production', '--docker', 'nginx']).stack, 'production');
  assert.deepEqual(options.sources, ['backend', 'frontend']);
  assert.equal(options.since, '5m');
  assert.equal(options.match, 'TypeError');
  assert.equal(options.type, 'error');
  assert.equal(options.context, 4);
  assert.deepEqual(parseArgs(['--', '-console.txt']).sources, ['-console.txt']);
});

test('rejects incomplete, incompatible, and invalid options', () => {
  for (const args of [
    ['--development'], ['--docker', '--production', '--development'], ['--production'], ['--production', 'saved.log'], ['--since', '5m'], ['--match'], ['--match', '--docker'], ['--unknown'],
    ['--context', '-1'], ['--context', '1.5'], ['--context', 'Infinity'],
    ['--type', 'request'], ['--docker', '--', '--follow'], ['--docker', 'path/to/log'],
  ]) {
    assert.throws(() => parseArgs(args), Error, args.join(' '));
  }
});

test('groups repeated Docker failures per source with captured locations', () => {
  const report = renderLogReport([
    { name: 'backend', text: 'backend-1 | 2026-11-04T10:00:00.123Z TypeError: broken\nbackend-1 | 2026-11-04T10:00:01Z TypeError: broken\n' },
    { name: 'saved.log', text: 'TypeError: broken\r\nWarning: deprecated API\r\n' },
  ], defaults);
  assert.match(report, /Errors\n {2}2x TypeError: broken/);
  assert.match(report, /Source: backend-1/);
  assert.match(report, /backend:1 \| time=2026-11-04T10:00:00.123Z/);
  assert.match(report, /backend:2 \| time=2026-11-04T10:00:01Z/);
  assert.match(report, /1x TypeError: broken\n {4}Source: saved.log/);
  assert.match(report, /Warnings\n {2}1x Warning: deprecated API/);
});

test('normalizes HTTP failures and retains application frames without dependency noise', () => {
  const report = renderLogReport([{ name: 'browser', text: [
    'GET https://localhost:5001/api/users?token=a 500 (Server Error)',
    'GET https://example.test/api/users?token=b 500',
    'POST /api/login 401',
    'at save (src/save.ts:12:4)',
    'at internal (node_modules/library.js:5:1)',
    'at internal (chunk-ABC123.js:5:1)',
    'react-router-dom logDeprecation',
  ].join('\n') }], defaults);
  assert.match(report, /2x GET \/api\/users\?… -> 500/);
  assert.match(report, /1x POST \/api\/login -> 401/);
  assert.match(report, /Application frames\n {2}1x at save/);
  assert.match(report, /React Router deprecation warning/);
  assert.doesNotMatch(report, /token=[ab]|node_modules|chunk-ABC123/);
});

test('matches literal text ignoring case and isolates first-occurrence context per group', () => {
  const report = renderLogReport([{ name: 'console', text: [
    'before', 'ERROR: failed [request]', 'at save (src/save.ts:2)',
    'unrelated', 'ERROR: failed [request]', 'after',
  ].join('\n') }], { match: 'FAILED [request]', type: 'error', context: 1 });
  assert.match(report, /2x ERROR: failed \[request\]/);
  assert.match(report, /console:2/);
  assert.match(report, /console:5/);
  assert.match(report, /> console:2 ERROR:/);
  assert.match(report, /console:1 before/);
  assert.match(report, /console:3 at save/);
  assert.doesNotMatch(report, /unrelated|after/);

  assert.match(renderLogReport([{ name: 'stdin', text: 'request abc finished' }], {
    match: 'abc', type: null, context: 2,
  }), /Matches\n {2}1x request abc finished/);
  assert.equal(renderLogReport([{ name: 'stdin', text: 'INFO: fine' }], {
    ...defaults, type: 'error',
  }), 'No log entries match the selected filters.');
  assert.equal(renderLogReport([], defaults), 'No recognized errors, warnings, HTTP failures, or application frames.');
});

test('CLI reads stdin and files, and propagates read failures', (context) => {
  const root = mkdtempSync(join(tmpdir(), 'log-report-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const file = join(root, 'console.txt');
  writeFileSync(file, 'ERROR: file failure\n');

  const stdin = spawnSync(process.execPath, [script, '--context', '0'], { input: 'Warning: stdin\n', encoding: 'utf8' });
  assert.equal(stdin.status, 0, stdin.stderr);
  assert.match(stdin.stdout, /stdin:1/);
  const fromFile = spawnSync(process.execPath, [script, file], { encoding: 'utf8' });
  assert.equal(fromFile.status, 0, fromFile.stderr);
  assert.match(fromFile.stdout, /ERROR: file failure/);
  const missing = spawnSync(process.execPath, [script, join(root, 'missing')], { encoding: 'utf8' });
  assert.equal(missing.status, 1);
  assert.equal(missing.stdout, '');
});

/**
 * Provides an isolated Docker executable and records acquisition arguments.
 * @example const { env, readCalls } = createDockerFixture(context);
 */
function createDockerFixture(context: TestContext) {
  const root = mkdtempSync(join(tmpdir(), 'log-report-docker-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const executable = join(root, 'docker');
  const argumentsFile = join(root, 'arguments.json');
  writeFileSync(executable, `#!${process.execPath}
const args = process.argv.slice(2);
require('node:fs').appendFileSync(process.env.LOG_REPORT_ARGUMENTS, JSON.stringify(args) + '\\n');
if (process.env.LOG_REPORT_FAIL) { console.error('Docker unavailable'); process.exit(1); }
if (args[0] === 'ps') { console.log(process.env.LOG_REPORT_CONFIGS); process.exit(0); }
console.log('backend-1 | 2026-11-04T12:00:00Z TypeError: fixture failure');
`);
  chmodSync(executable, 0o700);
  const env = { ...process.env, PATH: `${root}${delimiter}${process.env.PATH}`, LOG_REPORT_ARGUMENTS: argumentsFile, LOG_REPORT_CONFIGS: resolve(repoRoot, 'docker-compose.yml') };

  return {
    env,
    readCalls: () => readFileSync(argumentsFile, 'utf8').trim().split('\n').map(line => JSON.parse(line) as string[]),
  };
}

test('CLI detects development Compose and captures a finite service log window', (context) => {
  const { env, readCalls } = createDockerFixture(context);

  const result = spawnSync(process.execPath, [script, '--docker', 'backend', '--since', '5m', '--match', 'TypeError'], { env, encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /1x TypeError: fixture failure/);
  const [discovery, args] = readCalls();
  assert.ok(discovery!.includes(`label=com.docker.compose.project.working_dir=${resolve(repoRoot)}`));
  assert.ok(discovery!.includes('--all'));
  assert.deepEqual(args!.slice(args!.indexOf('logs')), ['logs', '--no-color', '--timestamps', '--since', '5m', 'backend']);
  assert.equal(args![args!.indexOf('-f') + 1], resolve(repoRoot, 'docker-compose.yml'));
  assert.ok(!args!.includes('--follow'));
});

test('CLI detects production Compose and deduplicates labels from multiple services', (context) => {
  const { env, readCalls } = createDockerFixture(context);
  const config = resolve(repoRoot, 'docker-compose.prod.yml');

  const result = spawnSync(process.execPath, [script, '--docker'], {
    env: { ...env, LOG_REPORT_CONFIGS: `${config}\n${config}` }, encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  const args = readCalls().at(-1)!;
  assert.equal(args[args.indexOf('-f') + 1], config);
});

for (const stack of ['production', 'development'] as const) {
  test(`CLI explicitly selects ${stack} without discovering containers`, (context) => {
    const { env, readCalls } = createDockerFixture(context);

    const result = spawnSync(process.execPath, [script, '--docker', `--${stack}`, 'backend', '--since', '10m'], { env, encoding: 'utf8' });

    assert.equal(result.status, 0, result.stderr);
    const calls = readCalls();
    assert.equal(calls.length, 1);
    const args = calls[0]!;
    const filename = stack === 'production' ? 'docker-compose.prod.yml' : 'docker-compose.yml';
    assert.equal(args[args.indexOf('-f') + 1], resolve(repoRoot, filename));
    assert.deepEqual(args.slice(args.indexOf('logs')), ['logs', '--no-color', '--timestamps', '--since', '10m', 'backend']);
  });
}

for (const [name, configs] of [
  ['no containers', ''],
  ['both stacks', [resolve(repoRoot, 'docker-compose.yml'), resolve(repoRoot, 'docker-compose.prod.yml')].join('\n')],
  ['custom overrides', `${resolve(repoRoot, 'docker-compose.yml')},${resolve(repoRoot, 'override.yml')}`],
]) {
  test(`CLI refuses automatic selection with ${name}`, (context) => {
    const { env, readCalls } = createDockerFixture(context);

    const result = spawnSync(process.execPath, [script, '--docker'], {
      env: { ...env, LOG_REPORT_CONFIGS: configs }, encoding: 'utf8',
    });

    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /Choose --development or --production/);
    const calls = readCalls();
    assert.equal(calls.length, 1);
    assert.equal(calls[0]![0], 'ps');
  });
}

test('CLI reports Docker acquisition failures without an empty success report', (context) => {
  const { env } = createDockerFixture(context);

  const result = spawnSync(process.execPath, [script, '--docker'], {
    env: { ...env, LOG_REPORT_FAIL: '1' }, encoding: 'utf8',
  });

  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /Docker unavailable/);
});

test('preserves backend request metadata and keeps services, messages, and causes distinct', () => {
  const report = renderLogReport([{ name: 'docker:all', text: [
    'backend | 2026-11-05T12:00:00Z [request-1] POST /api/example 400 ValidationError: Invalid fields',
    'backend | 2026-11-05T12:00:01Z [request-2] POST /api/example 400 ValidationError: Invalid fields',
    'backend | 2026-11-05T12:00:02Z [request-3] POST /api/example 400 BadRequestError: Invalid range',
    'frontend | 2026-11-05T12:00:03Z [request-4] POST /api/example 400 ValidationError: Invalid fields',
    'backend | 2026-11-05T12:00:04Z [request-5] GET /api/data 500 InternalServerError: Failed',
    'backend | 2026-11-05T12:00:04Z     at load (/app/src/data.ts:10:2)',
    'backend | 2026-11-05T12:00:04Z   [cause]: Error: first cause',
    'backend | 2026-11-05T12:00:05Z [request-6] GET /api/data 500 InternalServerError: Failed',
    'backend | 2026-11-05T12:00:05Z     at load (/app/src/data.ts:10:2)',
    'backend | 2026-11-05T12:00:05Z   [cause]: Error: second cause',
  ].join('\n') }], defaults);

  assert.match(report, /2x POST \/api\/example -> 400\n {4}Source: backend\n {4}Error: ValidationError: Invalid fields/);
  assert.match(report, /docker:all:1 \| time=2026-11-05T12:00:00Z \| request=request-1/);
  assert.match(report, /docker:all:2 \| time=2026-11-05T12:00:01Z \| request=request-2/);
  assert.match(report, /Error: BadRequestError: Invalid range/);
  assert.match(report, /1x POST \/api\/example -> 400\n {4}Source: frontend/);
  assert.equal(report.match(/1x GET \/api\/data -> 500/g)?.length, 2);
  assert.match(report, /first cause/);
  assert.match(report, /second cause/);
});

test('retains complete backend error details when services interleave and context is disabled', () => {
  const report = renderLogReport([{ name: 'docker:all', text: [
    'backend | 2026-11-05T12:00:00Z [request-1] GET /api/data 500 InternalServerError: Failed',
    'frontend | 2026-11-05T12:00:00Z Warning: separate service',
    'backend | 2026-11-05T12:00:00Z     at load (/app/src/data.ts:10:2)',
    'backend | 2026-11-05T12:00:00Z   [cause]: Error: connection closed',
    'backend | 2026-11-05T12:00:00Z   details: [{ field: "body.id", message: "Invalid" }]',
    'backend | 2026-11-05T12:00:00Z }',
    'backend | 2026-11-05T12:00:01Z INFO: unrelated request finished',
  ].join('\n') }], { match: 'connection closed', type: 'error', context: 0 });

  assert.match(report, /GET \/api\/data -> 500/);
  assert.match(report, /request=request-1/);
  assert.match(report, /Details:[\s\S]*at load[\s\S]*connection closed[\s\S]*body.id/);
  assert.doesNotMatch(report, /separate service|unrelated request|Application frames/);
});

test('recognizes nginx failures and filters HTTP summaries by status severity', () => {
  const input = [{ name: 'docker:all', text: [
    'nginx | 2026-11-05T12:00:00Z 127.0.0.1 - - [05/Nov/2026:12:00:00 +0000] "GET /api/tasks?token=private HTTP/1.1" 502 157 "-" "Review"',
    'backend | 2026-11-05T12:00:00Z [request-1] POST /api/example 400 BadRequestError: Invalid request',
  ].join('\n') }];
  const errors = renderLogReport(input, { ...defaults, type: 'error' });
  assert.match(errors, /GET \/api\/tasks\?… -> 502/);
  assert.match(errors, /Source: nginx/);
  assert.doesNotMatch(errors, /token=private|Invalid request/);

  const warnings = renderLogReport(input, { ...defaults, type: 'warning' });
  assert.match(warnings, /Error: BadRequestError: Invalid request/);
  assert.doesNotMatch(warnings, /502/);
  const http = renderLogReport(input, { ...defaults, type: 'http' });
  assert.match(http, /502/);
  assert.match(http, /400/);
});

test('parses actual Node error inspection without repeating the error heading', () => {
  const error = new Error('Invalid fields');
  error.name = 'ValidationError';
  const text = format('[request-1] POST /api/example 400 ValidationError: Invalid fields', error)
    .split('\n').map(line => `backend | 2026-11-05T12:00:00Z ${line}`).join('\n');

  const report = renderLogReport([{ name: 'docker:all', text }], defaults);

  assert.match(report, /Error: ValidationError: Invalid fields\n/);
  assert.doesNotMatch(report, /Invalid fields ValidationError/);
  assert.match(report, /Details:[\s\S]*at /);
  assert.match(renderLogReport([{ name: 'docker:all', text }], { ...defaults, match: 'backend |' }), /request=request-1/);
});
