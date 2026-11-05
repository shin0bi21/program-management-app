import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { collectRows, countLines } from './loc-report.ts';

test('counts nonblank lines and optionally excludes comment-start lines', () => {
  const text = '\n  // heading\nconst value = 1; // inline\n/* comment */ const next = 2;\n';

  assert.equal(countLines(text, 'ts', false), 3);
  assert.equal(countLines(text, 'ts', true), 1);
  assert.equal(countLines('', 'ts'), 0);
  assert.equal(countLines(' \r\nconst value = 1;', 'ts'), 1);
});

test('skips block comments through their closing line and resumes afterward', () => {
  const text = '/** heading\n * details\n\n */ const ignored = 1;\nconst counted = 2;\n/* unfinished\nmore comments';
  assert.equal(countLines(text, 'ts'), 1);
  assert.equal(countLines('{/* JSX\ncomment */}\n<div />\n', 'tsx'), 1);
  assert.equal(countLines('/* CSS\ncomment */\na { color: red; }', 'css'), 1);
  assert.equal(countLines('-- SQL\n/* block\nend */\nSELECT 1; -- inline', 'sql'), 1);
  assert.equal(countLines('<!-- heading\nend -->\n# Title', 'md'), 1);
});

test('uses line prefixes without parsing templates, fences, or inline block starts', () => {
  assert.equal(countLines('const text = `\n// looks like a comment\nend`;', 'ts'), 2);
  assert.equal(countLines('```html\n<!-- example -->\n```', 'md'), 2);
  assert.equal(countLines('const value = 1; /* inline */', 'ts'), 1);
  assert.equal(countLines('a {\n  --color: red;\n}', 'css'), 3);
  assert.equal(countLines('// unknown format\nvalue', 'txt'), 2);
});

test('aggregates source and tests while excluding ignored files, dependencies, and deletions', (context) => {
  const root = mkdtempSync(join(tmpdir(), 'loc-report-'));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  execFileSync('git', ['init', '--quiet'], { cwd: root });

  const write = (path: string, text: string) => writeFileSync(join(root, path), text);
  write('deleted.ts', 'deleted\n');
  execFileSync('git', ['add', 'deleted.ts'], { cwd: root });
  rmSync(join(root, 'deleted.ts'));
  write('.gitignore', 'ignored.ts\n');
  write('.codexignore', 'private.ts\n');
  write('.openaiignore', 'hidden.ts\n');
  write('ignored.ts', 'ignored\n');
  write('private.ts', 'private\n');
  write('hidden.ts', 'hidden\n');
  write('app.ts', '// header\nconst value = 1;\n');
  write('app.test.ts', 'test();\n');
  write('app.spec.ts', 'spec();\n');
  write('view.tsx', '<div />\n');
  write('style.css', 'a {}\n');
  mkdirSync(join(root, 'node_modules'));
  write('node_modules/dependency.ts', 'dependency\n');

  const rows = collectRows(root, { extensions: ['ts', 'tsx', 'css'], ignoreComments: true, help: false });

  assert.deepEqual(rows, [
    { label: 'TypeScript (.ts)', lines: 1 },
    { label: 'Tests (.ts)', lines: 2 },
    { label: 'React (.tsx)', lines: 1 },
    { label: 'Tests (.tsx)', lines: 0 },
    { label: 'CSS (.css)', lines: 1 },
  ]);
});

test('CLI supports default, all, custom extensions, help, and invalid arguments', () => {
  const script = fileURLToPath(new URL('./loc-report.ts', import.meta.url));
  for (const args of [[], ['all', '--ignore-comments'], ['ts', 'sql']]) {
    const result = spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^TOTAL\s+[1-9]\d*$/m);
    if (args[0] === 'all') assert.match(result.stdout, /Docs \(\.md\)/);
    if (args[0] === 'ts') assert.doesNotMatch(result.stdout, /React/);
  }

  const help = spawnSync(process.execPath, [script, '--help'], { encoding: 'utf8' });

  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /Usage:/);

  const invalid = spawnSync(process.execPath, [script, '--invalid'], { encoding: 'utf8' });

  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /Unknown argument/);
});
