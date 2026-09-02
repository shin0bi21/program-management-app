#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

type GhField = [name: string, value: string];

export interface ReportOptions {
  branch: string;
  last: number;
  since: string | null;
  until: string | null;
  json: boolean;
  help?: boolean;
}

interface UtcBounds {
  since: string | null;
  until: string;
}

export interface ComparableRun {
  prNumber: number;
  attempt: number;
  conclusion: string | null;
  createdAt: string;
  startedAt: string;
  completedAt: string;
  runnerSeconds: number;
}

interface WorkflowRun extends ComparableRun {
  id: number;
  workflow: string;
  url: string;
  branch: string;
  queueSeconds: number | null;
  wallSeconds: number | null;
}

interface MetricSummary {
  median: number | null;
  mean: number | null;
}

export interface RunSummary {
  pullRequests: number;
  pipelines: number;
  successfulPipelines: number;
  failedPipelines: number;
  workflowRuns: number;
  reruns: number;
  successRate: number | null;
  queueSeconds: MetricSummary;
  wallSeconds: MetricSummary;
  runnerSeconds: MetricSummary;
}

interface PullRequestRecord {
  number: number;
  title: string;
  body: string;
  branch: string;
  createdAt: string;
  headBranch: string;
  headCommit: string;
  mergedAt: string;
  url: string;
  commit: string;
}

interface EnrichedPullRequest extends PullRequestRecord {
  issues: number[];
  ciFiles: string[];
}

interface SegmentPullRequest {
  number: number;
  mergedAt: string;
  ciFiles: string[];
}

export type ReportSegment<T extends SegmentPullRequest = EnrichedPullRequest> =
  | { change: T; start?: never; end?: never; pullRequests?: never; summary?: never }
  | { change?: never; start: string; end: string; pullRequests: number[]; summary: RunSummary };

interface CiReport {
  repository: string;
  branches: string[];
  range: { start: string; end: string };
  summary: RunSummary;
  segments: ReportSegment<EnrichedPullRequest>[];
  pullRequests: EnrichedPullRequest[];
  workflowRuns: WorkflowRun[];
}

interface ApiPullRequest {
  number: number;
  title: string;
  body: string | null;
  merged_at: string | null;
  created_at: string;
  html_url: string;
  merge_commit_sha: string;
  head: { ref: string; sha: string };
}

interface ApiWorkflowRun {
  id: number;
  name: string;
  html_url: string;
  head_sha: string;
  head_branch: string;
  run_attempt?: number;
  conclusion: string | null;
  created_at: string;
  run_started_at: string;
  updated_at: string;
  pull_requests?: Array<{ number: number }>;
}

interface ApiJob {
  started_at: string | null;
  completed_at: string | null;
}

const CI_PATHS = [
  /^\.github\/workflows\//,
  /^scripts\/tests\//,
  /^scripts\/reports\/ci-report(?:\.test)?\.ts$/,
  /^docs\/workflows\/(ci|reports|testing)\.md$/,
  /(^|\/)package(-lock)?\.json$/,
  /(^|\/)vite\.config\.(js|ts)$/,
  /(^|\/)playwright\.config\.(js|ts)$/,
  /(^|\/)jest\.config\.(js|ts)$/,
];

