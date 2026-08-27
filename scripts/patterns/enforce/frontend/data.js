import { addMatches } from '../utils.js';

export function checkCentralizedHttp(violations, file, source) {
  if (!file.startsWith('frontend/src/') || file === 'frontend/src/http/transport.ts') return;
  addMatches(violations, file, source, /\bfetch\s*\(/g, 'frontend requests must use the centralized API client.');
}

export function checkFocusedAdapters(violations, file, source) {
  if (!file.startsWith('frontend/src/') || !file.endsWith('.api.ts')) return;
  addMatches(violations, file, source, /apiClient\.put(?:<[^>]+>)?\s*\(\s*(?:`[^`]*\/(?:status|placement)(?:[/?][^`]*)?`|'[^']*\/(?:status|placement)(?:[/?][^']*)?')/g, 'focused status/placement endpoints must use PATCH, not PUT.');
}
