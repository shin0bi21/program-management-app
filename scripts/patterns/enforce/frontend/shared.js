import { dirname } from 'node:path';

export function findRoutePageDirectory(file, routePageDirectories) {
  if (/^frontend\/src\/pages\/[^/]+\/common(?:\/|$)/.test(file)) return undefined;
  return routePageDirectories.find(
    routeDirectory => file === routeDirectory || file.startsWith(`${routeDirectory}/`),
  );
}

export function siblingExists(repositoryFiles, file, suffixes) {
  const directory = dirname(file);
  const fileName = file.slice(directory.length + 1).replace(/\.[^.]+$/, '');
  return suffixes.some(suffix => repositoryFiles.includes(`${directory}/${fileName}${suffix}`));
}

// Route pages are directories whose entry file matches the directory name.
// Longest paths come first so Homepage/ManageHomepage wins over Homepage.
export function collectRoutePageDirectories(repositoryFiles) {
  const routePagePattern = /^(frontend\/src\/pages\/(?:[^/]+\/)?([^/]+))\/\2\.tsx$/;
  return repositoryFiles
    .flatMap((file) => file.match(routePagePattern)?.[1] ?? [])
    .sort((left, right) => right.length - left.length);
}

// Structural rules need the current owner even when a required sibling was
// deleted. API siblings are also selected because their placement depends on
// how many adapters remain inside the same owner.
export function collectStructureCheckFiles(
  changedFiles,
  repositoryFiles,
  routePageDirectories,
) {
  const currentFiles = new Set(repositoryFiles);
  const selected = new Set(changedFiles.filter(file => currentFiles.has(file)));

  for (const changedFile of changedFiles) {
    const routeDirectory = findRoutePageDirectory(changedFile, routePageDirectories);
    if (routeDirectory) {
      const pageName = routeDirectory.split('/').at(-1);
      selected.add(`${routeDirectory}/${pageName}.tsx`);
    }

    const deletedTest = changedFile.match(/^(.*)\.(?:test|spec)\.[cm]?[jt]sx?$/)?.[1];
    if (deletedTest) {
      for (const extension of ['.ts', '.tsx']) {
        const owner = `${deletedTest}${extension}`;
        if (currentFiles.has(owner)) selected.add(owner);
      }
    }

    if (!/\.api(?:\.test)?\.ts$/.test(changedFile)) continue;

    if (routeDirectory) {
      for (const candidate of repositoryFiles) {
        if (candidate.startsWith(`${routeDirectory}/`) && /\.api(?:\.test)?\.ts$/.test(candidate)) {
          selected.add(candidate);
        }
      }
    }

    const sharedOwner = changedFile.match(
      /^(frontend\/src\/(?:common\/features\/[^/]+|pages\/[^/]+\/common))(?:\/|$)/,
    )?.[1];
    if (!sharedOwner) continue;
    for (const candidate of repositoryFiles) {
      if (candidate.startsWith(`${sharedOwner}/`) && /\.api(?:\.test)?\.ts$/.test(candidate)) {
        selected.add(candidate);
      }
    }
  }

  return [...selected];
}
