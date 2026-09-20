#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

interface DeploymentRecord {
  durationSeconds: number;
  startedAt: string;
  path: string;
  flags: Record<DeploymentComponent, boolean>;
}

interface DeploymentHistory {
  deployments: DeploymentRecord[];
}

interface DurationSummary {
  runs: number;
  meanSeconds: number;
  medianSeconds: number;
  minSeconds: number;
  maxSeconds: number;
}

type DeploymentComponent = 'frontend' | 'backend' | 'migrations' | 'infrastructure';

export interface ReportOptions {
  types: DeploymentComponent[];
  exclusive: boolean;
  since: string | null;
  until: string | null;
  file: string;
  help: boolean;
}

const DEFAULT_HISTORY_PATH = fileURLToPath(
  new URL('../../data/reports/deployment-history.json', import.meta.url),
);

const TABLE_PATHS = [
  ['frontend-only', 'Frontend only'],
  ['backend-only', 'Backend only'],
  ['backend+migrations', 'Backend + migrations'],
  ['full', 'Full deployment'],
  ['frontend+backend', 'Frontend + backend'],
  ['frontend+backend+migrations', 'Frontend + backend + migrations'],
  ['no-production-change', 'No production change'],
] as const;

const DEFAULT_PATHS = new Set([
  'frontend-only',
  'full',
  'frontend+backend',
  'frontend+backend+migrations',
]);

function usage(): string {
  return `Usage: npm run report:deployments -- [options]

Options:
  --type <component>  Include deployments using frontend, backend, migrations,
                      or infrastructure; repeat to require multiple components.
  --exclusive         Match only the selected component combination.
  --since <date>      Include deployments started on or after YYYY-MM-DD.
  --until <date>      Include deployments started on or before YYYY-MM-DD.
  --file <path>       Read another deployment-history JSON file.
  --help              Show this help.

Examples:
  npm run report:deployments
  npm run report:deployments -- --type frontend
  npm run report:deployments -- --type frontend --exclusive
  npm run report:deployments -- --type frontend --type backend
  npm run report:deployments -- --since 2026-09-01 --until 2026-09-30`;
}

function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

export function parseArgs(argv: string[]): ReportOptions {
  const options: ReportOptions = {
    types: [], exclusive: false, since: null, until: null, file: DEFAULT_HISTORY_PATH, help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--help') {
      options.help = true;
      continue;
    }
    if (argument === '--exclusive') {
      options.exclusive = true;
      continue;
    }
    if (!['--type', '--since', '--until', '--file'].includes(argument)) {
      throw new Error(`Unknown option: ${argument}`);
    }

    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`${argument} requires a value`);
    index += 1;

    if (argument === '--type') {
      if (!['frontend', 'backend', 'migrations', 'infrastructure'].includes(value)) {
        throw new Error('--type must be frontend, backend, migrations, or infrastructure');
      }
      if (!options.types.includes(value as DeploymentComponent)) {
        options.types.push(value as DeploymentComponent);
      }
    }
    if (argument === '--since') options.since = value;
    if (argument === '--until') options.until = value;
    if (argument === '--file') options.file = value;
  }

  if (options.exclusive && !options.types.length) throw new Error('--exclusive requires at least one --type');
  for (const [name, value] of [['--since', options.since], ['--until', options.until]] as const) {
    if (value && !validDate(value)) throw new Error(`${name} must use a valid YYYY-MM-DD date`);
  }
  if (options.since && options.until && options.since > options.until) {
    throw new Error('--since must not be after --until');
  }
  return options;
}

export function loadDeploymentHistory(path = DEFAULT_HISTORY_PATH): DeploymentHistory {
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as DeploymentHistory).deployments)) {
    throw new Error(`Invalid deployment history: ${path}`);
  }
  return parsed as DeploymentHistory;
}

