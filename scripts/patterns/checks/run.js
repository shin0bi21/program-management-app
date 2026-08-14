import { checkBackendControllers, checkBackendRoutes } from './backend.js';
import { checkCalendarDataHooks, checkPaginatedTables, checkResourceCalendars } from './data-surfaces.js';
import { checkCentralizedHttp, checkFocusedAdapters, checkFrontendOwnership, checkPreferenceControlOwnership } from './frontend.js';
import { checkDashboardNames, checkFocusedTests, checkVocabulary } from './quality.js';

export function runPatternChecks(violations, file, source, repoRoot) {
  checkVocabulary(violations, file, source);
  if (/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file)) checkFocusedTests(violations, file, source);

  if (file.startsWith('frontend/src/')) {
    checkFrontendOwnership(violations, file, source, repoRoot);
    checkCentralizedHttp(violations, file, source);
    if (file.endsWith('.api.ts')) checkFocusedAdapters(violations, file, source);
    if (file.endsWith('.tsx')) checkDashboardNames(violations, file, source);
    if (file.startsWith('frontend/src/pages/')) {
      checkPaginatedTables(violations, file, source);
      checkPreferenceControlOwnership(violations, file, source);
      if (file.endsWith('.tsx')) {
        checkResourceCalendars(violations, file, source);
      }
      checkCalendarDataHooks(violations, file);
    }
  }

  if (file.startsWith('backend/src/routes/')) checkBackendRoutes(violations, file, source);
  if (file.startsWith('backend/src/controllers/')) checkBackendControllers(violations, file, source);
}
