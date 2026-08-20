import assert from 'node:assert/strict';
import test from 'node:test';

import { buildSegments, isCiPath, parseArgs, summarizeRuns } from './ci-report.js';

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
  assert.equal(isCiPath('scripts/reports/ci-report.js'), true);
  assert.equal(isCiPath('docs/workflows/ci.md'), true);
  assert.equal(isCiPath('docs/workflows/reports.md'), true);
  assert.equal(isCiPath('docs/workflows/testing.md'), true);
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