function usage(): string {
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

export function parseArgs(argv: string[]): ReportOptions {
  const options: ReportOptions = { branch: 'all', last: 5, since: null, until: null, json: false };
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

export function isCiPath(filename: string): boolean {
  return CI_PATHS.some((pattern) => pattern.test(filename));
}

function run(command: string, args: string[]): string {
  const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
  if (result.error) throw new Error(`Could not run ${command}: ${result.error.message}`);
  if (result.status !== 0) throw new Error(result.stderr.trim() || `${command} exited ${result.status}`);
  return result.stdout.trim();
}

function ghJson(endpoint: string, fields: GhField[] = [], paginate = true): unknown[] {
  const args = ['api'];
  if (paginate) args.push('--paginate', '--slurp');
  args.push('-X', 'GET', endpoint);
  for (const [name, value] of fields) args.push('-f', `${name}=${value}`);
  const output = run('gh', args);
  if (!output) return [];
  const parsed: unknown = JSON.parse(output);
  if (paginate) {
    if (!Array.isArray(parsed)) throw new Error(`Unexpected paginated response from ${endpoint}`);
    return parsed;
  }
  return [parsed];
}

function flattenPages<T>(pages: unknown[], key: string | null = null): T[] {
  return pages.flatMap((page): T[] => {
    if (key) {
      if (!page || typeof page !== 'object') return [];
      const value = (page as Record<string, unknown>)[key];
      return Array.isArray(value) ? value as T[] : [];
    }
    return Array.isArray(page) ? page as T[] : [page as T];
  });
}

function repositoryName(): string {
  const remote = run('git', ['remote', 'get-url', 'origin']);
  const match = remote.match(/github\.com[/:]([^/]+\/[^/.]+)(?:\.git)?$/);
  if (!match) throw new Error(`Could not derive GitHub repository from origin: ${remote}`);
  return match[1];
}

function utcBounds(options: ReportOptions): UtcBounds {
  const untilDay = options.until ?? new Date().toISOString().slice(0, 10);
  return {
    since: options.since ? `${options.since}T00:00:00Z` : null,
    until: `${untilDay}T23:59:59Z`,
  };
}

function inBounds(timestamp: string, bounds: UtcBounds): boolean {
  return (!bounds.since || timestamp >= bounds.since) && timestamp <= bounds.until;
}

function issueNumbers(body = ''): number[] {
  const numbers = new Set<number>();
  const pattern = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)/gi;
  for (const match of body.matchAll(pattern)) numbers.add(Number(match[1]));
  return [...numbers];
}

function durationSeconds(start: string | null | undefined, end: string | null | undefined): number | null {
  if (!start || !end) return null;
  return Math.max(0, (Date.parse(end) - Date.parse(start)) / 1000);
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function mean(values: number[]): number | null {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
}

export function summarizeRuns(runs: ComparableRun[], pullRequestCount: number | null = null): RunSummary {
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
  const values = (field: 'queueSeconds' | 'wallSeconds' | 'runnerSeconds') => (
    successful.map((pipeline) => pipeline[field]).filter(Number.isFinite)
  );
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

function pullRequests(repo: string, branches: string[], options: ReportOptions, bounds: UtcBounds): PullRequestRecord[] {
  const records = branches.flatMap((branch) => {
    const pages = ghJson(`repos/${repo}/pulls`, [
      ['state', 'closed'], ['base', branch], ['sort', 'updated'], ['direction', 'desc'], ['per_page', '100'],
    ], Boolean(options.since));
    return flattenPages<ApiPullRequest>(pages)
      .filter((pr): pr is ApiPullRequest & { merged_at: string } => Boolean(pr.merged_at) && inBounds(pr.merged_at as string, bounds))
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

function enrichPullRequests(repo: string, prs: PullRequestRecord[]): EnrichedPullRequest[] {
  return prs.map((pr) => {
    const files = flattenPages<{ filename: string }>(ghJson(`repos/${repo}/pulls/${pr.number}/files`, [['per_page', '100']]))
      .map((file) => file.filename);
    return {
      ...pr,
      issues: issueNumbers(pr.body),
      ciFiles: files.filter(isCiPath),
    };
  });
}

function workflowRuns(repo: string, prs: EnrichedPullRequest[], bounds: UtcBounds): WorkflowRun[] {
  if (!prs.length) return [];
  const firstRunDate = prs.map((pr) => pr.createdAt).sort()[0];
  const created = `${firstRunDate.slice(0, 10)}..${bounds.until.slice(0, 10)}`;
  const pages = ghJson(`repos/${repo}/actions/runs`, [
    ['event', 'pull_request'], ['created', created], ['per_page', '100'],
  ]);
  const selected = new Map(prs.map((pr) => [pr.number, pr]));
  return flattenPages<ApiWorkflowRun>(pages, 'workflow_runs').flatMap((runRecord): WorkflowRun[] => {
    const pr = runRecord.pull_requests?.map(({ number }) => selected.get(number)).find(Boolean)
      ?? prs.find((candidate) => candidate.headCommit === runRecord.head_sha)
      ?? prs.find((candidate) => (
        candidate.headBranch === runRecord.head_branch
        && runRecord.created_at >= candidate.createdAt
        && runRecord.created_at <= candidate.mergedAt
      ));
    if (!pr) return [];
    const jobs = flattenPages<ApiJob>(ghJson(`repos/${repo}/actions/runs/${runRecord.id}/jobs`, [['per_page', '100']]), 'jobs');
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

export function buildSegments<T extends SegmentPullRequest>(prs: T[], runs: ComparableRun[]): ReportSegment<T>[] {
  if (!prs.length) return [];
  const changes = prs.filter((pr) => pr.ciFiles.length);
  const boundaries = [prs[0]!.mergedAt, ...changes.map((pr) => pr.mergedAt), prs.at(-1)!.mergedAt];
  const segments: ReportSegment<T>[] = [];
  for (let index = 0; index < boundaries.length - 1; index += 1) {
    const start = boundaries[index];
    const end = boundaries[index + 1];
    const includeEnd = index === boundaries.length - 2;
    const segmentPrs = prs.filter((pr) => pr.mergedAt >= start && (includeEnd ? pr.mergedAt <= end : pr.mergedAt < end));
    if (segmentPrs.length) {
      const numbers = new Set(segmentPrs.map((pr) => pr.number));
      segments.push({
        start: segmentPrs[0].mergedAt,
        end: segmentPrs.at(-1)!.mergedAt,
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
      end: prs.at(-1)!.mergedAt,
      pullRequests: prs.map((pr) => pr.number),
      summary: summarizeRuns(runs, prs.length),
    });
  }
  return segments;
}

function seconds(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'n/a';
  const rounded = Math.round(value);
  return rounded >= 60 ? `${Math.floor(rounded / 60)}m ${rounded % 60}s` : `${rounded}s`;
}

function percent(value: number | null): string {
  return value !== null && Number.isFinite(value) ? `${Math.round(value * 100)}%` : 'n/a';
}

function renderSummary(summary: RunSummary): string {
  return `${summary.pullRequests} PRs; ${summary.successfulPipelines}/${summary.pipelines} successful pipelines (${percent(summary.successRate)}); `
    + `median queue ${seconds(summary.queueSeconds.median)}, wall ${seconds(summary.wallSeconds.median)}, `
    + `runner ${seconds(summary.runnerSeconds.median)}; ${summary.reruns} reruns`;
}

function date(timestamp: string): string {
  return timestamp.slice(0, 10);
}

function render(report: CiReport): string {
  const lines: string[] = [
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

async function main(): Promise<void> {
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
  const report: CiReport = {
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
  main().catch((error: unknown) => {
    console.error(`ci-report: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
