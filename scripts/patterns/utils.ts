import { dirname, relative, resolve, sep } from 'node:path';

export type Findings = string[];

export function lineNumber(source: string, index = 0): number {
  return source.slice(0, index).split('\n').length;
}

export function addMatches(violations: Findings, file: string, source: string, pattern: RegExp, message: string): void {
  pattern.lastIndex = 0;
  for (const match of source.matchAll(pattern)) {
    violations.push(`${file}:${lineNumber(source, match.index)} ${message}`);
  }
}

export function filterDeletedFiles(files: string[], deletedFiles: string[]): string[] {
  const deleted = new Set(deletedFiles);
  return files.filter(file => !deleted.has(file));
}

export function resolveImport(repoRoot: string, file: string, importPath: string): string | null {
  if (!importPath.startsWith('.')) return null;
  return relative(repoRoot, resolve(dirname(resolve(repoRoot, file)), importPath)).split(sep).join('/');
}
