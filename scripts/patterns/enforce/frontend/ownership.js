import { lineNumber, resolveImport } from '../utils.js';
import { findRoutePageDirectory, siblingExists } from './shared.js';

export function checkFrontendOwnership(
  violations,
  file,
  source,
  routePageDirectories,
  repoRoot,
) {
  if (!file.startsWith('frontend/src/')) return;

  const importPattern = /(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  for (const match of source.matchAll(importPattern)) {
    const target = resolveImport(repoRoot, file, match[1]);
    if (!target) continue;

    if (file.startsWith('frontend/src/common/components/')) {
      if (target.startsWith('frontend/src/pages/') || target.startsWith('frontend/src/common/features/')) {
        violations.push(`${file}:${lineNumber(source, match.index)} common components cannot import features or pages (${match[1]}).`);
      }
      continue;
    }

    if (file.startsWith('frontend/src/common/features/') && target.startsWith('frontend/src/pages/')) {
      violations.push(`${file}:${lineNumber(source, match.index)} common features cannot import pages (${match[1]}).`);
      continue;
    }

    const targetRoute = findRoutePageDirectory(target, routePageDirectories);
    if (/^frontend\/src\/pages\/[^/]+\/common\//.test(file) && targetRoute) {
      violations.push(`${file}:${lineNumber(source, match.index)} page-family common code cannot import a route page's private code (${match[1]}).`);
    }
  }
}

export function checkApiStructure(violations, file, repositoryFiles) {
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

export function checkTestOwnership(violations, file, repositoryFiles, routePageDirectories) {
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

export function checkCentralizedFrontendDocumentation(violations, file) {
  if (file.startsWith('frontend/src/') && file.endsWith('/README.md')) {
    violations.push(
      `${file}:1 frontend architecture and integration guidance belongs under docs/, not beside source code.`,
    );
  }
}
