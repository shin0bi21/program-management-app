#!/usr/bin/env node

/**
 * Summarize completed GitHub development checks and production deployments in the CLI.
 *
 * Flow (see collectHistory() and renderReport()):
 *   1. Validate date, outcome, and component filters
 *   2. Identify the GitHub repository
 *   3. Collect completed attempts, job phases, test summaries, and optional commit ancestry
 *   4. Group comparable jobs and scopes, separating successful first attempts from failures
 *   5. Print the report
 *
 * Read-only.
 * See usage() for parameter details and examples.
 */

import { execFile } from 'node:child_process';
import { promisify, stripVTControlCharacters } from 'node:util';
import { fileURLToPath } from 'node:url';

// 1. Types, interfaces, and shared constants

type Branch = 'dev' | 'main';
type Component = 'frontend' | 'backend' | 'migrations' | 'infrastructure';
type TestMode = 'full' | 'related' | 'unknown';

interface TestSummary {
  component: 'backend' | 'frontend';
  mode: TestMode;
  suites: number | null;
  cases: number | null;
  logAvailable: boolean;
}

interface JobTiming {
  name: string;
  conclusion: string | null;
  durationSeconds: number | null;
  testSeconds: number | null;
  buildSeconds: number | null;
  checkSeconds: number | null;
  otherSeconds: number | null;
  tests?: TestSummary;
}

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
  headSha?: string;
  pullRequest?: { number: number; title?: string };
  containsChange?: boolean | null;
  jobs?: JobTiming[];
}

interface Options {
  branch: Branch | null;
  start: string;
  end: string;
  outcome: 'success' | 'failures' | 'all';
  types: Component[];
  exclusive: boolean;
  help: boolean;
  change: string | null;
}

interface Workflow {
  id: number;
  created_at: string;
  run_started_at: string;
  run_attempt: number;
  conclusion: string;
  head_branch: string;
  pull_requests: Array<{ number: number }>;
  head_sha?: string;
}

interface Step {
  name: string;
  conclusion: string | null;
  started_at: string | null;
  completed_at: string | null;
}

interface Job extends Step {
  id: number;
  steps?: Step[];
}

interface PullRequest {
  number: number;
  created_at: string;
  closed_at: string | null;
  head: { ref: string };
  title?: string;
}

type Request = (endpoint: string, paginate?: boolean) => string | Promise<string>;

interface AttemptContext {
  base: string;
  branch: Branch;
  options: Options;
  request: Request;
  changeSha: string | null;
  pullRequest?: PullRequest;
  changeComparisons: Map<string, Promise<boolean>>;
}

const COMPONENTS: Component[] = ['frontend', 'backend', 'migrations', 'infrastructure'];
const TEST_STEP_NAMES = new Set(['Run tests', 'Run related tests', 'Test deployment planning']);
const CHECK_STEP_PREFIXES = [
  'Type check',
  'Run static checks',
  'Check changed repository patterns',
  'Apply migrations',
  'Validate migration checksums',
  'Verify generated database types are committed',
  'Validate production',
];
const execute = promisify(execFile);

// 2. CLI usage, argument parsing, and validation

/**
 * Returns the CLI reference printed by --help.
 * @example usage().includes('--start YYYY-MM-DD') // true
 */
function usage(): string {
  // 1. Describe commands, filters, and evidence limits in the CLI reference.
  return `Usage: npm run report:ci-history -- --start 2026-09-01
       npm run report:ci-history -- --start 2026-09-01 --dev
       npm run report:ci-history -- --start 2026-11-02 --end 2026-11-06 --dev --change 0a06f196b --all
       npm run report:ci-history -- --start 2026-09-01 --end 2026-09-30 --main --type frontend --exclusive

  --start YYYY-MM-DD  Required inclusive start date (UTC).
  --end YYYY-MM-DD    Inclusive end date; defaults to now.
  --dev              Development PR checks only.
  --change SHA       Group development runs by exact commit ancestry. Requires --dev.
  --main             Production deployments only; default shows both views.
  --success          Successful attempts only; timings use first attempts (default).
  --failures         Failed attempts only; excludes cancellations.
  --all              All outcomes, including cancellations.
  --type COMPONENT   Deployment component; repeat to require multiple components. Requires --main.
  --exclusive        Require exactly the selected component combination.
  --help             Show this help.

Components: frontend, backend, migrations, infrastructure.
Migrations include backend; infrastructure includes all four components when matching --exclusive.
Deployments without component logs remain Unclassified and are excluded by component filters.

Requires authenticated GitHub CLI access (gh auth login). Dates select workflow creation time.
If GitHub's 1,000-run query limit is reached, narrow the date range.
--all shows success rate excluding cancellations. Outcome flags are mutually exclusive.
Development output includes job phases, full/related test groups, test counts, and per-attempt PR/head context.
Test scope follows the executed Jest/Vitest command, including full-suite fallbacks; absent evidence is unknown.
Timings exclude skipped steps. Setup/other includes job overhead and unclassified steps.
Use explicit start/end dates and a commit SHA for repeatable comparisons; GitHub history remains live.
Squash source PRs may contain equivalent changes without containing the squash merge commit.
No matches exits successfully.`;
}

