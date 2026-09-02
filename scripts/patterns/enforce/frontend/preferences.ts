import type { Findings } from '../utils.ts';

export function checkPreferenceControlOwnership(violations: Findings, file: string, source: string): void {
  if (!file.startsWith('frontend/src/pages/') || /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file)) return;

  if (file.endsWith('.tsx') && source.includes('<ColumnVisibilityMenu')) {
    const tableKeys = source.match(/\b([A-Z][A-Z0-9_]*_TABLE_KEYS)\b/)?.[1];
    if (!tableKeys || source.split(tableKeys).length < 2) {
      violations.push(`${file}:1 pages with column visibility must import and pass an owning *_TABLE_KEYS runtime list.`);
    }
  }

  if (!source.includes('useUserPreference')) return;
  const ownsTablePreferences = /\b(?:columnWidths|hiddenColumns)\b/.test(source);
  const passesTableKeys = /useUserPreference(?:<[^>]+>)?\s*\(\s*[^,]+,\s*tableKeys\s*,?\s*\)/
    .test(source);
  if (ownsTablePreferences && !passesTableKeys) {
    violations.push(`${file}:1 table preference hooks must receive owning tableKeys and pass them to useUserPreference.`);
  }
  if (!/\binitializePreference\s*\(/.test(source)) {
    violations.push(`${file}:1 preference hooks must initialize the shared save baseline from their normalized restored state.`);
  }
  if (!/\bsave\s*\(\s*current\s*=>/.test(source)) {
    violations.push(`${file}:1 preference hooks must use functional saves so consecutive controls preserve the latest state.`);
  }
}
