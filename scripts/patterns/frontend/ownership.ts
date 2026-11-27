import { parseSourceFile } from '../syntax.ts';
import { resolveImport } from '../utils.ts';
import type { Findings } from '../utils.ts';
import { findRoutePageDirectory } from './shared.ts';

interface ModuleReference {
  line: number;
  modulePath: string;
}

/**
 * Appends dependency-direction violations using repository-relative route owners and resolved local imports.
 * @example checkFrontendOwnership([], 'README.md', '', [], '/repo') // no findings
 */
export function checkFrontendOwnership(
  violations: Findings,
  file: string,
  source: string,
  routePageDirectories: string[],
  repoRoot: string,
): void {
  // 1. Restrict ownership checks to frontend source files.
  if (!file.startsWith('frontend/src/')) return;

  // 2. Resolve local references before applying dependency direction rules.
  for (const { line, modulePath } of moduleReferences(file, source)) {
    const target = resolveImport(repoRoot, file, modulePath);
    if (!target) continue;

    // 3. Keep shared components and features independent of private page owners.
    if (file.startsWith('frontend/src/common/components/')) {
      if (target.startsWith('frontend/src/pages/') || target.startsWith('frontend/src/common/features/')) {
        violations.push(`${file}:${line} common components cannot import features or pages (${modulePath}).`);
      }
      continue;
    }

    if (file.startsWith('frontend/src/common/features/') && target.startsWith('frontend/src/pages/')) {
      violations.push(`${file}:${line} common features cannot import pages (${modulePath}).`);
      continue;
    }

    // 4. Prevent family-common modules from reaching into a route page.
    const targetRoute = findRoutePageDirectory(target, routePageDirectories);
    if (/^frontend\/src\/pages\/[^/]+\/common\//.test(file) && targetRoute) {
      violations.push(`${file}:${line} page-family common code cannot import a route page's private code (${modulePath}).`);
    }
  }
}

/**
 * Extracts static import and re-export module paths with one-based source line locations.
 * @example moduleReferences('a.ts', "export * from './b';")[0].modulePath // './b'
 */
function moduleReferences(file: string, source: string): ModuleReference[] {
  // 1. Parse static module declarations, including re-exports.
  const sourceFile = parseSourceFile(file, source);
  // 2. Retain module specifiers with their original source line numbers.
  return [
    ...sourceFile.getImportDeclarations(),
    ...sourceFile.getExportDeclarations(),
  ].flatMap((declaration) => {
    const modulePath = declaration.getModuleSpecifierValue();
    return modulePath == null
      ? []
      : [{ line: declaration.getStartLineNumber(), modulePath }];
  });
}
