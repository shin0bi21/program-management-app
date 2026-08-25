#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import console from 'node:console';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import process from 'node:process';
import {
  collectRoutePageDirectories,
  collectStructureCheckFiles,
  runEnforcementChecks,
  runStructureEnforcement,
} from './enforce/run.js';
import { filterDeletedFiles } from './enforce/utils.js';
import { runPatternReview } from './review/run.js';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const TEXT_EXTENSIONS = new Set(['.css', '.html', '.js', '.json', '.md', '.mjs', '.sh', '.sql', '.ts', '.tsx', '.yaml', '.yml']);

function usage() {
  console.log(`Usage: node scripts/patterns/check-patterns.js [--changed [BASE_REF] | --all]

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
  try { git(['rev-parse', '--verify', '--quiet', 'origin/develop']); return 'origin/develop'; } catch { /* fall through */ }
  try { return git(['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD']) || 'HEAD'; } catch { return 'HEAD'; }
}

function parseArguments(argv) {
  if (!argv.length) return { mode: 'changed', baseRef: defaultBaseRef() };
  if (argv[0] === '-h' || argv[0] === '--help') { usage(); process.exit(0); }
  if (argv[0] === '--all' && argv.length === 1) return { mode: 'all' };
  if (argv[0] === '--changed' && argv.length <= 2) return { mode: 'changed', baseRef: argv[1] ?? defaultBaseRef() };
  usage();
  process.exit(2);
}

function uniqueLines(output) {
  return [...new Set(output.split('\n').map(line => line.trim()).filter(Boolean))];
}

function collectChangedFiles(baseRef) {
  let mergeBase;
  try { git(['rev-parse', '--verify', '--quiet', `${baseRef}^{commit}`]); mergeBase = git(['merge-base', baseRef, 'HEAD']); } catch { console.error(`ERROR: Base revision '${baseRef}' does not exist.`); process.exit(2); }
  return uniqueLines([
    git(['diff', '--name-only', '--diff-filter=ACMRD', `${mergeBase}...HEAD`]),
    git(['diff', '--name-only', '--diff-filter=ACMRD']),
    git(['diff', '--cached', '--name-only', '--diff-filter=ACMRD']),
    git(['ls-files', '--others', '--exclude-standard']),
  ].join('\n'));
}

function collectAllFiles() {
  const files = uniqueLines([
    git(['ls-files']),
    git(['ls-files', '--others', '--exclude-standard']),
  ].join('\n'));
  return filterDeletedFiles(files, uniqueLines(git(['ls-files', '--deleted'])));
}

function checkAppliedMigrations(violations, baseRef) {
  let mergeBase;
  try { mergeBase = git(['merge-base', baseRef, 'HEAD']); } catch { return; }
  for (const statusLine of uniqueLines([
    git(['diff', '--name-status', `${mergeBase}...HEAD`, '--', 'backend/db/migrations']),
    git(['diff', '--name-status', '--', 'backend/db/migrations']),
    git(['diff', '--cached', '--name-status', '--', 'backend/db/migrations']),
  ].join('\n'))) {
    const [status, file] = statusLine.split(/\s+/);
    if (status !== 'A') violations.push(`${file} applied migrations are immutable; add a new migration instead of ${status === 'D' ? 'deleting' : 'modifying'} one.`);
  }
}

const options = parseArguments(process.argv.slice(2));
const files = options.mode === 'all' ? collectAllFiles() : collectChangedFiles(options.baseRef);
const repositoryFiles = collectAllFiles();
const repositorySources = new Map(repositoryFiles
  .filter(file => file.startsWith('frontend/src/pages/') && /\.tsx?$/.test(file))
  .map((file) => {
    const absolute = resolve(REPO_ROOT, file);
    return [file, existsSync(absolute) && statSync(absolute).isFile()
      ? readFileSync(absolute, 'utf8')
      : ''];
  }));
const routePageDirectories = collectRoutePageDirectories(repositoryFiles);
const structureFiles = options.mode === 'all'
  ? files
  : collectStructureCheckFiles(files, repositoryFiles, routePageDirectories);
const violations = [];
const reviewFindings = [];
for (const file of files) {
  const absolute = resolve(REPO_ROOT, file);
  if (!existsSync(absolute) || !statSync(absolute).isFile() || !TEXT_EXTENSIONS.has(extname(file))) continue;
  const source = readFileSync(absolute, 'utf8');
  runEnforcementChecks(violations, file, source, REPO_ROOT, { routePageDirectories });
  runPatternReview(reviewFindings, file, source, {
    repositoryFiles,
    repositorySources,
    routePageDirectories,
  });
}
for (const file of structureFiles) {
  const absolute = resolve(REPO_ROOT, file);
  if (!existsSync(absolute) || !statSync(absolute).isFile()) continue;
  runStructureEnforcement(violations, file, { repositoryFiles, routePageDirectories });
}
if (options.mode === 'changed') checkAppliedMigrations(violations, options.baseRef);
if (reviewFindings.length) {
  console.warn(`Pattern review (${reviewFindings.length}, non-blocking):`);
  for (const finding of reviewFindings) console.warn(`  - ${finding}`);
}
if (violations.length) {
  console.error(`Pattern checks failed (${violations.length}):`);
  for (const violation of violations) console.error(`  - ${violation}`);
  process.exit(1);
}
console.log(`Pattern checks passed for ${files.length} ${options.mode === 'all' ? 'repository files' : `changes against ${options.baseRef}`}.`);
