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
 * Blank lines are always excluded. Comments are excluded using line
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
 * @example usage().includes('--sql') // true
 */
function usage(): string {
  return `Usage: npm run report:loc
       npm run report:loc -- all
       npm run report:loc -- --sql

  all                Count TS, TSX, CSS, SQL, and Markdown files.
  --ts, --tsx        Count only TypeScript or React files.
  --css, --sql, --md Count only CSS, SQL, or Markdown files.
  -h, --help         Show this help.

Without a filter, count TS and TSX. Use only one filter.
Requires Git. Excludes blank and comment lines; separates TS/TSX source and tests.`;
}

/**
 * Selects the default TS/TSX report, all file types, or one language filter.
 * @param args - CLI tokens after the script name; omit the filter to count TS/TSX.
 * @returns Selected extensions and whether help was requested.
 * @throws When an argument is unknown or more than one filter is supplied.
 * @example parseArgs([]) // { extensions: ['ts', 'tsx'], help: false }
 * @example parseArgs(['--sql']).extensions // ['sql']
 */
function parseArgs(args: string[]): ReportOptions {
  const filters = args.filter(argument => argument !== '-h' && argument !== '--help');

  if (filters.length > 1) {
    throw new Error('Use only one file-type filter.');
  }

  const filter = filters[0];
  let extensions = APP_EXTENSIONS;

  if (filter === 'all') {
    extensions = ALL_EXTENSIONS;
  } else if (filter !== undefined) {
    const extension = filter.slice(2);

    if (!filter.startsWith('--') || !ALL_EXTENSIONS.includes(extension)) {
      throw new Error(`Unknown argument: ${filter}`);
    }

    extensions = [extension];
  }

  return { extensions, help: args.includes('-h') || args.includes('--help') };
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
 * Counts nonblank lines in text, excluding comment lines by file type.
 * @param text - File contents; comment detection uses trimmed line prefixes, not a parser.
 * @param extension - Lowercase extension without a dot; unknown types only skip blank lines.
 * @returns A non-negative line count; inline comments on code lines do not remove the line.
 * @example countLines('// heading\nconst x = 1;\n', 'ts') // 1
 */
export function countLines(text: string, extension: string): number {
  // 1. Select comment syntax and retain block state across lines.
  const supportsSlashComments = extension === 'ts' || extension === 'tsx';
  const supportsBlockComments = supportsSlashComments || extension === 'css' || extension === 'sql';
  let blockCommentEnd: string | null = null;
  let total = 0;

  // 2. Skip blank and comment lines.
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();

    if (!line) continue;

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
 * @param options - Requested extensions; help is handled by the CLI.
 * @returns Rows in extension order, with a test row after each TS/TSX source row.
 * @throws When repository discovery or file reading fails.
 * @example collectRows(repoRoot, { extensions: [], help: false }) // []
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
    const lines = countLines(text, extension);
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
 * @returns Report text with leading/trailing newlines; does not print or recount files.
 * @example formatReport([]).includes('TOTAL                     0') // true
 */
function formatReport(rows: ReportRow[]): string {
  // 1. Describe the counting policy and compute the combined total.
  const note = 'Excludes blank lines and lines starting or continuing comments.';

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
  console.log(formatReport(rows));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
