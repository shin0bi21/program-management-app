#!/usr/bin/env node

/**
 * LOC REPORT — count repository lines by file type, separating TS/TSX tests.
 *
 * Flow (see main()):
 *   1. Validate arguments and select file types
 *   2. Discover tracked and nonignored untracked files
 *   3. Count lines, separating TS/TSX source and tests
 *   4. Print the category totals
 *
 * Requires Git. Scans tracked and nonignored untracked regular files, excluding
 * dependency/build directories and symlinks. TS/TSX .test and .spec files have
 * separate rows. No files are changed.
 *
 * Blank lines are always excluded. Comments are excluded by default using line
 * prefixes and block endings, without parsing strings, templates, or Markdown
 * code fences; a comment block's closing line is excluded even if code follows.
 * See usage() for parameter details and examples.
 */

// ============================================================================
// 1. Imports and report contracts
// ============================================================================

import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const APP_EXTENSIONS = ['ts', 'tsx'];
const ALL_EXTENSIONS = ['ts', 'tsx', 'css', 'sql', 'md'];
const EXCLUDED_DIRECTORIES = new Set(['.git', 'node_modules', 'dist', 'build']);
const LABELS: Record<string, string> = {
  ts: 'TypeScript (.ts)',
  tsx: 'React (.tsx)',
  css: 'CSS (.css)',
  sql: 'SQL (.sql)',
  md: 'Docs (.md)',
};

interface ReportOptions {
  extensions: string[];
  ignoreComments: boolean;
  help: boolean;
}

interface ReportRow {
  label: string;
  lines: number;
}

// ============================================================================
// 2. CLI arguments
// ============================================================================

/**
 * Supplies commands and options for the CLI help output.
 * @returns Help text without printing it or scanning repository files.
 * @example usage().includes('--include-comments') // true
 */
function usage(): string {
  return `Usage: npm run report:loc
       npm run report:loc -- all
       npm run report:loc -- ts tsx sql
       npm run report:loc -- all --include-comments

  app                Count TS and TSX files (default).
  all                Count TS, TSX, CSS, SQL, and Markdown files.
  EXTENSION...       Count exact, case-sensitive extensions without dots.
  --include-comments Count comments as well as code.
  -h, --help         Show this help.

Do not combine app or all with other extensions.`;
}

/**
 * Resolves LOC modes, extensions, and flags from args.
 * @param args - CLI tokens after the script name; omit the mode to count TS/TSX.
 * @returns Selected extensions, comment filtering enabled by default, and the help flag.
 * @throws When a flag is unknown or a preset mode is combined with another type.
 * @example parseArgs([]) // { extensions: ['ts', 'tsx'], ignoreComments: true, help: false }
 * @example parseArgs(['all', '--include-comments']).ignoreComments // false
 */
function parseArgs(args: string[]): ReportOptions {
  // 1. Default to source counting and gather requested types separately from flags.
  const options: ReportOptions = { extensions: [], ignoreComments: true, help: false };
  const requestedTypes: string[] = [];

  // 2. Apply flags and reject malformed extension tokens.
  for (const argument of args) {
    switch (argument) {
      case '--include-comments':
        options.ignoreComments = false;
        break;

      case '-h':
      case '--help':
        options.help = true;
        break;

      default:
        if (!/^[a-zA-Z0-9]+$/.test(argument)) {
          throw new Error(`Unknown argument: ${argument}`);
        }

        requestedTypes.push(argument);
    }
  }

  // 3. Resolve a standalone preset or deduplicate explicit extensions.
  const mode = requestedTypes[0] ?? 'app';

  if (mode === 'app' || mode === 'all') {
    if (requestedTypes.length > 1) {
      throw new Error('Use app, all, or a list of extensions.');
    }

    options.extensions = mode === 'app' ? APP_EXTENSIONS : ALL_EXTENSIONS;
  } else {
    options.extensions = [...new Set(requestedTypes)];
  }

  return options;
}

// ============================================================================
// 3. Repository file discovery
// ============================================================================

/**
 * Lists existing regular files from Git's tracked and nonignored untracked paths.
 * @param repoRoot - Repository directory used for Git commands and relative paths.
 * @returns Unique repository-relative paths, excluding dependency/build folders and symlinks.
 * @throws When Git discovery or filesystem inspection fails.
 * @example repositoryFiles(repoRoot).includes('node_modules/pkg/index.ts') // false
 */
function repositoryFiles(repoRoot: string): string[] {
  // 1. Discover tracked and untracked paths using the repository ignore files.
  const args = ['ls-files', '--cached', '--others', '--exclude-standard', '-z'];

  for (const ignoreFile of ['.codexignore', '.openaiignore']) {
    if (existsSync(resolve(repoRoot, ignoreFile))) {
      args.push(`--exclude-from=${ignoreFile}`);
    }
  }

  const output = execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' });

  // Git's NUL separators preserve filenames containing spaces or newlines.
  const paths = [...new Set(output.split('\0').filter(Boolean))];

  // 2. Exclude dependencies, build outputs, missing files, and symlinks.
  return paths.filter(path => {
    const isExcluded = path.split('/').some(part => EXCLUDED_DIRECTORIES.has(part));

    if (isExcluded) return false;

    const absolutePath = resolve(repoRoot, path);

    return existsSync(absolutePath) && lstatSync(absolutePath).isFile();
  });
}

// ============================================================================
// 4. Line counting
// ============================================================================

