import { reviewFrontendPatterns } from './frontend.ts';

export function runPatternReview(
  findings: string[],
  file: string,
  source: string,
  {
    repositoryFiles = [],
    repositorySources = new Map<string, string>(),
    routePageDirectories = [],
  }: {
    repositoryFiles?: string[];
    repositorySources?: Map<string, string>;
    routePageDirectories?: string[];
  } = {},
): void {
  if (!file.startsWith('frontend/src/')) return;
  reviewFrontendPatterns(findings, file, source, {
    repositoryFiles,
    repositorySources,
    routePageDirectories,
  });
}
