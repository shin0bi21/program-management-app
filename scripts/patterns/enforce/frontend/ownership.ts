import { parseSourceFile } from '../../syntax.ts';
import { resolveImport } from '../utils.ts';
import type { Findings } from '../utils.ts';
import { findRoutePageDirectory, siblingExists } from './shared.ts';

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

export function checkApiStructure(violations: Findings, file: string, repositoryFiles: string[]): void {
  const featureFile = file.startsWith('frontend/src/common/features/');
  const pageFamilyCommonFile = /^frontend\/src\/pages\/[^/]+\/common\//.test(file);
  if (!featureFile && !pageFamilyCommonFile) return;

  const apiDirectory = file.match(/^(.*\/api)\/[^/]+\.api\.ts$/)?.[1];
  if (apiDirectory) {
    const adapters = repositoryFiles.filter(candidate => (
      candidate.startsWith(`${apiDirectory}/`)
      && !candidate.slice(apiDirectory.length + 1).includes('/')
      && /^[a-z][A-Za-z0-9]*\.api\.ts$/.test(candidate.slice(apiDirectory.length + 1))
    ));
    if (adapters.length === 1) {
      violations.push(`${file}:1 a single API adapter belongs at its owning feature or page-family common root, not in api/.`);
    }
  }

  const ownerRootMatch = file.match(
    /^(frontend\/src\/(?:common\/features\/[^/]+|pages\/[^/]+\/common))\/([^/]+\.api\.ts)$/,
  );
  if (!ownerRootMatch) return;

  const [, ownerRoot, apiFile] = ownerRootMatch;
  if (!/^[a-z][A-Za-z0-9]*\.api\.ts$/.test(apiFile)) {
    violations.push(`${file}:1 API adapters must use a descriptive lowercase *.api.ts filename.`);
  }
  const rootAdapters = repositoryFiles.filter(candidate => (
    candidate.startsWith(`${ownerRoot}/`)
    && !candidate.slice(ownerRoot.length + 1).includes('/')
    && candidate.endsWith('.api.ts')
  ));
  if (rootAdapters.length > 1) {
    violations.push(`${file}:1 owners with multiple API adapters must group them under api/.`);
  }
}

export function checkTestOwnership(violations: Findings, file: string, repositoryFiles: string[], routePageDirectories: string[]): void {
  if (!file.startsWith('frontend/src/') || /\.(?:test|spec|story)\.[cm]?[jt]sx?$/.test(file)) return;

  const routeDirectory = findRoutePageDirectory(file, routePageDirectories);
  const pageName = routeDirectory?.split('/').at(-1);
  if (routeDirectory && file === `${routeDirectory}/${pageName}.tsx`) return;

  if (/\/components\/.*\.tsx$/.test(file)
    && !siblingExists(repositoryFiles, file, ['.test.tsx'])) {
    violations.push(`${file}:1 components must own a colocated same-name *.test.tsx file.`);
  }
  if (/\/use[A-Z][^/]*\.tsx?$/.test(file)
    && !siblingExists(repositoryFiles, file, ['.test.ts', '.test.tsx'])) {
    violations.push(`${file}:1 hooks must own a colocated same-name test file.`);
  }
  if (file.endsWith('.api.ts')) {
    const testFile = file.replace(/\.api\.ts$/, '.api.test.ts');
    if (!repositoryFiles.includes(testFile)) {
      violations.push(`${file}:1 API adapters must own a colocated same-name *.api.test.ts file.`);
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
