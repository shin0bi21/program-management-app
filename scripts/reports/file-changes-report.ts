#!/usr/bin/env node

/**
 * INSPECT CHANGES — read-only inventory for implementation, review, and shipping.
 *
 * Flow (see main() and inspectChanges()):
 *   1. Validate arguments and resolve the comparison base
 *   2. Collect committed branch changes and working-tree changes
 *   3. Combine affected paths, including both sides of renames
 *   4. Read branch context and select checks with the shared CI policy
 *   5. Fingerprint content, classify paths, and inventory stashes
 *   6. Print a human-readable or JSON report; checks are not executed
 *
 * Usage:
 *   node scripts/reports/file-changes-report.ts
 *   node scripts/reports/file-changes-report.ts --json --base origin/develop
 */

// ============================================================================
// 1. Imports
// ============================================================================

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readlinkSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { planCommands, selectTests, type TestPlan } from '../ci/select-tests.ts';

// ============================================================================
// 2. Configuration and report contracts
// ============================================================================

const DEFAULT_REPO_ROOT = resolve(import.meta.dirname, '../..');

interface BaseChange {
  path: string;
  status: string;
  originalPath?: string;
}

interface WorkingTreeChange {
  path: string;
  indexStatus: string;
  worktreeStatus: string;
  originalPath?: string;
}

interface StashEntry {
  reference: string;
  description: string;
}

interface Snapshot {
  schemaVersion: 1;
  git: {
    branch: string | null;
    head: string;
    baseRef: string;
    mergeBase: string;
    upstream: string | null;
    ahead: number | null;
    behind: number | null;
    fingerprint: string;
  };
  changes: {
    paths: string[];
    base: BaseChange[];
    workingTree: WorkingTreeChange[];
  };
  classifications: Record<string, string[]>;
  verification: {
    plan: TestPlan;
    commands: Array<{ command: string; value?: string }>;
    requiresPatternCheck: boolean;
    requiresDiffCheck: boolean;
  };
  stashes: StashEntry[];
}

// ============================================================================
// 3. CLI arguments
// ============================================================================

function usage(): string {
  return `Usage: node scripts/reports/file-changes-report.ts [--json] [--base BASE_REF]

Create a read-only snapshot of branch and working-tree changes.

  --json           Print the complete machine-readable snapshot.
  --base BASE_REF  Compare against this revision instead of the default base.
  -h, --help       Show this help.`;
}

interface CliOptions {
  json: boolean;
  baseRef?: string;
  help?: boolean;
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = { json: false };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    switch (argument) {
      case '--json':
        options.json = true;
        break;

      case '--base': {
        const revision = args[index + 1];
        if (!revision || revision.startsWith('-')) {
          throw new Error('--base requires a revision.');
        }

        options.baseRef = revision;

        // The next argument is the revision value, so skip it as an option.
        index += 1;
        break;
      }

      case '-h':
      case '--help':
        options.help = true;
        break;

      default:
        throw new Error(`Unknown argument: ${argument}`);
    }
  }

  return options;
}

// ============================================================================
// 4. Git access and comparison base
// ============================================================================

