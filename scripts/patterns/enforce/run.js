import { checkBackendControllers, checkBackendRoutes } from './backend.js';
import {
  checkApiStructure,
  checkCalendarDataHooks,
  checkCentralizedFrontendDocumentation,
  checkCentralizedHttp,
  checkFocusedAdapters,
  checkFrontendOwnership,
  checkPaginatedTables,
  checkPreferenceControlOwnership,
  checkResourceCalendars,
  checkRoutePageShell,
  checkRoutePageStructure,
  checkTestOwnership,
  collectRoutePageDirectories,
  collectStructureCheckFiles,
} from './frontend.js';
import { checkDashboardNames, checkFocusedTests, checkVocabulary } from './quality.js';

export { collectRoutePageDirectories, collectStructureCheckFiles };

export function runEnforcementChecks(
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
    checkCentralizedFrontendDocumentation(violations, file);
    checkCentralizedHttp(violations, file, source);
    if (file.endsWith('.api.ts')) checkFocusedAdapters(violations, file, source);
    if (file.endsWith('.tsx')) checkDashboardNames(violations, file, source);
    if (file.startsWith('frontend/src/pages/')) {
      checkRoutePageShell(violations, file, source, routePageDirectories);
      checkPaginatedTables(violations, file, source);
      checkPreferenceControlOwnership(violations, file, source);
      if (file.endsWith('.tsx')) checkResourceCalendars(violations, file, source);
      checkCalendarDataHooks(violations, file);
    }
  }

  if (file.startsWith('backend/src/routes/')) checkBackendRoutes(violations, file, source);
  if (file.startsWith('backend/src/controllers/')) checkBackendControllers(violations, file, source);
}

export function runStructureEnforcement(
  violations,
  file,
  { repositoryFiles, routePageDirectories },
) {
  checkApiStructure(violations, file, repositoryFiles);
  checkRoutePageStructure(violations, file, routePageDirectories, repositoryFiles);
  checkTestOwnership(violations, file, repositoryFiles, routePageDirectories);
}
