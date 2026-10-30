import { readFileSync } from 'node:fs';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

export function countLines(text: string, extension: string, ignoreComments = true): number {
  const lines = text.split('\n');
  if (!ignoreComments) return lines.filter(line => line.trim()).length;

  const lineStarts = [0];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '\n') lineStarts.push(index + 1);
  }

  const codeLines = new Set<number>();
  const markCode = (start: number, end: number) => {
    let low = 0;
    let high = lineStarts.length;
    while (low + 1 < high) {
      const middle = Math.floor((low + high) / 2);
      if (lineStarts[middle] <= start) low = middle;
      else high = middle;
    }

    let line = low;
    for (const fragment of text.slice(start, end).split('\n')) {
      if (fragment.trim()) codeLines.add(line);
      line += 1;
    }
  };

  if (extension === 'ts' || extension === 'tsx') {
    const source = ts.createSourceFile(`file.${extension}`, text, ts.ScriptTarget.Latest, true);
    const visit = (node: ts.Node) => {
      // JSDoc and empty JSX expressions contain comments rather than executable tokens.
      if (ts.isJSDoc(node) || (ts.isJsxExpression(node) && !node.expression)) return;

      const children = node.getChildren(source);
      if (children.length) {
        children.forEach(visit);
      } else if (node.kind !== ts.SyntaxKind.EndOfFileToken) {
        markCode(node.getStart(source), node.end);
      }
    };
    visit(source);
  } else if (['css', 'sql', 'md'].includes(extension)) {
    // Match strings before comments so quoted comment markers remain content.
    const tokens = extension === 'md'
      ? /(`{3,}|~{3,})[^\n]*\n[\s\S]*?\1|`+[^`]*`+|<!--[\s\S]*?(?:-->|$)|[^<`~]+|./g
      : extension === 'css'
        ? /'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|\/\*[\s\S]*?(?:\*\/|$)|[^'"/]+|./g
        : /\$([a-zA-Z_][\w]*|)\$[\s\S]*?\$\1\$|'(?:''|\\.|[^'\\])*'|"(?:""|\\.|[^"\\])*"|\/\*[\s\S]*?(?:\*\/|$)|--[^\n]*|[^'"/\-$]+|./g;
    for (let match = tokens.exec(text); match; match = tokens.exec(text)) {
      const token = match[0];

      // SQL block comments can nest; consume the entire outer comment.
      if (extension === 'sql' && token.startsWith('/*')) {
        let depth = 1;
        let position = match.index + 2;

        while (depth > 0 && position < text.length) {
          if (text.startsWith('/*', position)) {
            depth += 1;
            position += 2;
          } else if (text.startsWith('*/', position)) {
            depth -= 1;
            position += 2;
          } else {
            position += 1;
          }
        }

        tokens.lastIndex = position;
        continue;
      }

      const isComment = extension === 'md'
        ? token.startsWith('<!--')
        : token.startsWith('/*') || (extension === 'sql' && token.startsWith('--'));
      if (!isComment) markCode(match.index, match.index + token.length);
    }
  } else {
    return lines.filter(line => line.trim()).length;
  }

  return lines.filter((line, index) => line.trim() && codeLines.has(index)).length;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const extension = process.argv[2];
  process.stdin.setEncoding('utf8');
  let input = '';
  for await (const chunk of process.stdin) input += chunk;

  const files = input.split('\0').filter(Boolean);
  const total = files.reduce((sum, file) => {
    const text = readFileSync(file, 'utf8');
    const lines = countLines(text, extension, process.argv[3] === 'true');
    return sum + lines;
  }, 0);
  process.stdout.write(`${total}\n`);
}
