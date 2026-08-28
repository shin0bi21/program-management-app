import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { snapshotChanges } from './snapshot-changes.ts';

function command(repoRoot: string, executable: string, args: string[]): string {
  return execFileSync(executable, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function createRepository(): string {
  const repoRoot = mkdtempSync(join(tmpdir(), 'change-snapshot-repo-'));
  command(repoRoot, 'git', ['init', '-b', 'develop']);
  command(repoRoot, 'git', ['config', 'user.email', 'snapshot@example.com']);
  command(repoRoot, 'git', ['config', 'user.name', 'Snapshot Test']);
  mkdirSync(join(repoRoot, 'docs'), { recursive: true });
  writeFileSync(join(repoRoot, 'docs/guide.md'), 'initial\n');
  command(repoRoot, 'git', ['add', '.']);
  command(repoRoot, 'git', ['commit', '-m', 'Initial commit']);
  return repoRoot;
}

test('snapshots committed and working-tree changes with shared test routing', () => {
  const repoRoot = createRepository();
  mkdirSync(join(repoRoot, 'backend/src/services'), { recursive: true });
  writeFileSync(join(repoRoot, 'backend/src/services/accountService.ts'), 'export const value = 1;\n');
  command(repoRoot, 'git', ['add', '.']);
  command(repoRoot, 'git', ['commit', '-m', 'Add account service']);
  mkdirSync(join(repoRoot, 'frontend/src/pages'), { recursive: true });
  writeFileSync(join(repoRoot, 'frontend/src/pages/Example.tsx'), 'export default null;\n');
  writeFileSync(join(repoRoot, 'docs/guide.md'), 'updated\n');

  const snapshot = snapshotChanges({ repoRoot, baseRef: 'develop~1' });

  assert.deepEqual(snapshot.changes.paths, [
    'backend/src/services/accountService.ts', 'docs/guide.md', 'frontend/src/pages/Example.tsx',
  ]);
  assert.deepEqual(snapshot.classifications.backend, ['backend/src/services/accountService.ts']);
  assert.equal(snapshot.verification.plan.backendMode, 'focused');
  assert.equal(snapshot.verification.plan.frontendMode, 'related');
  assert.match(snapshot.git.fingerprint, /^sha256:[a-f0-9]{64}$/);
});

test('changes the fingerprint when untracked contents change', () => {
  const repoRoot = createRepository();
  const path = join(repoRoot, 'untracked.txt');
  writeFileSync(path, 'first\n');
  const first = snapshotChanges({ repoRoot, baseRef: 'HEAD' });
  writeFileSync(path, 'second\n');
  const second = snapshotChanges({ repoRoot, baseRef: 'HEAD' });

  assert.deepEqual(first.changes.paths, ['untracked.txt']);
  assert.notEqual(first.git.fingerprint, second.git.fingerprint);
});

test('accepts untracked filenames that begin with two dots', () => {
  const repoRoot = createRepository();
  writeFileSync(join(repoRoot, '..notes'), 'valid repository file\n');

  const snapshot = snapshotChanges({ repoRoot, baseRef: 'HEAD' });

  assert.deepEqual(snapshot.changes.paths, ['..notes']);
});

test('fingerprints untracked executable mode and symbolic-link text', () => {
  const repoRoot = createRepository();
  const scriptPath = join(repoRoot, 'script.sh');
  const externalDirectory = mkdtempSync(join(tmpdir(), 'change-snapshot-target-'));
  const firstTarget = join(externalDirectory, 'first.txt');
  const secondTarget = join(externalDirectory, 'second.txt');
  writeFileSync(scriptPath, '#!/bin/sh\n');
  writeFileSync(firstTarget, 'first\n');
  writeFileSync(secondTarget, 'second\n');
  symlinkSync(firstTarget, join(repoRoot, 'link.txt'));

  const initial = snapshotChanges({ repoRoot, baseRef: 'HEAD' });
  chmodSync(scriptPath, 0o755);
  const executable = snapshotChanges({ repoRoot, baseRef: 'HEAD' });
  writeFileSync(firstTarget, 'changed outside the repository\n');
  const externalContentChanged = snapshotChanges({ repoRoot, baseRef: 'HEAD' });
  command(repoRoot, 'rm', ['link.txt']);
  symlinkSync(secondTarget, join(repoRoot, 'link.txt'));
  const linkTextChanged = snapshotChanges({ repoRoot, baseRef: 'HEAD' });

  assert.notEqual(initial.git.fingerprint, executable.git.fingerprint);
  assert.equal(executable.git.fingerprint, externalContentChanged.git.fingerprint);
  assert.notEqual(externalContentChanged.git.fingerprint, linkTextChanged.git.fingerprint);
});

test('fingerprints broken symlinks without following them', () => {
  const repoRoot = createRepository();
  symlinkSync('missing-one', join(repoRoot, 'link.txt'));
  const first = snapshotChanges({ repoRoot, baseRef: 'HEAD' });
  command(repoRoot, 'rm', ['link.txt']);
  symlinkSync('missing-two', join(repoRoot, 'link.txt'));
  const second = snapshotChanges({ repoRoot, baseRef: 'HEAD' });

  assert.notEqual(first.git.fingerprint, second.git.fingerprint);
});

test('can be imported when the process has no script argument', () => {
  const result = spawnSync(
    process.execPath,
    ['--input-type=module', '--eval', `process.argv.splice(1); await import(${JSON.stringify(new URL('./snapshot-changes.ts', import.meta.url).href)});`],
    { encoding: 'utf8' },
  );

  assert.equal(result.status, 0, result.stderr);
});

test('treats remote main as a release verification base', () => {
  const repoRoot = createRepository();
  command(repoRoot, 'git', ['branch', 'main']);
  command(repoRoot, 'git', ['update-ref', 'refs/remotes/origin/main', 'main']);

  const snapshot = snapshotChanges({ repoRoot, baseRef: 'origin/main' });

  assert.equal(snapshot.verification.plan.backendImage, true);
  assert.equal(snapshot.verification.plan.frontendImage, true);
  assert.equal(snapshot.verification.plan.compose, true);
});

test('reports renames without losing either path', () => {
  const repoRoot = createRepository();
  command(repoRoot, 'git', ['mv', 'docs/guide.md', 'docs/renamed-guide.md']);

  const snapshot = snapshotChanges({ repoRoot, baseRef: 'HEAD' });

  assert.deepEqual(snapshot.changes.paths, ['docs/guide.md', 'docs/renamed-guide.md']);
  assert.deepEqual(snapshot.changes.workingTree, [{
    path: 'docs/renamed-guide.md', indexStatus: 'R', worktreeStatus: ' ', originalPath: 'docs/guide.md',
  }]);
});
