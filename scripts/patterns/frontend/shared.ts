export function findRoutePageDirectory(file: string, routePageDirectories: string[]): string | undefined {
  if (/^frontend\/src\/pages\/[^/]+\/common(?:\/|$)/.test(file)) return undefined;
  return routePageDirectories.find(
    routeDirectory => file === routeDirectory || file.startsWith(`${routeDirectory}/`),
  );
}

// Route pages are directories whose entry file matches the directory name.
// Longest paths come first so Homepage/ManageHomepage wins over Homepage.
export function collectRoutePageDirectories(repositoryFiles: string[]): string[] {
  const routePagePattern = /^(frontend\/src\/pages\/(?:[^/]+\/)?([^/]+))\/\2\.tsx$/;
  return repositoryFiles
    .flatMap((file) => file.match(routePagePattern)?.[1] ?? [])
    .sort((left, right) => right.length - left.length);
}
