#!/usr/bin/env node

/**
 * LOG REPORT — isolate and group problems from Docker, files, or pasted logs.
 * Flow: validate options → read logs → select entries → group and report context.
 * Read-only: Docker input reads the selected Compose stack without changing it.
 * Usage: npm run report:logs -- --docker backend --since 5m --match TypeError
 */

// 1. Imports and report contracts

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CATEGORIES = ['HTTP failures', 'Errors', 'Warnings', 'Application frames', 'Matches'] as const;
type Category = typeof CATEGORIES[number];

interface LogInput {
  name: string;
  text: string;
}

export interface ReportOptions {
  docker: boolean;
  stack: 'development' | 'production' | null;
  sources: string[];
  since: string | null;
  match: string | null;
  type: 'error' | 'warning' | 'http' | 'frame' | null;
  context: number;
  help: boolean;
}

// 2. CLI arguments

function usage(): string {
  return `Usage: npm run report:logs -- [options] [LOG_FILE ...]
       npm run report:logs -- --docker [SERVICE ...] [options]

  Options:
    --docker           Read Compose logs; detect the stack from container labels.
    --development      Select docker-compose.yml explicitly; requires --docker.
    --production       Select docker-compose.prod.yml explicitly; requires --docker.
    --since <time>     Docker time window, such as 5m or 1h (default: 5m).
    --match <text>     Match literal text, ignoring case (for example TypeError).
    --type <category>  Select error, warning, http, or frame entries.
    --context <lines>  Lines around each group's first occurrence (default: 2).
    --help             Show this help.

  Without files or --docker, reads stdin. Without filters, groups recognized problems.
  Source locations refer to lines in the captured input. Context shows proximity,
  not proof that adjacent messages have the same cause.

  Examples:
    npm run report:logs -- --docker backend --since 5m --match TypeError
    npm run report:logs -- --docker --since 1h --type error
    npm run report:logs -- console.txt --match "Failed to fetch" --context 4
    pbpaste | npm run report:logs`;
}

export function parseArgs(argv: string[]): ReportOptions {
  const options: ReportOptions = {
    docker: false,
    stack: null,
    sources: [],
    since: null,
    match: null,
    type: null,
    context: 2,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    // Treat everything after -- as a source, including names starting with -.
    if (argument === '--') {
      options.sources.push(...argv.slice(index + 1));
      break;
    }

    // Select the usage-help path.
    if (argument === '--help' || argument === '-h') {
      options.help = true;
      continue;
    }

    // Select Docker Compose logs as the input source.
    if (argument === '--docker') {
      options.docker = true;
      continue;
    }

    if (argument === '--production' || argument === '--development') {
      const stack = argument === '--production' ? 'production' : 'development';
      if (options.stack && options.stack !== stack) {
        throw new Error('--development and --production cannot be combined');
      }

      options.stack = stack;
      continue;
    }

    if (!argument.startsWith('-')) {
      options.sources.push(argument);
      continue;
    }

    if (!['--since', '--match', '--type', '--context'].includes(argument)) {
      throw new Error(`Unknown option: ${argument}`);
    }

    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`${argument} requires a value`);
    }

    index += 1;

    switch (argument) {
      case '--since':
        options.since = value;
        break;
      case '--match':
        options.match = value;
        break;
      case '--type':
        if (!['error', 'warning', 'http', 'frame'].includes(value)) {
          throw new Error('--type must be error, warning, http, or frame');
        }

        options.type = value as ReportOptions['type'];
        break;
      case '--context': {
        const context = Number(value);
        if (!/^\d+$/.test(value) || !Number.isSafeInteger(context)) {
          throw new Error('--context must be a non-negative integer');
        }

        options.context = context;
        break;
      }
    }
  }

  if (options.stack && !options.docker) {
    throw new Error('--development and --production require --docker');
  }

  if (options.since && !options.docker) {
    throw new Error('--since requires --docker');
  }

  if (options.docker && options.sources.some(source => !/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(source))) {
    throw new Error('Docker sources must be Compose service names');
  }

  return options;
}

// 3. Log acquisition

