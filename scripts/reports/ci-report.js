#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const CI_PATHS = [
  /^\.github\/workflows\//,
  /^scripts\/tests\//,
  /^scripts\/reports\/ci-report(?:\.test)?\.js$/,
  /^docs\/(architecture|operations)\/ci\.md$/,
  /^docs\/operations\/reports\.md$/,
  /^docs\/operations\/testing\.md$/,
  /(^|\/)package(-lock)?\.json$/,
  /(^|\/)vite\.config\.(js|ts)$/,
  /(^|\/)playwright\.config\.(js|ts)$/,
  /(^|\/)jest\.config\.(js|ts)$/,
];

function usage() {
  return `Usage: npm run report:ci -- [options]

Options:
  --branch <develop|main|all>  Base branch to analyze (default: all)
  --last <count>               Most recent merged PRs across selected branches (default: 5)
  --since <YYYY-MM-DD>         Analyze PRs merged on or after this UTC date
  --until <YYYY-MM-DD>         Analyze PRs merged on or before this UTC date (default: today)
  --json                       Emit machine-readable JSON
  --help                       Show this help

Examples:
  npm run report:ci
  npm run report:ci -- --branch develop --last 20
  npm run report:ci -- --since 2026-07-01 --until 2026-07-31
  npm run report:ci -- --since 2026-07-01 --json`;
}

export function parseArgs(argv) {
  const options = { branch: 'all', last: 5, since: null, until: null, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--help') return { ...options, help: true };
    if (argument === '--json') {
      options.json = true;
      continue;
    }
    if (!['--branch', '--last', '--since', '--until'].includes(argument)) {
      throw new Error(`Unknown option: ${argument}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`${argument} requires a value`);
    index += 1;
    if (argument === '--branch') options.branch = value;
    if (argument === '--last') options.last = Number(value);
    if (argument === '--since') options.since = value;
    if (argument === '--until') options.until = value;
  }
  if (!['develop', 'main', 'all'].includes(options.branch)) {
    throw new Error('--branch must be develop, main, or all');
  }
  if (!Number.isInteger(options.last) || options.last < 1) {
    throw new Error('--last must be a positive integer');
  }
  for (const [name, value] of [['--since', options.since], ['--until', options.until]]) {
    if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`)))) {
      throw new Error(`${name} must use a valid YYYY-MM-DD date`);
    }
  }
  if (options.since && options.until && options.since > options.until) {
    throw new Error('--since must not be after --until');
  }
  return options;
}

export function isCiPath(filename) {
  return CI_PATHS.some((pattern) => pattern.test(filename));
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
  if (result.error) throw new Error(`Could not run ${command}: ${result.error.message}`);
  if (result.status !== 0) throw new Error(result.stderr.trim() || `${command} exited ${result.status}`);
  return result.stdout.trim();
}

function ghJson(endpoint, fields = [], paginate = true) {
  const args = ['api'];
  if (paginate) args.push('--paginate', '--slurp');
  args.push('-X', 'GET', endpoint);
  for (const [name, value] of fields) args.push('-f', `${name}=${value}`);
  const output = run('gh', args);
  if (!output) return [];
  const parsed = JSON.parse(output);
  return paginate ? parsed : [parsed];
}

function flattenPages(pages, key = null) {
  return pages.flatMap((page) => (key ? page[key] ?? [] : page));
}

function repositoryName() {
  const remote = run('git', ['remote', 'get-url', 'origin']);
  const match = remote.match(/github\.com[/:]([^/]+\/[^/.]+)(?:\.git)?$/);
  if (!match) throw new Error(`Could not derive GitHub repository from origin: ${remote}`);
  return match[1];
}

function utcBounds(options) {
  const untilDay = options.until ?? new Date().toISOString().slice(0, 10);
  return {
    since: options.since ? `${options.since}T00:00:00Z` : null,
    until: `${untilDay}T23:59:59Z`,
  };
}

function inBounds(timestamp, bounds) {
  return (!bounds.since || timestamp >= bounds.since) && timestamp <= bounds.until;
}

function issueNumbers(body = '') {
  const numbers = new Set();
  const pattern = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)/gi;
  for (const match of body.matchAll(pattern)) numbers.add(Number(match[1]));
  return [...numbers];
}

