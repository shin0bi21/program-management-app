import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  filterDeployments, formatDuration, loadDeploymentHistory, parseArgs,
  renderDeploymentTable, summarizeDurations,
} from './deployment-history-report.ts';

type Deployment = ReturnType<typeof loadDeploymentHistory>['deployments'][number];

function deployment(overrides: Partial<Deployment> = {}): Deployment {
  return {
    durationSeconds: 30,
    startedAt: '2026-09-15T12:00:00Z',
    path: 'frontend-only',
    flags: { frontend: true, backend: false, migrations: false, infrastructure: false },
    ...overrides,
  };
}

test('parses component combinations and rejects invalid CLI inputs', () => {
  const options = parseArgs(['--type', 'frontend', '--type', 'backend', '--type', 'frontend', '--exclusive']);

  assert.deepEqual(options.types, ['frontend', 'backend']);
  assert.equal(options.exclusive, true);
  for (const args of [
    ['--exclusive'], ['--type'], ['--type', 'unknown'], ['--unknown'],
    ['--since', '2026-02-30'], ['--until', '2025-02-29'],
    ['--since', '2026-09-20', '--until', '2026-09-01'],
  ]) {
    assert.throws(() => parseArgs(args));
  }
  assert.equal(parseArgs(['--since', '2024-02-29']).since, '2024-02-29');
});

test('filters inclusive dates and requires every requested component', () => {
  const frontend = deployment({ startedAt: '2026-09-01T00:00:00Z' });
  const combined = deployment({
    startedAt: '2026-09-30T23:59:59Z', path: 'frontend+backend',
    flags: { frontend: true, backend: true, migrations: false, infrastructure: false },
  });
  const outside = deployment({ startedAt: '2026-10-01T00:00:00Z' });
  const records = [frontend, combined, outside];

  const dated = filterDeployments(records, parseArgs(['--since', '2026-09-01', '--until', '2026-09-30']));
  const both = filterDeployments(records, parseArgs(['--type', 'frontend', '--type', 'backend']));

  assert.deepEqual(dated, [frontend, combined]);
  assert.deepEqual(both, [combined]);
  assert.deepEqual(filterDeployments(records, parseArgs([])), records);
});

test('uses the UTC start date when history timestamps have offsets', () => {
  const record = deployment({ startedAt: '2026-09-30T23:30:00-04:00' });

  const september = filterDeployments([record], parseArgs(['--until', '2026-09-30']));
  const october = filterDeployments([record], parseArgs(['--since', '2026-10-01']));

  assert.deepEqual(september, []);
  assert.deepEqual(october, [record]);
});

test('exclusive filters include the required migration and infrastructure dependencies', () => {
  const frontend = deployment();
  const migrated = deployment({
    path: 'backend+migrations',
    flags: { frontend: false, backend: true, migrations: true, infrastructure: false },
  });
  const full = deployment({
    path: 'full', flags: { frontend: true, backend: true, migrations: true, infrastructure: true },
  });
  const records = [frontend, migrated, full];

  assert.deepEqual(filterDeployments(records, parseArgs(['--type', 'frontend'])), [frontend, full]);
  for (const [type, expected] of [['frontend', frontend], ['migrations', migrated], ['infrastructure', full]] as const) {
    const actual = filterDeployments(records, parseArgs(['--type', type, '--exclusive']));

    assert.deepEqual(actual, [expected]);
  }
});

test('summarizes odd and even groups and rejects unusable durations', () => {
  const even = summarizeDurations([deployment({ durationSeconds: 10 }), deployment({ durationSeconds: 40 })]);
  const odd = summarizeDurations([10, 20, 90].map(durationSeconds => deployment({ durationSeconds })));

  assert.deepEqual(even, { runs: 2, meanSeconds: 25, medianSeconds: 25, minSeconds: 10, maxSeconds: 40 });
  assert.equal(odd.medianSeconds, 20);
  assert.equal(odd.meanSeconds, 40);
  assert.throws(() => summarizeDurations([]), /empty/);
  for (const durationSeconds of [-1, NaN, Infinity]) {
    assert.throws(() => summarizeDurations([deployment({ durationSeconds })]), /finite, non-negative/);
  }
});

test('formats rounded durations and renders only eligible nonempty groups', () => {
  const records = [deployment(), deployment({ path: 'backend-only' })];

  const defaults = renderDeploymentTable(records);
  const all = renderDeploymentTable(records, true);

  assert.equal(formatDuration(0), '0s');
  assert.equal(formatDuration(59.5), '1m');
  assert.equal(formatDuration(65), '1m 05s');
  assert.match(defaults, /Frontend only\s+\|\s+1\s+\|\s+30s\s+\|\s+30s\s+\|\s+30s–30s/);
  assert.doesNotMatch(defaults, /Backend only/);
  assert.match(all, /Backend only/);
  assert.doesNotMatch(all, /Full deployment/);
});

test('loads history and rejects malformed records before filtering or rendering', (context) => {
  const root = mkdtempSync(join(tmpdir(), 'deployment-report-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const path = join(root, 'history.json');
  writeFileSync(path, JSON.stringify({ deployments: [deployment()] }));

  assert.deepEqual(loadDeploymentHistory(path).deployments, [deployment()]);
  for (const value of [null, {}, { deployments: [null] },
    { deployments: [deployment({ durationSeconds: -1 })] },
    { deployments: [deployment({ startedAt: '2026-02-30T00:00:00Z' })] },
    { deployments: [deployment({ path: 'unknown' })] },
    { deployments: [{ ...deployment(), flags: { frontend: 'true' } }] },
  ]) {
    writeFileSync(path, JSON.stringify(value));

    assert.throws(() => loadDeploymentHistory(path), /Invalid deployment/);
  }
});

test('CLI reports custom history and propagates empty, missing-file, and argument failures', (context) => {
  const root = mkdtempSync(join(tmpdir(), 'deployment-cli-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const path = join(root, 'history.json');
  const script = fileURLToPath(new URL('./deployment-history-report.ts', import.meta.url));
  writeFileSync(path, JSON.stringify({ deployments: [deployment()] }));

  const success = spawnSync(process.execPath, [script, '--file', path], { encoding: 'utf8' });
  const help = spawnSync(process.execPath, [script, '--help', '--file', join(root, 'missing')], { encoding: 'utf8' });

  assert.equal(success.status, 0, success.stderr);
  assert.match(success.stdout, /Frontend only/);
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /Usage:/);
  for (const [args, message] of [
    [['--file', path, '--type', 'backend'], /No deployments match/],
    [['--file', join(root, 'missing')], /ENOENT/],
    [['--type'], /requires a value/],
  ] as const) {
    const result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });

    assert.equal(result.status, 1);
    assert.match(result.stderr, message);
  }
});
