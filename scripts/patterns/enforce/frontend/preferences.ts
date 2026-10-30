import { Node, SyntaxKind, type ObjectLiteralExpression } from 'ts-morph';

import { parseSourceFile } from '../../syntax.ts';
import type { Findings } from '../utils.ts';

export function checkPreferenceControlOwnership(violations: Findings, file: string, source: string): void {
  if (!file.startsWith('frontend/src/pages/') || /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file)) return;

  if (file.endsWith('.tsx') && source.includes('<ColumnVisibilityMenu')) {
    const tableKeys = source.match(/\b([A-Z][A-Z0-9_]*_TABLE_KEYS)\b/)?.[1];
    if (!tableKeys || source.split(tableKeys).length < 2) {
      violations.push(`${file}:1 pages with column visibility must import and pass an owning *_TABLE_KEYS runtime list.`);
    }
  }

  if (/\b(?:useUserPreference|usePreferenceOptionRecovery)\b/.test(source)) {
    violations.push(`${file}:1 page preferences must use usePreferences; restoration and option recovery belong to the shared hook.`);
  }

  if (!/\busePreferences\s*(?:<[^>]+>)?\s*\(/.test(source)) return;
  if (!/\bfields\s*:/.test(source)) {
    violations.push(`${file}:1 usePreferences callers must declare field normalization rules in fields.`);
  }

  const sourceFile = parseSourceFile(file, source);
  for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    if (call.getExpression().getText() !== 'usePreferences') continue;
    const options = call.getArguments()[0];
    if (!options || !Node.isObjectLiteralExpression(options)) continue;
    const property = options.getProperty('fields');
    const fields = property && Node.isPropertyAssignment(property) ? property.getInitializer() : undefined;
    if (!fields || !Node.isObjectLiteralExpression(fields)) continue;

    for (const field of ['columnWidths', 'hiddenColumns']) {
      if (fields.getProperty(field)) {
        violations.push(`${file}:${fields.getStartLineNumber()} ${field} is browser-local layout and must use useTableLayout, not usePreferences.`);
      }
    }
  }

  if (/\b(?:columnWidths|hiddenColumns)\b/.test(source)) {
    const layoutCall = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)
      .find(call => call.getExpression().getText() === 'useTableLayout');
    const options = layoutCall?.getArguments()[0];
    const property = options && Node.isObjectLiteralExpression(options) ? options.getProperty('tableKeys') : undefined;
    const ownsKeys = property && (Node.isShorthandPropertyAssignment(property)
      || (Node.isPropertyAssignment(property) && property.getInitializer()?.getText() === 'tableKeys'));
    if (!ownsKeys) {
      violations.push(`${file}:1 table layouts must use useTableLayout with owning tableKeys.`);
    }
  }

  checkPreferenceReturnOwnership(violations, file, source);
}

const CONTROL_GROUPS = {
  search: ['value', 'setValue', 'appliedValue', 'apply', 'clear'],
  filters: ['definitions', 'apply', 'clear'],
  table: ['sorting', 'setSorting', 'columnWidths', 'setColumnWidths', 'hiddenColumns', 'setHiddenColumns'],
};
const FLAT_CONTROLS = new Set([
  ...Object.values(CONTROL_GROUPS).flat(),
  'searchValue', 'setSearchValue', 'appliedSearch', 'applySearch', 'clearSearch',
  'filterCategories', 'setSearch', 'statusFilters', 'roleFilters', 'programFilters',
  'filterDefinitions', 'applyFilter', 'clearFilters', 'updateSorting', 'updateColumnWidths', 'updateHiddenColumns',
]);

function checkGroupedPreferenceReturn(violations: Findings, file: string, result: ObjectLiteralExpression): void {
  const location = `${file}:${result.getStartLineNumber()}`;
  const flatControls = new Set(FLAT_CONTROLS);
  for (const field of ['ready', 'error']) {
    if (!result.getProperty(field)) {
      violations.push(`${location} page preference hooks must return ${field} at the top level.`);
    }
  }

  for (const [group, required] of Object.entries(CONTROL_GROUPS)) {
    const property = result.getProperty(group);
    const controls = property && Node.isPropertyAssignment(property) ? property.getInitializer() : undefined;
    if (!controls || !Node.isObjectLiteralExpression(controls)) {
      violations.push(`${location} page preference hooks must return an explicit ${group} control group.`);
      continue;
    }

    const missing = required.filter(field => !controls.getProperty(field));
    if (missing.length) {
      violations.push(`${location} the ${group} preference group must include ${missing.join(', ')}.`);
    }
    if (group === 'filters') {
      const domainFields = controls.getProperties().filter(property => (
        !Node.isSpreadAssignment(property) && !required.includes(property.getName())
      ));
      if (domainFields.length === 0) {
        violations.push(`${location} the filters preference group must expose its domain filter values.`);
      }
      for (const field of domainFields) {
        if (!Node.isSpreadAssignment(field)) flatControls.add(field.getName());
      }
    }
  }

  if (Boolean(result.getProperty('view')) !== Boolean(result.getProperty('setView'))) {
    violations.push(`${location} view and setView must be exposed together when a page supports view switching.`);
  }

  for (const property of result.getProperties()) {
    if (!Node.isSpreadAssignment(property) && flatControls.has(property.getName())) {
      violations.push(`${location} ${property.getName()} must be exposed inside its preference control group, not at the top level.`);
    }
  }
}

function checkPreferenceReturnOwnership(violations: Findings, file: string, source: string): void {
  const sourceFile = parseSourceFile(file, source);
  const isFunction = (node: Node) => Node.isFunctionDeclaration(node)
    || Node.isFunctionExpression(node) || Node.isArrowFunction(node);
  const owners = new Set(sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter(call => call.getExpression().getText() === 'usePreferences')
    .map(call => call.getFirstAncestor(isFunction))
    .filter(owner => owner !== undefined));

  for (const owner of owners) {
    const returns = owner.getDescendantsOfKind(SyntaxKind.ReturnStatement)
      .filter(statement => statement.getFirstAncestor(isFunction) === owner);
    if (returns.length === 0) {
      violations.push(`${file}:${owner.getStartLineNumber()} page preference hooks must return explicit grouped controls.`);
    }

    for (const statement of returns) {
      const result = statement.getExpression();
      if (result && Node.isObjectLiteralExpression(result)) {
        checkGroupedPreferenceReturn(violations, file, result);
      } else {
        violations.push(`${file}:${statement.getStartLineNumber()} page preference hooks must return explicit grouped controls.`);
      }
    }
  }
}