function git(repoRoot: string, args: string[], encoding: BufferEncoding | 'buffer' = 'utf8'): string | Buffer {
  return execFileSync('git', ['-C', repoRoot, ...args], {
    encoding: encoding === 'buffer' ? null : encoding,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function gitText(repoRoot: string, args: string[]): string {
  return String(git(repoRoot, args)).trim();
}

function resolveDefaultBase(repoRoot: string): string {
  if (process.env.INSPECT_CHANGES_BASE_REF) return process.env.INSPECT_CHANGES_BASE_REF;

  try {
    git(repoRoot, ['rev-parse', '--verify', '--quiet', 'origin/develop^{commit}']);
    return 'origin/develop';
  } catch {
    // A local-only repository may not have origin/develop.
  }

  try {
    return gitText(repoRoot, ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD']);
  } catch {
    return 'HEAD';
  }
}

function assertBaseRef(repoRoot: string, baseRef: string): void {
  try {
    git(repoRoot, ['rev-parse', '--verify', '--quiet', `${baseRef}^{commit}`]);
  } catch {
    throw new Error(`Base revision '${baseRef}' does not exist.`);
  }
}

// ============================================================================
// 5. Changed-file parsing
// ============================================================================

// `git diff --name-status -z` emits status\0path\0; renames/copies emit
// status\0originalPath\0path\0. NUL delimiters preserve spaces and newlines in names.
function parseDiffNameStatus(output: string): BaseChange[] {
  const fields = output.split('\0');
  const changes: BaseChange[] = [];

  // The final field is empty because Git terminates its output with NUL.
  for (let fieldIndex = 0; fieldIndex < fields.length - 1;) {
    const status = fields[fieldIndex];
    fieldIndex += 1;

    const isRenameOrCopy = status.startsWith('R') || status.startsWith('C');
    let originalPath: string | undefined;
    if (isRenameOrCopy) {
      originalPath = fields[fieldIndex];
      fieldIndex += 1;
    }

    const path = fields[fieldIndex];
    fieldIndex += 1;

    changes.push({ path, status, ...(originalPath ? { originalPath } : {}) });
  }

  return changes;
}

// `git status --porcelain=v1 -z` emits "XY path\0": X is the staged
// status, Y is the unstaged status, and "??" marks an untracked file.
function parseWorkingTreeStatus(output: string): WorkingTreeChange[] {
  const fields = output.split('\0');
  const changes: WorkingTreeChange[] = [];

  // The final field is empty because Git terminates its output with NUL.
  for (let fieldIndex = 0; fieldIndex < fields.length - 1;) {
    const statusAndPath = fields[fieldIndex];
    fieldIndex += 1;

    const indexStatus = statusAndPath[0];
    const worktreeStatus = statusAndPath[1];
    // Skip X, Y, and the separating space; preserve the filename verbatim.
    const path = statusAndPath.slice(3);

    const isRenameOrCopy = indexStatus === 'R' || indexStatus === 'C'
      || worktreeStatus === 'R' || worktreeStatus === 'C';
    let originalPath: string | undefined;

    // In status -z output, a rename/copy puts the destination first and the
    // original path in the next NUL-delimited field, with no status prefix.
    if (isRenameOrCopy) {
      originalPath = fields[fieldIndex];
      fieldIndex += 1;
    }

    changes.push({ path, indexStatus, worktreeStatus, ...(originalPath ? { originalPath } : {}) });
  }

  return changes;
}

// ============================================================================
// 6. Branch context
// ============================================================================

function upstreamState(repoRoot: string): Pick<Snapshot['git'], 'upstream' | 'ahead' | 'behind'> {
  let upstream: string;
  try {
    upstream = gitText(repoRoot, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}']);
  } catch {
    return { upstream: null, ahead: null, behind: null };
  }

  const [behind, ahead] = gitText(repoRoot, ['rev-list', '--left-right', '--count', `${upstream}...HEAD`])
    .split(/\s+/)
    .map(Number);
  return { upstream, ahead, behind };
}

// ============================================================================
// 7. Content fingerprint, path classifications, and stashes
// ============================================================================

function fingerprint(
  repoRoot: string,
  baseCommit: string,
  paths: string[],
  workingTreeChanges: WorkingTreeChange[],
): string {
  const hash = createHash('sha256');
  // Preserve the original hash namespace so renaming the command does not invalidate evidence.
  hash.update('snapshot-changes-v1\0');
  hash.update(baseCommit);
  hash.update('\0');
  // The binary diff includes tracked file content and mode changes.
  hash.update(git(repoRoot, ['diff', '--binary', '--no-ext-diff', baseCommit, '--'], 'buffer'));

  // Untracked files are absent from git diff; hash their content and mode separately.
  const untracked = workingTreeChanges
    .filter(change => change.indexStatus === '?' && change.worktreeStatus === '?')
    .map(change => change.path)
    .sort();

  for (const path of untracked) {
    const absolutePath = resolve(repoRoot, path);
    const pathFromRoot = relative(repoRoot, absolutePath);
    if (pathFromRoot === '..' || pathFromRoot.startsWith(`..${sep}`) || isAbsolute(pathFromRoot)) {
      throw new Error(`Untracked path escapes the repository: ${path}`);
    }

    const stats = lstatSync(absolutePath);
    hash.update('\0untracked\0');
    hash.update(path);
    hash.update('\0');

    if (stats.isSymbolicLink()) {
      // Hash the link text without reading its target, which may be outside the repo.
      hash.update('symlink\0');
      hash.update(readlinkSync(absolutePath));
    } else if (stats.isFile()) {
      hash.update(stats.mode & 0o111 ? '100755\0' : '100644\0');
      hash.update(readFileSync(absolutePath));
    } else {
      throw new Error(`Unsupported untracked file type: ${path}`);
    }
  }

  for (const path of paths) {
    hash.update('\0path\0');
    hash.update(path);
  }

  return `sha256:${hash.digest('hex')}`;
}

function classifyPaths(paths: string[]): Record<string, string[]> {
  const categories: Record<string, string[]> = {
    frontend: [], backend: [], migrations: [], skills: [], ci: [], documentation: [], tooling: [], other: [],
  };

  for (const path of paths) {
    if (path.startsWith('backend/db/') && !path.startsWith('backend/db/scripts/')) categories.migrations.push(path);
    else if (path.startsWith('frontend/')) categories.frontend.push(path);
    else if (path.startsWith('backend/')) categories.backend.push(path);
    else if (path.startsWith('.agents/skills/')) categories.skills.push(path);
    else if (path.startsWith('.github/workflows/')) categories.ci.push(path);
    else if (path.endsWith('.md')) categories.documentation.push(path);
    else if (path.startsWith('scripts/')) categories.tooling.push(path);
    else categories.other.push(path);
  }

  return categories;
}

function stashInventory(repoRoot: string): StashEntry[] {
  const output = gitText(repoRoot, ['stash', 'list', '--format=%gd%x09%gs']);
  if (!output) return [];

  return output.split('\n').map(line => {
    const [reference, ...description] = line.split('\t');
    return { reference, description: description.join('\t') };
  });
}

// ============================================================================
// 8. Snapshot workflow
// ============================================================================

export function inspectChanges({
  repoRoot = DEFAULT_REPO_ROOT,
  baseRef,
}: { repoRoot?: string; baseRef?: string } = {}): Snapshot {
  // Step 1. Resolve and validate the comparison base.
  const resolvedRepoRoot = resolve(repoRoot);
  const selectedBase = baseRef ?? resolveDefaultBase(resolvedRepoRoot);
  assertBaseRef(resolvedRepoRoot, selectedBase);

  const mergeBase = gitText(resolvedRepoRoot, ['merge-base', selectedBase, 'HEAD']);

  // Step 2. Collect branch commits and staged, unstaged, and untracked changes.
  const baseChanges = parseDiffNameStatus(String(git(resolvedRepoRoot, [
    'diff', '--name-status', '-z', '--find-renames', `${mergeBase}...HEAD`,
  ])));
  const workingTreeChanges = parseWorkingTreeStatus(String(git(resolvedRepoRoot, [
    'status', '--porcelain=v1', '-z', '--untracked-files=all',
  ])));

  // Step 3. Keep both sides of renames so routing sees every affected owner.
  const paths = [...new Set([
    ...baseChanges.flatMap(change => [change.originalPath, change.path]),
    ...workingTreeChanges.flatMap(change => [change.originalPath, change.path]),
  ].filter((path): path is string => Boolean(path)))].sort();

  // Step 4. Read branch context and select checks using the shared CI policy.
  const branch = gitText(resolvedRepoRoot, ['branch', '--show-current']) || null;
  const head = gitText(resolvedRepoRoot, ['rev-parse', 'HEAD']);
  const upstream = upstreamState(resolvedRepoRoot);

  // The selector treats main as a release base, including origin/main.
  const testBaseRef = /(^|\/)main$/.test(selectedBase) ? 'main' : selectedBase;
  const testPlan = selectTests(paths, { baseRef: testBaseRef });

  // Step 5. Fingerprint the content, classify paths, and inventory stashes.
  const workspaceFingerprint = fingerprint(resolvedRepoRoot, mergeBase, paths, workingTreeChanges);
  const classifications = classifyPaths(paths);
  const stashes = stashInventory(resolvedRepoRoot);
  const commands = planCommands(testPlan).map(([command, value]) => ({
    command,
    ...(value ? { value } : {}),
  }));

  // Step 6. Assemble the report without running any selected checks.
  return {
    schemaVersion: 1,
    git: {
      branch, head, baseRef: selectedBase, mergeBase, ...upstream,
      fingerprint: workspaceFingerprint,
    },
    changes: { paths, base: baseChanges, workingTree: workingTreeChanges },
    classifications,
    verification: {
      plan: testPlan,
      commands,
      requiresPatternCheck: paths.length > 0,
      requiresDiffCheck: paths.length > 0,
    },
    stashes,
  };
}

// ============================================================================
// 9. Report output and CLI workflow
// ============================================================================

function formatHuman(snapshot: Snapshot): string {
  const lines = [
    `Branch: ${snapshot.git.branch ?? '(detached HEAD)'}`,
    `Base: ${snapshot.git.baseRef} (${snapshot.git.mergeBase.slice(0, 12)})`,
    `Upstream: ${snapshot.git.upstream ?? '(none)'}`,
    `Ahead/behind: ${snapshot.git.ahead ?? 'n/a'}/${snapshot.git.behind ?? 'n/a'}`,
    `Fingerprint: ${snapshot.git.fingerprint}`,
    `Changed paths: ${snapshot.changes.paths.length}`,
  ];

  for (const path of snapshot.changes.paths) lines.push(`  ${path}`);
  lines.push(`Selected checks: ${snapshot.verification.commands.length}`);
  for (const command of snapshot.verification.commands) {
    lines.push(`  ${command.command}${command.value ? `: ${command.value}` : ''}`);
  }
  lines.push(`Stashes: ${snapshot.stashes.length}`);
  return lines.join('\n');
}

function main(): void {
  // Step 1. Validate CLI arguments and handle help.
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }

  // Step 2. Collect the snapshot, then print the requested representation.
  const snapshot = inspectChanges({ baseRef: options.baseRef });
  console.log(options.json ? JSON.stringify(snapshot, null, 2) : formatHuman(snapshot));
}

// ============================================================================
// 10. Entrypoint
// ============================================================================

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 2;
  }
}
