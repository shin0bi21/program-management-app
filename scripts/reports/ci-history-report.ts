#!/usr/bin/env node

/**
 * Summarize saved development checks and production deployments, without network access.
 * Flow: validate options → load history → filter attempts → print outcomes and timings.
 * Read-only. Usage: npm run report:ci-history -- --start 2026-08-09 --main --success
 */

import { readFileSync } from 'node:fs';
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
  startedAt: string;
  durationSeconds: number;
  queueSeconds?: number | null;
  runnerSeconds?: number | null;
  flags?: Record<Component, boolean>;
}

interface Coverage {
  start: string;
  end: string;
  completeOutcomes: boolean;
}

interface History {
  capturedAt: string;
  coverage: Record<Branch, Coverage>;
  runs: Run[];
}

interface Options {
  branch: Branch | null;
  start: string;
  end: string;
  outcome: 'success' | 'failures' | 'all';
  types: Component[];
  exclusive: boolean;
  file: string;
  help: boolean;
}

const COMPONENTS: Component[] = ['frontend', 'backend', 'migrations', 'infrastructure'];
const HISTORY_PATH = fileURLToPath(new URL('../../data/reports/ci-history.json', import.meta.url));

const HELP = `Usage: npm run report:ci-history -- --start YYYY-MM-DD [options]

  --start YYYY-MM-DD  Required inclusive UTC start date.
  --end YYYY-MM-DD    Inclusive UTC end date; defaults to now.
  --dev              Development PR checks only.
  --main             Production deployments only; default shows both views.
  --success          Successful attempts only (default).
  --failures         Failed attempts only; excludes cancellations.
  --all              All outcomes, including cancellations.
  --type COMPONENT   Deployment component; repeat to require multiple components.
  --exclusive        Require exactly the selected component combination.
  --file PATH        Read another saved history file.
  --help             Show this help.

Components: frontend, backend, migrations, infrastructure. Component filters require --main.`;

// 2. Argument and history validation

/** Recognizes real UTC calendar dates; for example, 2024-02-29 is valid. */
function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString().slice(0, 10) === value;
}

/** Recognizes dated timestamps with an explicit timezone; for example, 2026-09-01T00:00:00Z. */
function validTimestamp(value: unknown): value is string {
  return typeof value === 'string' && validDate(value.slice(0, 10))
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && Number.isFinite(Date.parse(value));
}

/** Parses options such as --start 2026-09-01 --dev; missing --start throws except with --help. */
export function parseArgs(argv: string[]): Options {
  const options: Options = {
    branch: null, start: '', end: new Date().toISOString(), outcome: 'success',
    types: [], exclusive: false, file: HISTORY_PATH, help: false,
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
    if (!['--start', '--end', '--type', '--file'].includes(argument)) {
      throw new Error(`Unknown option: ${argument}`);
    }
    const value = argv[++index];
    if (!value || value.startsWith('--')) throw new Error(`${argument} requires a value`);
    if (argument === '--start' || argument === '--end') {
      if (!validDate(value)) throw new Error(`${argument} must use a valid YYYY-MM-DD date`);
      if (argument === '--start') options.start = `${value}T00:00:00Z`;
      else options.end = `${value}T23:59:59.999Z`;
    }
    if (argument === '--file') options.file = value;
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

/** Accepts finite non-negative seconds, including zero; rejects NaN and negative durations. */
function validSeconds(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/** Validates all attempts from a JSON path, e.g. data/reports/ci-history.json; malformed input throws. */
export function loadHistory(path: string): History {
  const history = JSON.parse(readFileSync(path, 'utf8')) as History | null;
  if (!history || !validTimestamp(history.capturedAt) || !Array.isArray(history.runs)) {
    throw new Error('Invalid CI history');
  }
  for (const branch of ['dev', 'main'] as const) {
    const coverage = history.coverage?.[branch];
    if (!coverage || !validTimestamp(coverage.start) || !validTimestamp(coverage.end)
      || Date.parse(coverage.start) > Date.parse(coverage.end)
      || typeof coverage.completeOutcomes !== 'boolean') throw new Error(`Invalid ${branch} coverage`);
  }
  const attempts = new Set<string>();
  for (const run of history.runs) {
    if (!run || !Number.isInteger(run.runId) || run.runId < 1
      || !['dev', 'main'].includes(run.branch) || typeof run.group !== 'string' || !run.group.trim()
      || !Number.isInteger(run.attempt) || run.attempt < 1
      || typeof run.conclusion !== 'string' || !run.conclusion
      || !validTimestamp(run.startedAt) || !validSeconds(run.durationSeconds)
      || (run.queueSeconds != null && !validSeconds(run.queueSeconds))
      || (run.runnerSeconds != null && !validSeconds(run.runnerSeconds))
      || (run.branch === 'main' && !COMPONENTS.every(component => typeof run.flags?.[component] === 'boolean'))) {
      throw new Error('Invalid CI history attempt');
    }
    const key = `${run.branch}:${run.runId}:${run.attempt}`;
    if (attempts.has(key)) throw new Error(`Duplicate CI history attempt: ${key}`);
    attempts.add(key);
  }
  return history;
}

// 3. Shared filtering and duration summaries

/** Filters validated attempts; for example, exclusive migrations also require their backend. */
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
    const started = Date.parse(run.startedAt);
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

// 4. Outcome counts and separate success/failure timing tables

/** Renders validated history; for example, --all shows failure timings separately from successful runs. */
export function renderReport(history: History, options: Options): string {
  const runs = filterRuns(history.runs, options);
  const lines = [`Saved history: ${history.capturedAt}`, `Requested: ${options.start} → ${options.end}`];
  for (const branch of options.branch ? [options.branch] : ['dev', 'main'] as const) {
    const coverage = history.coverage[branch];
    const selected = runs.filter(run => run.branch === branch);
    lines.push('', branch === 'dev' ? 'Development PR checks' : 'Production deployments',
      `Available: ${coverage.start} → ${coverage.end}`);
    if (!coverage.completeOutcomes) lines.push('Saved sample contains successful first attempts only.');
    if (!selected.length) {
      lines.push('No saved attempts match.');
      continue;
    }
    const successes = selected.filter(run => run.conclusion === 'success');
    const cancelled = selected.filter(run => run.conclusion === 'cancelled').length;
    const failed = selected.filter(run => !['success', 'cancelled'].includes(run.conclusion));
    const reruns = selected.filter(run => run.attempt > 1).length;
    lines.push(`${selected.length} attempts; ${successes.length} successful; ${reruns} reruns`);
    if (options.outcome === 'all') {
      const completed = selected.length - cancelled;
      let rate = 'unavailable (saved successes only)';
      if (coverage.completeOutcomes) {
        rate = completed ? `${(successes.length / completed * 100).toFixed(1)}%` : 'unavailable (no completed attempts)';
      }
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

// 5. Read-only CLI

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const options = parseArgs(process.argv.slice(2));
    console.log(options.help ? HELP : renderReport(loadHistory(options.file), options));
  } catch (error: unknown) {
    console.error(`ci-history-report: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
