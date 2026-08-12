#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, relative, resolve, sep } from 'node:path';
import process from 'node:process';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const TEXT_EXTENSIONS = new Set([
  '.css', '.html', '.js', '.json', '.md', '.mjs', '.sh', '.sql', '.ts', '.tsx', '.yaml', '.yml',
]);
const RETIRED_VOCABULARY = [
  {
    pattern: /\b(?:work_tasks|workTask(?:s)?|WorkTask(?:s)?|work-task(?:s)?)\b/g,
    replacement: 'tasks / task / Task',
  },
];

function usage() {
  console.log(`Usage: node scripts/agents/check-patterns.js [--changed [BASE_REF] | --all]

  --changed   Check committed and working-tree changes (default).
  BASE_REF    Compare committed changes with this revision. Defaults to the
              development branch, the remote default branch, or HEAD.
  --all       Check every tracked and untracked repository source file.
  -h, --help  Show this help.`);
}

function git(args) {
  return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
}

function defaultBaseRef() {
  if (process.env.CHECK_PATTERNS_BASE_REF) return process.env.CHECK_PATTERNS_BASE_REF;
  try {
    git(['rev-parse', '--verify', '--quiet', 'origin/develop']);
    return 'origin/develop';
  } catch {
    // Fall through when the development branch is unavailable.
  }
  try {
    const remoteDefault = git(['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD']);
    if (remoteDefault) return remoteDefault;
  } catch {
    return 'HEAD';
  }
  return 'HEAD';
}

function parseArguments(argv) {
  if (!argv.length) return { mode: 'changed', baseRef: defaultBaseRef() };
  if (argv[0] === '-h' || argv[0] === '--help') {
    usage();
    process.exit(0);
  }
  if (argv[0] === '--all' && argv.length === 1) return { mode: 'all' };
  if (argv[0] === '--changed' && argv.length <= 2) {
    return { mode: 'changed', baseRef: argv[1] ?? defaultBaseRef() };
  }
  usage();
  process.exit(2);
}

function uniqueLines(output) {
  return [...new Set(output.split('\n').map(line => line.trim()).filter(Boolean))];
}

function collectChangedFiles(baseRef) {
  let mergeBase;
  try {
    git(['rev-parse', '--verify', '--quiet', `${baseRef}^{commit}`]);
    mergeBase = git(['merge-base', baseRef, 'HEAD']);
  } catch {
    console.error(`ERROR: Base revision '${baseRef}' does not exist.`);
    process.exit(2);
  }

  const outputs = [
    git(['diff', '--name-only', '--diff-filter=ACMR', `${mergeBase}...HEAD`]),
    git(['diff', '--name-only', '--diff-filter=ACMR']),
    git(['diff', '--cached', '--name-only', '--diff-filter=ACMR']),
    git(['ls-files', '--others', '--exclude-standard']),
  ];
  return uniqueLines(outputs.join('\n'));
}

function collectAllFiles() {
  return uniqueLines([
    git(['ls-files']),
    git(['ls-files', '--others', '--exclude-standard']),
  ].join('\n'));
}

function isReadableSource(file) {
  const absolute = resolve(REPO_ROOT, file);
  return existsSync(absolute) && statSync(absolute).isFile() && TEXT_EXTENSIONS.has(extname(file));
}

function lineNumber(source, index) {
  return source.slice(0, index).split('\n').length;
}

function addMatches(violations, file, source, pattern, message) {
  pattern.lastIndex = 0;
  for (const match of source.matchAll(pattern)) {
    violations.push(`${file}:${lineNumber(source, match.index)} ${message}`);
  }
}

function resolveImport(file, importPath) {
  if (!importPath.startsWith('.')) return null;
  return relative(REPO_ROOT, resolve(dirname(resolve(REPO_ROOT, file)), importPath)).split(sep).join('/');
}

