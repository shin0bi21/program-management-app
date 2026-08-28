import { addMatches } from '../utils.ts';
import type { Findings } from '../utils.ts';

export function checkBackendControllers(violations: Findings, file: string, source: string): void {
  if (!/^backend\/src\/controllers\/.*\.ts$/.test(file)) return;
  addMatches(violations, file, source, /\.parse(?:Async)?\s*\(\s*req\.query\s*\)/g, 'controllers must consume route-validated query values without parsing them again.');
}
