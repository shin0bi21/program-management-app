import { addMatches, lineNumber } from './utils.js';

export function checkBackendRoutes(violations, file, source) {
  if (!/^backend\/src\/routes\/.*\.ts$/.test(file)) return;
  const routePattern = /router\.(?:get|post|put|patch|delete)\s*\(([\s\S]*?)\);/g;
  for (const match of source.matchAll(routePattern)) {
    if (!match[1].includes('asyncHandler(')) violations.push(`${file}:${lineNumber(source, match.index)} Express route handlers must be wrapped with asyncHandler.`);
  }
}

export function checkBackendControllers(violations, file, source) {
  if (!/^backend\/src\/controllers\/.*\.ts$/.test(file)) return;
  addMatches(violations, file, source, /\.parse(?:Async)?\s*\(\s*req\.query\s*\)/g, 'controllers must consume route-validated query values without parsing them again.');
}