/**
 * Counts nonblank lines in text, optionally filtering comment lines by file type.
 * @param text - File contents; comment detection uses trimmed line prefixes, not a parser.
 * @param extension - Lowercase extension without a dot; unknown types only skip blank lines.
 * @param ignoreComments - Excludes comment starts and block continuations when true (default).
 * @returns A non-negative line count; inline comments on code lines do not remove the line.
 * @example countLines('// heading\nconst x = 1;\n', 'ts') // 1
 * @example countLines('// heading\nconst x = 1;\n', 'ts', false) // 2
 */
export function countLines(text: string, extension: string, ignoreComments: boolean = true): number {
  // 1. Select comment syntax and retain block state across lines.
  const supportsSlashComments = extension === 'ts' || extension === 'tsx';
  const supportsBlockComments = supportsSlashComments || extension === 'css' || extension === 'sql';
  let blockCommentEnd: string | null = null;
  let total = 0;

  // 2. Skip blanks and apply the requested comment policy to each line.
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();

    if (!line) continue;

    if (!ignoreComments) {
      total += 1;
      continue;
    }

    // A block that started on a comment line excludes its entire closing line too.
    if (blockCommentEnd) {
      if (line.includes(blockCommentEnd)) {
        blockCommentEnd = null;
      }
      continue;
    }

    const isSingleLineComment = (supportsSlashComments && line.startsWith('//'))
      || (extension === 'sql' && line.startsWith('--'));

    if (isSingleLineComment) continue;

    const startsBlockComment = supportsBlockComments && (line.startsWith('/*')
      || (extension === 'tsx' && line.startsWith('{/*')));

    if (startsBlockComment) {
      if (!line.includes('*/')) {
        blockCommentEnd = '*/';
      }
      continue;
    }

    if (extension === 'md' && line.startsWith('<!--')) {
      if (!line.includes('-->')) {
        blockCommentEnd = '-->';
      }
      continue;
    }

    // 3. Count only lines that survive blank and comment filtering.
    total += 1;
  }

  return total;
}

// ============================================================================
// 5. Report aggregation and formatting
// ============================================================================

/**
 * Counts selected repository file types, separating TS/TSX source from tests.
 * @param repoRoot - Repository directory to inspect without changing files.
 * @param options - Requested extensions and comment policy; help is handled by the CLI.
 * @returns Rows in extension order, with a test row after each TS/TSX source row.
 * @throws When repository discovery or file reading fails.
 * @example collectRows(repoRoot, { extensions: [], ignoreComments: true, help: false }) // []
 */
export function collectRows(repoRoot: string, options: ReportOptions): ReportRow[] {
  // 1. Allocate source and test totals for each selected extension.
  const counts = new Map(options.extensions.map(extension => [extension, { source: 0, tests: 0 }]));

  // 2. Count each matching file under its source or test owner.
  for (const path of repositoryFiles(repoRoot)) {
    const extension = extname(path).slice(1);
    const count = counts.get(extension);

    if (!count) continue;

    const text = readFileSync(resolve(repoRoot, path), 'utf8');
    const lines = countLines(text, extension, options.ignoreComments);
    const isTest = /\.(?:test|spec)\.(?:ts|tsx)$/.test(path);

    if (isTest) {
      count.tests += lines;
    } else {
      count.source += lines;
    }
  }

  // 3. Preserve extension order, placing TS/TSX test totals after source totals.
  const rows: ReportRow[] = [];

  for (const [extension, count] of counts) {
    rows.push({ label: LABELS[extension] ?? `.${extension}`, lines: count.source });
    if (APP_EXTENSIONS.includes(extension)) {
      rows.push({ label: `Tests (.${extension})`, lines: count.tests });
    }
  }

  return rows;
}

/**
 * Formats rows as a table with the counting policy and summed total.
 * @param rows - Report labels and non-negative line counts in display order.
 * @param ignoreComments - Selects the note describing the policy used to count rows.
 * @returns Report text with leading/trailing newlines; does not print or recount files.
 * @example formatReport([], true).includes('TOTAL                     0') // true
 */
function formatReport(rows: ReportRow[], ignoreComments: boolean): string {
  // 1. Describe the counting policy and compute the combined total.
  const note = ignoreComments
    ? 'Excludes blank lines and lines starting or continuing comments.'
    : 'Excludes blank lines; includes comments.';

  const divider = formatRow('--------------------', '------');
  const total = rows.reduce((sum, row) => sum + row.lines, 0);

  // 2. Align category rows and the total using the same column format.
  return [
    '', note,
    formatRow('Type', 'Lines'), divider,
    ...rows.map(row => formatRow(row.label, row.lines)),
    divider, formatRow('TOTAL', total), '',
  ].join('\n');
}

/**
 * Pads label and value into the table's two columns without truncating either.
 * @returns A label padded to at least 20 characters, a space, and a value padded to at least 6.
 * @example formatRow('', '').length // 27
 */
function formatRow(label: string, value: string | number): string {
  return `${label.padEnd(20)} ${String(value).padStart(6)}`;
}

// ============================================================================
// 6. Main workflow and entrypoint
// ============================================================================

/**
 * Reads process arguments, discovers files, counts lines, and prints the LOC report.
 * @returns Nothing; prints help instead when requested, without scanning repository files.
 * @throws Argument, Git, and filesystem errors for the entrypoint to report with exit status 1.
 * @example // With process.argv ending in ['--help'], main() prints usage without counting files.
 */
function main(): void {
  // Step 1. Validate arguments before reading repository files.
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    console.log(usage());
    return;
  }

  // Step 2. Discover files and count each selected file once.
  const rows = collectRows(REPO_ROOT, options);

  // Step 3. Print the category breakdown and total.
  console.log(formatReport(rows, options.ignoreComments));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
