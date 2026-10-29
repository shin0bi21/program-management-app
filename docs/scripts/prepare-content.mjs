import { readdir, readFile, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const documentationDirectories = ['docs/backend', 'docs/frontend', 'docs/workflows'];
export const DEFAULT_REPOSITORY_SLUG = 'shin0bi21/be-original';

export async function prepareContent({ repoRoot = repositoryRoot, outputDir, gitRef = 'main', repositorySlug = DEFAULT_REPOSITORY_SLUG } = {}) {
  const root = path.resolve(repoRoot);
  const output = path.resolve(outputDir ?? path.join(root, 'docs/src/content/docs'));
  const sources = await collectSources(root);
  const routes = {};
  const generated = [];
  const destinations = new Map();

  for (const sourcePath of sources) {
    const sourceAbsolute = path.resolve(root, sourcePath);
    const content = await readFile(sourceAbsolute, 'utf8');
    const title = sourcePath.endsWith('.mmd') ? titleFromMermaidPath(sourcePath, content) : titleFromMarkdown(sourcePath, content);
    const generatedRelative = generatedPath(sourcePath);
    const destination = path.resolve(output, generatedRelative);

    assertInside(output, destination, `Generated path escapes content directory: ${generatedRelative}`);
    const duplicate = destinations.get(destination);
    if (duplicate) throw new Error(`Generated content collision: ${duplicate} and ${sourcePath} both map to ${generatedRelative}`);
    destinations.set(destination, sourcePath);

    const body = sourcePath.endsWith('.mmd') ? `\`\`\`mermaid\n${content.trimEnd()}\n\`\`\`` : stripFirstH1(content);
    const editUrl = `https://github.com/${repositorySlug}/edit/${encodeURIComponent(gitRef)}/${sourcePath}`;
    const document = `---\ntitle: ${yamlString(capitalizeTitle(title))}\neditUrl: ${yamlString(editUrl)}\n---\n\n${body.trimStart()}\n`;
    generated.push({ destination, document, sourcePath, route: routeForSource(sourcePath) });
    routes[sourcePath] = routeForSource(sourcePath);
  }

  await mkdir(output, { recursive: true });
  for (const entry of await readdir(output)) {
    await rm(path.join(output, entry), { recursive: true, force: true });
  }
  for (const file of generated) {
    await mkdir(path.dirname(file.destination), { recursive: true });
    await writeFile(file.destination, file.document, 'utf8');
  }

  return {
    routes,
    sidebar: documentationDirectories.map(directory => sidebarGroup(directory, sources, routes)),
    sources: Object.fromEntries(generated.map(file => [file.destination, file.sourcePath])),
  };
}

function capitalizeTitle(title) {
  return title.replace(/(^|[\s-])([a-z])/g, (_match, separator, letter) => separator + letter.toUpperCase());
}

function sidebarGroup(directory, sources, routes) {
  const prefix = `${directory}/`;
  const children = sources.filter(source => source.startsWith(prefix));
  const directPages = children.filter(source => !source.slice(prefix.length).includes('/'));
  const subdirectories = [...new Set(children
    .filter(source => source.slice(prefix.length).includes('/'))
    .map(source => source.slice(prefix.length).split('/')[0]))];
  const items = directPages.map(source => ({
    slug: routes[source].slice(1, -1),
    ...(source.endsWith('/README.md') ? { label: 'Overview' } : {}),
  }));

  items.push(...subdirectories.map(child => sidebarGroup(`${directory}/${child}`, sources, routes)));
  return { label: capitalizeTitle(path.posix.basename(directory).replace(/[-_]+/g, ' ')), items };
}

async function collectSources(root) {
  const candidates = ['README.md', 'docs/README.md'];

  for (const directory of documentationDirectories) {
    await collectMarkdownFiles(root, directory, candidates);
  }
  return candidates.sort();
}

async function collectMarkdownFiles(root, directory, candidates) {
  const absolute = path.join(root, directory);
  const entries = await readdir(absolute, { withFileTypes: true });

  for (const entry of entries) {
    const relative = path.posix.join(directory, entry.name);
    if (entry.isDirectory()) await collectMarkdownFiles(root, relative, candidates);
    else if (entry.isFile() && /\.(?:md|mmd)$/i.test(entry.name)) candidates.push(relative);
  }
}

function generatedPath(sourcePath) {
  if (sourcePath === 'README.md') return 'index.md';
  if (sourcePath === 'docs/README.md') return 'website.md';
  if (/^docs\/(?:backend|frontend|workflows)\/(?:.+\/)?README\.md$/i.test(sourcePath)) {
    return `${sourcePath.slice(5, -'README.md'.length)}index.md`;
  }
  const relative = sourcePath.slice('docs/'.length);
  return relative.replace(/\.(?:mmd|md)$/i, '.md');
}

function routeForSource(sourcePath) {
  if (sourcePath === 'README.md') return '/';
  if (sourcePath === 'docs/README.md') return '/website/';
  const relative = sourcePath.slice('docs/'.length).replace(/\.mmd$/i, '.md').replace(/\.md$/i, '');
  if (/^(?:backend|frontend|workflows)\/(?:.+\/)?README$/i.test(relative)) {
    return `/${relative.slice(0, -'README'.length)}`;
  }
  return `/${relative}/`;
}

function titleFromMarkdown(sourcePath, markdown) {
  const headingLine = firstH1Line(markdown);
  if (headingLine === -1) throw new Error(`Missing first-level title in ${sourcePath}`);
  return markdown.split(/\r?\n/)[headingLine].match(/^#\s+(.+?)\s*#*\s*$/)[1].trim();
}

function titleFromMermaidPath(sourcePath, content) {
  const titleComment = content.match(/^%%\s+(.+?)(?::\s*.*)?$/m)?.[1];
  if (titleComment) return titleComment.trim();
  return path.posix.basename(sourcePath, '.mmd').replace(/[-_]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

function stripFirstH1(markdown) {
  const lines = markdown.split(/\r?\n/);
  const headingLine = firstH1Line(markdown);
  if (headingLine === -1) return markdown;

  let firstBodyLine = headingLine + 1;
  if (!lines[firstBodyLine]?.trim()) firstBodyLine += 1;
  return lines.slice(firstBodyLine).join('\n');
}

function firstH1Line(markdown) {
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

function yamlString(value) {
  return JSON.stringify(value);
}

function assertInside(parent, child, message) {
  const relative = path.relative(parent, child);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(message);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await prepareContent();
}