/**
 * Parses CLI filters, expanding dates to inclusive UTC boundaries and defaulting the end to now.
 * Throws for missing or conflicting filters; --help returns before remaining validation.
 * @param argv - Arguments after the script path, with separate flag and value tokens.
 * @example parseArgs(['--start', '2026-09-01', '--dev']).start // '2026-09-01T00:00:00Z'
 */
export function parseArgs(argv: string[]): Options {
  // 1. Start with successful attempts and an open-ended UTC window.
  const options: Options = {
    branch: null, start: '', end: new Date().toISOString(), outcome: 'success',
    types: [], exclusive: false, help: false, change: null,
  };

  let selectedOutcome: Options['outcome'] | null = null;

  // 2. Read flags and their values, rejecting conflicting selections.
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

    if (!['--start', '--end', '--type', '--change'].includes(argument)) {
      throw new Error(`Unknown option: ${argument}`);
    }

    index += 1;
    const value = argv[index];
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

    if (argument === '--change') {
      if (!/^[a-f\d]{7,40}$/i.test(value)) throw new Error('--change must be a commit SHA (7–40 hexadecimal characters)');

      options.change = value.toLowerCase();
    }
  }

  // 3. Validate the date window and dependencies between filters.
  if (!options.start) throw new Error('--start is required');
  if (Date.parse(options.start) > Date.parse(options.end)) throw new Error('--start must not be after --end');
  if (options.types.length && options.branch !== 'main') throw new Error('--type requires --main');
  if (options.exclusive && !options.types.length) throw new Error('--exclusive requires --type');
  if (options.change && options.branch !== 'dev') throw new Error('--change requires --dev');

  return options;
}

/**
 * Checks whether a date names a real UTC calendar day.
 * @param value - A proposed YYYY-MM-DD date, without a time or offset.
 * @todo Standardize date-only validation: https://github.com/shin0bi21/be-original/issues/1262
 * @example validDate('2024-02-29') // true
 * @example validDate('2026-02-30') // false
 */
function validDate(value: string): boolean {
  // 1. Require an ISO calendar date that survives a UTC round trip.
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString().slice(0, 10) === value;
}

// 3. Read-only GitHub collection

/**
 * Collects completed development PR checks and production deployment attempts with job timings.
 * Rejects on API or JSON failures and queries over 1,000 runs; unavailable logs retain timings.
 * @param repository - GitHub owner/repository name accessible to the request client.
 * @param options - Validated date and outcome filters from parseArgs; component filtering occurs in filterRuns.
 * @param request - Read-only API client returning raw text, or JSON page arrays for paginated requests.
 * @returns Matching attempt records; production durations and outcomes describe the deployment job.
 * @example await collectHistory('example/project', parseArgs(['--start', '2026-09-01', '--main']))
 */
