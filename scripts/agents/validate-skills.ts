#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, relative, resolve, sep } from 'node:path';
import process from 'node:process';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const SKILLS_ROOT = resolve(REPO_ROOT, '.agents/skills');

function markdownFiles(directory: string): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return markdownFiles(path);
    return entry.isFile() && entry.name.endsWith('.md') ? [path] : [];
  });
}

function parseFrontmatter(source: string): Map<string, string> | null {
  const match = source.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) return null;
  const fields = new Map<string, string>();
  for (const line of match[1].split('\n')) {
    const field = line.match(/^([a-z_]+):\s*(.+)$/);
    if (!field) return null;
    fields.set(field[1], field[2].trim());
  }
  return fields;
}

function markdownLinks(source: string): string[] {
  return [...source.matchAll(/\[[^\]]+\]\(([^)#]+)(?:#[^)]+)?\)/g)].map(match => match[1]);
}

function repoPath(path: string): string {
  return relative(REPO_ROOT, path).split(sep).join('/');
}

const failures: string[] = [];
const skillDirectories = readdirSync(SKILLS_ROOT, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => resolve(SKILLS_ROOT, entry.name));

for (const skillDirectory of skillDirectories) {
  const folderName = basename(skillDirectory);
  const skillFile = resolve(skillDirectory, 'SKILL.md');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(folderName)) {
    failures.push(`${repoPath(skillDirectory)} must use a lowercase hyphenated skill name.`);
  }
  if (!existsSync(skillFile)) {
    failures.push(`${repoPath(skillDirectory)} is missing SKILL.md.`);
    continue;
  }

  const source = readFileSync(skillFile, 'utf8');
  const lineCount = source.split('\n').length;
  if (lineCount > 500) failures.push(`${repoPath(skillFile)} has ${lineCount} lines; keep SKILL.md under 500.`);

  const frontmatter = parseFrontmatter(source);
  if (!frontmatter) {
    failures.push(`${repoPath(skillFile)} must start with simple YAML frontmatter.`);
  } else {
    const keys = [...frontmatter.keys()];
    if (keys.length !== 2 || !frontmatter.has('name') || !frontmatter.has('description')) {
      failures.push(`${repoPath(skillFile)} frontmatter must contain exactly name and description.`);
    }
    if (frontmatter.get('name') !== folderName) {
      failures.push(`${repoPath(skillFile)} name must match its folder (${folderName}).`);
    }
    if (!frontmatter.get('description')) failures.push(`${repoPath(skillFile)} description cannot be empty.`);
  }

  const linkedFiles = new Set();
  for (const link of markdownLinks(source)) {
    if (/^[a-z]+:/i.test(link)) continue;
    const target = resolve(dirname(skillFile), decodeURIComponent(link));
    linkedFiles.add(target);
    if (!existsSync(target)) failures.push(`${repoPath(skillFile)} links to missing ${link}.`);
  }

  const referencesDirectory = resolve(skillDirectory, 'references');
  for (const reference of markdownFiles(referencesDirectory)) {
    if (!linkedFiles.has(reference)) {
      failures.push(`${repoPath(reference)} must be routed directly from ${repoPath(skillFile)}.`);
    }
  }

  const agentConfig = resolve(skillDirectory, 'agents/openai.yaml');
  if (!existsSync(agentConfig)) {
    failures.push(`${repoPath(skillDirectory)} is missing agents/openai.yaml.`);
  } else {
    const config = readFileSync(agentConfig, 'utf8');
    if (!config.includes(`$${folderName}`)) {
      failures.push(`${repoPath(agentConfig)} default prompt must explicitly invoke $${folderName}.`);
    }
  }
}

if (failures.length) {
  console.error(`Skill validation failed (${failures.length}):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`Validated ${skillDirectories.length} repository skills.`);
