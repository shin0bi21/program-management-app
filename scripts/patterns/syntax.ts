import { Project, type SourceFile } from 'ts-morph';

const project = new Project({
  skipAddingFilesFromTsConfig: true,
  useInMemoryFileSystem: true,
});

/**
 * Parses a source snapshot in memory, replacing a previous snapshot with the same path.
 * @param file - Source identity used for diagnostics; no disk file is read or written.
 * @param source - Complete TypeScript or TSX contents to inspect.
 * @example parseSourceFile('example.ts', 'const count = 1;').getStatements().length // 1
 */
export function parseSourceFile(file: string, source: string): SourceFile {
  return project.createSourceFile(file, source, { overwrite: true });
}
