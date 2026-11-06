import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { collectHistory, filterRuns, parseArgs, renderReport } from './ci-history-report.ts';

type Run = Awaited<ReturnType<typeof collectHistory>>[number];

/** Creates a development attempt; run({ conclusion: 'failure' }) overrides its successful default. */
function run(overrides: Partial<Run> = {}): Run {
  return {
    runId: 1, branch: 'dev', group: 'CI', attempt: 1, conclusion: 'success',
    createdAt: '2026-09-15T12:00:00Z', durationSeconds: 30,
    queueSeconds: 2, runnerSeconds: 60, ...overrides,
  };
}

test('requires a real start date, defaults end to now, and rejects ambiguous filters', () => {
  const before = Date.now();
  const options = parseArgs(['--start', '2026-09-01', '--dev']);

  assert.equal(options.start, '2026-09-01T00:00:00Z');
  assert.ok(Date.parse(options.end) >= before && Date.parse(options.end) <= Date.now());
  assert.equal(parseArgs(['--help']).help, true);
  for (const args of [
    [], ['--start'], ['--start', '2026-02-30'],
    ['--start', '2026-09-02', '--end', '2026-09-01'],
    ['--start', '2026-09-01', '--main', '--dev'],
    ['--start', '2026-09-01', '--success', '--all'],
    ['--start', '2026-09-01', '--type', 'frontend'],
    ['--start', '2026-09-01', '--exclusive'],
    ['--start', '2026-09-01', '--main', '--type', 'unknown'],
  ]) assert.throws(() => parseArgs(args));
});

test('filters inclusive UTC dates, outcomes, and exact deployment component dependencies', () => {
  const dev = run({ createdAt: '2026-09-30T23:30:00-04:00' });
  const frontend = run({ runId: 2, branch: 'main', group: 'frontend-only',
    flags: { frontend: true, backend: false, migrations: false, infrastructure: false } });
  const migrated = run({ runId: 3, branch: 'main', group: 'backend+migrations',
    flags: { frontend: false, backend: true, migrations: true, infrastructure: false } });
  const failed = run({ runId: 4, conclusion: 'failure' });
  const records = [dev, frontend, migrated, failed];
  const september = ['--start', '2026-09-01', '--end', '2026-09-30'];

  assert.deepEqual(filterRuns(records, parseArgs(september)), [frontend, migrated]);
  assert.deepEqual(filterRuns(records, parseArgs([...september, '--dev', '--success'])), []);
  assert.deepEqual(filterRuns(records, parseArgs(['--start', '2026-10-01', '--dev'])), [dev]);
  assert.deepEqual(filterRuns(records, parseArgs([...september, '--main', '--type', 'migrations', '--exclusive'])), [migrated]);
  assert.deepEqual(filterRuns(records, parseArgs([...september, '--main', '--type', 'frontend', '--type', 'backend'])), []);
});

test('counts failed and cancelled attempts without polluting successful first-attempt timings', () => {
  const records = [
    run({ durationSeconds: 10 }),
    run({ runId: 2, durationSeconds: 40 }),
    run({ runId: 3, conclusion: 'failure', durationSeconds: 1 }),
    run({ runId: 4, conclusion: 'cancelled', durationSeconds: 900 }),
    run({ runId: 3, attempt: 2, durationSeconds: 900 }),
  ];
  const options = parseArgs(['--start', '2026-09-01', '--dev', '--all']);
  const report = renderReport(records, options);

  assert.match(report, /5 attempts; 3 successful; 1 reruns/);
  assert.match(report, /1 failed; 1 cancelled; success rate: 75.0%/);
  assert.match(report, /CI\s+\| 2\s+\| 25s\s+\| 25s\s+\| 10s–40s/);
  const successes = renderReport(records, { ...options, outcome: 'success' });
  assert.match(successes, /3 attempts; 3 successful/);
  assert.doesNotMatch(successes, /success rate|failed|cancelled/);
  const failures = renderReport(records, { ...options, outcome: 'failures' });
  assert.match(failures, /1 attempts; 0 successful/);
  assert.match(failures, /Failed attempt timings \(may end early\):/);
  assert.match(failures, /CI\s+\| 1\s+\| 1s\s+\| 1s/);
  assert.doesNotMatch(failures, /Successful first-attempt timings|success rate|900s/);
});

