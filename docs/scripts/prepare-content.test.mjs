import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { prepareContent } from './prepare-content.mjs';

async function createRepository() {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'docs-content-'));
  const outputDir = path.join(repoRoot, 'docs/src/content/docs');
  await mkdir(path.join(repoRoot, 'docs/backend'), { recursive: true });
  await mkdir(path.join(repoRoot, 'docs/frontend/components'), { recursive: true });
  await mkdir(path.join(repoRoot, 'docs/workflows'), { recursive: true });
  await writeFile(path.join(repoRoot, 'README.md'), '# Product\n\nRoot landing page.\n');
  await writeFile(path.join(repoRoot, 'docs/README.md'), '# Docs index\n\nDocumentation home.\n');
  await writeFile(path.join(repoRoot, 'docs/backend/README.md'), '# Backend\n\nBackend guide.\n');
  await writeFile(path.join(repoRoot, 'docs/backend/http.mmd'), '%% HTTP lifecycle\nsequenceDiagram\n  A->>B: Request\n');
  await writeFile(path.join(repoRoot, 'docs/frontend/README.md'), '# Frontend\n\nFrontend guide.\n');
  await writeFile(path.join(repoRoot, 'docs/frontend/components/README.md'), '# Components\n\nComponent guide.\n');
  await writeFile(path.join(repoRoot, 'docs/frontend/components/buttons.md'), '# Buttons\n\nButton guide.\n');
  await writeFile(path.join(repoRoot, 'docs/workflows/testing.md'), '# Testing\n\nWorkflow guide.\n');
  return { repoRoot, outputDir, cleanup: () => rm(repoRoot, { recursive: true, force: true }) };
}

test('builds the configured corpus, route manifest, frontmatter, and Mermaid source', async t => {
  const fixture = await createRepository();
  t.after(fixture.cleanup);

  const manifest = await prepareContent({ ...fixture, gitRef: 'release-2', repositorySlug: 'acme/product' });

  assert.deepEqual(manifest.routes, {
    'README.md': '/',
    'docs/README.md': '/website/',
    'docs/backend/README.md': '/backend/',
    'docs/backend/http.mmd': '/backend/http/',
    'docs/frontend/README.md': '/frontend/',
    'docs/frontend/components/README.md': '/frontend/components/',
    'docs/frontend/components/buttons.md': '/frontend/components/buttons/',
    'docs/workflows/testing.md': '/workflows/testing/',
  });
  const rootOutput = await readFile(path.join(fixture.outputDir, 'index.md'), 'utf8');
  assert.match(rootOutput, /^---\ntitle: "Product"\neditUrl: "https:\/\/github.com\/acme\/product\/edit\/release-2\/README.md"\n---\n\nRoot landing page/);
  assert.doesNotMatch(rootOutput, /^# Product/m);
  assert.match(await readFile(path.join(fixture.outputDir, 'backend/http.md'), 'utf8'), /```mermaid\n%% HTTP lifecycle\nsequenceDiagram/);
  assert.equal(manifest.sources[path.join(fixture.outputDir, 'backend/index.md')], 'docs/backend/README.md');
});

test('fails when a Markdown document has no first-level title', async t => {
  const fixture = await createRepository();
  t.after(fixture.cleanup);
  await writeFile(path.join(fixture.repoRoot, 'docs/workflows/testing.md'), 'No title here.\n');

  await assert.rejects(prepareContent(fixture), /Missing first-level title in docs\/workflows\/testing.md/);
});

test('fails on generated path collisions before writing output', async t => {
  const fixture = await createRepository();
  t.after(fixture.cleanup);
  await mkdir(path.join(fixture.repoRoot, 'docs/backend/http'), { recursive: true });
  await writeFile(path.join(fixture.repoRoot, 'docs/backend/http/README.md'), '# Nested HTTP\n');
  await writeFile(path.join(fixture.repoRoot, 'docs/backend/http.md'), '# HTTP Markdown\n');

  await assert.rejects(prepareContent(fixture), /Generated content collision/);
});