export function summarizeDurations(deployments: DeploymentRecord[]): DurationSummary {
  if (!deployments.length) throw new Error('Cannot summarize an empty deployment group');

  const durations = deployments.map(({ durationSeconds }) => durationSeconds).sort((left, right) => left - right);
  if (durations.some((duration) => !Number.isFinite(duration) || duration < 0)) {
    throw new Error('Deployment durations must be finite, non-negative numbers');
  }

  const total = durations.reduce((sum, duration) => sum + duration, 0);
  const middle = Math.floor(durations.length / 2);
  const median = durations.length % 2
    ? durations[middle]
    : (durations[middle - 1] + durations[middle]) / 2;

  return {
    runs: durations.length,
    meanSeconds: total / durations.length,
    medianSeconds: median,
    minSeconds: durations[0],
    maxSeconds: durations.at(-1)!,
  };
}

export function filterDeployments(
  deployments: DeploymentRecord[],
  options: Pick<ReportOptions, 'types' | 'exclusive' | 'since' | 'until'>,
): DeploymentRecord[] {
  const selected = new Set(options.types);
  const expectedFlags: Record<DeploymentComponent, boolean> = {
    frontend: selected.has('frontend') || selected.has('infrastructure'),
    backend: selected.has('backend') || selected.has('migrations') || selected.has('infrastructure'),
    migrations: selected.has('migrations') || selected.has('infrastructure'),
    infrastructure: selected.has('infrastructure'),
  };

  return deployments.filter((deployment) => {
    const startedDate = deployment.startedAt.slice(0, 10);
    if (options.since && startedDate < options.since) return false;
    if (options.until && startedDate > options.until) return false;
    if (!selected.size) return true;

    if (options.exclusive) {
      return Object.entries(expectedFlags).every(
        ([component, expected]) => deployment.flags[component as DeploymentComponent] === expected,
      );
    }
    return options.types.every((component) => deployment.flags[component]);
  });
}

export function formatDuration(seconds: number): string {
  const rounded = Math.round(seconds);
  if (rounded < 60) return `${rounded}s`;

  const minutes = Math.floor(rounded / 60);
  const remainingSeconds = rounded % 60;
  return remainingSeconds ? `${minutes}m ${String(remainingSeconds).padStart(2, '0')}s` : `${minutes}m`;
}

export function renderDeploymentTable(
  deployments: DeploymentRecord[],
  includeEveryPath = false,
): string {
  const headers = ['Deployment path', 'Runs', 'Mean', 'Median', 'Range'];
  const rows: string[][] = [];

  for (const [path, label] of TABLE_PATHS) {
    const matching = deployments.filter((deployment) => deployment.path === path);
    if (!matching.length || (!includeEveryPath && !DEFAULT_PATHS.has(path))) continue;

    const summary = summarizeDurations(matching);
    rows.push([
      label,
      String(summary.runs),
      formatDuration(summary.meanSeconds),
      formatDuration(summary.medianSeconds),
      `${formatDuration(summary.minSeconds)}–${formatDuration(summary.maxSeconds)}`,
    ]);
  }

  const widths = headers.map((header, index) => Math.max(
    header.length,
    ...rows.map((row) => row[index].length),
  ));
  const renderRow = (cells: string[]): string => cells
    .map((cell, index) => index === 0 ? cell.padEnd(widths[index]) : cell.padStart(widths[index]))
    .join(' | ');
  const separator = widths.map((width) => '-'.repeat(width)).join('-+-');

  return [renderRow(headers), separator, ...rows.map(renderRow)].join('\n');
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }

  const history = loadDeploymentHistory(options.file);
  const deployments = filterDeployments(history.deployments, options);
  if (!deployments.length) throw new Error('No deployments match the selected filters');

  const filtering = Boolean(options.types.length || options.since || options.until);
  console.log(renderDeploymentTable(deployments, filtering));
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  try {
    main();
  } catch (error: unknown) {
    console.error(`deployment-history: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