export async function collectHistory(repository: string, options: Options, request: Request = github): Promise<Run[]> {
  // 1. Prepare the query window and collection state for the selected branches.
  const base = `repos/${repository}`;
  const range = encodeURIComponent(`${options.start}..${options.end}`);
  const branches: Branch[] = options.branch ? [options.branch] : ['dev', 'main'];
  const records: Run[] = [];
  const pullRequests = new Map<number, PullRequest>();
  const changeComparisons = new Map<string, Promise<boolean>>();

  // 2. Resolve the comparison commit once so every run uses the same SHA.
  let changeSha: string | null = null;
  if (options.change) {
    const commit = JSON.parse(await request(`${base}/commits/${options.change}`)) as { sha: string };
    changeSha = commit.sha;
  }

  // 3. Fetch completed workflows and restrict development runs to develop PRs.
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
      // GitHub can omit PR associations after merging; match the branch within its PR lifetime.
      workflows = workflows.filter(run => {
        const associated = prs.find(pr => run.pull_requests.some(link => link.number === pr.number));
        const matching = associated ?? prs.find(pr => pr.head.ref === run.head_branch
          && pr.created_at <= run.created_at && (!pr.closed_at || run.created_at <= pr.closed_at));
        if (!matching) return false;

        pullRequests.set(run.id, matching);
        return true;
      });
    }

    // 4. Collect every attempt in bounded batches, reusing ancestry comparisons.
    const attempts = workflows.flatMap(workflow => Array.from(
      { length: workflow.run_attempt },
      (_, index) => ({ workflow, attempt: index + 1 }),
    ));
    for (let offset = 0; offset < attempts.length; offset += 6) {
      const batch = await Promise.all(attempts.slice(offset, offset + 6).map(
        ({ workflow, attempt }) => collectAttempt(workflow, attempt, {
          base, branch, options, request, changeSha,
          pullRequest: pullRequests.get(workflow.id), changeComparisons,
        }),
      ));
      records.push(...batch.filter((run): run is Run => run !== null));
    }
  }

  // 5. Return attempts in stable chronological order, including reruns.
  return records.sort((left, right) => left.createdAt.localeCompare(right.createdAt)
    || left.runId - right.runId || left.attempt - right.attempt);
}

/**
 * Collects one attempt's phases, test evidence, ancestry, or deployment flags.
 * Missing logs (HTTP 404/410) retain timings with unknown details; other API failures reject.
 * @param workflow - Completed run carrying the latest attempt number and original creation time.
 * @param attempt - One-based attempt number, no greater than workflow.run_attempt.
 * @param context - Explicit branch, filters, PR metadata, and shared ancestry requests.
 * @returns An attempt record, or null for an excluded outcome or absent deployment job.
 * @example await collectAttempt(workflow, 1, context) // First attempt, even when the latest run is a rerun.
 */
