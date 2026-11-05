#!/usr/bin/env node

/**
 * LOC REPORT — count repository lines by file type, separating TS/TSX tests.
 *
 * Flow: validate options → discover files → count lines → print the report.
 * Blank lines never count. --ignore-comments uses line prefixes and block endings,
 * without parsing strings, templates, or Markdown code fences. No files are changed.
 *
 * Usage:
 *   npm run report:loc
 *   npm run report:loc -- all --ignore-comments
 *   npm run report:loc -- ts tsx sql
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

function usage(): string {
  return `Usage: npm run report:loc -- [app | all | EXTENSION...] [--ignore-comments]

  app                Count TS and TSX files (default).
  all                Count TS, TSX, CSS, SQL, and Markdown files.
  EXTENSION...       Count the requested file extensions.
  --ignore-comments  Skip lines starting with comments and their block continuations.
  -h, --help         Show this help.`;
}

function parseArgs(args: string[]): ReportOptions {
  const options: ReportOptions = { extensions: [], ignoreComments: false, help: false };
  const requestedTypes: string[] = [];

  for (const argument of args) {
    switch (argument) {
      case '--ignore-comments':
        options.ignoreComments = true;
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

function repositoryFiles(repoRoot: string): string[] {
  // Git supplies tracked and untracked files while respecting repository ignores.
  const args = ['ls-files', '--cached', '--others', '--exclude-standard', '-z'];
  for (const ignoreFile of ['.codexignore', '.openaiignore']) {
    if (existsSync(resolve(repoRoot, ignoreFile))) {
      args.push(`--exclude-from=${ignoreFile}`);
    }
  }

  const output = execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' });
  const paths = [...new Set(output.split('\0').filter(Boolean))];

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

export function countLines(text: string, extension: string, ignoreComments = true): number {
  const supportsSlashComments = extension === 'ts' || extension === 'tsx';
  const supportsBlockComments = supportsSlashComments || extension === 'css' || extension === 'sql';
  let blockCommentEnd: string | null = null;
  let total = 0;

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

    total += 1;
  }

  return total;
}

// ============================================================================
// 5. Report aggregation and formatting
// ============================================================================

export function collectRows(repoRoot: string, options: ReportOptions): ReportRow[] {
  const counts = new Map(options.extensions.map(extension => [extension, { source: 0, tests: 0 }]));

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

  const rows: ReportRow[] = [];
  for (const [extension, count] of counts) {
    rows.push({ label: LABELS[extension] ?? `.${extension}`, lines: count.source });
    if (APP_EXTENSIONS.includes(extension)) {
      rows.push({ label: `Tests (.${extension})`, lines: count.tests });
    }
  }

  return rows;
}

function formatReport(rows: ReportRow[], ignoreComments: boolean): string {
  const note = ignoreComments
    ? 'Excludes blank lines and lines starting or continuing comments.'
    : 'Excludes blank lines; includes comments.';
  const formatRow = (label: string, value: string | number) => `${label.padEnd(20)} ${String(value).padStart(6)}`;
  const divider = formatRow('--------------------', '------');
  const total = rows.reduce((sum, row) => sum + row.lines, 0);

  return [
    '', note,
    formatRow('Type', 'Lines'), divider,
    ...rows.map(row => formatRow(row.label, row.lines)),
    divider, formatRow('TOTAL', total), '',
  ].join('\n');
}

// ============================================================================
// 6. Main workflow and entrypoint
// ============================================================================

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
