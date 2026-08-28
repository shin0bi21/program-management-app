import { findRoutePageDirectory } from './shared.ts';
import type { Findings } from '../utils.ts';

export function checkRoutePageStructure(
  violations: Findings,
  file: string,
  routePageDirectories: string[],
  repositoryFiles: string[],
): void {
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
  ]);
  const isPageApi = (path: string) => /^[a-z][A-Za-z0-9]*\.api\.ts$/.test(path);
  const isPageApiTest = (path: string) => /^[a-z][A-Za-z0-9]*\.api\.test\.ts$/.test(path);
  const pageApi = isPageApi(relativePath);
  const pageApiTest = isPageApiTest(relativePath);
  const nestedPageApi = parts.length === 2
    && parts[0] === 'api'
    && /^[a-z][A-Za-z0-9]*\.api\.ts$/.test(parts[1]);
  const reportUnique = (message: string) => {
    if (!violations.includes(message)) violations.push(message);
  };
  const reportNonstandardRootFile = (rootFile: string) => reportUnique(
    `${rootFile}:1 route-page root files are limited to the page TSX, optional CSS, test, types.ts, and one descriptively named *.api.ts adapter with its colocated test.`,
  );
  const reportNonstandardChild = (childFile: string) => reportUnique(
    `${childFile}:1 route-page children must be owned by api/, components/, hooks/, or utils/.`,
  );

  if (relativePath === `${pageName}.tsx`) {
    const missing = [...requiredFiles].filter(
      required => !repositoryFiles.includes(`${routeDirectory}/${required}`),
    );
    if (missing.length) {
      violations.push(`${file}:1 route pages require a TSX entry and colocated test; missing ${missing.join(', ')}.`);
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
  violations: Findings,
  file: string,
  source: string,
  routePageDirectories: string[],
): void {
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