async function collectAttempt(workflow: Workflow, attempt: number, context: AttemptContext): Promise<Run | null> {
  // 1. Read the explicit collection context for this workflow attempt.
  const { base, branch, options, request, changeSha, pullRequest, changeComparisons } = context;

  // 2. Load this attempt's jobs and choose the workflow or deployment boundary.
  const endpoint = `${base}/actions/runs/${workflow.id}/attempts/${attempt}`;
  const details: Workflow = attempt === workflow.run_attempt
    ? workflow : JSON.parse(await request(endpoint));
  const pages = JSON.parse(await request(`${endpoint}/jobs?per_page=100`, true)) as Array<{ jobs: Job[] }>;
  const jobs = pages.flatMap(page => page.jobs).filter(job => job.conclusion !== 'skipped');
  const deployment = jobs.find(job => job.name === 'Deploy to Lightsail');
  if (branch === 'main' && !deployment) return null;
  const measured = branch === 'main' ? [deployment!] : jobs;

  // 3. Measure elapsed time across the selected non-skipped jobs.
  const starts = measured.flatMap(job => job.started_at ? [Date.parse(job.started_at)] : []);
  const ends = measured.flatMap(job => job.completed_at ? [Date.parse(job.completed_at)] : []);
  const start = starts.length ? Math.min(...starts) : Date.parse(details.run_started_at);
  const end = ends.length ? Math.max(...ends) : start;

  // 4. Record the outcome, queue delay, and combined runner consumption.
  const conclusion = branch === 'main' ? deployment!.conclusion ?? details.conclusion : details.conclusion;
  const record: Run = {
    runId: workflow.id, branch, group: branch === 'dev' ? 'CI' : 'Unclassified', attempt,
    conclusion,
    createdAt: workflow.created_at, durationSeconds: Math.max(0, (end - start) / 1000),
  };
  if (branch === 'dev') {
    record.queueSeconds = attempt === 1 ? Math.max(0, (start - Date.parse(workflow.created_at)) / 1000) : null;
    record.runnerSeconds = jobs.reduce((total, job) => total + (elapsedSeconds(job) ?? 0), 0);
  }

  // 5. Skip excluded outcomes before downloading their logs or ancestry evidence.
  if (!filterRuns([record], { ...options, types: [], exclusive: false }).length) return null;

  // 6. Attach development PR context, exact ancestry, and executed test evidence.
  if (branch === 'dev') {
    record.headSha = workflow.head_sha;
    if (pullRequest) record.pullRequest = { number: pullRequest.number, title: pullRequest.title };
    if (changeSha) {
      record.containsChange = null;
      if (workflow.head_sha) {
        const headSha = workflow.head_sha;
        let comparison = changeComparisons.get(headSha);
        if (!comparison) {
          comparison = requestComparison(`${base}/compare/${changeSha}...${headSha}`, request);
          changeComparisons.set(headSha, comparison);
        }
        record.containsChange = await comparison;
      }
      record.group = changeGroup(record);
    }
    record.jobs = await Promise.all(jobs.map(async job => {
      const timing = jobTiming(job);
      if (timing.tests) {
        const log = await optionalLog(`${base}/actions/jobs/${job.id}/logs`, request);
        timing.tests = { ...timing.tests, ...testSummary(log, timing.tests.component) };
      }
      return timing;
    }));
  }

  // 7. Classify production deployments from their recorded component flags.
  if (branch === 'main' && deployment) {
    const log = await optionalLog(`${base}/actions/jobs/${deployment.id}/logs`, request);
    if (log !== null) record.flags = deploymentFlags(log);
    if (record.flags) {
      const selected = COMPONENTS.filter(component => component !== 'infrastructure' && record.flags![component]);
      const componentGroup = selected.join('+') || 'no-production-change';
      record.group = record.flags.infrastructure ? 'full' : componentGroup;
      if (selected.length === 1 && !record.flags.infrastructure) record.group += '-only';
    }
  }

  return record;
}

/**
 * Checks commit ancestry using GitHub's resolved comparison, rather than merge dates.
 * @param endpoint - Comparison with the cleanup commit as base and run head as head.
 * @param request - Read-only GitHub client; API failures reject.
 * @example await requestComparison('repos/example/project/compare/abc...def', request) // true when def contains abc
 */
async function requestComparison(endpoint: string, request: Request): Promise<boolean> {
  // 1. Read the comparison and reject statuses outside GitHub's ancestry contract.
  const comparison = JSON.parse(await request(endpoint)) as { status: string };
  if (!['ahead', 'identical', 'behind', 'diverged'].includes(comparison.status)) {
    throw new Error(`Unknown GitHub comparison status: ${comparison.status}`);
  }

  // 2. Count the commit as present only when the head is equal to or ahead of it.
  return comparison.status === 'ahead' || comparison.status === 'identical';
}

/**
 * Reads a job log, retaining unavailable/expired logs as missing evidence.
 * @param endpoint - GitHub job-log endpoint.
 * @param request - Read-only client; errors other than HTTP 404/410 reject.
 * @example await optionalLog('repos/example/project/actions/jobs/1/logs', request) // null for expired logs
 */
async function optionalLog(endpoint: string, request: Request): Promise<string | null> {
  // 1. Read the log, treating only missing or expired output as unavailable evidence.
  try {
    return await request(endpoint);
  } catch (error) {
    if (error instanceof Error && /HTTP (404|410)/.test(error.message)) return null;
    throw error;
  }
}

/**
 * Measures elapsed seconds for a completed job or step; absent timestamps remain unknown.
 * @param item - GitHub timestamps in ISO format, including skipped or incomplete steps.
 * @example elapsedSeconds({ started_at: null, completed_at: null }) // null
 */
function elapsedSeconds(item: Pick<Step, 'started_at' | 'completed_at'>): number | null {
  // 1. Preserve missing timestamps instead of interpreting them as zero duration.
  if (!item.started_at || !item.completed_at) return null;

  // 2. Convert the completed interval to non-negative seconds.
  return Math.max(0, (Date.parse(item.completed_at) - Date.parse(item.started_at)) / 1000);
}

