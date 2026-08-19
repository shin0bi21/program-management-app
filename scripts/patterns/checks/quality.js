import { addMatches } from './utils.js';

const RETIRED_VOCABULARY = [
  { pattern: /\b(?:work_tasks|workTask(?:s)?|WorkTask(?:s)?|work-task(?:s)?)\b/g, replacement: 'tasks / task / Task' },
];

export function checkVocabulary(violations, file, source) {
  if (file === 'scripts/patterns/checks/quality.js') return;
  for (const rule of RETIRED_VOCABULARY) addMatches(violations, file, source, rule.pattern, `retired domain vocabulary; use canonical ${rule.replacement} terminology.`);
}

export function checkFocusedTests(violations, file, source) {
  if (!/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file)) return;
  addMatches(violations, file, source, /\b(?:describe|it|test)\.only\s*\(/g, 'focused test marker must not be committed.');
  addMatches(violations, file, source, /\b(?:fdescribe|fit)\s*\(/g, 'focused test marker must not be committed.');
  addMatches(violations, file, source, /\b(?:describe|it|test)\.skip\s*\(/g, 'skipped test marker must not be committed.');
  addMatches(violations, file, source, /\b(?:xdescribe|xit|xtest)\s*\(/g, 'skipped test marker must not be committed.');
}

export function checkDashboardNames(violations, file, source) {
  if (!file.startsWith('frontend/src/') || !file.endsWith('.tsx') || /\.(?:test|spec|story)\.tsx$/.test(file)) return;
  const fileName = file.match(/([^/]+)\.tsx$/)?.[1];
  if (!fileName) return;
  if (fileName.endsWith('Overview') && /<[A-Z][A-Za-z0-9]*DashboardCard\b/.test(source)) violations.push(`${file}:1 structural dashboard owners must use the *Dashboard name; reserve Overview for domain content.`);
  if (file.includes('/components/') && source.includes('<DashboardCard') && !fileName.endsWith('DashboardCard')) violations.push(`${file}:1 extracted dashboard card components must use the *DashboardCard naming convention.`);
  if (/\/components\/[^/]*Dashboard\/.*Card\.tsx$/.test(file) && !fileName.endsWith('DashboardCard')) violations.push(`${file}:1 cards nested under a *Dashboard owner must use the *DashboardCard naming convention.`);
}
