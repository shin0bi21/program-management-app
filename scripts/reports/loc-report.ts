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

interface CommentState {
  blockCommentEnd: string | null;
}

interface ReportRow {
  label: string;
  lines: number;
}

// ============================================================================
// 2. Main workflow
// ============================================================================

/**
 * Reads process arguments, discovers files, counts lines, and prints the LOC report.
 * @returns Nothing; prints help instead when requested, without scanning repository files.
 * @throws Argument, Git, and filesystem errors for the entrypoint to report with exit status 1.
 * @example // With process.argv ending in ['--help'], main() prints usage without counting files.
 */
function main(): void {
  // Step 1. Validate arguments before reading repository files.
  // npm consumes a bare --all and passes it through the lifecycle environment.
  const options = parseArgs(process.argv.slice(2), process.env.npm_config_all === 'true');

  if (options.help) {
    console.log(usage());
    return;
  }

  // Step 2. Discover files and count each selected file once.
  const rows = collectRows(REPO_ROOT, options);

  // Step 3. Print the category breakdown and total.
  console.log(formatReport(rows));
}

// ============================================================================
// 3. CLI arguments
// ============================================================================

/**
 * Selects the default TS/TSX report, all file types, or a combination of types.
 * @param args - CLI tokens after the script name.
 * @param npmAll - Whether npm consumed its own --all option for this run.
 * @returns Selected extensions and whether help was requested.
 * @throws When an argument is unknown.
 * @example parseArgs([], false) // { extensions: ['ts', 'tsx'], help: false }
 * @example parseArgs([], true).extensions // ['ts', 'tsx', 'css', 'sql', 'md']
 * @example parseArgs(['--ts', '--sql'], false).extensions // ['ts', 'sql']
 */
function parseArgs(args: string[], npmAll: boolean): ReportOptions {
  const filters = args.filter(argument => argument !== '-h' && argument !== '--help');

  let includeAll = npmAll;
  const selectedExtensions = new Set<string>();

  for (const filter of filters) {
    if (filter === '--all') {
      includeAll = true;
      continue;
    }

    const extension = filter.slice(2);

    if (!filter.startsWith('--') || !Object.hasOwn(LABELS, extension)) {
      throw new Error(`Unknown argument: ${filter}`);
    }

    selectedExtensions.add(extension);
  }

  let extensions = ['ts', 'tsx'];

  if (includeAll) {
    extensions = Object.keys(LABELS);
  } else if (selectedExtensions.size > 0) {
    extensions = [...selectedExtensions];
  }

  return { extensions, help: args.includes('-h') || args.includes('--help') };
}

/**
 * Supplies commands and options for the CLI help output.
 * @returns Help text without printing it or scanning repository files.
 * @example usage().includes('--sql') // true
 */
function usage(): string {
  return `Commands:
  npm run report:loc                 Count TypeScript and React source and tests.
  npm run report:loc --all           Count all supported types.
  npm run report:loc -- --all        Same report with a forwarded flag.
  npm run report:loc -- --css --sql  Count only CSS and SQL.
  npm run report:loc -- --help       Show this help (-h also works).

Supported type filters: --ts, --tsx, --css, --sql, --md.
Requires Git. Excludes blank and comment lines; separates TS/TSX source and tests.`;
}

// ============================================================================
// 4. Report collection
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
    if (extension === 'ts' || extension === 'tsx') {
      rows.push({ label: `Tests (.${extension})`, lines: count.tests });
    }
  }

  return rows;
}

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
// 5. Line counting
// ============================================================================

/**
 * Counts nonblank lines in text, excluding comment lines by file type.
 * @param text - File contents; comment detection uses trimmed line prefixes, not a parser.
 * @param extension - Lowercase extension without a dot; unknown types only skip blank lines.
 * @returns A non-negative line count; inline comments on code lines do not remove the line.
 * @example countLines('// heading\nconst x = 1;\n', 'ts') // 1
 */
export function countLines(text: string, extension: string): number {
  const commentState: CommentState = { blockCommentEnd: null };
  let total = 0;

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();

    if (!line || isComment(line, extension, commentState)) continue;

    total += 1;
  }

  return total;
}

/**
 * Checks whether a line is a comment and updates the file's block-comment state.
 * @param line - Trimmed, nonblank line, supplied in file order.
 * @param extension - Lowercase extension without a dot; unknown types have no comment syntax.
 * @param state - Mutable block state shared across lines of one file.
 * @returns Whether to exclude the entire line, including a block's closing line.
 * @example isComment('// heading', 'ts', { blockCommentEnd: null }) // true
 * @example isComment('SELECT 1;', 'sql', { blockCommentEnd: null }) // false
 */
function isComment(line: string, extension: string, state: CommentState): boolean {
  // A block that started on a comment line excludes its entire closing line too.
  if (state.blockCommentEnd) {
    if (line.includes(state.blockCommentEnd)) {
      state.blockCommentEnd = null;
    }
    return true;
  }

  const supportsSlashComments = extension === 'ts' || extension === 'tsx';
  const isSingleLineComment = (supportsSlashComments && line.startsWith('//'))
    || (extension === 'sql' && line.startsWith('--'));

  if (isSingleLineComment) return true;

  const supportsBlockComments = supportsSlashComments || extension === 'css' || extension === 'sql';
  const startsBlockComment = supportsBlockComments && (line.startsWith('/*')
    || (extension === 'tsx' && line.startsWith('{/*')));

  if (startsBlockComment) {
    if (!line.includes('*/')) {
      state.blockCommentEnd = '*/';
    }
    return true;
  }

  if (extension === 'md' && line.startsWith('<!--')) {
    if (!line.includes('-->')) {
      state.blockCommentEnd = '-->';
    }
    return true;
  }

  return false;
}

// ============================================================================
// 6. Report formatting
// ============================================================================

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
// 7. Entrypoint
// ============================================================================

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