/**
 * Partitions job time by named step responsibility, preserving overhead in setup/other.
 * @param job - One non-skipped job, with its attempt-specific steps.
 * @example jobTiming(job).testSeconds // Sum of executed test-step seconds, never skipped steps
 */
function jobTiming(job: Job): JobTiming {
  // 1. Initialize phase totals, keeping absent step metadata unknown.
  const initialSeconds = job.steps ? 0 : null;
  const timing: JobTiming = {
    name: job.name, conclusion: job.conclusion, durationSeconds: elapsedSeconds(job),
    testSeconds: initialSeconds, buildSeconds: initialSeconds, checkSeconds: initialSeconds, otherSeconds: null,
  };

  // 2. Attribute each executed step to testing, building, or validation checks.
  for (const step of job.steps ?? []) {
    if (step.conclusion === 'skipped') continue;
    const seconds = elapsedSeconds(step);
    let metric: 'testSeconds' | 'buildSeconds' | 'checkSeconds' | null = null;
    if (TEST_STEP_NAMES.has(step.name)) metric = 'testSeconds';
    else if (/^Build\b/.test(step.name)) metric = 'buildSeconds';
    else if (CHECK_STEP_PREFIXES.some(prefix => step.name.startsWith(prefix))) {
      metric = 'checkSeconds';
    }
    if (metric) {
      const previousSeconds = timing[metric];
      timing[metric] = seconds === null || previousSeconds === null ? null : previousSeconds + seconds;
    }
  }

  // 3. Assign the remaining job time to setup, cleanup, and unclassified work.
  if (timing.durationSeconds !== null && timing.testSeconds !== null && timing.buildSeconds !== null && timing.checkSeconds !== null) {
    timing.otherSeconds = Math.max(0, timing.durationSeconds - timing.testSeconds - timing.buildSeconds - timing.checkSeconds);
  }

  // 4. Identify application jobs that need runner scope and test-count evidence.
  let component: 'backend' | 'frontend' | null = null;
  if (job.name === 'Backend — Typecheck, Migrate & Test') component = 'backend';
  if (job.name === 'Frontend — Typecheck & Build') component = 'frontend';
  if (component) timing.tests = { component, mode: 'unknown', suites: null, cases: null, logAvailable: false };
  return timing;
}

/**
 * Extracts actual test scope and the last runner totals from Jest/Vitest output.
 * Command evidence overrides planned MODE values, which can fall back to full execution.
 * @param log - Attempt-specific job output; null means expired or unavailable.
 * @param component - Runner owner, determining which command and summary labels to read.
 * @example testSummary('> jest --runInBand\nTests: 12 passed, 12 total', 'backend').mode // 'full'
 */
function testSummary(log: string | null, component: 'backend' | 'frontend'): TestSummary {
  // 1. Keep scope and counts unknown until the log supplies explicit evidence.
  const result: TestSummary = {
    component, mode: 'unknown', suites: null, cases: null, logAvailable: log !== null,
  };
  if (log === null) return result;

  // 2. Classify the last executed runner command, including full-suite fallbacks.
  const clean = stripVTControlCharacters(log);
  const commands = [...clean.matchAll(/> (jest|vitest run)([^\r\n]*)/g)]
    .filter(match => match[1] === (component === 'backend' ? 'jest' : 'vitest run'));
  const command = commands.at(-1);
  if (command) {
    const argumentsText = command[2].trim();
    const related = /--(findRelatedTests|changed)\b/.test(argumentsText);
    // Positional paths or unrecognized flags cannot establish a full-suite run.
    const full = argumentsText.replace(/--runInBand\b/g, '').trim() === '';
    if (related) result.mode = 'related';
    else if (full) result.mode = 'full';
  }

  // 3. Read the last suite and case totals using the selected runner's labels.
  const suitePattern = component === 'backend' ? /Test Suites:[^\r\n]*?\b(\d+) total\b/g : /Test Files[^\r\n]*?\((\d+)\)/g;
  const casePattern = component === 'backend' ? /Tests:[^\r\n]*?\b(\d+) total\b/g : /\bTests\s+[^\r\n]*?\((\d+)\)/g;
  const suites = [...clean.matchAll(suitePattern)].at(-1);
  const cases = [...clean.matchAll(casePattern)].at(-1);
  if (suites) result.suites = Number(suites[1]);
  if (cases) result.cases = Number(cases[1]);
  return result;
}

