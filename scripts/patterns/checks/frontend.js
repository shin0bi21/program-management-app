import { addMatches, lineNumber, resolveImport } from './utils.js';

export function checkFrontendOwnership(violations, file, source, repoRoot) {
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
    const pageMatch = file.match(/^frontend\/src\/pages\/([^/]+)\//);
    const targetPageMatch = target.match(/^frontend\/src\/pages\/([^/]+)\//);
    if (pageMatch && targetPageMatch && pageMatch[1] !== targetPageMatch[1]) {
      violations.push(`${file}:${lineNumber(source, match.index)} route-family pages cannot import another page family's private code (${match[1]}).`);
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
  if (!file.startsWith('frontend/src/pages/') || /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file) || !source.includes('useUserPreference')) return;
  addMatches(violations, file, source, /^\s*(\w+)\s*:\s*(?:next\.\1\s*\?\?\s*)?preference\?\.\1\b/gm, 'persisted control fields must come from page-owned state, not the preference cache.');
}
