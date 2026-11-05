import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildSegments, isCiPath, parseArgs, summarizeRuns } from './ci-report.ts';

test('parses recent and date-range options', () => {
  assert.deepEqual(parseArgs([]), { branch: 'all', last: 5, since: null, until: null, json: false });
  assert.deepEqual(parseArgs(['--branch', 'develop', '--since', '2026-08-01', '--json']), {
    branch: 'develop', last: 5, since: '2026-08-01', until: null, json: true,
  });
  assert.throws(() => parseArgs(['--branch', 'production']), /develop, main, or all/);
  assert.throws(() => parseArgs(['--since', '2026-19-40']), /valid YYYY-MM-DD/);
});

test('classifies CI ownership paths without treating application code as CI', () => {
  assert.equal(isCiPath('.github/workflows/ci.yml'), true);
  assert.equal(isCiPath('scripts/tests/frontend/test-ui.sh'), true);
  assert.equal(isCiPath('scripts/reports/ci-report.ts'), true);
  assert.equal(isCiPath('docs/workflows/ci.md'), true);
  assert.equal(isCiPath('docs/workflows/reports.md'), true);
  assert.equal(isCiPath('docs/workflows/testing.md'), true);
  assert.equal(isCiPath('docs/workflows/delivery/ci.md'), true);
  assert.equal(isCiPath('docs/workflows/delivery/reports.md'), true);
  assert.equal(isCiPath('docs/workflows/delivery/testing.md'), true);
  assert.equal(isCiPath('docs/workflows/local-development/setup.md'), false);
  assert.equal(isCiPath('docs/backend/database.md'), false);
  assert.equal(isCiPath('frontend/package-lock.json'), true);
  assert.equal(isCiPath('frontend/src/App.tsx'), false);
});

test('summaries exclude cancelled runs and reruns from comparable timing', () => {
  const summary = summarizeRuns([
    { prNumber: 1, attempt: 1, conclusion: 'success', createdAt: '2026-01-01T00:00:00Z', startedAt: '2026-01-01T00:00:10Z', completedAt: '2026-01-01T00:01:50Z', runnerSeconds: 200 },
    { prNumber: 1, attempt: 1, conclusion: 'success', createdAt: '2026-01-01T00:00:00Z', startedAt: '2026-01-01T00:00:15Z', completedAt: '2026-01-01T00:02:10Z', runnerSeconds: 50 },
    { prNumber: 2, attempt: 1, conclusion: 'success', createdAt: '2026-01-01T00:00:00Z', startedAt: '2026-01-01T00:00:20Z', completedAt: '2026-01-01T00:03:40Z', runnerSeconds: 400 },
    { prNumber: 2, attempt: 2, conclusion: 'success', createdAt: '2026-01-01T00:00:00Z', startedAt: '2026-01-01T00:00:01Z', completedAt: '2026-01-01T00:00:02Z', runnerSeconds: 1 },
    { prNumber: 3, attempt: 1, conclusion: 'cancelled', createdAt: '2026-01-01T00:00:00Z', startedAt: '2026-01-01T00:00:01Z', completedAt: '2026-01-01T00:16:40Z', runnerSeconds: 999 },
  ]);

  assert.equal(summary.pullRequests, 3);
  assert.equal(summary.pipelines, 1);
  assert.equal(summary.reruns, 1);
  assert.equal(summary.wallSeconds.median, 120);
  assert.equal(summary.runnerSeconds.median, 250);
});

test('CI-changing pull requests become timeline boundaries', () => {
  const prs = [
    { number: 1, mergedAt: '2026-08-01T12:00:00Z', ciFiles: [] },
    { number: 2, mergedAt: '2026-08-02T12:00:00Z', ciFiles: ['.github/workflows/ci.yml'] },
    { number: 3, mergedAt: '2026-08-03T12:00:00Z', ciFiles: [] },
  ];
  const runs = prs.map((pr) => ({
    prNumber: pr.number,
    attempt: 1,
    conclusion: 'success',
    createdAt: '2026-08-01T00:00:00Z',
    startedAt: '2026-08-01T00:00:01Z',
    completedAt: '2026-08-01T00:00:03Z',
    runnerSeconds: 3,
  }));
  const segments = buildSegments(prs, runs);

  assert.deepEqual(segments.map((segment) => segment.change?.number ?? segment.pullRequests), [[1], 2, [2, 3]]);
});