function checkFrontendOwnership(violations, file, source) {
  if (!file.startsWith('frontend/src/')) return;
  const importPattern = /(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  for (const match of source.matchAll(importPattern)) {
    const target = resolveImport(file, match[1]);
    if (!target) continue;

    if (file.startsWith('frontend/src/common/components/')) {
      if (target.startsWith('frontend/src/pages/') || target.startsWith('frontend/src/common/features/')) {
        violations.push(`${file}:${lineNumber(source, match.index)} common components cannot import features or pages (${match[1]}).`);
      }
      continue;
    }

    if (file.startsWith('frontend/src/common/features/') && target.startsWith('frontend/src/pages/')) {
      violations.push(`${file}:${lineNumber(source, match.index)} common features cannot import pages (${match[1]}).`);
      continue;
    }

    const pageMatch = file.match(/^frontend\/src\/pages\/([^/]+)\//);
    const targetPageMatch = target.match(/^frontend\/src\/pages\/([^/]+)\//);
    if (pageMatch && targetPageMatch && pageMatch[1] !== targetPageMatch[1]) {
      violations.push(`${file}:${lineNumber(source, match.index)} route-family pages cannot import another page family's private code (${match[1]}).`);
    }
  }
}

function checkCentralizedHttp(violations, file, source) {
  if (!file.startsWith('frontend/src/') || file === 'frontend/src/http/client.ts' || file === 'frontend/src/auth/tokenRefresh.ts') return;
  addMatches(violations, file, source, /\bfetch\s*\(/g, 'frontend requests must use the centralized API client.');
}

function checkBackendRoutes(violations, file, source) {
  if (!/^backend\/src\/routes\/.*\.ts$/.test(file)) return;
  const routePattern = /router\.(?:get|post|put|patch|delete)\s*\(([\s\S]*?)\);/g;
  for (const match of source.matchAll(routePattern)) {
    if (!match[1].includes('asyncHandler(')) {
      violations.push(`${file}:${lineNumber(source, match.index)} Express route handlers must be wrapped with asyncHandler.`);
    }
  }
}

function checkFocusedAdapters(violations, file, source) {
  if (!file.startsWith('frontend/src/') || !file.endsWith('.api.ts')) return;
  const broadFocusedMutation = /apiClient\.put(?:<[^>]+>)?\s*\(\s*(?:`[^`]*\/(?:status|placement)(?:[/?][^`]*)?`|'[^']*\/(?:status|placement)(?:[/?][^']*)?')/g;
  addMatches(
    violations,
    file,
    source,
    broadFocusedMutation,
    'focused status/placement endpoints must use PATCH, not PUT.',
  );
}

function checkPaginatedTables(violations, file, source) {
  if (!file.startsWith('frontend/src/pages/')) return;

  if (source.includes('useInfiniteListQuery') && !file.includes('/hooks/')) {
    violations.push(`${file}:1 page components must own remote infinite-list queries through a page hook.`);
  }

  if (source.includes('useInfiniteListQuery')
    && file.includes('ListView/')
    && !/\/components\/[^/]*ListView\/hooks\//.test(file)) {
    violations.push(`${file}:1 a *ListView remote-list hook must be colocated under that view's hooks directory.`);
  }

  if (source.includes('useInfiniteListQuery') && !/limit\s*:\s*25\b/.test(source)) {
    violations.push(`${file}:1 remote list hooks must request the standard 25-row cursor page size.`);
  }

  const paginationProps = ['hasNextPage', 'loadingNextPage', 'onLoadNextPage'];
  const wiredProps = paginationProps.filter(prop => new RegExp(`\\b${prop}\\s*=`).test(source));
  if (wiredProps.length > 0 && wiredProps.length < paginationProps.length) {
    const missing = paginationProps.filter(prop => !wiredProps.includes(prop));
    violations.push(`${file}:1 paginated tables must wire the complete load-more contract; missing ${missing.join(', ')}.`);
  }
}

function checkResourceCalendars(violations, file, source) {
  if (!file.startsWith('frontend/src/pages/') || !file.endsWith('.tsx')
    || /\.(?:test|spec|story)\.tsx$/.test(file) || !source.includes('<ResourceCalendar')) return;

  if (!source.includes('usePeriodDataBuffer')) {
    violations.push(`${file}:1 resource-calendar pages must load visible ranges through usePeriodDataBuffer.`);
  }

  if (!/\/components\/[^/]*CalendarView\/[^/]*CalendarView\.tsx$/.test(file)) {
    violations.push(`${file}:1 ResourceCalendar must be owned by a cohesive page-private *CalendarView component.`);
  }

  const lifecycleProps = ['onInitialPeriods', 'onPeriodsBuilt', 'onPeriodsReset', 'positionStorageKey'];
  const missing = lifecycleProps.filter(prop => !new RegExp(`\\b${prop}\\s*=`).test(source));
  if (missing.length) {
    violations.push(`${file}:1 buffered resource calendars must wire the complete period lifecycle; missing ${missing.join(', ')}.`);
  }
}

function checkCalendarDataHooks(violations, file) {
  if (!file.startsWith('frontend/src/pages/')
    || !/\/use[^/]*CalendarData\.tsx?$/.test(file)
    || /\.(?:test|spec)\.tsx?$/.test(file)) return;

  if (!/\/components\/[^/]*CalendarView\/hooks\/use[^/]*CalendarData\.tsx?$/.test(file)) {
    violations.push(`${file}:1 calendar-data hooks must be owned by their page-private *CalendarView hooks directory.`);
  }
}

function checkDashboardNames(violations, file, source) {
  if (!file.startsWith('frontend/src/') || !file.endsWith('.tsx')
    || /\.(?:test|spec|story)\.tsx$/.test(file)) return;

  const fileName = file.match(/([^/]+)\.tsx$/)?.[1];
  if (!fileName) return;

  if (fileName.endsWith('Overview') && /<[A-Z][A-Za-z0-9]*DashboardCard\b/.test(source)) {
    violations.push(`${file}:1 structural dashboard owners must use the *Dashboard name; reserve Overview for domain content.`);
  }

  if (file.includes('/components/')
    && source.includes('<DashboardCard')
    && !fileName.endsWith('DashboardCard')) {
    violations.push(`${file}:1 extracted dashboard card components must use the *DashboardCard naming convention.`);
  }

  const nestedDashboardCard = /\/components\/[^/]*Dashboard\/.*Card\.tsx$/.test(file);
  if (nestedDashboardCard && !fileName.endsWith('DashboardCard')) {
    violations.push(`${file}:1 cards nested under a *Dashboard owner must use the *DashboardCard naming convention.`);
  }
}

function checkFocusedTests(violations, file, source) {
  if (!/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file)) return;
  addMatches(violations, file, source, /\b(?:describe|it|test)\.only\s*\(/g, 'focused test marker must not be committed.');
  addMatches(violations, file, source, /\b(?:fdescribe|fit)\s*\(/g, 'focused test marker must not be committed.');
  addMatches(violations, file, source, /\b(?:describe|it|test)\.skip\s*\(/g, 'skipped test marker must not be committed.');
  addMatches(violations, file, source, /\b(?:xdescribe|xit|xtest)\s*\(/g, 'skipped test marker must not be committed.');
}

function checkVocabulary(violations, file, source) {
  if (file === 'scripts/agents/check-patterns.js') return;
  for (const rule of RETIRED_VOCABULARY) {
    addMatches(
      violations,
      file,
      source,
      rule.pattern,
      `retired domain vocabulary; use canonical ${rule.replacement} terminology.`,
    );
  }
}

function checkAppliedMigrations(violations, baseRef) {
  if (!baseRef) return;
  let mergeBase;
  try {
    mergeBase = git(['merge-base', baseRef, 'HEAD']);
  } catch {
    return;
  }
  const statuses = uniqueLines([
    git(['diff', '--name-status', `${mergeBase}...HEAD`, '--', 'backend/db/migrations']),
    git(['diff', '--name-status', '--', 'backend/db/migrations']),
    git(['diff', '--cached', '--name-status', '--', 'backend/db/migrations']),
  ].join('\n'));
  for (const statusLine of statuses) {
    const [status, file] = statusLine.split(/\s+/);
    if (status !== 'A') {
      violations.push(`${file} applied migrations are immutable; add a new migration instead of ${status === 'D' ? 'deleting' : 'modifying'} one.`);
    }
  }
}

const options = parseArguments(process.argv.slice(2));
const files = options.mode === 'all' ? collectAllFiles() : collectChangedFiles(options.baseRef);
const violations = [];

for (const file of files.filter(isReadableSource)) {
  const source = readFileSync(resolve(REPO_ROOT, file), 'utf8');
  checkVocabulary(violations, file, source);
  checkFrontendOwnership(violations, file, source);
  checkCentralizedHttp(violations, file, source);
  checkBackendRoutes(violations, file, source);
  checkFocusedAdapters(violations, file, source);
  checkPaginatedTables(violations, file, source);
  checkResourceCalendars(violations, file, source);
  checkCalendarDataHooks(violations, file);
  checkDashboardNames(violations, file, source);
  checkFocusedTests(violations, file, source);
}
if (options.mode === 'changed') checkAppliedMigrations(violations, options.baseRef);

if (violations.length) {
  console.error(`Pattern checks failed (${violations.length}):`);
  for (const violation of violations) console.error(`  - ${violation}`);
  process.exit(1);
}

const scope = options.mode === 'all' ? 'repository files' : `changes against ${options.baseRef}`;
console.log(`Pattern checks passed for ${files.length} ${scope}.`);