/**
 * Reads GitHub through the authenticated gh CLI without saving files; command failures reject.
 * @param endpoint - GitHub API path, including any query parameters.
 * @param paginate - Whether to collect every page into a JSON array of page responses.
 * @returns Raw response text, or slurped JSON pages when pagination is enabled.
 * @example await github('repos/example/project/actions/runs?per_page=100', true) // JSON pages
 */
async function github(endpoint: string, paginate: boolean = false): Promise<string> {
  // 1. Choose paginated JSON or raw output, preserving terminal-formatted logs.
  const flags = paginate ? ['--paginate', '--slurp'] : ['--allow-escape-sequences'];

  // 2. Execute the authenticated read and return its output without saving files.
  const { stdout } = await execute('gh', ['api', ...flags, endpoint], { maxBuffer: 128 * 1024 * 1024 });
  return stdout;
}

/**
 * Reads the last printed value for each deployment component, ignoring letter case.
 * @param log - Deployment job output containing component: true/false lines.
 * @returns All four flags, or undefined if any component has no printed value.
 * @example deploymentFlags('Frontend: true') // undefined: three components are missing
 */
function deploymentFlags(log: string): Run['flags'] {
  // 1. Read each component's last flag, leaving incomplete logs unclassified.
  const flags = {} as Record<Component, boolean>;
  for (const component of COMPONENTS) {
    const matches = [...log.matchAll(new RegExp(String.raw`\b${component}:\s*(true|false)\b`, 'gi'))];
    if (!matches.length) return undefined;
    flags[component] = matches.at(-1)![1].toLowerCase() === 'true';
  }
  return flags;
}

// 4. Shared attempt filtering

/**
 * Selects attempts by inclusive creation date, branch, outcome, and deployment components without mutation.
 * Exclusive matching includes backend for migrations and all components for infrastructure.
 * @param runs - Collected attempts with component flags when available.
 * @param options - Validated filters; attempts without flags cannot match component filters.
 * @example filterRuns([], parseArgs(['--start', '2026-09-01'])) // []
 */
export function filterRuns(runs: Run[], options: Options): Run[] {
  // 1. Expand component dependencies and resolve the inclusive date boundaries.
  const selected = new Set(options.types);
  const expected: Record<Component, boolean> = {
    frontend: selected.has('frontend') || selected.has('infrastructure'),
    backend: selected.has('backend') || selected.has('migrations') || selected.has('infrastructure'),
    migrations: selected.has('migrations') || selected.has('infrastructure'),
    infrastructure: selected.has('infrastructure'),
  };
  const start = Date.parse(options.start);
  const end = Date.parse(options.end);

  // 2. Match dates and outcomes before applying component selection rules.
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

// 5. Outcome counts and separate success/failure timing tables

/**
 * Builds the filtered text report with separate successful first-attempt and failed-attempt timings.
 * @param history - Collected attempts; successful reruns count toward outcomes but not timing summaries.
 * @param options - Validated report filters; --all includes a success rate excluding cancellations.
 * @returns Display text, including a no-match message for each empty branch view.
 * @example renderReport([], parseArgs(['--start', '2026-09-01', '--dev'])).includes('No completed attempts match.') // true
 */
export function renderReport(history: Run[], options: Options): string {
  // 1. Select and sort attempts, then describe the requested comparison window.
  const runs = filterRuns(history, options).sort((left, right) => left.createdAt.localeCompare(right.createdAt)
    || left.runId - right.runId || left.attempt - right.attempt);
  const lines = [`CI history: ${options.start} → ${options.end}`];
  if (options.change) {
    lines.push(`Change: ${options.change} (exact commit ancestry, not merge date or patch equivalence)`);
    lines.push('Squash source PRs can contain equivalent changes while lacking the merge commit.');
  }

  // 2. Open each branch view and disclose unavailable deployment classifications.
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

    // 3. Count outcomes and reruns without counting cancellations as failures.
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

    // 4. Keep successful first attempts separate from potentially shortened failures.
    const timingGroups: Array<[string, Run[]]> = [
      ['Successful first-attempt timings:', successes.filter(run => run.attempt === 1)],
      ['Failed attempt timings (may end early):', failed],
    ];
    for (const [label, timed] of timingGroups) {
      if (!timed.length) continue;
      lines.push(label);
      const rows = timingRows(timed);
      lines.push(...table(rows));
      if (branch === 'dev') lines.push(...developmentTimings(timed, options));
    }

    // 5. Include individual development attempts so aggregate results remain traceable.
    if (branch === 'dev') lines.push(...developmentAttempts(selected, options));
  }

  return lines.join('\n');
}

