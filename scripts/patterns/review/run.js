import { reviewFrontendPatterns } from './frontend.js';

export function runPatternReview(
  findings,
  file,
  source,
  { repositoryFiles = [], repositorySources = new Map(), routePageDirectories = [] } = {},
) {
  if (!file.startsWith('frontend/src/')) return;
  reviewFrontendPatterns(findings, file, source, {
    repositoryFiles,
    repositorySources,
    routePageDirectories,
  });
}
