import { dirname, relative, resolve, sep } from 'node:path';

export function lineNumber(source, index) {
  return source.slice(0, index).split('\n').length;
}

export function addMatches(violations, file, source, pattern, message) {
  pattern.lastIndex = 0;
  for (const match of source.matchAll(pattern)) {
    violations.push(`${file}:${lineNumber(source, match.index)} ${message}`);
  }
}

export function resolveImport(repoRoot, file, importPath) {
  if (!importPath.startsWith('.')) return null;
  return relative(repoRoot, resolve(dirname(resolve(repoRoot, file)), importPath)).split(sep).join('/');
}
