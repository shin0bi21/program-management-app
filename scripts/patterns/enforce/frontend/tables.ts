import { addMatches } from '../utils.ts';
import type { Findings } from '../utils.ts';

export function checkPaginatedTables(violations: Findings, file: string, source: string): void {
  if (!file.startsWith('frontend/src/pages/')) return;

  if (/\bdebouncedSearch\b/.test(source)) {
    violations.push(
      `${file}:1 searches must use the shared explicit Apply/Clear flow; do not debounce search.`,
    );
  }

  const routePageMatch = file.match(/\/([^/]+)\/\1\.tsx$/);
  if (routePageMatch) {
    addMatches(
      violations,
      file,
      source,
      /from\s+['"][^'"]*\/components\/[^/'"]+Table\/hooks\/use[^/'"]*TableData['"]/g,
      'route pages must not import a table owner\'s private data hook; the *Table component owns its remote query.',
    );
  }

  const usesInfiniteList = source.includes('useInfiniteListQuery');
  const tableOwnerMatch = file.match(/\/components\/([^/]+)\//);
  const tableOwnerName = tableOwnerMatch?.[1];
  const historicalTableOwner = tableOwnerName != null
    && /(?:ListView|TableView)$/.test(tableOwnerName);
  const canonicalTableOwner = tableOwnerName != null && /Table$/.test(tableOwnerName);

  if (historicalTableOwner) {
    violations.push(
      `${file}:1 page-owned table components must use components/*Table/*Table.tsx; *ListView and *TableView owners are not supported.`,
    );
  }

  if (usesInfiniteList && !file.includes('/hooks/')) {
    violations.push(
      `${file}:1 page components must own remote infinite-list queries through a page hook.`,
    );
  }

  const tableOwnerHook = canonicalTableOwner
    && file.includes(`/components/${tableOwnerName}/hooks/`);
  if (usesInfiniteList && canonicalTableOwner && !tableOwnerHook) {
    violations.push(
      `${file}:1 a remote-table hook must be colocated under its table owner's hooks directory.`,
    );
  }

  const rendersTable = /<Table(?:\s|\/|>)/.test(source);
  const canonicalTableComponent = canonicalTableOwner
    && file.endsWith(`/components/${tableOwnerName}/${tableOwnerName}.tsx`);
  if (rendersTable && !canonicalTableComponent) {
    violations.push(
      `${file}:1 a page-owned table renderer must use components/*Table/*Table.tsx with matching owner and file names.`,
    );
  }

  if (/\.(?:test|spec|story)\.tsx?$/.test(file)) return;

  const usesStandardPageSize = /limit\s*:\s*TABLE_PAGE_SIZE\b/.test(source)
    && /import\s*\{[^}]*\bTABLE_PAGE_SIZE\b[^}]*\}\s*from\s*['"][^'"]*\/query\/types['"]/.test(source);
  if (usesInfiniteList && !usesStandardPageSize) {
    violations.push(
      `${file}:1 remote list hooks must request the standard 50-row cursor page size through TABLE_PAGE_SIZE from query/types.`,
    );
  }

  if (usesInfiniteList && source.includes('useDeferredValue')) {
    violations.push(
      `${file}:1 remote table-data hooks must receive page-applied search in their filter object; do not defer search inside the query hook.`,
    );
  }

  if (usesInfiniteList && tableOwnerHook && !/\bordering\s*:/.test(source)) {
    violations.push(`${file}:1 table data hooks must declare the active sort value and direction for out-of-order refresh messages.`);
  }
  if (canonicalTableComponent && rendersTable && !source.includes('tableRefreshMessage(')) {
    violations.push(`${file}:1 table owners must report retained-edit refresh messages through the page message owner.`);
  }

  const paginationProps = ['hasNextPage', 'loadingNextPage', 'onLoadNextPage'];
  const wiredProps = paginationProps.filter(
    prop => new RegExp(`\\b${prop}\\s*=`).test(source),
  );
  if (canonicalTableComponent && rendersTable && wiredProps.length < paginationProps.length) {
    const missing = paginationProps.filter(prop => !wiredProps.includes(prop));
    violations.push(
      `${file}:1 paginated tables must wire the complete load-more contract; missing ${missing.join(', ')}.`,
    );
  }

  if (canonicalTableComponent && rendersTable && !/\bnextPageUnavailable\s*=/.test(source)) {
    violations.push(`${file}:1 paginated tables must expose next-page failure and explicit retry through nextPageUnavailable.`);
  }
}