function selectComposeFile(stack: ReportOptions['stack']): string {
  const developmentFile = resolve(REPO_ROOT, 'docker-compose.yml');
  const productionFile = resolve(REPO_ROOT, 'docker-compose.prod.yml');

  if (stack) return stack === 'production' ? productionFile : developmentFile;

  // Include stopped services so failures remain inspectable after a container exits.
  const output = execFileSync('docker', [
    'ps', '--all',
    '--filter', `label=com.docker.compose.project.working_dir=${REPO_ROOT}`,
    '--filter', 'label=com.docker.compose.oneoff=False',
    '--format', '{{.Label "com.docker.compose.project.config_files"}}',
  ], {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
    timeout: 30_000,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const configurations = [...new Set(output.split(/\r?\n/).map(line => line.trim()).filter(Boolean))];
  if (configurations.length !== 1) {
    throw new Error('Cannot identify one Compose stack for this checkout. Choose --development or --production.');
  }

  const composeFile = configurations[0];
  if (composeFile !== developmentFile && composeFile !== productionFile) {
    throw new Error('Containers use an unrecognized Compose configuration. Choose --development or --production to read a repository stack explicitly.');
  }

  return composeFile;
}

export function loadLogs(options: ReportOptions): LogInput[] {
  if (options.docker) {
    const composeFile = selectComposeFile(options.stack);

    const text = execFileSync('docker', [
      'compose', '--project-directory', REPO_ROOT, '-f', composeFile,
      'logs', '--no-color', '--timestamps', '--since', options.since ?? '5m', ...options.sources,
    ], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      timeout: 30_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    return [{ name: `docker:${options.sources.join(',') || 'all'}`, text }];
  }

  if (options.sources.length) {
    return options.sources.map(name => ({ name, text: readFileSync(name, 'utf8') }));
  }

  if (process.stdin.isTTY) {
    throw new Error('Supply log files, pipe logs through stdin, or use --docker');
  }

  return [{ name: 'stdin', text: readFileSync(0, 'utf8') }];
}

// 4. Classification and grouping

function classify(line: string): { category: Category; message: string } | null {
  // Ignore Compose prefixes and ISO timestamps when grouping repeated messages.
  const message = line.trim()
    .replace(/^[a-zA-Z0-9_.-]+\s+\|\s*/, '')
    .replace(/^\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d{2}:\d{2})\s+/, '');

  const http = message.match(/\b(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s+(https?:\/\/\S+|\/\S*)\s+([45]\d{2})\b/);
  if (http) {
    const [, method, url, status] = http;
    const path = url.replace(/^https?:\/\/[^/]+/, '').replace(/\?.*$/, '?…') || '/';

    return { category: 'HTTP failures', message: `${method} ${path} -> ${status}` };
  }

  if (/react-router-dom.*(?:logDeprecation|warnOnce)|logV6DeprecationWarnings/.test(message)) {
    return { category: 'Warnings', message: 'React Router deprecation warning' };
  }

  if (/\b(?:error|fatal|unhandled|uncaught)\b|\b\w*Error:/i.test(message)) {
    return { category: 'Errors', message };
  }

  if (/\b(?:warn|warning|deprecated|deprecation)\b/i.test(message)) {
    return { category: 'Warnings', message };
  }

  if (/\.(?:tsx?|jsx?):\d+/.test(message) && !/node_modules|chunk-[A-Z0-9]+|react-router-dom/.test(message)) {
    return { category: 'Application frames', message };
  }

  return null;
}

export function renderLogReport(inputs: LogInput[], options: Pick<ReportOptions, 'match' | 'type' | 'context'>): string {
  const groups = new Map<string, {
    category: Category;
    message: string;
    locations: string[];
    context: string[];
  }>();
  const selectedCategory: Partial<Record<NonNullable<ReportOptions['type']>, Category>> = {
    error: 'Errors',
    warning: 'Warnings',
    http: 'HTTP failures',
    frame: 'Application frames',
  };
  const needle = options.match?.toLowerCase();

  for (const input of inputs) {
    const lines = input.text.split(/\r?\n/);
    if (lines.at(-1) === '') lines.pop();

    for (const [index, line] of lines.entries()) {
      if (needle && !line.toLowerCase().includes(needle)) continue;

      const entry = classify(line);
      if (options.type && entry?.category !== selectedCategory[options.type]) continue;
      if (!entry && !needle) continue;

      const category = entry?.category ?? 'Matches';
      const message = entry?.message ?? line.trim();
      const key = `${category}\0${message}`;
      const location = `${input.name}:${index + 1}`;
      const existing = groups.get(key);

      if (existing) {
        existing.locations.push(location);
        continue;
      }

      const start = Math.max(0, index - options.context);
      const end = Math.min(lines.length, index + options.context + 1);
      const context: string[] = [];

      if (options.context !== 0) {
        const contextLines = lines.slice(start, end);

        for (const [offset, text] of contextLines.entries()) {
          const lineNumber = start + offset + 1;
          const marker = lineNumber === index + 1 ? '>' : ' ';

          context.push(`    ${marker} ${input.name}:${lineNumber} ${text}`);
        }
      }

      groups.set(key, { category, message, locations: [location], context });
    }
  }

  if (!groups.size) {
    return options.match || options.type
      ? 'No log entries match the selected filters.'
      : 'No recognized errors, warnings, HTTP failures, or application frames.';
  }

  const output: string[] = [];
  for (const category of CATEGORIES) {
    const entries = [...groups.values()].filter(entry => entry.category === category);
    if (!entries.length) continue;

    if (output.length) output.push('');
    output.push(category);

    for (const entry of entries) {
      output.push(
        `  ${entry.locations.length}x ${entry.message}`,
        `    Locations: ${entry.locations.join(', ')}`,
        ...entry.context,
      );
    }
  }

  return output.join('\n');
}

// 5. Main workflow and entrypoint

function main(): void {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    console.log(usage());
    return;
  }

  const inputs = loadLogs(options);
  console.log(renderLogReport(inputs, options));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(`log-report: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
