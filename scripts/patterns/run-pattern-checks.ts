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
import { checkBackendRoutes } from './backend/routes.ts';
import { checkCentralizedHttp } from './frontend/data.ts';
import { checkFrontendOwnership } from './frontend/ownership.ts';
import { collectRoutePageDirectories } from './frontend/shared.ts';
import { filterDeletedFiles, type Findings } from './utils.ts';
import { readBaseline } from '../../backend/db/scripts/helpers/read-migrations.ts';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const TEXT_EXTENSIONS = new Set(['.css', '.html', '.js', '.json', '.md', '.mjs', '.sh', '.sql', '.ts', '.tsx', '.yaml', '.yml']);

type CheckOptions = { mode: 'all' } | { mode: 'changed'; baseRef: string };

interface EnforcementOptions {
  routePageDirectories?: string[];
}

/**
 * Prints supported pattern-check modes and comparison-base defaults.
 * @example usage() // prints --changed and --all options
 */
function usage(): void {
  console.log(`Usage: node scripts/patterns/run-pattern-checks.ts [--changed [BASE_REF] | --all]

  --changed   Check committed and working-tree changes (default).
  BASE_REF    Compare committed changes with this revision. Defaults to the
              development branch, the remote default branch, or HEAD.
  --all       Check every tracked and untracked repository source file.
  -h, --help  Show this help.`);
}

/**
 * Runs Git in this checkout and returns trimmed stdout; command failures throw.
 * @example git(['branch', '--show-current']) // current branch name
 */
function git(args: string[]): string {
  return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
}

/**
 * Chooses an environment override, origin/develop, the remote default branch, or HEAD in that order.
 * @example defaultBaseRef() // 'HEAD' when no override or remote refs exist
 */
function defaultBaseRef(): string {
  // 1. Honor an explicit comparison base from the environment.
  if (process.env.CHECK_PATTERNS_BASE_REF) return process.env.CHECK_PATTERNS_BASE_REF;
  // 2. Prefer origin/develop, then the remote default branch or HEAD.
  try { git(['rev-parse', '--verify', '--quiet', 'origin/develop']); return 'origin/develop'; } catch { /* fall through */ }
  try { return git(['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD']) || 'HEAD'; } catch { return 'HEAD'; }
}

/**
 * Parses one supported mode and optional base; help exits successfully and invalid combinations exit with status 2.
 * @example parseArguments(['--all']) // { mode: 'all' }
 */
function parseArguments(argv: string[]): CheckOptions {
  // 1. Recognize the default mode, help, and supported argument combinations.
  if (!argv.length) return { mode: 'changed', baseRef: defaultBaseRef() };
  if (argv[0] === '-h' || argv[0] === '--help') { usage(); process.exit(0); }
  if (argv[0] === '--all' && argv.length === 1) return { mode: 'all' };
  if (argv[0] === '--changed' && argv.length <= 2) return { mode: 'changed', baseRef: argv[1] ?? defaultBaseRef() };
  // 2. Print usage and fail when the requested combination is invalid.
  usage();
  process.exit(2);
}

/**
 * Trims newline-delimited records, omits blanks, and preserves the first occurrence of each record.
 * @example uniqueLines('a\na\n') // ['a']
 */
function uniqueLines(output: string): string[] {
  return [...new Set(output.split('\n').map(line => line.trim()).filter(Boolean))];
}

/**
 * Collects unique branch and working-tree paths against a valid common ancestor; invalid bases exit with status 2.
 * @example collectChangedFiles('HEAD') // [] in a clean checkout
 */
function collectChangedFiles(baseRef: string): string[] {
  // 1. Resolve a valid comparison commit and its common ancestor with HEAD.
  let mergeBase: string;
  try { git(['rev-parse', '--verify', '--quiet', `${baseRef}^{commit}`]); mergeBase = git(['merge-base', baseRef, 'HEAD']); } catch { console.error(`ERROR: Base revision '${baseRef}' does not exist.`); process.exit(2); }
  // 2. Combine committed, unstaged, staged, and untracked paths without duplicates.
  return uniqueLines([
    git(['diff', '--name-only', '--diff-filter=ACMRD', `${mergeBase}...HEAD`]),
    git(['diff', '--name-only', '--diff-filter=ACMRD']),
    git(['diff', '--cached', '--name-only', '--diff-filter=ACMRD']),
    git(['ls-files', '--others', '--exclude-standard']),
  ].join('\n'));
}

