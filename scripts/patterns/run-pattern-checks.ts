#!/usr/bin/env node

// Usage: node scripts/patterns/run-pattern-checks.ts [--changed [BASE_REF] | --all]
// Read-only: discover repository files, apply pattern rules, and report violations.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import console from 'node:console';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { checkBackendControllers } from './backend/controllers.ts';
import { checkBackendRoutes } from './backend/routes.ts';
import { checkCentralizedHttp, checkFocusedAdapters } from './frontend/data.ts';
import { checkFrontendOwnership, checkCentralizedFrontendDocumentation } from './frontend/ownership.ts';
import { collectRoutePageDirectories } from './frontend/shared.ts';
import { filterDeletedFiles, type Findings } from './utils.ts';
import { readBaseline } from '../../backend/db/scripts/helpers/read-migrations.ts';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const TEXT_EXTENSIONS = new Set(['.css', '.html', '.js', '.json', '.md', '.mjs', '.sh', '.sql', '.ts', '.tsx', '.yaml', '.yml']);

type CheckOptions = { mode: 'all' } | { mode: 'changed'; baseRef: string };

interface EnforcementOptions {
  routePageDirectories?: string[];
}

function usage(): void {
  console.log(`Usage: node scripts/patterns/run-pattern-checks.ts [--changed [BASE_REF] | --all]

  --changed   Check committed and working-tree changes (default).
  BASE_REF    Compare committed changes with this revision. Defaults to the
              development branch, the remote default branch, or HEAD.
  --all       Check every tracked and untracked repository source file.
  -h, --help  Show this help.`);
}

function git(args: string[]): string {
  return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
}

function defaultBaseRef(): string {
  if (process.env.CHECK_PATTERNS_BASE_REF) return process.env.CHECK_PATTERNS_BASE_REF;
  try { git(['rev-parse', '--verify', '--quiet', 'origin/develop']); return 'origin/develop'; } catch { /* fall through */ }
  try { return git(['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD']) || 'HEAD'; } catch { return 'HEAD'; }
}

function parseArguments(argv: string[]): CheckOptions {
  if (!argv.length) return { mode: 'changed', baseRef: defaultBaseRef() };
  if (argv[0] === '-h' || argv[0] === '--help') { usage(); process.exit(0); }
  if (argv[0] === '--all' && argv.length === 1) return { mode: 'all' };
  if (argv[0] === '--changed' && argv.length <= 2) return { mode: 'changed', baseRef: argv[1] ?? defaultBaseRef() };
  usage();
  process.exit(2);
}

function uniqueLines(output: string): string[] {
  return [...new Set(output.split('\n').map(line => line.trim()).filter(Boolean))];
}

function collectChangedFiles(baseRef: string): string[] {
  let mergeBase: string;
  try { git(['rev-parse', '--verify', '--quiet', `${baseRef}^{commit}`]); mergeBase = git(['merge-base', baseRef, 'HEAD']); } catch { console.error(`ERROR: Base revision '${baseRef}' does not exist.`); process.exit(2); }
  return uniqueLines([
    git(['diff', '--name-only', '--diff-filter=ACMRD', `${mergeBase}...HEAD`]),
    git(['diff', '--name-only', '--diff-filter=ACMRD']),
    git(['diff', '--cached', '--name-only', '--diff-filter=ACMRD']),
    git(['ls-files', '--others', '--exclude-standard']),
  ].join('\n'));
}

function collectAllFiles(): string[] {
  const files = uniqueLines([
    git(['ls-files']),
    git(['ls-files', '--others', '--exclude-standard']),
  ].join('\n'));
  return filterDeletedFiles(files, uniqueLines(git(['ls-files', '--deleted'])));
}

function checkAppliedMigrations(violations: string[], baseRef: string): void {
  let mergeBase: string;
  try {
    mergeBase = git(['merge-base', baseRef, 'HEAD']);
  } catch {
    return;
  }

  let baseline: ReturnType<typeof readBaseline> = null;
  try {
    baseline = readBaseline(resolve(REPO_ROOT, 'backend/db'));
  } catch {
    // An invalid baseline cannot exempt a committed migration from immutability.
  }

  const paths = ['backend/db/migrations', 'backend/db/schema', 'backend/db/data'];
  for (const statusLine of uniqueLines([
    git(['diff', '--no-renames', '--name-status', `${mergeBase}...HEAD`, '--', ...paths]),
    git(['diff', '--no-renames', '--name-status', '--', ...paths]),
    git(['diff', '--no-renames', '--name-status', '--cached', '--', ...paths]),
  ].join('\n'))) {
    const [status, file] = statusLine.split(/\s+/);
    if (!file.endsWith('.sql')) continue;

    const replaceable = status === 'D' || (status === 'M' && /\/(schema|data)\/init\.sql$/.test(file));
    if (replaceable && baseline) {
      const relative = file.replace(/^backend\/db\//, '');
      const version = relative.startsWith('migrations/') ? relative.slice('migrations/'.length) : relative;
      const previousVersions = [mergeBase, 'HEAD'];
      const replaced = previousVersions.some(revision => {
        try {
          const previous = execFileSync('git', ['show', `${revision}:${file}`], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
          });
          const checksum = createHash('sha256').update(previous).digest('hex');

          return baseline.replaces.some(row => row.version === version && row.checksum === checksum);
        } catch {
          return false;
        }
      });
      if (replaced) continue;
    }

    if (status !== 'A') violations.push(`${file} applied migrations are immutable; add a new migration instead of ${status === 'D' ? 'deleting' : 'modifying'} one.`);
  }
}

export function runEnforcementChecks(
  violations: Findings,
  file: string,
  source: string,
  repoRoot: string,
  { routePageDirectories = [] }: EnforcementOptions = {},
): void {
  if (file.startsWith('frontend/src/')) {
    checkFrontendOwnership(violations, file, source, routePageDirectories, repoRoot);
    checkCentralizedFrontendDocumentation(violations, file);
    checkCentralizedHttp(violations, file, source);
    if (file.endsWith('.api.ts')) checkFocusedAdapters(violations, file, source);
  }

  if (file.startsWith('backend/src/routes/')) checkBackendRoutes(violations, file, source);
  if (file.startsWith('backend/src/controllers/')) checkBackendControllers(violations, file, source);
}

function main(): void {
  const options = parseArguments(process.argv.slice(2));
  const files = options.mode === 'all' ? collectAllFiles() : collectChangedFiles(options.baseRef);
  const repositoryFiles = collectAllFiles();
  const routePageDirectories = collectRoutePageDirectories(repositoryFiles);
  const violations: string[] = [];

  for (const file of files) {
    const absolute = resolve(REPO_ROOT, file);
    if (!existsSync(absolute) || !statSync(absolute).isFile() || !TEXT_EXTENSIONS.has(extname(file))) continue;
    const source = readFileSync(absolute, 'utf8');
    runEnforcementChecks(violations, file, source, REPO_ROOT, { routePageDirectories });
  }

  if (options.mode === 'changed') checkAppliedMigrations(violations, options.baseRef);
  if (violations.length) {
    console.error(`Pattern checks failed (${violations.length}):`);
    for (const violation of violations) console.error(`  - ${violation}`);
    process.exit(1);
  }

  console.log(`Pattern checks passed for ${files.length} ${options.mode === 'all' ? 'repository files' : `changes against ${options.baseRef}`}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
