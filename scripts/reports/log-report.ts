#!/usr/bin/env node

/**
 * LOG REPORT — isolate and group problems from Docker, files, or pasted logs.
 *
 * Flow (see main()):
 *   1. Validate arguments and select the log source
 *   2. Read Docker logs, files, or stdin
 *   3. Classify entries and apply text/category filters
 *   4. Group matching failures and print their details and context
 *
 * Read-only: Docker input reads the selected Compose stack without changing it.
 * See usage() for parameter details and examples.
 */

// 1. Imports and report contracts

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const CATEGORIES = ['HTTP failures', 'Errors', 'Warnings', 'Application frames', 'Matches'] as const;
type Category = typeof CATEGORIES[number];

/** One complete capture; name labels locations and supplies the source outside Compose logs. */
interface LogInput {
  name: string;
  text: string;
}

export interface ReportOptions {
  docker: boolean;
  stack: 'development' | 'production' | null;
  /** Compose service names with docker enabled; otherwise file paths relative to the caller. */
  sources: string[];
  since: string | null;
  match: string | null;
  type: 'error' | 'warning' | 'http' | 'frame' | null;
  /** Non-negative safe integer counting neighboring capture lines on each side. */
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

/** Supplies CLI options and examples. @example usage().includes("--help") // true */
function usage(): string {
  return `Usage: npm run report:logs -- --docker backend --since 5m --match TypeError
       npm run report:logs -- --docker --since 1h --type error
       npm run report:logs -- console.txt --match "Failed to fetch" --context 4
       pbpaste | npm run report:logs

  --docker           Read Compose logs for named services, or all services when omitted.
  --development      Select docker-compose.yml explicitly; requires --docker.
  --production       Select docker-compose.prod.yml explicitly; requires --docker.
  --since <time>     Docker time window or timestamp (default: 5m).
  --match <text>     Match literal captured text and attached details, ignoring case.
  --type <category>  Select error (includes 5xx), warning (includes 4xx), http, or frame.
  --context <lines>  Lines around the first occurrence per group (default: 2; 0 hides context).
  -h, --help         Show this help.

Without files or --docker, reads stdin. Docker input requires Compose and detects the stack.
Text and category filters both apply; no matches exits successfully.
Locations are capture line numbers; neighboring context may include unrelated messages.`;
}

/**
 * Parses CLI tokens, throwing for missing values, unknown flags, or incompatible options.
 * @param argv - Arguments after the executable and script; tokens after -- are sources.
 * @returns Validated options; defaults include two context lines and no filters.
 * @example parseArgs(['--docker', 'backend', '--context', '0']).sources // ['backend']
 */
export function parseArgs(argv: string[]): ReportOptions {
  // 1. Establish defaults before applying caller-supplied options.
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

  // 2. Consume flags and sources in order; value flags advance past their value.
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    // Treat everything after -- as a source, including names starting with -.
    if (argument === '--') {
      options.sources.push(...argv.slice(index + 1));
      break;
    }

    if (argument === '--help' || argument === '-h') {
      options.help = true;
      continue;
    }

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

  // 3. Reject incompatible input selections and invalid Compose service names.
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

/**
 * Selects a repository Compose file, inspecting container labels when no stack is supplied.
 * Throws if Docker discovery fails or does not identify exactly one recognized configuration.
 * @param stack - Explicit stack, or null to inspect this checkout's stopped and running containers.
 * @example selectComposeFile('production').endsWith('docker-compose.prod.yml') // true
 */
function selectComposeFile(stack: ReportOptions['stack']): string {
  // 1. Honor an explicit stack without requiring container discovery.
  const developmentFile = resolve(REPO_ROOT, 'docker-compose.yml');
  const productionFile = resolve(REPO_ROOT, 'docker-compose.prod.yml');

  if (stack) return stack === 'production' ? productionFile : developmentFile;

  // 2. Include stopped services so failures remain inspectable after a container exits.
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

  // 3. Accept discovery only when it identifies one recognized repository stack.
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

/**
 * Reads a finite Docker capture, files, or stdin without changing services.
 * Throws on acquisition failures or interactive stdin; Docker commands time out after 30 seconds.
 * @param options - Validated source selection from parseArgs; Docker defaults to the last five minutes.
 * @returns One capture per file, or a single combined Docker/stdin capture.
 * @example loadLogs(parseArgs(['console.txt']))[0].name // 'console.txt', if the file exists
 */
export function loadLogs(options: ReportOptions): LogInput[] {
  // 1. Capture a finite Compose time window when Docker input is selected.
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

  // 2. Keep each supplied file as a separate capture with its own line numbers.
  if (options.sources.length) {
    return options.sources.map(name => ({ name, text: readFileSync(name, 'utf8') }));
  }

  // 3. Fall back to piped stdin; interactive input would wait without a finite capture.
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
  // 1. Separate the optional Compose service prefix from the message.
  const envelope = text.match(/^([a-zA-Z0-9_.-]+)\s+\| ?(.*)$/);
  let message = envelope?.[2] ?? text;

  // 2. Remove a leading timestamp while retaining it for occurrence details.
  const timestamp = message.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d{2}:\d{2})) /);
  if (timestamp) message = message.slice(timestamp[0].length);