/**
 * Lists tracked and nonignored untracked paths, excluding deleted tracked files.
 * @example collectAllFiles() // repository-relative file paths
 */
function collectAllFiles(): string[] {
  // 1. Combine tracked and nonignored untracked paths.
  const files = uniqueLines([
    git(['ls-files']),
    git(['ls-files', '--others', '--exclude-standard']),
  ].join('\n'));
  // 2. Remove tracked paths that no longer exist in the working tree.
  return filterDeletedFiles(files, uniqueLines(git(['ls-files', '--deleted'])));
}

/**
 * Appends committed SQL history violations, allowing only checksum-verified baseline replacements.
 * @example checkAppliedMigrations([], 'HEAD') // leaves findings empty when migration files are unchanged
 */
function checkAppliedMigrations(violations: string[], baseRef: string): void {
  // 1. Resolve the history boundary; an unavailable base has no comparable migrations.
  let mergeBase: string;
  try {
    mergeBase = git(['merge-base', baseRef, 'HEAD']);
  } catch {
    return;
  }

  // 2. Read the verified baseline before considering any history replacement exception.
  let baseline: ReturnType<typeof readBaseline> = null;
  try {
    baseline = readBaseline(resolve(REPO_ROOT, 'backend/db'));
  } catch {
    // An invalid baseline cannot exempt a committed migration from immutability.
  }

  // 3. Inspect SQL additions, modifications, and deletions across branch and working changes.
  const paths = ['backend/db/migrations', 'backend/db/schema', 'backend/db/data'];
  for (const statusLine of uniqueLines([
    git(['diff', '--no-renames', '--name-status', `${mergeBase}...HEAD`, '--', ...paths]),
    git(['diff', '--no-renames', '--name-status', '--', ...paths]),
    git(['diff', '--no-renames', '--name-status', '--cached', '--', ...paths]),
  ].join('\n'))) {
    const [status, file] = statusLine.split(/\s+/);
    if (!file.endsWith('.sql')) continue;

    // 4. Exempt replaced artifacts only when their previous checksums match the baseline.
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

    // 5. Report every remaining change to an already committed migration.
    if (status !== 'A') violations.push(`${file} applied migrations are immutable; add a new migration instead of ${status === 'D' ? 'deleting' : 'modifying'} one.`);
  }
}

/**
 * Appends owner-specific findings for one repository-relative file and its complete source text.
 * @example runEnforcementChecks([], 'README.md', '# App', '/repo') // no findings
 */
export function runEnforcementChecks(
  violations: Findings,
  file: string,
  source: string,
  repoRoot: string,
  { routePageDirectories = [] }: EnforcementOptions = {},
): void {
  // 1. Apply frontend ownership and centralized HTTP rules.
  if (file.startsWith('frontend/src/')) {
    checkFrontendOwnership(violations, file, source, routePageDirectories, repoRoot);
    checkCentralizedHttp(violations, file, source);
  }

  // 2. Apply backend route wrapping rules.
  if (file.startsWith('backend/src/routes/')) checkBackendRoutes(violations, file, source);
}

/**
 * Discovers selected text files, reports pattern violations, and exits with status 1 when any rule fails.
 * @example // node scripts/patterns/run-pattern-checks.ts --help prints usage without inspecting files.
 */
function main(): void {
  // 1. Resolve the requested file set and route ownership context.
  const options = parseArguments(process.argv.slice(2));
  const files = options.mode === 'all' ? collectAllFiles() : collectChangedFiles(options.baseRef);
  const repositoryFiles = collectAllFiles();
  const routePageDirectories = collectRoutePageDirectories(repositoryFiles);
  const violations: string[] = [];

  // 2. Inspect existing text files with their applicable owner rules.
  for (const file of files) {
    const absolute = resolve(REPO_ROOT, file);
    if (!existsSync(absolute) || !statSync(absolute).isFile() || !TEXT_EXTENSIONS.has(extname(file))) continue;
    const source = readFileSync(absolute, 'utf8');
    runEnforcementChecks(violations, file, source, REPO_ROOT, { routePageDirectories });
  }

  // 3. Validate migration history, then report all failures or successful completion.
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