/**
 * Calculates display rows for each timing cohort without assembling the report sections.
 * @param runs - Nonempty attempts from one outcome group; successful reruns are excluded by the caller.
 * @returns Header and data rows with elapsed, queue, and runner summaries.
 * @example timingRows(runs)[0][0] // 'Group'
 */
function timingRows(runs: Run[]): string[][] {
  // 1. Select the timing columns available in this outcome group.
  const metrics = (['queueSeconds', 'runnerSeconds'] as const).filter(key => runs.some(run => run[key] != null));
  const metricHeaders = metrics.map(key => key === 'queueSeconds' ? 'Queue median' : 'Runner median');
  const rows = [['Group', 'Runs', 'Mean', 'Median', 'Range', ...metricHeaders]];

  // 2. Summarize each cohort's elapsed, queue, and combined runner timings.
  for (const group of [...new Set(runs.map(run => run.group))].sort()) {
    const matching = runs.filter(run => run.group === group);
    const values = matching.map(run => run.durationSeconds);
    const meanSeconds = values.reduce((sum, value) => sum + value, 0) / values.length;
    const range = `${duration(Math.min(...values))}–${duration(Math.max(...values))}`;
    rows.push([group, String(values.length), duration(meanSeconds), duration(median(values)), range,
      ...metrics.map(key => {
        const recorded = matching.map(run => run[key]).filter((value): value is number => value != null);
        return duration(recorded.length === matching.length ? median(recorded) : null);
      })]);
  }

  // 3. Return the calculated rows for the shared table formatter.
  return rows;
}

/**
 * Labels a run's ancestry evidence without treating missing metadata as a pre-change run.
 * @param run - Development attempt collected with --change.
 * @example changeGroup({ containsChange: null }) // 'Unknown ancestry'
 */
function changeGroup(run: Pick<Run, 'containsChange'>): string {
  // 1. Label exact ancestry while preserving missing evidence as unknown.
  if (run.containsChange === true) return 'Contains commit';
  if (run.containsChange === false) return 'Lacks commit';
  return 'Unknown ancestry';
}

/**
 * Formats caller-ordered rows as an aligned CLI table.
 * @param rows - Header followed by equally sized display rows.
 * @example table([['Runs'], ['2']]) // ['Runs', '2']
 */
function table(rows: string[][]): string[] {
  // 1. Measure column widths across the header and all supplied rows.
  const widths = rows[0].map((_, index) => Math.max(...rows.map(row => row[index].length)));

  // 2. Align the cells while preserving the caller's row order.
  return rows.map(row => row.map((cell, index) => cell.padEnd(widths[index])).join(' | ').trimEnd());
}

/**
 * Summarizes job phases separately by job, actual suite scope, and cleanup ancestry.
 * @param runs - Successful first attempts or failed attempts, never a mixture of outcomes.
 * @param options - Determines whether to split by cleanup commit ancestry.
 * @example developmentTimings([], options) // []
 */
