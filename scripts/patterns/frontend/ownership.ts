import { parseSourceFile } from '../syntax.ts';
import { resolveImport } from '../utils.ts';
import type { Findings } from '../utils.ts';
import { findRoutePageDirectory } from './shared.ts';

function moduleReferences(file: string, source: string): Array<{ line: number; modulePath: string }> {
  const sourceFile = parseSourceFile(file, source);
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

export function checkFrontendOwnership(
  violations: Findings,
  file: string,
  source: string,
  routePageDirectories: string[],
  repoRoot: string,
): void {
  if (!file.startsWith('frontend/src/')) return;

  for (const { line, modulePath } of moduleReferences(file, source)) {
    const target = resolveImport(repoRoot, file, modulePath);
    if (!target) continue;

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

    const targetRoute = findRoutePageDirectory(target, routePageDirectories);
    if (/^frontend\/src\/pages\/[^/]+\/common\//.test(file) && targetRoute) {
      violations.push(`${file}:${line} page-family common code cannot import a route page's private code (${modulePath}).`);
    }
  }
}

export function checkCentralizedFrontendDocumentation(violations: Findings, file: string): void {
  if (file.startsWith('frontend/src/') && file.endsWith('/README.md')) {
    violations.push(
      `${file}:1 frontend architecture and integration guidance belongs under docs/, not beside source code.`,
    );
  }
}
