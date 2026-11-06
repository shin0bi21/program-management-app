#!/usr/bin/env node

/**
 * Summarize completed GitHub development checks and production deployments in the CLI.
 * Flow: validate options → query completed runs and jobs → filter attempts → print timings.
 * Read-only. Usage: npm run report:ci-history -- --start 2026-08-09 --main --success
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

// 1. History and CLI contracts

type Branch = 'dev' | 'main';
type Component = 'frontend' | 'backend' | 'migrations' | 'infrastructure';

interface Run {
  runId: number;
  branch: Branch;
  group: string;
  attempt: number;
  conclusion: string;
  createdAt: string;
  durationSeconds: number;
  queueSeconds?: number | null;
  runnerSeconds?: number | null;
  flags?: Record<Component, boolean>;
}

interface Options {
  branch: Branch | null;
  start: string;
  end: string;
  outcome: 'success' | 'failures' | 'all';
  types: Component[];
  exclusive: boolean;
  help: boolean;
}

const COMPONENTS: Component[] = ['frontend', 'backend', 'migrations', 'infrastructure'];
const execute = promisify(execFile);

const HELP = `Usage: npm run report:ci-history -- --start YYYY-MM-DD [options]

  --start YYYY-MM-DD  Required inclusive start date (UTC).
  --end YYYY-MM-DD    Inclusive end date; defaults to now.
  --dev              Development PR checks only.
  --main             Production deployments only; default shows both views.
  --success          Successful attempts only (default).
  --failures         Failed attempts only; excludes cancellations.
  --all              All outcomes, including cancellations.
  --type COMPONENT   Deployment component; repeat to require multiple components.
  --exclusive        Require exactly the selected component combination.
  --help             Show this help.

Components: frontend, backend, migrations, infrastructure. Component filters require --main.`;

// 2. Argument and history validation

/** Recognizes real UTC calendar dates; for example, 2024-02-29 is valid. */
function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString().slice(0, 10) === value;
}

/** Parses options such as --start 2026-09-01 --dev; missing --start throws except with --help. */
export function parseArgs(argv: string[]): Options {
  const options: Options = {
    branch: null, start: '', end: new Date().toISOString(), outcome: 'success',
    types: [], exclusive: false, help: false,
  };

  let selectedOutcome: Options['outcome'] | null = null;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--help') return { ...options, help: true };
    if (argument === '--dev' || argument === '--main') {
      const branch = argument === '--dev' ? 'dev' : 'main';
      if (options.branch && options.branch !== branch) throw new Error('Choose either --dev or --main');
      options.branch = branch;
      continue;
    }
    if (['--success', '--failures', '--all'].includes(argument)) {
      const outcome = argument.slice(2) as Options['outcome'];
      if (selectedOutcome && selectedOutcome !== outcome) {
        throw new Error('Choose only one of --success, --failures, or --all');
      }
      options.outcome = outcome;
      selectedOutcome = outcome;
      continue;
    }
    if (argument === '--exclusive') {
      options.exclusive = true;
      continue;
    }
    if (!['--start', '--end', '--type'].includes(argument)) {
      throw new Error(`Unknown option: ${argument}`);
    }
    const value = argv[++index];
    if (!value || value.startsWith('--')) throw new Error(`${argument} requires a value`);
    if (argument === '--start' || argument === '--end') {
      if (!validDate(value)) throw new Error(`${argument} must use a valid YYYY-MM-DD date`);
      if (argument === '--start') options.start = `${value}T00:00:00Z`;
      else options.end = `${value}T23:59:59.999Z`;
    }
    if (argument === '--type') {
      if (!COMPONENTS.includes(value as Component)) throw new Error('Unknown deployment component');
      if (!options.types.includes(value as Component)) options.types.push(value as Component);
    }
  }

  if (!options.start) throw new Error('--start is required');
  if (Date.parse(options.start) > Date.parse(options.end)) throw new Error('--start must not be after --end');
  if (options.types.length && options.branch !== 'main') throw new Error('--type requires --main');
  if (options.exclusive && !options.types.length) throw new Error('--exclusive requires --type');
  return options;
}

