import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { filterRuns, loadHistory, parseArgs, renderReport } from './ci-history-report.ts';

type History = ReturnType<typeof loadHistory>;
type Run = History['runs'][number];

/** Creates a development attempt; run({ conclusion: 'failure' }) overrides its successful default. */
function run(overrides: Partial<Run> = {}): Run {
  return {
    runId: 1, branch: 'dev', group: 'CI', attempt: 1, conclusion: 'success',
    startedAt: '2026-09-15T12:00:00Z', durationSeconds: 30,
    queueSeconds: 2, runnerSeconds: 60, ...overrides,
  };
}

/** Wraps attempts with complete coverage; history([run()]) creates one successful attempt. */
function history(runs: Run[]): History {
  const coverage = { start: '2026-09-01T00:00:00Z', end: '2026-09-30T23:59:59Z', completeOutcomes: true };
  return { capturedAt: '2026-10-01T00:00:00Z', coverage: { dev: { ...coverage }, main: { ...coverage } }, runs };
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
  const dev = run({ startedAt: '2026-09-30T23:30:00-04:00' });
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
  const report = renderReport(history(records), options);

  assert.match(report, /5 attempts; 3 successful; 1 reruns/);
  assert.match(report, /1 failed; 1 cancelled; success rate: 75.0%/);
  assert.match(report, /CI\s+\| 2\s+\| 25s\s+\| 25s\s+\| 10s–40s/);
  const successes = renderReport(history(records), { ...options, outcome: 'success' });
  assert.match(successes, /3 attempts; 3 successful/);
  assert.doesNotMatch(successes, /success rate|failed|cancelled/);
  const failures = renderReport(history(records), { ...options, outcome: 'failures' });
  assert.match(failures, /1 attempts; 0 successful/);
  assert.match(failures, /Failed attempt timings \(may end early\):/);
  assert.match(failures, /CI\s+\| 1\s+\| 1s\s+\| 1s/);
  assert.doesNotMatch(failures, /Successful first-attempt timings|success rate|900s/);
});

test('shows saved coverage and does not invent a production success rate or missing timings', () => {
  const saved = history([run({ branch: 'main', group: 'frontend-only', queueSeconds: null, runnerSeconds: null,
    flags: { frontend: true, backend: false, migrations: false, infrastructure: false } })]);
  saved.coverage.main.completeOutcomes = false;
  const report = renderReport(saved, parseArgs(['--start', '2026-09-01', '--main', '--all']));

  assert.match(report, /Available: 2026-09-01T00:00:00Z → 2026-09-30T23:59:59Z/);
  assert.match(report, /success rate: unavailable \(saved successes only\)/);
  assert.doesNotMatch(report, /Queue median|Runner median|100.0%/);
  assert.match(renderReport(saved, parseArgs(['--start', '2026-10-01', '--main'])), /No saved attempts match/);
});

test('CLI reads local history without external commands and rejects malformed or duplicate attempts', context => {
  const root = mkdtempSync(join(tmpdir(), 'ci-history-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const file = join(root, 'history.json');
  const script = fileURLToPath(new URL('./ci-history-report.ts', import.meta.url));
  writeFileSync(file, JSON.stringify(history([run()])));

  const result = spawnSync(process.execPath, [script, '--file', file, '--start', '2026-09-01', '--dev'], {
    env: { ...process.env, PATH: '' }, encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Development PR checks/);
  for (const saved of [null, {}, history([run({ durationSeconds: -1 })]),
    history([run({ startedAt: '2026-02-30T00:00:00Z' })]), history([run(), run()])]) {
    writeFileSync(file, JSON.stringify(saved));
    assert.throws(() => loadHistory(file), /Invalid|Duplicate/);
  }
  const missing = spawnSync(process.execPath, [script, '--start', '2026-09-01', '--file', join(root, 'missing')], { encoding: 'utf8' });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /ENOENT/);
});
