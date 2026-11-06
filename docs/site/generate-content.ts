/**
 * Builds Starlight pages from canonical guides, updating the generated content directory.
 * Flow:
 * 1. Discover sources and prepare pages, rejecting missing titles and path collisions.
 * 2. Publish the source manifest before writing changed pages for live loaders.
 * 3. Remove obsolete generated pages and return the manifest.
 */
import { readdir, readFile, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const documentationDirectories = ['docs/backend', 'docs/frontend', 'docs/local-development', 'docs/production', 'docs/workflows'];
export const DEFAULT_REPOSITORY_SLUG = 'shin0bi21/be-original';

interface GenerateContentOptions {
  /** Repository containing README.md and the five published documentation areas. */
  repoRoot?: string;
  /** Generated-content directory; defaults to docs/src/content/docs under repoRoot. */
  outputDir?: string;
  /** GitHub branch, tag, or commit used by page edit links. */
  gitRef?: string;
  /** GitHub owner/repository used by page edit links. */
  repositorySlug?: string;
  /** Synchronous notification before filesystem writes; throwing aborts generation. */
  onPrepared?: (manifest: ContentManifest) => void;
}

export interface ContentManifest {
  /** Repository-relative source paths mapped to root-relative website routes. */
  routes: Record<string, string>;
  /** Absolute generated page paths mapped to repository-relative source paths. */
  sources: Record<string, string>;
}

/**
 * Converts canonical guides into Starlight content, preserving source directories.
 * Rejects path collisions before writing; onPrepared lets live loaders resolve sources before pages change.
 * @returns The source/route manifest after changed pages are written and obsolete pages removed; filesystem errors reject the promise.
 * @example await generateContent({ outputDir: "/tmp/docs-preview", gitRef: "develop" });
 */
export async function generateContent({ repoRoot = repositoryRoot, outputDir, gitRef = 'main', repositorySlug = DEFAULT_REPOSITORY_SLUG, onPrepared }: GenerateContentOptions = {}) {
  const root = path.resolve(repoRoot);
  const output = path.resolve(outputDir ?? path.join(root, 'docs/src/content/docs'));
  const sources = await collectSources(root);
  const routes: Record<string, string> = {};
  const generated = [];
  const destinations = new Map();

  for (const sourcePath of sources) {
    const sourceAbsolute = path.resolve(root, sourcePath);
    const content = await readFile(sourceAbsolute, 'utf8');
    const isMermaid = sourcePath.endsWith('.mmd');
    const title = isMermaid
      ? titleFromMermaidPath(sourcePath, content)
      : titleFromMarkdown(sourcePath, content);
    const generatedRelative = generatedPath(sourcePath);
    const destination = path.resolve(output, generatedRelative);

    assertInside(output, destination, `Generated path escapes content directory: ${generatedRelative}`);
    const duplicate = destinations.get(destination);
    if (duplicate) throw new Error(`Generated content collision: ${duplicate} and ${sourcePath} both map to ${generatedRelative}`);
    destinations.set(destination, sourcePath);

    const body = isMermaid ? `\`\`\`mermaid\n${content.trimEnd()}\n\`\`\`` : stripFirstH1(content);
    const editUrl = `https://github.com/${repositorySlug}/edit/${encodeURIComponent(gitRef)}/${sourcePath}`;
    const sidebarOrder = /(?:^|\/)README\.md$/i.test(sourcePath) ? 'sidebar:\n  order: -1\n' : '';
    const document = `---\ntitle: ${yamlString(title)}\neditUrl: ${yamlString(editUrl)}\n${sidebarOrder}---\n\n${body.trimStart()}\n`;
    const route = routeForSource(sourcePath);
    generated.push({ destination, document, sourcePath, route });
    routes[sourcePath] = route;
  }

  const manifest: ContentManifest = {
    routes,
    sources: Object.fromEntries(generated.map(file => [file.destination, file.sourcePath])),
  };
  onPrepared?.(manifest);

  await mkdir(output, { recursive: true });
  const existing: string[] = [];
  await collectMarkdownFiles(output, '', existing);

  // Keep watched directories and unchanged entries intact during live reloads.
  for (const file of generated) {
    const previous = await readFile(file.destination, 'utf8').catch(error => {
      if (error.code === 'ENOENT') return undefined;
      throw error;
    });
    if (previous === file.document) continue;

    await mkdir(path.dirname(file.destination), { recursive: true });
    await writeFile(file.destination, file.document, 'utf8');
  }
  for (const relative of existing) {
    const destination = path.resolve(output, relative);
    if (!destinations.has(destination)) await rm(destination);
  }

  return manifest;
}

/**
 * Lists the repository overview and published documentation, sorted by source path.
 * @param root - Repository directory containing all published documentation areas.
 * @example await collectSources(repoRoot) includes "README.md" and "docs/frontend/README.md".
 */
async function collectSources(root: string) {
  const candidates = ['README.md'];

  for (const directory of documentationDirectories) {
    await collectMarkdownFiles(root, directory, candidates);
  }
  return candidates.sort();
}

/**
 * Appends Markdown and Mermaid file paths recursively without following symlink directories.
 * @param directory - Directory relative to root; an empty string scans root itself.
 * @param candidates - Accumulator receiving root-relative paths; existing entries remain.
 * @example await collectMarkdownFiles(root, "docs/frontend", files) appends "docs/frontend/README.md".
 */
async function collectMarkdownFiles(root: string, directory: string, candidates: string[]) {
  const absolute = path.join(root, directory);
  const entries = await readdir(absolute, { withFileTypes: true });

  for (const entry of entries) {
    const relative = path.posix.join(directory, entry.name);
    if (entry.isDirectory()) await collectMarkdownFiles(root, relative, candidates);
    else if (entry.isFile() && /\.(?:md|mmd)$/i.test(entry.name)) candidates.push(relative);
  }
}

/**
 * Maps a published source to its generated Markdown path, treating READMEs as indexes.
 * @param sourcePath - Repository-relative published path: README.md or a file under docs/.
 * @example generatedPath("docs/frontend/README.md") returns "frontend/index.md".
 */
function generatedPath(sourcePath: string) {
  if (sourcePath === 'README.md') return 'index.md';
  if (sourcePath.startsWith('docs/') && /\/README\.md$/i.test(sourcePath)) {
    return `${sourcePath.slice(5, -'README.md'.length)}index.md`;
  }
  const relative = sourcePath.slice('docs/'.length);
  return relative.replace(/\.(?:mmd|md)$/i, '.md');
}

/**
 * Maps a published source to its website route while preserving directory nesting.
 * @param sourcePath - Repository-relative published path: README.md or a file under docs/.
 * @example routeForSource("docs/frontend/architecture/ownership.md") returns "/frontend/architecture/ownership/".
 */
function routeForSource(sourcePath: string) {
  if (sourcePath === 'README.md') return '/';
  const relative = sourcePath.slice('docs/'.length).replace(/\.mmd$/i, '.md').replace(/\.md$/i, '');
  if (/\/README$/i.test(relative)) {
    return `/${relative.slice(0, -'README'.length)}`;
  }
  return `/${relative}/`;
}

/**
 * Reads the first Markdown H1 outside backtick fences; throws when the title is missing.
 * @param sourcePath - Repository-relative filename included in missing-title errors.
 * @example titleFromMarkdown("guide.md", "# App Navigation") returns "App Navigation".
 */
function titleFromMarkdown(sourcePath: string, markdown: string) {
  const headingLine = firstH1Line(markdown);
  if (headingLine === -1) throw new Error(`Missing first-level title in ${sourcePath}`);
  const title = markdown.split(/\r?\n/)[headingLine].match(/^#\s+(.+?)\s*#*\s*$/)?.[1];
  if (!title) throw new Error(`Missing first-level title in ${sourcePath}`);

  return title.trim();
}

/**
 * Uses the first Mermaid title comment, falling back to a title-cased filename.
 * @example titleFromMermaidPath("http-flow.mmd", "graph LR") returns "Http Flow".
 */
function titleFromMermaidPath(sourcePath: string, content: string) {
  const titleComment = content.match(/^%%\s+(.+?)(?::\s*.*)?$/m)?.[1];
  if (titleComment) return titleComment.trim();

  const filename = path.posix.basename(sourcePath, '.mmd');
  const words = filename.replace(/[-_]+/g, ' ');
  return words.replace(/\b\w/g, letter => letter.toUpperCase());
}

/**
 * Keeps the content after the first H1, skipping one following blank line.
 * Returns the original Markdown when no H1 exists; any preamble before a heading is omitted.
 * @example stripFirstH1("# Guide\n\nBody") returns "Body".
 */
function stripFirstH1(markdown: string) {
  const lines = markdown.split(/\r?\n/);
  const headingLine = firstH1Line(markdown);
  if (headingLine === -1) return markdown;

  let firstBodyLine = headingLine + 1;
  if (!lines[firstBodyLine]?.trim()) firstBodyLine += 1;
  return lines.slice(firstBodyLine).join('\n');
}

/**
 * Finds the zero-based line of the first H1 outside backtick fences, or -1 when absent.
 * @example firstH1Line("Intro\n# Guide") returns 1.
 */
function firstH1Line(markdown: string) {
  const lines = markdown.split(/\r?\n/);
  let insideFence = false;
  for (let index = 0; index < lines.length; index += 1) {
    if (/^\s*```/.test(lines[index])) {
      insideFence = !insideFence;
      continue;
    }
    if (!insideFence && /^#\s+/.test(lines[index])) return index;
  }
  return -1;
}

/**
 * Quotes a frontmatter string using JSON escaping, which is valid YAML syntax.
 * @example yamlString("Guide") // '"Guide"'
 */
function yamlString(value: string) {
  return JSON.stringify(value);
}

/**
 * Rejects paths outside a parent directory before generated content is written.
 * @param parent - Absolute output directory containing the absolute child path.
 * @param message - Error text identifying the rejected generated path.
 * @example assertInside("/tmp/docs", "/tmp/other", "Outside output") throws.
 */
function assertInside(parent: string, child: string, message: string) {
  const relative = path.relative(parent, child);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(message);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await generateContent();
}