// 3. Read-only GitHub collection

interface Workflow {
  id: number;
  created_at: string;
  run_started_at: string;
  run_attempt: number;
  conclusion: string;
  head_branch: string;
  pull_requests: Array<{ number: number }>;
}

interface Job {
  id: number;
  name: string;
  conclusion: string | null;
  started_at: string | null;
  completed_at: string | null;
}

interface PullRequest {
  number: number;
  created_at: string;
  closed_at: string | null;
  head: { ref: string };
}

type Request = (endpoint: string, paginate?: boolean) => string | Promise<string>;

/** Reads GitHub via authenticated gh; e.g. paginated /actions/runs, without saving files. */
async function github(endpoint: string, paginate = false): Promise<string> {
  const flags = paginate ? ['--paginate', '--slurp'] : ['--allow-escape-sequences'];
  const { stdout } = await execute('gh', ['api', ...flags, endpoint], { maxBuffer: 128 * 1024 * 1024 });
  return stdout;
}

/** Reads the printed component flags; a job failing before selection returns no flags. */
function deploymentFlags(log: string): Run['flags'] {
  const flags = {} as Record<Component, boolean>;
  for (const component of COMPONENTS) {
    const matches = [...log.matchAll(new RegExp(String.raw`\b${component}:\s*(true|false)\b`, 'gi'))];
    if (!matches.length) return undefined;
    flags[component] = matches.at(-1)![1].toLowerCase() === 'true';
  }
  return flags;
}

