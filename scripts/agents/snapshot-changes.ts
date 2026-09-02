#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readlinkSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

import { planCommands, selectTests, type TestPlan } from '../ci/select-tests.ts';

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

function usage(): string {
  return `Usage: node scripts/agents/snapshot-changes.ts [--json] [--base BASE_REF]

Create a read-only snapshot of branch and working-tree changes.

  --json           Print the complete machine-readable snapshot.
  --base BASE_REF  Compare against this revision instead of the default base.
  -h, --help       Show this help.`;
}

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
  if (process.env.SNAPSHOT_CHANGES_BASE_REF) return process.env.SNAPSHOT_CHANGES_BASE_REF;

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

function parseNameStatus(output: string): BaseChange[] {
  const fields = output.split('\0');
  const changes: BaseChange[] = [];

  for (let index = 0; index < fields.length - 1;) {
    const status = fields[index++];
    const code = status[0];
    const originalPath = code === 'R' || code === 'C' ? fields[index++] : undefined;
    const path = fields[index++];

    changes.push({ path, status, ...(originalPath ? { originalPath } : {}) });
  }

  return changes;
}

function parsePorcelain(output: string): WorkingTreeChange[] {
  const fields = output.split('\0');
  const changes: WorkingTreeChange[] = [];

  for (let index = 0; index < fields.length - 1;) {
    const entry = fields[index++];
    const indexStatus = entry[0];
    const worktreeStatus = entry[1];
    const path = entry.slice(3);
    const renamedOrCopied = indexStatus === 'R' || indexStatus === 'C'
      || worktreeStatus === 'R' || worktreeStatus === 'C';
    const originalPath = renamedOrCopied ? fields[index++] : undefined;

    changes.push({ path, indexStatus, worktreeStatus, ...(originalPath ? { originalPath } : {}) });
  }

  return changes;
}

function classifyPaths(paths: string[]): Record<string, string[]> {
  const categories: Record<string, string[]> = {
    frontend: [], backend: [], migrations: [], skills: [], ci: [], documentation: [], tooling: [], other: [],
  };

  for (const path of paths) {
    if (path.startsWith('backend/db/migrations/')) categories.migrations.push(path);
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

function fingerprint(
  repoRoot: string,
  baseCommit: string,
  paths: string[],
  workingTreeChanges: WorkingTreeChange[],
): string {
  const hash = createHash('sha256');
  hash.update('snapshot-changes-v1\0');
  hash.update(baseCommit);
  hash.update('\0');
  hash.update(git(repoRoot, ['diff', '--binary', '--no-ext-diff', baseCommit, '--'], 'buffer'));

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

function stashInventory(repoRoot: string): StashEntry[] {
  const output = gitText(repoRoot, ['stash', 'list', '--format=%gd%x09%gs']);
  if (!output) return [];

  return output.split('\n').map(line => {
    const [reference, ...description] = line.split('\t');
    return { reference, description: description.join('\t') };
  });
}

export function snapshotChanges({
  repoRoot = DEFAULT_REPO_ROOT,
  baseRef,
}: { repoRoot?: string; baseRef?: string } = {}): Snapshot {
  const resolvedRepoRoot = resolve(repoRoot);
  const selectedBase = baseRef ?? resolveDefaultBase(resolvedRepoRoot);
  assertBaseRef(resolvedRepoRoot, selectedBase);

  const mergeBase = gitText(resolvedRepoRoot, ['merge-base', selectedBase, 'HEAD']);
  const baseChanges = parseNameStatus(gitText(resolvedRepoRoot, [
    'diff', '--name-status', '-z', '--find-renames', `${mergeBase}...HEAD`,
  ]));
  const workingTreeChanges = parsePorcelain(String(git(resolvedRepoRoot, [
    'status', '--porcelain=v1', '-z', '--untracked-files=all',
  ])));
  const paths = [...new Set([
    ...baseChanges.flatMap(change => [change.originalPath, change.path]),
    ...workingTreeChanges.flatMap(change => [change.originalPath, change.path]),
  ].filter((path): path is string => Boolean(path)))].sort();
  const branch = gitText(resolvedRepoRoot, ['branch', '--show-current']) || null;
  const head = gitText(resolvedRepoRoot, ['rev-parse', 'HEAD']);
  const testBaseRef = /(^|\/)main$/.test(selectedBase) ? 'main' : selectedBase;
  const testPlan = selectTests(paths, { baseRef: testBaseRef });

  return {
    schemaVersion: 1,
    git: {
      branch, head, baseRef: selectedBase, mergeBase, ...upstreamState(resolvedRepoRoot),
      fingerprint: fingerprint(resolvedRepoRoot, mergeBase, paths, workingTreeChanges),
    },
    changes: { paths, base: baseChanges, workingTree: workingTreeChanges },
    classifications: classifyPaths(paths),
    verification: {
      plan: testPlan,
      commands: planCommands(testPlan).map(([command, value]) => ({ command, ...(value ? { value } : {}) })),
      requiresPatternCheck: paths.length > 0,
      requiresDiffCheck: paths.length > 0,
    },
    stashes: stashInventory(resolvedRepoRoot),
  };
}

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

function parseArgs(args: string[]): { json: boolean; baseRef?: string; help?: boolean } {
  const options: { json: boolean; baseRef?: string; help?: boolean } = { json: false };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--json') options.json = true;
    else if (argument === '--base') {
      options.baseRef = args[index + 1];
      if (!options.baseRef) throw new Error('--base requires a revision.');
      index += 1;
    } else if (argument === '-h' || argument === '--help') options.help = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }

  return options;
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }

  const snapshot = snapshotChanges({ baseRef: options.baseRef });
  console.log(options.json ? JSON.stringify(snapshot, null, 2) : formatHuman(snapshot));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 2;
  }
}
