import { reviewFrontendPatterns } from './frontend.js';

export function runPatternReview(
  findings,
  file,
  source,
  { repositoryFiles = [], routePageDirectories = [] } = {},
) {
  if (!file.startsWith('frontend/src/')) return;
  reviewFrontendPatterns(findings, file, source, {
    repositoryFiles,
    routePageDirectories,
  });
}
