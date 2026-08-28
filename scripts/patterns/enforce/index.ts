import { checkBackendControllers, checkBackendRoutes } from './backend/index.ts';
import {
  checkCalendarDataHooks,
  checkCentralizedHttp,
  checkDashboardNames,
  checkApiStructure,
  checkCentralizedFrontendDocumentation,
  checkFocusedAdapters,
  checkFrontendOwnership,
  checkPaginatedTables,
  checkPreferenceControlOwnership,
  checkRoutePageShell,
  checkRoutePageStructure,
  checkTestOwnership,
  checkTimelineCalendars,
  collectRoutePageDirectories,
  collectStructureCheckFiles,
} from './frontend/index.ts';
import type { Findings } from './utils.ts';

interface EnforcementOptions {
  routePageDirectories?: string[];
}

interface StructureOptions {
  repositoryFiles: string[];
  routePageDirectories: string[];
}

export { collectRoutePageDirectories, collectStructureCheckFiles };

export function runEnforcementChecks(
  violations: Findings,
  file: string,
  source: string,
  repoRoot: string,
  { routePageDirectories = [] }: EnforcementOptions = {},
): void {
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
  violations: Findings,
  file: string,
  { repositoryFiles, routePageDirectories }: StructureOptions,
): void {
  checkApiStructure(violations, file, repositoryFiles);
  checkRoutePageStructure(violations, file, routePageDirectories, repositoryFiles);
  checkTestOwnership(violations, file, repositoryFiles, routePageDirectories);
}
