#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import console from 'node:console';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import process from 'node:process';

const REPO_ROOT = resolve(import.meta.dirname, '../..');

function git(args: string[]): string {
  return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' });
}

function repositoryFiles(): string[] {
  return [...new Set([
    git(['ls-files']),
    git(['ls-files', '--others', '--exclude-standard']),
  ].join('\n').split('\n').map(file => file.trim()).filter(Boolean))];
}

function repositoryPaths(files: string[]): Set<string> {
  const paths = new Set(['.']);
  for (const file of files) {
    paths.add(file);
    for (let parent = dirname(file); parent !== '.'; parent = dirname(parent)) {
      paths.add(parent);
    }
  }
  return paths;
}

function linkTarget(rawTarget: string): string {
  const raw = rawTarget.trim();
  if (raw.startsWith('<')) return raw.slice(1, raw.indexOf('>'));
  return raw.split(/\s+(?=["'])/)[0];
}

const broken: string[] = [];
const repoFiles = repositoryFiles();
const repoPaths = repositoryPaths(repoFiles);
const files = repoFiles.filter(
  file => file.endsWith('.md') && existsSync(resolve(REPO_ROOT, file)),
);

for (const file of files) {
  const source = readFileSync(resolve(REPO_ROOT, file), 'utf8');
  for (const match of source.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = linkTarget(match[1]).split('#')[0];
    if (!target || target.startsWith('/') || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue;

    let repoPath: string;
    try {
      const localPath = resolve(REPO_ROOT, dirname(file), decodeURIComponent(target));
      repoPath = relative(REPO_ROOT, localPath).split(sep).join('/') || '.';
    } catch {
      broken.push(`${file}: invalid local link ${match[1]}`);
      continue;
    }
    if (repoPath.startsWith('../') || !repoPaths.has(repoPath)) {
      broken.push(`${file}: missing local link ${match[1]}`);
    }
  }
}

if (broken.length) {
  console.error(`Documentation link checks failed (${broken.length}):`);
  for (const finding of broken) console.error(`  - ${finding}`);
  process.exit(1);
}

console.log(`Documentation links passed for ${files.length} Markdown files.`);
