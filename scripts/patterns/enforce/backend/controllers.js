import { addMatches } from '../utils.js';

export function checkBackendControllers(violations, file, source) {
  if (!/^backend\/src\/controllers\/.*\.ts$/.test(file)) return;
  addMatches(violations, file, source, /\.parse(?:Async)?\s*\(\s*req\.query\s*\)/g, 'controllers must consume route-validated query values without parsing them again.');
}
