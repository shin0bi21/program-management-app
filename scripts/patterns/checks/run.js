import { checkBackendControllers, checkBackendRoutes } from './backend.js';
import {
  checkApiStructure,
  checkCentralizedHttp,
  checkFocusedAdapters,
  checkFrontendOwnership,
  checkPreferenceControlOwnership,
  checkRoutePageStructure,
  checkTestOwnership,
  collectRoutePageDirectories,
  collectStructureCheckFiles,
} from './frontend.js';
import {
  checkCalendarDataHooks,
  checkPaginatedTables,
  checkResourceCalendars,
} from './frontend-views.js';
import { checkFrontendAdvisories } from './frontend-advisories.js';
import { checkDashboardNames, checkFocusedTests, checkVocabulary } from './quality.js';

export { collectRoutePageDirectories, collectStructureCheckFiles };

export function runPatternChecks(
  violations,
  file,
  source,
  repoRoot,
  { routePageDirectories = [] } = {},
) {
  checkVocabulary(violations, file, source);
  if (/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file)) checkFocusedTests(violations, file, source);

  if (file.startsWith('frontend/src/')) {
    checkFrontendOwnership(violations, file, source, routePageDirectories, repoRoot);
    checkCentralizedHttp(violations, file, source);
    if (file.endsWith('.api.ts')) checkFocusedAdapters(violations, file, source);
    if (file.endsWith('.tsx')) checkDashboardNames(violations, file, source);
    if (file.startsWith('frontend/src/pages/')) {
      checkPaginatedTables(violations, file, source);
      checkPreferenceControlOwnership(violations, file, source);
      if (file.endsWith('.tsx')) checkResourceCalendars(violations, file, source);
      checkCalendarDataHooks(violations, file);
    }
  }

  if (file.startsWith('backend/src/routes/')) checkBackendRoutes(violations, file, source);
  if (file.startsWith('backend/src/controllers/')) checkBackendControllers(violations, file, source);
}

export function runAdvisoryChecks(
  advisories,
  file,
  source,
  { repositoryFiles = [], routePageDirectories = [] } = {},
) {
  if (file.startsWith('frontend/src/')) {
    checkFrontendAdvisories(advisories, file, source, {
      repositoryFiles,
      routePageDirectories,
    });
  }
}

export function runStructureChecks(
  violations,
  file,
  { repositoryFiles, routePageDirectories },
) {
  checkApiStructure(violations, file, repositoryFiles);
  checkRoutePageStructure(violations, file, routePageDirectories, repositoryFiles);
  checkTestOwnership(violations, file, repositoryFiles, routePageDirectories);
}
