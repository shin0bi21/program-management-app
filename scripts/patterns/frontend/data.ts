import { addMatches } from '../utils.ts';
import type { Findings } from '../utils.ts';

/**
 * Appends textual fetch-call matches outside the frontend transport owner.
 * @example checkCentralizedHttp([], 'frontend/src/http/transport.ts', 'fetch(url)') // no findings
 */
export function checkCentralizedHttp(violations: Findings, file: string, source: string): void {
  if (!file.startsWith('frontend/src/') || file === 'frontend/src/http/transport.ts') return;
  addMatches(violations, file, source, /\bfetch\s*\(/g, 'frontend requests must use the centralized API client.');
}