function durationSeconds(start, end) {
  if (!start || !end) return null;
  return Math.max(0, (Date.parse(end) - Date.parse(start)) / 1000);
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function mean(values) {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
}

export function summarizeRuns(runs, pullRequestCount = null) {
  const rerunPullRequests = new Set(runs.filter((run) => run.attempt > 1).map((run) => run.prNumber));
  const primary = runs.filter(
    (run) => run.attempt === 1 && run.conclusion !== 'cancelled' && !rerunPullRequests.has(run.prNumber),
  );
  const grouped = Map.groupBy(primary, (run) => run.prNumber);
  const pipelines = [...grouped.entries()].map(([prNumber, prRuns]) => {
    const starts = prRuns.map((run) => Date.parse(run.startedAt)).filter(Number.isFinite);
    const completions = prRuns.map((run) => Date.parse(run.completedAt)).filter(Number.isFinite);
    const creations = prRuns.map((run) => Date.parse(run.createdAt)).filter(Number.isFinite);
    const firstStart = Math.min(...starts);
    return {
      prNumber,
      conclusion: prRuns.every((run) => run.conclusion === 'success') ? 'success' : 'failure',
      queueSeconds: (firstStart - Math.min(...creations)) / 1000,
      wallSeconds: (Math.max(...completions) - firstStart) / 1000,
      runnerSeconds: prRuns.reduce((total, run) => total + run.runnerSeconds, 0),
    };
  });
  const successful = pipelines.filter((pipeline) => pipeline.conclusion === 'success');
  const values = (field) => successful.map((pipeline) => pipeline[field]).filter(Number.isFinite);
  const queue = values('queueSeconds');
  const wall = values('wallSeconds');
  const runner = values('runnerSeconds');
  return {
    pullRequests: pullRequestCount ?? new Set(runs.map((run) => run.prNumber)).size,
    pipelines: pipelines.length,
    successfulPipelines: successful.length,
    failedPipelines: pipelines.filter((pipeline) => pipeline.conclusion === 'failure').length,
    workflowRuns: primary.length,
    reruns: runs.filter((run) => run.attempt > 1).length,
    successRate: pipelines.length ? successful.length / pipelines.length : null,
    queueSeconds: { median: median(queue), mean: mean(queue) },
    wallSeconds: { median: median(wall), mean: mean(wall) },
    runnerSeconds: { median: median(runner), mean: mean(runner) },
  };
}

function pullRequests(repo, branches, options, bounds) {
  const records = branches.flatMap((branch) => {
    const pages = ghJson(`repos/${repo}/pulls`, [
      ['state', 'closed'], ['base', branch], ['sort', 'updated'], ['direction', 'desc'], ['per_page', '100'],
    ], Boolean(options.since));
    return flattenPages(pages)
      .filter((pr) => pr.merged_at && inBounds(pr.merged_at, bounds))
      .map((pr) => ({
        number: pr.number,
        title: pr.title,
        body: pr.body ?? '',
        branch,
        createdAt: pr.created_at,
        headBranch: pr.head.ref,
        headCommit: pr.head.sha,
        mergedAt: pr.merged_at,
        url: pr.html_url,
        commit: pr.merge_commit_sha,
      }));
  });
  records.sort((left, right) => left.mergedAt.localeCompare(right.mergedAt));
  return options.since ? records : records.slice(-options.last);
}

function enrichPullRequests(repo, prs) {
  return prs.map((pr) => {
    const files = flattenPages(ghJson(`repos/${repo}/pulls/${pr.number}/files`, [['per_page', '100']]))
      .map((file) => file.filename);
    return {
      ...pr,
      issues: issueNumbers(pr.body),
      ciFiles: files.filter(isCiPath),
    };
  });
}

function workflowRuns(repo, prs, bounds) {
  if (!prs.length) return [];
  const firstRunDate = prs.map((pr) => pr.createdAt).sort()[0];
  const created = `${firstRunDate.slice(0, 10)}..${bounds.until.slice(0, 10)}`;
  const pages = ghJson(`repos/${repo}/actions/runs`, [
    ['event', 'pull_request'], ['created', created], ['per_page', '100'],
  ]);
  const selected = new Map(prs.map((pr) => [pr.number, pr]));
  return flattenPages(pages, 'workflow_runs').flatMap((runRecord) => {
    const pr = runRecord.pull_requests?.map(({ number }) => selected.get(number)).find(Boolean)
      ?? prs.find((candidate) => candidate.headCommit === runRecord.head_sha)
      ?? prs.find((candidate) => (
        candidate.headBranch === runRecord.head_branch
        && runRecord.created_at >= candidate.createdAt
        && runRecord.created_at <= candidate.mergedAt
      ));
    if (!pr) return [];
    const jobs = flattenPages(ghJson(`repos/${repo}/actions/runs/${runRecord.id}/jobs`, [['per_page', '100']]), 'jobs');
    const started = jobs.map((job) => job.started_at).filter(Boolean).sort()[0] ?? runRecord.run_started_at;
    const completed = jobs.map((job) => job.completed_at).filter(Boolean).sort().at(-1) ?? runRecord.updated_at;
    const runnerSeconds = jobs.reduce(
      (total, job) => total + (durationSeconds(job.started_at, job.completed_at) ?? 0),
      0,
    );
    return [{
      id: runRecord.id,
      workflow: runRecord.name,
      url: runRecord.html_url,
      prNumber: pr.number,
      branch: pr.branch,
      attempt: runRecord.run_attempt ?? 1,
      conclusion: runRecord.conclusion,
      createdAt: runRecord.created_at,
      startedAt: started,
      completedAt: completed,
      queueSeconds: durationSeconds(runRecord.created_at, started),
      wallSeconds: durationSeconds(started, completed),
      runnerSeconds,
    }];
  });
}

export function buildSegments(prs, runs) {
  if (!prs.length) return [];
  const changes = prs.filter((pr) => pr.ciFiles.length);
  const boundaries = [prs[0].mergedAt, ...changes.map((pr) => pr.mergedAt), prs.at(-1).mergedAt];
  const segments = [];
  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const start = boundaries[index];
    const end = boundaries[index + 1];
    const includeEnd = index === boundaries.length - 2;
    const segmentPrs = prs.filter((pr) => pr.mergedAt >= start && (includeEnd ? pr.mergedAt <= end : pr.mergedAt < end));
    if (segmentPrs.length) {
      const numbers = new Set(segmentPrs.map((pr) => pr.number));
      segments.push({
        start: segmentPrs[0].mergedAt,
        end: segmentPrs.at(-1).mergedAt,
        pullRequests: segmentPrs.map((pr) => pr.number),
        summary: summarizeRuns(runs.filter((run) => numbers.has(run.prNumber)), segmentPrs.length),
      });
    }
    const change = changes.find((pr) => pr.mergedAt === end);
    if (change) segments.push({ change });
  }
  if (boundaries.length === 2 && !segments.length) {
    segments.push({
      start: prs[0].mergedAt,
      end: prs.at(-1).mergedAt,
      pullRequests: prs.map((pr) => pr.number),
      summary: summarizeRuns(runs, prs.length),
    });
  }
  return segments;
}