/** Queries completed workflows in the date range; e.g. --main reads deployment jobs, not PR checks. */
export async function collectHistory(repository: string, options: Options, request: Request = github): Promise<Run[]> {
  const base = `repos/${repository}`;
  const range = encodeURIComponent(`${options.start}..${options.end}`);
  const branches: Branch[] = options.branch ? [options.branch] : ['dev', 'main'];
  const records: Run[] = [];

  for (const branch of branches) {
    const endpoint = branch === 'dev'
      ? `${base}/actions/workflows/ci.yml/runs?event=pull_request`
      : `${base}/actions/runs?event=push&branch=main`;
    const pages = JSON.parse(await request(`${endpoint}&status=completed&created=${range}&per_page=100`, true)) as Array<{
      total_count: number; workflow_runs: Workflow[];
    }>;
    if (pages[0]?.total_count > 1000) {
      throw new Error('GitHub limits this query to 1,000 runs. Use a narrower date range.');
    }
    let workflows = pages.flatMap(page => page.workflow_runs);
    if (branch === 'dev' && workflows.length) {
      const pages = JSON.parse(await request(`${base}/pulls?base=develop&state=all&per_page=100`, true)) as PullRequest[][];
      const prs = pages.flat();
      const numbers = new Set(prs.map(pr => pr.number));
      // GitHub can omit PR associations after merging; match the branch within its PR lifetime.
      workflows = workflows.filter(run => run.pull_requests.some(pr => numbers.has(pr.number))
        || prs.some(pr => pr.head.ref === run.head_branch && pr.created_at <= run.created_at
          && (!pr.closed_at || run.created_at <= pr.closed_at)));
    }

    /** Collects one attempt's job times; expired logs retain timing with an unclassified deployment. */
    async function collectAttempt(workflow: Workflow, attempt: number): Promise<Run | null> {
      const endpoint = `${base}/actions/runs/${workflow.id}/attempts/${attempt}`;
      const details: Workflow = attempt === workflow.run_attempt
        ? workflow : JSON.parse(await request(endpoint));
      const pages = JSON.parse(await request(`${endpoint}/jobs?per_page=100`, true)) as Array<{ jobs: Job[] }>;
      const jobs = pages.flatMap(page => page.jobs).filter(job => job.conclusion !== 'skipped');
      const deployment = jobs.find(job => job.name === 'Deploy to Lightsail');
      if (branch === 'main' && !deployment) return null;
      const measured = branch === 'main' ? [deployment!] : jobs;
      const starts = measured.flatMap(job => job.started_at ? [Date.parse(job.started_at)] : []);
      const ends = measured.flatMap(job => job.completed_at ? [Date.parse(job.completed_at)] : []);
      const start = starts.length ? Math.min(...starts) : Date.parse(details.run_started_at);
      const end = ends.length ? Math.max(...ends) : start;
      const record: Run = {
        runId: workflow.id, branch, group: branch === 'dev' ? 'CI' : 'Unclassified', attempt,
        conclusion: branch === 'main' ? deployment!.conclusion ?? details.conclusion : details.conclusion,
        createdAt: workflow.created_at, durationSeconds: Math.max(0, (end - start) / 1000),
      };
      if (branch === 'dev') {
        record.queueSeconds = attempt === 1 ? Math.max(0, (start - Date.parse(workflow.created_at)) / 1000) : null;
        record.runnerSeconds = jobs.reduce((total, job) => total + (job.started_at && job.completed_at
          ? Math.max(0, (Date.parse(job.completed_at) - Date.parse(job.started_at)) / 1000) : 0), 0);
      }
      // Outcome filtering avoids downloading logs for attempts outside the requested view.
      if (!filterRuns([record], { ...options, types: [], exclusive: false }).length) return null;
      if (branch === 'main' && deployment) {
        try {
          record.flags = deploymentFlags(await request(`${base}/actions/jobs/${deployment.id}/logs`));
        } catch (error) {
          if (!(error instanceof Error) || !/HTTP (404|410)/.test(error.message)) throw error;
        }
        if (record.flags) {
          const selected = COMPONENTS.filter(component => component !== 'infrastructure' && record.flags![component]);
          record.group = record.flags.infrastructure ? 'full' : selected.join('+') || 'no-production-change';
          if (selected.length === 1 && !record.flags.infrastructure) record.group += '-only';
        }
      }
      return record;
    }

    const attempts = workflows.flatMap(workflow => Array.from({ length: workflow.run_attempt }, (_, index) => ({ workflow, attempt: index + 1 })));
    // Bound concurrent API requests without storing a cache or snapshot.
    for (let offset = 0; offset < attempts.length; offset += 6) {
      const batch = await Promise.all(attempts.slice(offset, offset + 6).map(({ workflow, attempt }) => collectAttempt(workflow, attempt)));
      records.push(...batch.filter((run): run is Run => run !== null));
    }
  }
  return records;
}

// 4. Shared filtering and duration summaries

/** Filters attempts; for example, exclusive migrations also require their backend. */
export function filterRuns(runs: Run[], options: Options): Run[] {
  const selected = new Set(options.types);
  const expected: Record<Component, boolean> = {
    frontend: selected.has('frontend') || selected.has('infrastructure'),
    backend: selected.has('backend') || selected.has('migrations') || selected.has('infrastructure'),
    migrations: selected.has('migrations') || selected.has('infrastructure'),
    infrastructure: selected.has('infrastructure'),
  };
  const start = Date.parse(options.start);
  const end = Date.parse(options.end);
  return runs.filter(run => {
    const started = Date.parse(run.createdAt);
    if (started < start || started > end) return false;
    if (options.branch && run.branch !== options.branch) return false;
    if (options.outcome === 'success' && run.conclusion !== 'success') return false;
    if (options.outcome === 'failures' && ['success', 'cancelled'].includes(run.conclusion)) return false;
    if (!selected.size) return true;
    if (options.exclusive) return COMPONENTS.every(component => run.flags?.[component] === expected[component]);
    return options.types.every(component => run.flags?.[component]);
  });
}

