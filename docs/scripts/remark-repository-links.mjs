import { access, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_REPOSITORY_SLUG } from './prepare-content.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function remarkRepositoryLinks({ manifest, repoRoot = repositoryRoot, gitRef = 'main', repositorySlug = DEFAULT_REPOSITORY_SLUG }) {
  const root = path.resolve(repoRoot);
  const sourceByOutputPath = new Map(Object.entries(manifest.sources).map(([outputPath, sourcePath]) => [path.resolve(outputPath), sourcePath]));
  const routes = manifest.routes;

  return async (tree, file) => {
    const generatedPath = path.resolve(String(file.path));
    const sourcePath = sourceByOutputPath.get(generatedPath);
    if (!sourcePath) throw new Error(`No repository source is registered for generated document ${file.path}`);

    const resolvedRoot = await realpath(root);
    const nodes = [];
    visit(tree, node => {
      if ((node.type === 'link' || node.type === 'image' || node.type === 'definition') && typeof node.url === 'string') nodes.push(node);
    });
    for (const node of nodes) node.url = await rewriteUrl(node.url, sourcePath, routes, root, resolvedRoot, repositorySlug, gitRef);
  };
}

export default remarkRepositoryLinks;

async function rewriteUrl(url, sourcePath, routes, root, resolvedRoot, repository, gitRef) {
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

function resolveDocumentSource(target, routes) {
  const source = target.endsWith('/') ? path.posix.join(target, 'README.md') : target;
  if (Object.hasOwn(routes, source)) return source;

  const candidate = target.endsWith('/') ? path.posix.join(target, 'README.md') : `${target}/README.md`;
  if (Object.hasOwn(routes, candidate)) return candidate;
  return null;
}

async function githubPath(repository, gitRef, target, absolutePath) {
  await access(absolutePath);
  const metadata = await stat(absolutePath);
  const kind = metadata.isDirectory() ? 'tree' : 'blob';
  return `https://github.com/${repository}/${kind}/${encodeURIComponent(gitRef)}/${encodePath(target)}`;
}

function visit(node, callback) {
  if (!node || typeof node !== 'object') return;
  callback(node);
  if (Array.isArray(node.children)) node.children.forEach(child => visit(child, callback));
}

function splitSuffix(url) {
  const index = url.search(/[?#]/);
  return index < 0 ? { path: url, suffix: '' } : { path: url.slice(0, index), suffix: url.slice(index) };
}

function isExternalUrl(url) {
  return /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(url);
}

function encodePath(value) {
  return value.split('/').map(encodeURIComponent).join('/');
}

function assertInside(parent, child, message) {
  const relative = path.relative(parent, child);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(message);
}