function seconds(value) {
  if (!Number.isFinite(value)) return 'n/a';
  const rounded = Math.round(value);
  return rounded >= 60 ? `${Math.floor(rounded / 60)}m ${rounded % 60}s` : `${rounded}s`;
}

function percent(value) {
  return Number.isFinite(value) ? `${Math.round(value * 100)}%` : 'n/a';
}

function renderSummary(summary) {
  return `${summary.pullRequests} PRs; ${summary.successfulPipelines}/${summary.pipelines} successful pipelines (${percent(summary.successRate)}); `
    + `median queue ${seconds(summary.queueSeconds.median)}, wall ${seconds(summary.wallSeconds.median)}, `
    + `runner ${seconds(summary.runnerSeconds.median)}; ${summary.reruns} reruns`;
}

function date(timestamp) {
  return timestamp.slice(0, 10);
}

function render(report) {
  const lines = [
    `CI report: ${report.range.start} through ${report.range.end}`,
    `Repository: ${report.repository}`,
    `Branches: ${report.branches.join(', ')}`,
    '',
    `Overall: ${renderSummary(report.summary)}`,
    '',
    'Timeline',
  ];
  for (const segment of report.segments) {
    if (segment.change) {
      const issues = segment.change.issues.length ? `; issues ${segment.change.issues.map((number) => `#${number}`).join(', ')}` : '';
      lines.push(`${date(segment.change.mergedAt)} — CI change: #${segment.change.number} ${segment.change.title}${issues}`);
      lines.push(`  ${segment.change.url}`);
      lines.push(`  Files: ${segment.change.ciFiles.join(', ')}`);
    } else {
      lines.push(`${date(segment.start)} through ${date(segment.end)} — ${renderSummary(segment.summary)}`);
    }
  }
  lines.push('', 'Pull requests');
  for (const pr of report.pullRequests) {
    const marker = pr.ciFiles.length ? ' [CI change]' : '';
    lines.push(`${date(pr.mergedAt)} ${pr.branch} #${pr.number}${marker} ${pr.title} (${pr.commit.slice(0, 7)})`);
  }
  lines.push('', 'Notes: successful first attempts drive timing medians; cancelled runs are excluded; reruns are disclosed separately.');
  lines.push('Runner time is the sum of job execution durations and can rise when parallelism lowers wall time.');
  return lines.join('\n');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }
  const repo = repositoryName();
  const branches = options.branch === 'all' ? ['develop', 'main'] : [options.branch];
  const bounds = utcBounds(options);
  const prs = enrichPullRequests(repo, pullRequests(repo, branches, options, bounds));
  const runs = workflowRuns(repo, prs, bounds);
  const report = {
    repository: repo,
    branches,
    range: {
      start: options.since ?? (prs[0]?.mergedAt.slice(0, 10) ?? bounds.until.slice(0, 10)),
      end: options.until ?? bounds.until.slice(0, 10),
    },
    summary: summarizeRuns(runs, prs.length),
    segments: buildSegments(prs, runs),
    pullRequests: prs,
    workflowRuns: runs,
  };
  console.log(options.json ? JSON.stringify(report, null, 2) : render(report));
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  main().catch((error) => {
    console.error(`ci-report: ${error.message}`);
    process.exitCode = 1;
  });
}
