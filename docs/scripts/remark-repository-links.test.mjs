import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { remarkRepositoryLinks } from './remark-repository-links.mjs';

async function createFixture() {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'remark-links-'));
  const outputPath = path.join(repoRoot, 'docs/src/content/docs/backend/index.md');
  await mkdir(path.dirname(outputPath), { recursive: true });
  await mkdir(path.join(repoRoot, 'docs/backend'), { recursive: true });
  await mkdir(path.join(repoRoot, 'docs/frontend'), { recursive: true });
  await mkdir(path.join(repoRoot, 'src'), { recursive: true });
  await writeFile(path.join(repoRoot, 'docs/backend/README.md'), '# Backend\n');
  await writeFile(path.join(repoRoot, 'docs/frontend/README.md'), '# Frontend\n');
  await writeFile(path.join(repoRoot, 'docs/frontend/api.md'), '# API\n');
  await writeFile(path.join(repoRoot, 'AGENTS.md'), '# Agents\n');
  await writeFile(path.join(repoRoot, 'src/app.ts'), 'export {};\n');
  await mkdir(path.join(repoRoot, 'src/lib'), { recursive: true });
  const manifest = {
    routes: {
      'docs/backend/README.md': '/backend/',
      'docs/frontend/README.md': '/frontend/',
      'docs/frontend/api.md': '/frontend/api',
    },
    sources: { [outputPath]: 'docs/backend/README.md' },
  };
  return { repoRoot, outputPath, manifest, cleanup: () => rm(repoRoot, { recursive: true, force: true }) };
}

async function transform(fixture, children) {
  const plugin = remarkRepositoryLinks({ manifest: fixture.manifest, repoRoot: fixture.repoRoot, gitRef: 'main', repositorySlug: 'acme/product' });
  await plugin({ type: 'root', children }, { path: fixture.outputPath });
  return children;
}

test('rewrites Markdown, image, definition, anchor, external, directory, and repository source links', async t => {
  const fixture = await createFixture();
  t.after(fixture.cleanup);
  const children = [
    { type: 'link', url: '../frontend/api.md#Headers?mode=full', children: [] },
    { type: 'link', url: '../frontend/', children: [] },
    { type: 'image', url: '../../src/app.ts:12', children: [] },
    { type: 'definition', identifier: 'agent', url: '../../AGENTS.md', title: null },
    { type: 'link', url: 'https://example.com/guide.md#top', children: [] },
    { type: 'link', url: '#local-heading', children: [] },
    { type: 'link', url: '/frontend/api/', children: [] },
    { type: 'code', value: '[unchanged](../frontend/api.md)' },
  ];

  await transform(fixture, children);

  assert.equal(children[0].url, '/frontend/api#Headers?mode=full');
  assert.equal(children[1].url, '/frontend/');
  assert.equal(children[2].url, 'https://github.com/acme/product/blob/main/src/app.ts#L12');
  assert.equal(children[3].url, 'https://github.com/acme/product/blob/main/AGENTS.md');
  assert.equal(children[4].url, 'https://example.com/guide.md#top');
  assert.equal(children[5].url, '#local-heading');
  assert.equal(children[6].url, '/frontend/api/');
  assert.equal(children[7].value, '[unchanged](../frontend/api.md)');
});

test('fails missing repository links and workspace traversal', async t => {
  const fixture = await createFixture();
  t.after(fixture.cleanup);

  await assert.rejects(transform(fixture, [{ type: 'link', url: '../../does-not-exist.md', children: [] }]), /ENOENT/);
  await assert.rejects(transform(fixture, [{ type: 'link', url: '../../../outside.txt', children: [] }]), /escapes the workspace/);
});
