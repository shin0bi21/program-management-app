import { dirname, relative, resolve, sep } from 'node:path';

export type Findings = string[];

/**
 * Converts a zero-based source character offset to a one-based line number.
 * @example lineNumber('a\nb', 2) // 2
 */
export function lineNumber(source: string, index: number = 0): number {
  return source.slice(0, index).split('\n').length;
}

/**
 * Appends file-and-line findings for every match of a global pattern; resets its search cursor first.
 * @example addMatches(findings, 'a.ts', 'fetch()', /fetch/g, 'Use the client') // appends 'a.ts:1 Use the client'
 */
export function addMatches(violations: Findings, file: string, source: string, pattern: RegExp, message: string): void {
  // 1. Reset the caller-supplied pattern so prior searches cannot skip findings.
  pattern.lastIndex = 0;
  // 2. Append each finding with its original one-based source location.
  for (const match of source.matchAll(pattern)) {
    violations.push(`${file}:${lineNumber(source, match.index)} ${message}`);
  }
}

/**
 * Removes explicitly deleted paths while preserving the remaining input order.
 * @example filterDeletedFiles(['a', 'b'], ['a']) // ['b']
 */
export function filterDeletedFiles(files: string[], deletedFiles: string[]): string[] {
  const deleted = new Set(deletedFiles);
  return files.filter(file => !deleted.has(file));
}

/**
 * Resolves relative module paths from a repository file; package imports return null.
 * @example resolveImport('/repo', 'src/a.ts', './b') // 'src/b'
 */
export function resolveImport(repoRoot: string, file: string, importPath: string): string | null {
  if (!importPath.startsWith('.')) return null;
  return relative(repoRoot, resolve(dirname(resolve(repoRoot, file)), importPath)).split(sep).join('/');
}
