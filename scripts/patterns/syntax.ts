import { Project } from 'ts-morph';

const project = new Project({
  skipAddingFilesFromTsConfig: true,
  useInMemoryFileSystem: true,
});

export function parseSourceFile(file: string, source: string) {
  return project.createSourceFile(file, source, { overwrite: true });
}