test('rejects impossible dates and incomplete or conflicting options', () => {
  for (const args of [
    ['--since', '2026-02-30'], ['--until', '2025-02-29'], ['--last', '0'],
    ['--last', '1.5'], ['--last'], ['--unknown'],
    ['--since', '2026-09-30', '--until', '2026-09-01'],
  ]) {
    assert.throws(() => parseArgs(args));
  }
  assert.equal(parseArgs(['--since', '2024-02-29']).since, '2024-02-29');
});

test('reports empty and failed samples without inventing successful timings', () => {
  const empty = summarizeRuns([], 3);
  const failed = summarizeRuns([{
    prNumber: 1, attempt: 1, conclusion: 'failure', runnerSeconds: 30,
    createdAt: '2026-01-01T00:00:00Z', startedAt: '2026-01-01T00:00:10Z',
    completedAt: '2026-01-01T00:00:40Z',
  }]);

  assert.equal(empty.pullRequests, 3);
  assert.equal(empty.successRate, null);
  assert.deepEqual(empty.wallSeconds, { mean: null, median: null });
  assert.equal(failed.failedPipelines, 1);
  assert.equal(failed.successRate, 0);
  assert.deepEqual(failed.wallSeconds, { mean: null, median: null });
});

test('emits first, last, and tied CI changes once while grouping each PR once', () => {
  const prs = [
    { number: 1, mergedAt: '2026-08-01T12:00:00Z', ciFiles: ['ci.yml'] },
    { number: 2, mergedAt: '2026-08-01T12:00:00Z', ciFiles: ['ci.yml'] },
    { number: 3, mergedAt: '2026-08-02T12:00:00Z', ciFiles: ['ci.yml'] },
  ];

  const segments = buildSegments(prs, []);

  assert.deepEqual(segments.flatMap(segment => segment.change ? [segment.change.number] : []), [1, 2, 3]);
  assert.deepEqual(segments.flatMap(segment => segment.pullRequests ?? []), [1, 2, 3]);
  assert.deepEqual(buildSegments([], []), []);
  assert.deepEqual(buildSegments([prs[0]], []).map(segment => segment.change?.number ?? segment.pullRequests), [1, [1]]);
});

test('CLI handles help and invalid arguments without GitHub access', () => {
  const script = fileURLToPath(new URL('./ci-report.ts', import.meta.url));
  const help = spawnSync(process.execPath, [script, '--help'], { encoding: 'utf8' });
  const invalid = spawnSync(process.execPath, [script, '--last', '0'], { encoding: 'utf8' });

  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /Usage:/);

  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /positive integer/);
});

test('CLI collects paginated GitHub data and renders JSON without remote access', (context) => {
  const root = mkdtempSync(join(tmpdir(), 'ci-report-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  execFileSync('git', ['init', '--quiet'], { cwd: root });
  execFileSync('git', ['remote', 'add', 'origin', 'https://github.com/example/project.git'], { cwd: root });
  const pr = {
    number: 1, title: 'Example', body: '', merged_at: '2026-08-02T12:00:00Z',
    created_at: '2026-08-01T12:00:00Z', html_url: 'https://github.com/example/project/pull/1',
    merge_commit_sha: 'abc1234', head: { ref: 'feature', sha: 'abc1234' },
  };
  const github = `#!${process.execPath}
const args = process.argv.slice(2);
if (!args.includes('--paginate') || !args.includes('--slurp')) process.exit(1);
const endpoint = args[args.indexOf('GET') + 1];
if (endpoint.endsWith('/pulls')) console.log(JSON.stringify([[${JSON.stringify(pr)}]]));
else if (endpoint.endsWith('/files')) console.log('[[]]');
else if (endpoint.endsWith('/actions/runs')) console.log('[{"workflow_runs":[]}]');
else process.exit(2);
`;
  writeFileSync(join(root, 'gh'), github, { mode: 0o755 });
  const script = fileURLToPath(new URL('./ci-report.ts', import.meta.url));

  const result = spawnSync(process.execPath, [script, '--branch', 'develop', '--until', '2026-08-31', '--json'], {
    cwd: root, env: { ...process.env, PATH: `${root}:${process.env.PATH}` }, encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.repository, 'example/project');
  assert.equal(report.summary.pullRequests, 1);
  assert.equal(report.pullRequests[0].number, 1);
  assert.equal(report.summary.pipelines, 0);
});