  // 3. Preserve the raw line and capture location alongside the parsed fields.
  return {
    text,
    message,
    source: envelope?.[1] ?? input,
    timestamp: timestamp?.[1],
    location: `${input}:${lineNumber}`,
  };
}

/**
 * Removes HTTP hosts and replaces the entire query string with a marker.
 * @param url - Request target from a recognized HTTP failure, such as /api/users?page=2.
 * @example requestPath('https://example.test/api/users?token=secret') // '/api/users?…'
 */
function requestPath(url: string): string {
  return url.replace(/^https?:\/\/[^/]+/, '').replace(/\?.*$/, '?…') || '/';
}

/**
 * Recognizes backend request summaries, HTTP failures, and generic problem lines.
 * @param line - Message after removing any Compose prefix and leading timestamp.
 * @returns A category and display summary, plus backend request fields when present; null for unrecognized text.
 * @example classify('[rid] GET /api/tasks 500 InternalServerError: failed')?.request?.requestId // 'rid'
 */
function classify(line: string): ClassifiedEntry | null {
  // 1. Prefer backend summaries because they retain request and error metadata.
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

  // 2. Recognize other HTTP failures, including nginx's quoted request protocol.
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

  // 3. Check warnings and errors before treating source locations as application frames.
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
 * Captures problem events, attached backend details, and neighboring lines from each input.
 * Indented lines and closing braces/brackets attach until the next ordinary line in that service.
 * @param inputs - Complete captures, kept separate even when service names match.
 * @param contextSize - Non-negative safe integer counting raw lines on each side of each event.
 * @param match - Optional literal text allowing otherwise unrecognized lines to become Matches events.
 * @example collectEvents([{ name: 'stdin', text: 'Error: failed' }], 0).length // 1
 */
function collectEvents(inputs: LogInput[], contextSize: number, match?: string | null): LogEvent[] {
  // 1. Prepare case-insensitive matching and an ordered collection across captures.
  const needle = match?.toLowerCase();
  const events: LogEvent[] = [];

  for (const input of inputs) {
    // 2. Keep continuation state within each capture; a trailing newline adds no log line.
    const lines = input.text.split(/\r?\n/);
    if (lines.at(-1) === '') lines.pop();
    const pending = new Map<string, LogEvent>();

    for (const [index, text] of lines.entries()) {
      // 3. Attach backend continuations only to the pending event from the same service.
      const line = parseLine(text, input.name, index + 1);
      const previous = pending.get(line.source);
      const continuation = /^(?:\s+\S|[}\]])/.test(line.message);
      if (previous && continuation) {
        previous.details.push(line);
        continue;
      }
      pending.delete(line.source);

      // 4. Retain recognized problems or literal matches that can be filtered later.
      const entry = classify(line.message);
      if (!entry && (!needle || !text.toLowerCase().includes(needle))) continue;

      // 5. Bound neighboring context to this capture and mark the event's own line.
      const start = Math.max(0, index - contextSize);
      const end = Math.min(lines.length, index + contextSize + 1);
      const context = contextSize === 0 ? [] : lines.slice(start, end).map((value, offset) => {
        const number = start + offset + 1;
        const marker = number === index + 1 ? '>' : ' ';
        return `    ${marker} ${input.name}:${number} ${value}`;
      });
      // 6. Record the occurrence; only backend error summaries accept attached details.
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
 * HTTP failures remain selectable by HTTP or status severity: 5xx errors and 4xx warnings.
 * @param event - Classified event with its original line and attached backend continuations.
 * @param options - Literal case-insensitive text and category filters; context does not affect matching.
 * @example
 * const event = collectEvents([{ name: 'stdin', text: 'GET /api/tasks 500' }], 0)[0];
 * matchesEvent(event, { match: null, type: 'error', context: 0 }) // true
 */
function matchesEvent(event: LogEvent, options: Pick<ReportOptions, 'match' | 'type' | 'context'>): boolean {
  // 1. Apply literal matching to the original line and attached details, excluding context.
  if (options.match) {
    const needle = options.match.toLowerCase();
    const text = [event.line.text, ...event.details.map(line => line.text)].join('\n');
    if (!text.toLowerCase().includes(needle)) return false;
  } else if (event.category === 'Matches') {
    return false;
  }

  // 2. Select HTTP events by request category or status severity when a type is supplied.
  if (!options.type) return true;
  if (event.request) {
    if (options.type === 'http') return true;
    if (options.type === 'error') return event.request.status >= 500;
    if (options.type === 'warning') return event.request.status < 500;
    return false;
  }

  // 3. Compare non-request events with the selected diagnostic category.
  const selectedCategory = {
    error: 'Errors', warning: 'Warnings', http: 'HTTP failures', frame: 'Application frames',
  };
  return event.category === selectedCategory[options.type];
}

/**
 * Groups repeated events by source and diagnostic fields while retaining every occurrence.
 * Different stack/cause details remain separate groups; request IDs do not prevent grouping.
 * @param inputs - Named complete captures; locations use one-based lines within each capture.
 * @param options - Combined literal text/category filters and non-negative context lines per side.
 * @returns Category-ordered groups with all occurrence locations and only the first occurrence's context.
 * @example renderLogReport([], { match: null, type: null, context: 0 }).startsWith('No recognized') // true
 */
export function renderLogReport(inputs: LogInput[], options: Pick<ReportOptions, 'match' | 'type' | 'context'>): string {
  // 1. Collect and filter complete events before grouping diagnostic equivalents.
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

  // 2. Explain an empty result according to whether filters were requested.
  if (!groups.size) {
    return options.match || options.type
      ? 'No log entries match the selected filters.'
      : 'No recognized errors, warnings, HTTP failures, or application frames.';
  }

  // 3. Render groups in a stable category order, omitting empty categories.
  const output: string[] = [];
  for (const category of CATEGORIES) {
    const entries = [...groups.values()].filter(events => events[0].category === category);
    if (!entries.length) continue;
    if (output.length) output.push('');
    output.push(category);

    for (const events of entries) {
      // 4. Show the shared diagnosis once and retain every occurrence's metadata.
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
      // 5. Use the first occurrence for shared details and neighboring context.
      if (first.details.length) {
        output.push('    Details:', ...first.details.map(line => `      ${line.message}`));
      }
      output.push(...first.context);
    }
  }

  return output.join('\n');
}

// 5. Main workflow and entrypoint

/**
 * Reads process arguments and prints help or an acquired log report to stdout.
 * Argument and acquisition failures reach the entrypoint, which reports them with exit status 1.
 * @example // npm run report:logs -- --help prints usage without reading logs.
 */
function main(): void {
  // 1. Validate arguments and handle help before acquiring any logs.
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    console.log(usage());
    return;
  }

  // 2. Read the selected Docker, file, or stdin captures.
  const inputs = loadLogs(options);

  // 3. Classify, filter, and group the captures, then print the report.
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
