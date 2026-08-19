import { dirname } from 'node:path';

import { addMatches, lineNumber, resolveImport } from './utils.js';

function findRoutePageDirectory(file, routePageDirectories) {
  if (/^frontend\/src\/pages\/[^/]+\/common(?:\/|$)/.test(file)) return undefined;
  return routePageDirectories.find(
    routeDirectory => file === routeDirectory || file.startsWith(`${routeDirectory}/`),
  );
}

function siblingExists(repositoryFiles, file, suffixes) {
  const directory = dirname(file);
  const fileName = file.slice(directory.length + 1).replace(/\.[^.]+$/, '');
  return suffixes.some(suffix => repositoryFiles.includes(`${directory}/${fileName}${suffix}`));
}

// Route pages are directories whose entry file matches the directory name.
// Longest paths come first so Homepage/ManageHomepage wins over Homepage.
export function collectRoutePageDirectories(repositoryFiles) {
  const routePagePattern = /^(frontend\/src\/pages\/(?:[^/]+\/)?([^/]+))\/\2\.tsx$/;
  return repositoryFiles
    .flatMap((file) => file.match(routePagePattern)?.[1] ?? [])
    .sort((left, right) => right.length - left.length);
}

// Structural rules need the current owner even when a required sibling was
// deleted. API siblings are also selected because their placement depends on
// how many adapters remain inside the same owner.
export function collectStructureCheckFiles(
  changedFiles,
  repositoryFiles,
  routePageDirectories,
) {
  const currentFiles = new Set(repositoryFiles);
  const selected = new Set(changedFiles.filter(file => currentFiles.has(file)));

  for (const changedFile of changedFiles) {
    const routeDirectory = findRoutePageDirectory(changedFile, routePageDirectories);
    if (routeDirectory) {
      const pageName = routeDirectory.split('/').at(-1);
      selected.add(`${routeDirectory}/${pageName}.tsx`);
    }

    const deletedTest = changedFile.match(/^(.*)\.(?:test|spec)\.[cm]?[jt]sx?$/)?.[1];
    if (deletedTest) {
      for (const extension of ['.ts', '.tsx']) {
        const owner = `${deletedTest}${extension}`;
        if (currentFiles.has(owner)) selected.add(owner);
      }
    }

    if (!/\.api(?:\.test)?\.ts$/.test(changedFile)) continue;

    if (routeDirectory) {
      for (const candidate of repositoryFiles) {
        if (candidate.startsWith(`${routeDirectory}/`) && /\.api(?:\.test)?\.ts$/.test(candidate)) {
          selected.add(candidate);
        }
      }
    }

    const sharedOwner = changedFile.match(
      /^(frontend\/src\/(?:common\/features\/[^/]+|pages\/[^/]+\/common))(?:\/|$)/,
    )?.[1];
    if (!sharedOwner) continue;
    for (const candidate of repositoryFiles) {
      if (candidate.startsWith(`${sharedOwner}/`) && /\.api(?:\.test)?\.ts$/.test(candidate)) {
        selected.add(candidate);
      }
    }
  }

  return [...selected];
}

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

    const sourceRoute = findRoutePageDirectory(file, routePageDirectories);
    const targetRoute = findRoutePageDirectory(target, routePageDirectories);
    if (/^frontend\/src\/pages\/[^/]+\/common\//.test(file) && targetRoute) {
      violations.push(`${file}:${lineNumber(source, match.index)} page-family common code cannot import a route page's private code (${match[1]}).`);
      continue;
    }
    if (sourceRoute && targetRoute && sourceRoute !== targetRoute) {
      violations.push(`${file}:${lineNumber(source, match.index)} route pages cannot import another route page's private code (${match[1]}).`);
      continue;
    }

    const pageMatch = file.match(/^frontend\/src\/pages\/([^/]+)\//);
    const targetPageMatch = target.match(/^frontend\/src\/pages\/([^/]+)\//);
    if (pageMatch && targetPageMatch && pageMatch[1] !== targetPageMatch[1]) {
      violations.push(`${file}:${lineNumber(source, match.index)} route-family pages cannot import another page family's private code (${match[1]}).`);
    }
  }
}