test('collects paginated development jobs and attempts without including release PRs', async () => {
  const workflow = { id: 1, created_at: '2026-09-15T12:00:00Z', run_started_at: '2026-09-15T12:00:10Z',
    run_attempt: 2, conclusion: 'success', head_branch: 'feature', pull_requests: [] };
  const request = (endpoint: string): string => {
    if (endpoint.includes('/workflows/ci.yml/runs?')) return JSON.stringify([{ total_count: 2, workflow_runs: [
      workflow, { ...workflow, id: 2, head_branch: 'develop' },
    ] }]);
    if (endpoint.includes('/pulls?')) return JSON.stringify([[{
      number: 10, created_at: '2026-09-01T00:00:00Z', closed_at: '2026-09-20T00:00:00Z', head: { ref: 'feature' },
    }]]);
    if (endpoint.endsWith('/attempts/1')) return JSON.stringify({ ...workflow, conclusion: 'failure' });
    if (endpoint.endsWith('/attempts/1/jobs?per_page=100')) return JSON.stringify([{ jobs: [{
      id: 10, name: 'Tests', conclusion: 'failure', started_at: '2026-09-15T12:00:10Z', completed_at: '2026-09-15T12:00:20Z',
    }] }]);
    if (endpoint.endsWith('/attempts/2/jobs?per_page=100')) return JSON.stringify([
      { jobs: [{ id: 20, name: 'Backend', conclusion: 'success', started_at: '2026-09-15T12:00:30Z', completed_at: '2026-09-15T12:01:00Z' }] },
      { jobs: [{ id: 21, name: 'Frontend', conclusion: 'success', started_at: '2026-09-15T12:00:40Z', completed_at: '2026-09-15T12:01:10Z' }] },
    ]);
    throw new Error(`Unexpected request: ${endpoint}`);
  };
  const records = await collectHistory('example/project', parseArgs(['--start', '2026-09-01', '--dev', '--all']), request);

  assert.deepEqual(records.map(run => [run.runId, run.attempt, run.conclusion, run.durationSeconds, run.runnerSeconds]), [
    [1, 1, 'failure', 10, 10], [1, 2, 'success', 40, 60],
  ]);
  assert.equal(records[0].queueSeconds, 10);
  assert.equal(records[1].queueSeconds, null);
});

/** Returns API fixtures with a completed deployment job; logs may be unavailable before selection. */
function productionRequest(endpoint: string): string {
  if (endpoint.includes('/actions/runs?')) return JSON.stringify([{ total_count: 1, workflow_runs: [{
    id: 1, created_at: '2026-09-15T12:00:00Z', run_started_at: '2026-09-15T12:00:00Z',
    run_attempt: 1, conclusion: 'failure', head_branch: 'main', pull_requests: [],
  }] }]);
  if (endpoint.includes('/jobs?')) return JSON.stringify([{ jobs: [
    { id: 10, name: 'Other CI job', conclusion: 'failure', started_at: '2026-09-15T12:00:00Z', completed_at: '2026-09-15T12:05:00Z' },
    { id: 11, name: 'Deploy to Lightsail', conclusion: 'success', started_at: '2026-09-15T12:00:10Z', completed_at: '2026-09-15T12:00:40Z' },
  ] }]);
  if (endpoint.endsWith('/logs')) return 'Frontend: true\nBackend: false\nMigrations: false\nInfrastructure: false';
  throw new Error(`Unexpected request: ${endpoint}`);
}

test('production uses the deployment job outcome and duration, with components from its log', async () => {
  const options = parseArgs(['--start', '2026-09-01', '--main']);
  const records = await collectHistory('example/project', options, productionRequest);

  assert.equal(records[0].conclusion, 'success');
  assert.equal(records[0].durationSeconds, 30);
  assert.equal(records[0].group, 'frontend-only');
  assert.equal(records[0].runnerSeconds, undefined);
  assert.deepEqual(filterRuns(records, { ...options, types: ['frontend'], exclusive: true }), records);
});

test('missing deployment logs retain timings while authentication and query-limit failures stop the report', async () => {
  const options = parseArgs(['--start', '2026-09-01', '--main']);
  const records = await collectHistory('example/project', options, endpoint => {
    if (endpoint.endsWith('/logs')) throw new Error('Logs unavailable (HTTP 410)');
    return productionRequest(endpoint);
  });

  assert.equal(records[0].group, 'Unclassified');
  assert.equal(records[0].durationSeconds, 30);
  const filtered = renderReport(records, { ...options, types: ['frontend'] });
  assert.match(filtered, /1 attempts lack component details/);
  assert.match(filtered, /No completed attempts match/);
  await assert.rejects(collectHistory('example/project', options, () => {
    throw new Error('Authentication failed (HTTP 403)');
  }), /HTTP 403/);
  await assert.rejects(collectHistory('example/project', options, () => JSON.stringify([
    { total_count: 1001, workflow_runs: [] },
  ])), /narrower date range/);
});

test('help and invalid arguments finish before attempting GitHub access', () => {
  const script = fileURLToPath(new URL('./ci-history-report.ts', import.meta.url));
  const help = spawnSync(process.execPath, [script, '--help'], { env: { ...process.env, PATH: '' }, encoding: 'utf8' });
  const invalid = spawnSync(process.execPath, [script, '--file', 'unused'], { env: { ...process.env, PATH: '' }, encoding: 'utf8' });

  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /Usage:/);
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /Unknown option: --file/);
});
