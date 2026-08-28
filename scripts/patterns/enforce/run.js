import { checkBackendControllers } from './backend/controllers.js';
import { checkBackendRoutes } from './backend/routes.js';
import { checkCalendarDataHooks, checkTimelineCalendars } from './frontend/calendars.js';
import { checkCentralizedHttp, checkFocusedAdapters } from './frontend/data.js';
import { checkDashboardNames } from './frontend/dashboards.js';
import {
  checkApiStructure,
  checkCentralizedFrontendDocumentation,
  checkFrontendOwnership,
  checkTestOwnership,
} from './frontend/ownership.js';
import { checkRoutePageShell, checkRoutePageStructure } from './frontend/pages.js';
import { checkPreferenceControlOwnership } from './frontend/preferences.js';
import {
  collectRoutePageDirectories,
  collectStructureCheckFiles,
} from './frontend/shared.js';
import { checkPaginatedTables } from './frontend/tables.js';
import { checkFocusedTests } from './quality.js';

export { collectRoutePageDirectories, collectStructureCheckFiles };

export function runEnforcementChecks(
  violations,
  file,
  source,
  repoRoot,
  { routePageDirectories = [] } = {},
) {
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
      if (file.endsWith('.tsx')) checkTimelineCalendars(violations, file, source);
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
