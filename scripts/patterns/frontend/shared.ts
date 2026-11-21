/**
 * Finds the narrowest matching page owner; route-family common files have no private page owner.
 * @example findRoutePageDirectory('frontend/src/pages/Tasks/a.ts', ['frontend/src/pages/Tasks']) // 'frontend/src/pages/Tasks'
 */
export function findRoutePageDirectory(file: string, routePageDirectories: string[]): string | undefined {
  if (/^frontend\/src\/pages\/[^/]+\/common(?:\/|$)/.test(file)) return undefined;
  return routePageDirectories.find(
    routeDirectory => file === routeDirectory || file.startsWith(`${routeDirectory}/`),
  );
}

/**
 * Lists page directories whose entry file matches their name, longest paths first.
 * @param repositoryFiles - Repository-relative paths; nested pages must win over parent pages.
 * @example collectRoutePageDirectories(['frontend/src/pages/Tasks/Tasks.tsx']) // ['frontend/src/pages/Tasks']
 */
export function collectRoutePageDirectories(repositoryFiles: string[]): string[] {
  const routePagePattern = /^(frontend\/src\/pages\/(?:[^/]+\/)?([^/]+))\/\2\.tsx$/;
  return repositoryFiles
    .flatMap((file) => file.match(routePagePattern)?.[1] ?? [])
    .sort((left, right) => right.length - left.length);
}
