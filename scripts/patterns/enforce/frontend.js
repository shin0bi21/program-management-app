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
  const requiredFiles = new Set([
    `${pageName}.tsx`,
    `${pageName}.test.tsx`,
    'types.ts',
  ]);
  const isPageApi = path => /^[a-z][A-Za-z0-9]*\.api\.ts$/.test(path);
  const isPageApiTest = path => /^[a-z][A-Za-z0-9]*\.api\.test\.ts$/.test(path);
  const pageApi = isPageApi(relativePath);
  const pageApiTest = isPageApiTest(relativePath);
  const nestedPageApi = parts.length === 2
    && parts[0] === 'api'
    && /^[a-z][A-Za-z0-9]*\.api\.ts$/.test(parts[1]);
  const reportUnique = (message) => {
    if (!violations.includes(message)) violations.push(message);
  };
  const reportNonstandardRootFile = rootFile => reportUnique(
    `${rootFile}:1 route-page root files are limited to the page TSX, optional CSS, test, types.ts, and one descriptively named *.api.ts adapter with its colocated test.`,
  );
  const reportNonstandardChild = childFile => reportUnique(
    `${childFile}:1 route-page children must be owned by api/, components/, hooks/, or utils/.`,
  );

  if (relativePath === `${pageName}.tsx`) {
    const missing = [...requiredFiles].filter(
      required => !repositoryFiles.includes(`${routeDirectory}/${required}`),
    );
    if (missing.length) {
      violations.push(`${file}:1 route pages require TSX, test, and types files; missing ${missing.join(', ')}.`);
    }

    const rootPrefix = `${routeDirectory}/`;
    for (const candidate of repositoryFiles) {
      if (!candidate.startsWith(rootPrefix)) continue;
      const candidatePath = candidate.slice(rootPrefix.length);
      const candidateOwner = findRoutePageDirectory(candidate, routePageDirectories);
      if (candidateOwner && candidateOwner !== routeDirectory) continue;
      if (candidatePath.startsWith('common/')) continue;
      if (candidatePath.includes('/')) {
        if (!standardDirectories.has(candidatePath.split('/')[0])) {
          reportNonstandardChild(candidate);
        }
        continue;
      }
      if (!standardFiles.has(candidatePath) && !isPageApi(candidatePath) && !isPageApiTest(candidatePath)) {
        reportNonstandardRootFile(candidate);
      }
    }

    const rootApiFiles = repositoryFiles.filter(candidate => (
      candidate.startsWith(rootPrefix)
      && isPageApi(candidate.slice(rootPrefix.length))
    ));
    if (rootApiFiles.length > 1) {
      reportUnique(`${file}:1 route pages with multiple API adapters must group them under api/.`);
    }

    const apiDirectory = `${routeDirectory}/api/`;
    const nestedApiFiles = repositoryFiles.filter(candidate => (
      candidate.startsWith(apiDirectory)
      && !candidate.slice(apiDirectory.length).includes('/')
      && isPageApi(candidate.slice(apiDirectory.length))
    ));
    if (nestedApiFiles.length === 1) {
      reportUnique(`${nestedApiFiles[0]}:1 a route page with one API adapter keeps it at the page root, not in api/.`);
    }
  }

  if (parts.length === 1 && !standardFiles.has(relativePath) && !pageApi && !pageApiTest) {
    reportNonstandardRootFile(file);
  }
  if (parts.length > 1 && !standardDirectories.has(parts[0])) {
    reportNonstandardChild(file);
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

export function checkRoutePageShell(
  violations,
  file,
  source,
  routePageDirectories,
) {
  const routeDirectory = findRoutePageDirectory(file, routePageDirectories);
  if (!routeDirectory) return;

  const pageName = routeDirectory.split('/').at(-1);
  if (file !== `${routeDirectory}/${pageName}.tsx` || !/<PageBody\b/.test(source)) return;

  if (!/<PageHeader\b/.test(source)) {
    violations.push(`${file}:1 data route pages using PageBody must compose a route-level PageHeader.`);
  }

  const dataMain = /<main\b[^>]*className\s*=\s*["'][^"']*\bpage-container\b[^"']*\bpage-container--data\b[^"']*["']/s;
  if (!dataMain.test(source)) {
    violations.push(`${file}:1 data route pages must use main.page-container.page-container--data.`);
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

export function checkCentralizedFrontendDocumentation(violations, file) {
  if (file.startsWith('frontend/src/') && file.endsWith('/README.md')) {
    violations.push(
      `${file}:1 frontend architecture and integration guidance belongs under docs/, not beside source code.`,
    );
  }
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
  const passesColumnKeys = /useUserPreference(?:<[^>]+>)?\s*\(\s*[^,]+,\s*columnKeys\s*,?\s*\)/
    .test(source);
  if (ownsTablePreferences && !passesColumnKeys) {
    violations.push(`${file}:1 table preference hooks must receive page-owned columnKeys and pass them to useUserPreference.`);
  }
  if (!/\bsetBaseline\s*\(/.test(source)) {
    violations.push(`${file}:1 preference hooks must initialize the shared save baseline from their normalized restored state.`);
  }
  if (!/\bsave\s*\(\s*current\s*=>/.test(source)) {
    violations.push(`${file}:1 preference hooks must use functional saves so consecutive controls preserve the latest state.`);
  }
}

export function checkPaginatedTables(violations, file, source) {
  if (!file.startsWith('frontend/src/pages/')) return;

  const usesInfiniteList = source.includes('useInfiniteListQuery');
  if (usesInfiniteList && !file.includes('/hooks/')) {
    violations.push(
      `${file}:1 page components must own remote infinite-list queries through a page hook.`,
    );
  }

  const tableViewHook = /\/components\/[^/]*(?:List|Table)View\/hooks\//.test(file);
  if (usesInfiniteList && /(?:List|Table)View\//.test(file) && !tableViewHook) {
    violations.push(
      `${file}:1 a remote-table view hook must be colocated under that view's hooks directory.`,
    );
  }

  if (usesInfiniteList && !/limit\s*:\s*25\b/.test(source)) {
    violations.push(
      `${file}:1 remote list hooks must request the standard 25-row cursor page size.`,
    );
  }

  const paginationProps = ['hasNextPage', 'loadingNextPage', 'onLoadNextPage'];
  const wiredProps = paginationProps.filter(
    prop => new RegExp(`\\b${prop}\\s*=`).test(source),
  );
  if (wiredProps.length > 0 && wiredProps.length < paginationProps.length) {
    const missing = paginationProps.filter(prop => !wiredProps.includes(prop));
    violations.push(
      `${file}:1 paginated tables must wire the complete load-more contract; missing ${missing.join(', ')}.`,
    );
  }
}

export function checkResourceCalendars(violations, file, source) {
  const resourceCalendarPage = file.startsWith('frontend/src/pages/')
    && file.endsWith('.tsx')
    && !/\.(?:test|spec|story)\.tsx$/.test(file)
    && source.includes('<ResourceCalendar');
  if (!resourceCalendarPage) return;

  if (!source.includes('usePeriodDataBuffer')) {
    violations.push(
      `${file}:1 resource-calendar pages must load visible ranges through usePeriodDataBuffer.`,
    );
  }

  const calendarViewOwner = /\/components\/[^/]*CalendarView\/[^/]*CalendarView\.tsx$/.test(file);
  if (!calendarViewOwner) {
    violations.push(
      `${file}:1 ResourceCalendar must be owned by a cohesive page-private *CalendarView component.`,
    );
  }

  const lifecycleProps = [
    'onInitialPeriods',
    'onPeriodsBuilt',
    'onPeriodsReset',
    'positionStorageKey',
  ];
  const missing = lifecycleProps.filter(
    prop => !new RegExp(`\\b${prop}\\s*=`).test(source),
  );
  if (missing.length) {
    violations.push(
      `${file}:1 buffered resource calendars must wire the complete period lifecycle; missing ${missing.join(', ')}.`,
    );
  }
}

export function checkCalendarDataHooks(violations, file) {
  const calendarDataHook = file.startsWith('frontend/src/pages/')
    && /\/use[^/]*CalendarData\.tsx?$/.test(file)
    && !/\.(?:test|spec)\.tsx?$/.test(file);
  if (!calendarDataHook) return;

  const calendarViewHook = /\/components\/[^/]*CalendarView\/hooks\/use[^/]*CalendarData\.tsx?$/.test(file);
  if (!calendarViewHook) {
    violations.push(
      `${file}:1 calendar-data hooks must be owned by their page-private *CalendarView hooks directory.`,
    );
  }
}
