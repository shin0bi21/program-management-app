import { addMatches } from './utils.js';

export function checkFocusedTests(violations, file, source) {
  if (!/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file)) return;
  addMatches(violations, file, source, /\b(?:describe|it|test)\.only\s*\(/g, 'focused test marker must not be committed.');
  addMatches(violations, file, source, /\b(?:fdescribe|fit)\s*\(/g, 'focused test marker must not be committed.');
  addMatches(violations, file, source, /\b(?:describe|it|test)\.skip\s*\(/g, 'skipped test marker must not be committed.');
  addMatches(violations, file, source, /\b(?:xdescribe|xit|xtest)\s*\(/g, 'skipped test marker must not be committed.');
}