export function checkRoutePageStructure(
  violations,
  file,
  routePageDirectories,
  repositoryFiles,
) {
  const routeDirectory = findRoutePageDirectory(file, routePageDirectories);
  if (!routeDirectory) return;

  const standardDirectories = new Set(['api', 'components', 'hooks', 'utils']);
  const relativePath = file.slice(routeDirectory.length + 1);
  const parts = relativePath.split('/');
  const pageName = routeDirectory.split('/').at(-1);
  const standardFiles = new Set([
    `${pageName}.tsx`,
    `${pageName}.css`,
    `${pageName}.test.tsx`,
    'types.ts',
  ]);
  const pageApi = /^[a-z][A-Za-z0-9]*\.api\.ts$/.test(relativePath);
  const pageApiTest = /^[a-z][A-Za-z0-9]*\.api\.test\.ts$/.test(relativePath);
  const nestedPageApi = parts.length === 2
    && parts[0] === 'api'
    && /^[a-z][A-Za-z0-9]*\.api\.ts$/.test(parts[1]);

  if (relativePath === `${pageName}.tsx`) {
    const missing = [...standardFiles].filter(
      required => !repositoryFiles.includes(`${routeDirectory}/${required}`),
    );
    if (missing.length) {
      violations.push(`${file}:1 route pages require TSX, CSS, test, and types files; missing ${missing.join(', ')}.`);
    }
  }

  if (parts.length === 1 && !standardFiles.has(relativePath) && !pageApi && !pageApiTest) {
    violations.push(`${file}:1 route-page root files are limited to the page TSX, CSS, test, types.ts, and one descriptively named *.api.ts adapter with its colocated test.`);
  }
  if (parts.length > 1 && !standardDirectories.has(parts[0])) {
    violations.push(`${file}:1 route-page children must be owned by api/, components/, hooks/, or utils/.`);
  }
  if (pageApiTest) {
    const adapter = relativePath.replace('.api.test.ts', '.api.ts');
    if (!repositoryFiles.includes(`${routeDirectory}/${adapter}`)) {
      violations.push(`${file}:1 a route-page API test must be colocated with its matching *.api.ts adapter.`);
    }
  }
  if (pageApi) {
    const apiFiles = repositoryFiles.filter(candidate => (
      candidate.startsWith(`${routeDirectory}/`)
      && !candidate.slice(routeDirectory.length + 1).includes('/')
      && /^[a-z][A-Za-z0-9]*\.api\.ts$/.test(candidate.slice(routeDirectory.length + 1))
    ));
    if (apiFiles.length > 1) {
      violations.push(`${file}:1 route pages with multiple API adapters must group them under api/.`);
    }
  }
  if (nestedPageApi) {
    const apiDirectory = `${routeDirectory}/api/`;
    const apiFiles = repositoryFiles.filter(candidate => (
      candidate.startsWith(apiDirectory)
      && !candidate.slice(apiDirectory.length).includes('/')
      && /^[a-z][A-Za-z0-9]*\.api\.ts$/.test(candidate.slice(apiDirectory.length))
    ));
    if (apiFiles.length === 1) {
      violations.push(`${file}:1 a route page with one API adapter keeps it at the page root, not in api/.`);
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

export function checkCentralizedHttp(violations, file, source) {
  if (!file.startsWith('frontend/src/') || file === 'frontend/src/http/client.ts' || file === 'frontend/src/auth/tokenRefresh.ts') return;
  addMatches(violations, file, source, /\bfetch\s*\(/g, 'frontend requests must use the centralized API client.');
}

export function checkFocusedAdapters(violations, file, source) {
  if (!file.startsWith('frontend/src/') || !file.endsWith('.api.ts')) return;
  addMatches(violations, file, source, /apiClient\.put(?:<[^>]+>)?\s*\(\s*(?:`[^`]*\/(?:status|placement)(?:[/?][^`]*)?`|'[^']*\/(?:status|placement)(?:[/?][^']*)?')/g, 'focused status/placement endpoints must use PATCH, not PUT.');
}

export function checkPreferenceControlOwnership(violations, file, source) {
  if (!file.startsWith('frontend/src/pages/') || /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file)) return;

  if (file.endsWith('.tsx') && source.includes('<ColumnVisibilityMenu')) {
    const columnKeys = source.match(/const\s+([A-Z][A-Z0-9_]*_COLUMN_KEYS)\s*=\s*\[/)?.[1];
    if (!columnKeys || source.split(columnKeys).length < 3) {
      violations.push(`${file}:1 pages with column visibility must define and pass a page-owned *_COLUMN_KEYS runtime list.`);
    }
  }

  if (!source.includes('useUserPreference')) return;
  const ownsTablePreferences = /\b(?:columnWidths|hiddenColumns)\b/.test(source);
  const passesColumnKeys = /useUserPreference(?:<[^>]+>)?\s*\(\s*['"][^'"]+['"]\s*,\s*columnKeys\s*\)/
    .test(source);
  if (ownsTablePreferences && !passesColumnKeys) {
    violations.push(`${file}:1 table preference hooks must receive page-owned columnKeys and pass them to useUserPreference.`);
  }
  if (!/\bsetBaseline\s*\(/.test(source)) {
    violations.push(`${file}:1 preference control hooks must initialize the shared save baseline from their normalized restored state.`);
  }
  if (!/\bsave\s*\(\s*current\s*=>/.test(source)) {
    violations.push(`${file}:1 preference control hooks must use functional saves so consecutive controls preserve the latest state.`);
  }
}