/** Computes a median of nonempty values without mutation; [10, 40] produces 25. */
function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Formats seconds for the table; 65 becomes 1m 05s, missing values become an em dash. */
function duration(seconds: number | null): string {
  if (seconds === null) return '—';
  const rounded = Math.round(seconds);
  if (rounded < 60) return `${rounded}s`;
  const remaining = rounded % 60;
  return `${Math.floor(rounded / 60)}m${remaining ? ` ${String(remaining).padStart(2, '0')}s` : ''}`;
}

// 5. Outcome counts and separate success/failure timing tables

/** Renders completed history; for example, --all shows failure timings separately from successful runs. */
export function renderReport(history: Run[], options: Options): string {
  const runs = filterRuns(history, options);
  const lines = [`CI history: ${options.start} → ${options.end}`];
  for (const branch of options.branch ? [options.branch] : ['dev', 'main'] as const) {
    const selected = runs.filter(run => run.branch === branch);
    lines.push('', branch === 'dev' ? 'Development PR checks' : 'Production deployments');
    const unknown = filterRuns(history, { ...options, types: [], exclusive: false })
      .filter(run => run.branch === branch && branch === 'main' && !run.flags).length;
    if (unknown) lines.push(`${unknown} attempts lack component details; component filters exclude them.`);
    if (!selected.length) {
      lines.push('No completed attempts match.');
      continue;
    }
    const successes = selected.filter(run => run.conclusion === 'success');
    const cancelled = selected.filter(run => run.conclusion === 'cancelled').length;
    const failed = selected.filter(run => !['success', 'cancelled'].includes(run.conclusion));
    const reruns = selected.filter(run => run.attempt > 1).length;
    lines.push(`${selected.length} attempts; ${successes.length} successful; ${reruns} reruns`);
    if (options.outcome === 'all') {
      const completed = selected.length - cancelled;
      const rate = completed ? `${(successes.length / completed * 100).toFixed(1)}%` : 'unavailable (no completed attempts)';
      lines.push(`${failed.length} failed; ${cancelled} cancelled; success rate: ${rate}`);
    }
    const timingGroups: Array<[string, Run[]]> = [
      ['Successful first-attempt timings:', successes.filter(run => run.attempt === 1)],
      ['Failed attempt timings (may end early):', failed],
    ];
    for (const [label, timed] of timingGroups) {
      if (!timed.length) continue;
      lines.push(label);
      const metrics = (['queueSeconds', 'runnerSeconds'] as const).filter(key => timed.some(run => run[key] != null));
      const rows = [['Group', 'Runs', 'Mean', 'Median', 'Range', ...metrics.map(key => key === 'queueSeconds' ? 'Queue median' : 'Runner median')]];
      for (const group of [...new Set(timed.map(run => run.group))].sort()) {
        const matching = timed.filter(run => run.group === group);
        const values = matching.map(run => run.durationSeconds);
        rows.push([group, String(values.length), duration(values.reduce((sum, value) => sum + value, 0) / values.length),
          duration(median(values)), `${duration(Math.min(...values))}–${duration(Math.max(...values))}`,
          ...metrics.map(key => {
            const recorded = matching.map(run => run[key]).filter((value): value is number => value != null);
            return duration(recorded.length === matching.length ? median(recorded) : null);
          })]);
      }
      const widths = rows[0].map((_, index) => Math.max(...rows.map(row => row[index].length)));
      for (const row of rows) lines.push(row.map((cell, index) => cell.padEnd(widths[index])).join(' | ').trimEnd());
    }
  }
  return lines.join('\n');
}

// 6. Read-only CLI

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) console.log(HELP);
    else {
      const { stdout } = await execute('gh', ['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner']);
      console.log(renderReport(await collectHistory(stdout.trim(), options), options));
    }
  } catch (error: unknown) {
    console.error(`ci-history-report: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
