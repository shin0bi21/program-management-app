import { access, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_REPOSITORY_SLUG } from './generate-content.ts';
import type { ContentManifest } from './generate-content.ts';
import type { RemarkPlugin } from '@astrojs/markdown-remark';
import type { Definition, Image, Link, Nodes } from 'mdast';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

interface MarkdownLinksOptions {
  manifest: ContentManifest;
  repoRoot?: string;
  gitRef?: string;
  repositorySlug?: string;
}

export const convertMarkdownLinks: RemarkPlugin<[MarkdownLinksOptions]> = function ({ manifest, repoRoot = repositoryRoot, gitRef = 'main', repositorySlug = DEFAULT_REPOSITORY_SLUG }) {
  const root = path.resolve(repoRoot);

  return async (tree, file) => {
    const generatedPath = path.resolve(String(file.path));
    const sourcePath = manifest.sources[generatedPath];
    if (!sourcePath) throw new Error(`No repository source is registered for generated document ${file.path}`);

    const resolvedRoot = await realpath(root);
    const nodes: (Link | Image | Definition)[] = [];
    visit(tree, node => {
      if ((node.type === 'link' || node.type === 'image' || node.type === 'definition') && typeof node.url === 'string') nodes.push(node);
    });
    for (const node of nodes) node.url = await rewriteUrl(node.url, sourcePath, manifest.routes, root, resolvedRoot, repositorySlug, gitRef);
  };
}

export default convertMarkdownLinks;

async function rewriteUrl(url: string, sourcePath: string, routes: ContentManifest['routes'], root: string, resolvedRoot: string, repository: string, gitRef: string) {
  if (!url || isExternalUrl(url) || url.startsWith('#') || url.startsWith('/')) return url;

  const parsed = splitSuffix(url);
  let relativePath;
  try {
    relativePath = decodeURIComponent(parsed.path);
  } catch {
    throw new Error(`Malformed repository link in ${sourcePath}: ${url}`);
  }
  if (!relativePath) return url;

  const baseDirectory = path.posix.dirname(sourcePath);
  let target = path.posix.normalize(path.posix.join(baseDirectory, relativePath));
  if (target === '..' || target.startsWith('../') || path.posix.isAbsolute(target)) {
    throw new Error(`Repository link escapes the workspace in ${sourcePath}: ${url}`);
  }

  const line = target.match(/^(.*):(\d+)$/);
  const lineFragment = line ? `#L${line[2]}` : '';
  if (line) target = line[1];

  const targetAbsolute = path.resolve(root, target);
  assertInside(root, targetAbsolute, `Repository link escapes the workspace in ${sourcePath}: ${url}`);
  const resolvedTarget = await realpath(targetAbsolute);
  assertInside(resolvedRoot, resolvedTarget, `Repository link escapes the workspace in ${sourcePath}: ${url}`);
  const sourceDocumentPath = resolveDocumentSource(target, routes);
  if (sourceDocumentPath) return `${routes[sourceDocumentPath]}${parsed.suffix}${lineFragment}`;

  return `${await githubPath(repository, gitRef, target, resolvedTarget)}${parsed.suffix}${lineFragment}`;
}

function resolveDocumentSource(target: string, routes: ContentManifest['routes']) {
  const source = target.endsWith('/') ? path.posix.join(target, 'README.md') : target;
  if (Object.hasOwn(routes, source)) return source;

  const candidate = target.endsWith('/') ? path.posix.join(target, 'README.md') : `${target}/README.md`;
  if (Object.hasOwn(routes, candidate)) return candidate;
  return null;
}

async function githubPath(repository: string, gitRef: string, target: string, absolutePath: string) {
  await access(absolutePath);
  const metadata = await stat(absolutePath);
  const kind = metadata.isDirectory() ? 'tree' : 'blob';
  return `https://github.com/${repository}/${kind}/${encodeURIComponent(gitRef)}/${encodePath(target)}`;
}

function visit(node: Nodes, callback: (node: Nodes) => void) {
  if (!node || typeof node !== 'object') return;
  callback(node);
  if ('children' in node) node.children.forEach(child => visit(child, callback));
}

function splitSuffix(url: string) {
  const index = url.search(/[?#]/);
  return index < 0 ? { path: url, suffix: '' } : { path: url.slice(0, index), suffix: url.slice(index) };
}

function isExternalUrl(url: string) {
  return /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(url);
}

function encodePath(value: string) {
  return value.split('/').map(encodeURIComponent).join('/');
}

function assertInside(parent: string, child: string, message: string) {
  const relative = path.relative(parent, child);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(message);
}

