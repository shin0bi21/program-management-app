import type { Findings } from '../utils.ts';

export function checkDashboardNames(violations: Findings, file: string, source: string): void {
  if (!file.startsWith('frontend/src/') || !file.endsWith('.tsx') || /\.(?:test|spec|story)\.tsx$/.test(file)) return;
  const fileName = file.match(/([^/]+)\.tsx$/)?.[1];
  if (!fileName) return;
  if (fileName.endsWith('Overview') && /<[A-Z][A-Za-z0-9]*DashboardCard\b/.test(source)) violations.push(`${file}:1 structural dashboard owners must use the *Dashboard name; reserve Overview for domain content.`);
  if (file.includes('/components/') && source.includes('<DashboardCard') && !fileName.endsWith('DashboardCard')) violations.push(`${file}:1 extracted dashboard card components must use the *DashboardCard naming convention.`);
  if (/\/components\/[^/]*Dashboard\/.*Card\.tsx$/.test(file) && !fileName.endsWith('DashboardCard')) violations.push(`${file}:1 cards nested under a *Dashboard owner must use the *DashboardCard naming convention.`);
}
