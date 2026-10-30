import assert from 'node:assert/strict';
import test from 'node:test';

import { countLines } from './count-lines.ts';

test('excludes standalone TypeScript comments and blank lines while keeping inline code', () => {
  const source = '// heading\n/** docs\n * details\n */\n\nconst value = 1; // inline\n/* comment */ const next = 2;\n';
  assert.equal(countLines(source, 'ts'), 2);
});

test('preserves strings, regular expressions, and multiline template content', () => {
  const source = 'const url = "https://example.com";\nconst regex = /a\\/\\/b/;\nconst text = `start\n// content\n/* content */\n${1 /* inline */}\nend`;\n';
  assert.equal(countLines(source, 'ts'), 7);
});

test('excludes JSX comments and preserves JSX text and attributes', () => {
  const source = 'const view = <div title="// text">\n{/* comment */}\n{/* multi\nline */}\n// visible text\n<span>hello</span>\n</div>;\n';
  assert.equal(countLines(source, 'tsx'), 4);
});

test('handles empty files, single files without final newlines, and CRLF', () => {
  assert.equal(countLines('', 'ts'), 0);
  assert.equal(countLines('const value = 1;', 'ts'), 1);
  assert.equal(countLines('// comment\r\n\r\nconst value = 1;\r\n', 'ts'), 1);
});

test('excludes CSS, SQL, and Markdown comments while preserving quoted content', () => {
  assert.equal(countLines('/* heading\nend */\na { content: "/* text */"; }\n', 'css'), 1);
  assert.equal(countLines("-- heading\n/* block */\nSELECT '--text', $$/*text*/$$; -- inline\n", 'sql'), 1);
  assert.equal(countLines('<!-- heading\nend -->\n# Title\n```html\n<!-- example -->\n```\n', 'md'), 4);
  assert.equal(countLines('# unknown extension\nvalue', 'txt'), 2);
});

test('excludes whitespace-only lines in both modes and for unknown extensions', () => {
  const source = '\n \t\n// comment\nconst value = 1;\n\n';
  assert.equal(countLines(source, 'ts', false), 2);
  assert.equal(countLines(source, 'ts', true), 1);
  assert.equal(countLines(source, 'txt', true), 2);
  assert.equal(countLines(' \r\n\t\n', 'ts', false), 0);
});

test('keeps CSS custom properties while excluding multiline comment-only lines', () => {
  const source = 'a {\n  --name: /* heading\n comment */\n red;\n}\n';
  assert.equal(countLines(source, 'css'), 4);
});

test('excludes nested SQL block comments and preserves dollar-quoted content', () => {
  const source = "/* outer\n /* inner */\n still comment\n*/\nSELECT $body$/* literal */$body$;\n";
  assert.equal(countLines(source, 'sql'), 1);
});
