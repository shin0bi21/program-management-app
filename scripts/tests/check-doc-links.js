#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import console from 'node:console';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';

const REPO_ROOT = resolve(import.meta.dirname, '../..');

function git(args) {
  return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' });
}

function markdownFiles() {
  return [...new Set([
    git(['ls-files', '*.md']),
    git(['ls-files', '--others', '--exclude-standard', '*.md']),
  ].join('\n').split('\n').map(file => file.trim()).filter(
    file => file && existsSync(resolve(REPO_ROOT, file)),
  ))];
}

function linkTarget(rawTarget) {
  const raw = rawTarget.trim();
  if (raw.startsWith('<')) return raw.slice(1, raw.indexOf('>'));
  return raw.split(/\s+(?=["'])/)[0];
}

const broken = [];
const files = markdownFiles();

for (const file of files) {
  const source = readFileSync(resolve(REPO_ROOT, file), 'utf8');
  for (const match of source.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = linkTarget(match[1]).split('#')[0];
    if (!target || target.startsWith('/') || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue;

    let localPath;
    try {
      localPath = resolve(REPO_ROOT, dirname(file), decodeURIComponent(target));
    } catch {
      broken.push(`${file}: invalid local link ${match[1]}`);
      continue;
    }
    if (!existsSync(localPath)) broken.push(`${file}: missing local link ${match[1]}`);
  }
}

if (broken.length) {
  console.error(`Documentation link checks failed (${broken.length}):`);
  for (const finding of broken) console.error(`  - ${finding}`);
  process.exit(1);
}

console.log(`Documentation links passed for ${files.length} Markdown files.`);