function developmentTimings(runs: Run[], options: Options): string[] {
  // 1. Group jobs by identity, actual test scope, and optional commit ancestry.
  const groups = new Map<string, JobTiming[]>();
  for (const run of runs) {
    for (const job of run.jobs ?? []) {
      const cohort = options.change ? `${changeGroup(run)} / ` : '';
      const mode = job.tests ? ` / ${job.tests.mode}` : '';
      const key = `${cohort}${job.name}${mode}`;
      const group = groups.get(key) ?? [];
      group.push(job);
      groups.set(key, group);
    }
  }
  if (!groups.size) return [];

  // 2. Calculate phase medians and count ranges with their available sample sizes.
  const rows = [['Job / scope', 'N', 'Job median', 'Tests median', 'Build median', 'Checks median', 'Setup/other median', 'Suites range (N)', 'Cases range (N)']];
  for (const key of [...groups.keys()].sort()) {
    const jobs = groups.get(key)!;
    const metrics = (['durationSeconds', 'testSeconds', 'buildSeconds', 'checkSeconds', 'otherSeconds'] as const).map(metric => {
      const values = jobs.map(job => job[metric]).filter((value): value is number => value !== null);
      return duration(values.length === jobs.length ? median(values) : null);
    });
    const counts = (['suites', 'cases'] as const).map(metric => {
      const values = jobs.map(job => job.tests?.[metric]).filter((value): value is number => value != null);
      if (!values.length) return '— (0)';
      return `${Math.min(...values)}–${Math.max(...values)} (${values.length})`;
    });
    rows.push([key, String(jobs.length), ...metrics, ...counts]);
  }

  // 3. Render the groups with the distinction between runner and wall time.
  return ['', 'Job phases (seconds are runner time; medians do not sum to wall time):', ...table(rows)];
}

/**
 * Prints exact run, PR, commit, scope, and count evidence for every selected attempt.
 * @param runs - Attempts already sorted by creation time, run ID, and attempt number.
 * @param options - Determines whether to include cleanup ancestry.
 * @example developmentAttempts([], options) // []
 */
function developmentAttempts(runs: Run[], options: Options): string[] {
  // 1. Omit the evidence section when no development job metadata was collected.
  if (!runs.some(run => run.jobs)) return [];

  // 2. Print each attempt's identity, PR context, and optional ancestry classification.
  const lines = ['', 'Attempt evidence (unknown means missing or unrecognized log evidence):'];
  for (const run of runs) {
    const pr = run.pullRequest ? `PR #${run.pullRequest.number}` : 'PR unknown';
    const ancestry = options.change ? ` | ${changeGroup(run)}` : '';
    lines.push(`${run.createdAt} | run ${run.runId}/${run.attempt} | ${run.conclusion} | ${pr} | head ${run.headSha ?? 'unknown'}${ancestry}`);
    if (run.pullRequest?.title) lines.push(`  ${stripVTControlCharacters(run.pullRequest.title).replace(/[\r\n]/g, ' ')}`);

    // 3. List application test scope, timing, and counts in stable job order.
    for (const job of [...(run.jobs ?? [])].sort((left, right) => left.name.localeCompare(right.name))) {
      if (!job.tests) continue;
      const tests = job.tests;
      const logStatus = tests.logAvailable ? '' : ' | log unavailable';
      lines.push(`  ${tests.component}: ${tests.mode} | job ${job.conclusion} | tests ${duration(job.testSeconds)} | suites ${tests.suites ?? 'unknown'} | cases ${tests.cases ?? 'unknown'}${logStatus}`);
    }
  }
  return lines;
}

/**
 * Computes the median without changing the supplied values.
 * @param values - Nonempty collection of finite timing values in the same units.
 * @example median([10, 40]) // 25
 */
function median(values: number[]): number {
  // 1. Sort a copy so the caller's measurements retain their original order.
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  // 2. Use the middle value or the mean of the two central values.
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Formats a duration rounded to whole seconds, omitting zero seconds after whole minutes.
 * @param seconds - Non-negative finite duration, or null when the metric is unavailable.
 * @example duration(65) // '1m 05s'
 * @example duration(null) // '—'
 */
function duration(seconds: number | null): string {
  // 1. Display unavailable durations explicitly.
  if (seconds === null) return '—';

  // 2. Round short durations to whole seconds.
  const rounded = Math.round(seconds);
  if (rounded < 60) return `${rounded}s`;

  // 3. Format longer durations as minutes with any remaining seconds.
  const remaining = rounded % 60;
  return `${Math.floor(rounded / 60)}m${remaining ? ` ${String(remaining).padStart(2, '0')}s` : ''}`;
}

// 6. Read-only CLI

/**
 * Validates CLI filters, resolves the repository, collects history, and prints the report.
 * Help returns before contacting GitHub; collection failures reach the entrypoint.
 * @example main() // with --help, prints the reference without running gh
 */
async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }

  const { stdout } = await execute('gh', ['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner']);
  const history = await collectHistory(stdout.trim(), options);
  console.log(renderReport(history, options));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error: unknown) => {
    console.error(`ci-history-report: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
