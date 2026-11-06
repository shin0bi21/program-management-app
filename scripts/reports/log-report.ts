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

interface RequestFailure {
  method: string;
  path: string;
  status: number;
  requestId?: string;
  errorClass?: string;
  errorMessage?: string;
}

interface ParsedLine {
  text: string;
  message: string;
  source: string;
  timestamp?: string;
  location: string;
}

interface ClassifiedEntry {
  category: Category;
  message: string;
  request?: RequestFailure;
}

interface LogEvent extends ClassifiedEntry {
  line: ParsedLine;
  details: ParsedLine[];
  context: string[];
}

// 2. CLI arguments

/** Returns CLI usage and examples without reading logs. @example usage().includes("--docker") // true */
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
  Reports retain services, request IDs, timestamps, and backend error details.
  Source locations refer to lines in the captured input. Context shows proximity,
  not proof that adjacent messages have the same cause.

  Examples:
    npm run report:logs -- --docker backend --since 5m --match TypeError
    npm run report:logs -- --docker --since 1h --type error
    npm run report:logs -- console.txt --match "Failed to fetch" --context 4
    pbpaste | npm run report:logs`;
}

/** Parses CLI tokens and rejects incompatible options. @example parseArgs(["--docker"]).docker // true */
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

/** Selects an explicit or uniquely detected repository stack. @example selectComposeFile("production").endsWith("docker-compose.prod.yml") // true */
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

/** Reads a finite Docker capture, files, or stdin without changing services. @example loadLogs(options)[0].name // "docker:all" for all services */
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

/**
 * Separates a Compose service and timestamp from a captured log line.
 * @param text - One unmodified captured line, including any indentation.
 * @param input - File or Docker capture name used when no service is present.
 * @param lineNumber - One-based location in that capture.
 * @example parseLine('backend | Error: failed', 'stdin', 1).source // 'backend'
 */
function parseLine(text: string, input: string, lineNumber: number): ParsedLine {
  const envelope = text.match(/^([a-zA-Z0-9_.-]+)\s+\| ?(.*)$/);
  let message = envelope?.[2] ?? text;
  const timestamp = message.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d{2}:\d{2})) /);
  if (timestamp) message = message.slice(timestamp[0].length);

  return {
    text,
    message,
    source: envelope?.[1] ?? input,
    timestamp: timestamp?.[1],
    location: `${input}:${lineNumber}`,
  };
}

/**
 * Removes HTTP hosts and query values while retaining the requested path.
 * @example requestPath('https://example.test/api/users?token=secret') // '/api/users?…'
 */
function requestPath(url: string): string {
  return url.replace(/^https?:\/\/[^/]+/, '').replace(/\?.*$/, '?…') || '/';
}

/**
 * Recognizes backend request summaries, HTTP failures, and generic problem lines.
 * @returns Existing backend fields separately from the display summary, or null.
 * @example classify('[rid] GET /api/tasks 500 InternalServerError: failed')?.request?.requestId // 'rid'
 */
function classify(line: string): ClassifiedEntry | null {
  const message = line.trim();
  const backend = message.match(/^\[([\w-]+)\] (GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD) (\S+) ([45]\d{2}) ([\w.]+): (.*)$/);
  if (backend) {
    const [, requestId, method, url, status, errorClass, rawMessage] = backend;
    let errorMessage = rawMessage;
    // Node inspection may repeat either a subclass name or Error [customName].
    const repeatedHeadings = [` ${errorClass}: `, ` Error [${errorClass}]: `];
    for (const heading of repeatedHeadings) {
      const repeatedAt = rawMessage.indexOf(heading);
      if (repeatedAt === -1) continue;
      const summaryMessage = rawMessage.slice(0, repeatedAt);
      const inspectedMessage = rawMessage.slice(repeatedAt + heading.length);
      if (inspectedMessage === summaryMessage || inspectedMessage === `${summaryMessage} {`) {
        errorMessage = summaryMessage;
        break;
      }
    }

    const path = requestPath(url);

    return {
      category: 'HTTP failures',
      message: `${method} ${path} -> ${status}`,
      request: { method, path, status: Number(status), requestId, errorClass, errorMessage },
    };
  }

  // nginx access logs include a protocol inside the quoted request.
  const http = message.match(/\b(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s+(https?:\/\/\S+|\/\S*)\s+(?:HTTP\/\d(?:\.\d)?"\s+)?([45]\d{2})\b/);
  if (http) {
    const [, method, url, status] = http;
    const path = requestPath(url);

    return {
      category: 'HTTP failures',
      message: `${method} ${path} -> ${status}`,
      request: { method, path, status: Number(status) },
    };
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

/**
 * Captures problem events and their first-occurrence context from each input.
 * Only indented continuations from the same service join a backend error event.
 * @example collectEvents([{ name: 'stdin', text: 'Error: failed' }], 0).length // 1
 */
function collectEvents(inputs: LogInput[], contextSize: number, match?: string | null): LogEvent[] {
  const needle = match?.toLowerCase();
  const events: LogEvent[] = [];

  for (const input of inputs) {
    const lines = input.text.split(/\r?\n/);
    if (lines.at(-1) === '') lines.pop();
    const pending = new Map<string, LogEvent>();

    for (const [index, text] of lines.entries()) {
      const line = parseLine(text, input.name, index + 1);
      const previous = pending.get(line.source);
      const continuation = /^(?:\s+\S|[}\]])/.test(line.message);
      if (previous && continuation) {
        previous.details.push(line);
        continue;
      }
      pending.delete(line.source);

      const entry = classify(line.message);
      if (!entry && (!needle || !text.toLowerCase().includes(needle))) continue;

      const start = Math.max(0, index - contextSize);
      const end = Math.min(lines.length, index + contextSize + 1);
      const context = contextSize === 0 ? [] : lines.slice(start, end).map((value, offset) => {
        const number = start + offset + 1;
        const marker = number === index + 1 ? '>' : ' ';
        return `    ${marker} ${input.name}:${number} ${value}`;
      });
      const event: LogEvent = {
        category: entry?.category ?? 'Matches',
        message: entry?.message ?? line.message.trim(),
        request: entry?.request,
        line,
        details: [],
        context,
      };
      events.push(event);
      if (entry?.request?.errorClass) pending.set(line.source, event);
    }
  }

  return events;
}

/**
 * Applies text and category filters to complete events, including their details.
 * HTTP failures remain selectable by both HTTP and their backend severity.
 * @example matchesEvent(event, { match: null, type: 'error', context: 0 }) // true for a 500
 */
function matchesEvent(event: LogEvent, options: Pick<ReportOptions, 'match' | 'type' | 'context'>): boolean {
  if (options.match) {
    const needle = options.match.toLowerCase();
    const text = [event.line.text, ...event.details.map(line => line.text)].join('\n');
    if (!text.toLowerCase().includes(needle)) return false;
  } else if (event.category === 'Matches') {
    return false;
  }

  if (!options.type) return true;
  if (event.request) {
    if (options.type === 'http') return true;
    if (options.type === 'error') return event.request.status >= 500;
    if (options.type === 'warning') return event.request.status < 500;
    return false;
  }

  const selectedCategory = {
    error: 'Errors', warning: 'Warnings', http: 'HTTP failures', frame: 'Application frames',
  };
  return event.category === selectedCategory[options.type];
}

/**
 * Groups repeated events by source and diagnostic fields while retaining every occurrence.
 * Different stack/cause details remain separate groups; request IDs do not prevent grouping.
 * @example renderLogReport([], { match: null, type: null, context: 0 }).startsWith('No recognized') // true
 */
export function renderLogReport(inputs: LogInput[], options: Pick<ReportOptions, 'match' | 'type' | 'context'>): string {
  const groups = new Map<string, LogEvent[]>();
  for (const event of collectEvents(inputs, options.context, options.match)) {
    if (!matchesEvent(event, options)) continue;
    const key = JSON.stringify([
      event.line.source, event.category, event.message,
      event.request?.errorClass, event.request?.errorMessage,
      event.details.map(line => line.message),
    ]);
    const existing = groups.get(key);
    if (existing) existing.push(event);
    else groups.set(key, [event]);
  }

  if (!groups.size) {
    return options.match || options.type
      ? 'No log entries match the selected filters.'
      : 'No recognized errors, warnings, HTTP failures, or application frames.';
  }

  const output: string[] = [];
  for (const category of CATEGORIES) {
    const entries = [...groups.values()].filter(events => events[0].category === category);
    if (!entries.length) continue;
    if (output.length) output.push('');
    output.push(category);

    for (const events of entries) {
      const first = events[0];
      output.push(`  ${events.length}x ${first.message}`, `    Source: ${first.line.source}`);
      if (first.request?.errorClass) {
        output.push(`    Error: ${first.request.errorClass}: ${first.request.errorMessage}`);
      }
      output.push('    Occurrences:');
      for (const event of events) {
        const fields = [event.line.location];
        if (event.line.timestamp) fields.push(`time=${event.line.timestamp}`);
        if (event.request?.requestId) fields.push(`request=${event.request.requestId}`);
        output.push(`      ${fields.join(' | ')}`);
      }
      if (first.details.length) {
        output.push('    Details:', ...first.details.map(line => `      ${line.message}`));
      }
      output.push(...first.context);
    }
  }

  return output.join('\n');
}

// 5. Main workflow and entrypoint

/** Parses options, reads logs, and prints the report; throws acquisition failures. @example // node scripts/reports/log-report.ts --help */
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
