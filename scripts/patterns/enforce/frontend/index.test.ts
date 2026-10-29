import assert from 'node:assert/strict';
import test from 'node:test';

import {
  checkApiStructure,
  checkCalendarDataHooks,
  checkCentralizedFrontendDocumentation,
  checkFrontendOwnership,
  checkPaginatedTables,
  checkPreferenceControlOwnership,
  checkTimelineCalendars,
  checkRoutePageShell,
  checkRoutePageStructure,
  checkTestOwnership,
  collectRoutePageDirectories,
  collectStructureCheckFiles,
} from './index.ts';

const repoRoot = '/repo';
const leadsPage = 'frontend/src/pages/Leads';
const homepagePage = 'frontend/src/pages/Homepage';
const manageHomepagePage = 'frontend/src/pages/Homepage/ManageHomepage';
const routePageDirectories = [manageHomepagePage, homepagePage, leadsPage];
const completeLeadPage = [
  `${leadsPage}/Leads.tsx`,
  `${leadsPage}/Leads.css`,
  `${leadsPage}/Leads.test.tsx`,
  `${leadsPage}/types.ts`,
];

function violationsFor<Args extends unknown[]>(
  check: (violations: string[], ...args: Args) => void,
  ...args: Args
): string[] {
  const violations: string[] = [];
  check(violations, ...args);
  return violations;
}

test('discovers nested route pages before their route-family parent', () => {
  assert.deepEqual(
    collectRoutePageDirectories([
      `${homepagePage}/Homepage.tsx`,
      `${manageHomepagePage}/ManageHomepage.tsx`,
    ]),
    [manageHomepagePage, homepagePage],
  );
});

test('allows imports from a sibling route page', () => {
  const violations = violationsFor(
    checkFrontendOwnership,
    `${manageHomepagePage}/ManageHomepage.tsx`,
    "import HomepageContent from '../PublicHomepage/PublicHomepage';",
    routePageDirectories,
    repoRoot,
  );

  assert.deepEqual(violations, []);
});

test('allows imports across route families', () => {
  const violations = violationsFor(
    checkFrontendOwnership,
    `${leadsPage}/Leads.tsx`,
    "import Homepage from '../../Homepage/Homepage';",
    routePageDirectories,
    repoRoot,
  );

  assert.deepEqual(violations, []);
});

test('allows a nested route page to import its page-family common owner', () => {
  const violations = violationsFor(
    checkFrontendOwnership,
    `${manageHomepagePage}/ManageHomepage.tsx`,
    "import HomepageContent from '../common/components/HomepageContent/HomepageContent';",
    routePageDirectories,
    repoRoot,
  );

  assert.deepEqual(violations, []);
});

test('checks import and export declarations without matching source text', () => {
  const file = 'frontend/src/common/components/Example/Example.tsx';
  const source = `
    const documentation = "import Thing from '../../../pages/Leads/Leads'";
    // export { Thing } from '../../../pages/Leads/Leads';
    export { saveLead } from '../../../pages/Leads/leads.api';
  `;
  const violations = violationsFor(
    checkFrontendOwnership,
    file,
    source,
    routePageDirectories,
    repoRoot,
  );

  assert.equal(violations.length, 1);
  assert.match(violations[0], /:4 common components cannot import features or pages/);
  assert.match(violations[0], /leads\.api/);
});

test('requires the route entry and test while keeping types optional', () => {
  const violations = violationsFor(
    checkRoutePageStructure,
    `${leadsPage}/Leads.tsx`,
    routePageDirectories,
    [`${leadsPage}/Leads.tsx`],
  );

  assert.match(violations[0], /Leads\.test\.tsx/);
  assert.doesNotMatch(violations[0], /types\.ts/);

  assert.deepEqual(
    violationsFor(
      checkRoutePageStructure,
      `${leadsPage}/Leads.tsx`,
      routePageDirectories,
      [`${leadsPage}/Leads.tsx`, `${leadsPage}/Leads.test.tsx`],
    ),
    [],
  );
});

test('allows a route page to delegate all styling without owning CSS', () => {
  assert.deepEqual(
    violationsFor(
      checkRoutePageStructure,
      `${leadsPage}/Leads.tsx`,
      routePageDirectories,
      completeLeadPage.filter(file => !file.endsWith('.css')),
    ),
    [],
  );
});

test('accepts a complete route-page root', () => {
  assert.deepEqual(
    violationsFor(
      checkRoutePageStructure,
      `${leadsPage}/Leads.tsx`,
      routePageDirectories,
      completeLeadPage,
    ),
    [],
  );
});

test('requires data route pages to compose the shared page shell', () => {
  const missingHeader = violationsFor(
    checkRoutePageShell,
    `${leadsPage}/Leads.tsx`,
    '<main className="page-container"><PageBody /></main>',
    routePageDirectories,
  );
  assert.match(missingHeader[0], /route-level PageHeader/);

  const missingDataMain = violationsFor(
    checkRoutePageShell,
    `${leadsPage}/Leads.tsx`,
    '<main><PageHeader title="Leads" /><PageBody /></main>',
    routePageDirectories,
  );
  assert.match(missingDataMain[0], /main\.page-container/);
});

test('accepts the canonical data route page shell', () => {
  assert.deepEqual(
    violationsFor(
      checkRoutePageShell,
      `${leadsPage}/Leads.tsx`,
      '<main className="page-container leads-page"><PageHeader title="Leads" /><PageBody /></main>',
      routePageDirectories,
    ),
    [],
  );
});

test('rejects nonstandard route-page root files', () => {
  const file = `${leadsPage}/queryKeys.ts`;
  const violations = violationsFor(
    checkRoutePageStructure,
    file,
    routePageDirectories,
    [...completeLeadPage, file],
  );

  assert.match(violations[0], /route-page root files are limited/);
});

test('rejects an existing nonstandard root sibling when another page file changes', () => {
  const extraFile = `${leadsPage}/queryKeys.ts`;
  const violations = violationsFor(
    checkRoutePageStructure,
    `${leadsPage}/Leads.tsx`,
    routePageDirectories,
    [...completeLeadPage, extraFile],
  );

  assert.match(violations[0], new RegExp(`${extraFile}:1`));
  assert.match(violations[0], /route-page root files are limited/);
});

test('rejects an existing nonstandard child directory when another page file changes', () => {
  const extraFile = `${leadsPage}/schema/leadSchema.ts`;
  const violations = violationsFor(
    checkRoutePageStructure,
    `${leadsPage}/Leads.tsx`,
    routePageDirectories,
    [...completeLeadPage, extraFile],
  );

  assert.match(violations[0], new RegExp(`${extraFile}:1`));
  assert.match(violations[0], /route-page children must be owned/);
});

test('rejects an unchanged invalid API layout when another page file changes', () => {
  const rootApis = [`${leadsPage}/leads.api.ts`, `${leadsPage}/notes.api.ts`];
  const rootViolations = violationsFor(
    checkRoutePageStructure,
    `${leadsPage}/Leads.tsx`,
    routePageDirectories,
    [...completeLeadPage, ...rootApis],
  );
  assert.match(rootViolations[0], /multiple API adapters must group them under api/);

  const nestedApi = `${leadsPage}/api/leads.api.ts`;
  const nestedViolations = violationsFor(
    checkRoutePageStructure,
    `${leadsPage}/Leads.tsx`,
    routePageDirectories,
    [...completeLeadPage, nestedApi],
  );
  assert.match(nestedViolations[0], /one API adapter keeps it at the page root/);
});

test('keeps one API adapter at its route-page root', () => {
  const file = `${leadsPage}/leads.api.ts`;
  assert.deepEqual(
    violationsFor(
      checkRoutePageStructure,
      file,
      routePageDirectories,
      [...completeLeadPage, file, `${leadsPage}/leads.api.test.ts`],
    ),
    [],
  );
});

test('requires multiple route-page API adapters to use api/', () => {
  const file = `${leadsPage}/leads.api.ts`;
  const violations = violationsFor(
    checkRoutePageStructure,
    file,
    routePageDirectories,
    [...completeLeadPage, file, `${leadsPage}/leadNotes.api.ts`],
  );

  assert.match(violations[0], /multiple API adapters/);
});

test('rejects a one-file API directory inside a common feature', () => {
  const file = 'frontend/src/common/features/youth/api/youth.api.ts';
  const violations = violationsFor(checkApiStructure, file, [file]);

  assert.match(violations[0], /belongs at its owning feature/);
});

test('allows an API directory with multiple cohesive feature adapters', () => {
  const file = 'frontend/src/common/features/programming/api/cohorts.api.ts';
  const repositoryFiles = [
    file,
    'frontend/src/common/features/programming/api/sessions.api.ts',
  ];

  assert.deepEqual(violationsFor(checkApiStructure, file, repositoryFiles), []);
});

test('requires components to own a colocated test', () => {
  const file = `${leadsPage}/components/LeadModal/LeadModal.tsx`;
  const violations = violationsFor(
    checkTestOwnership,
    file,
    [file],
    routePageDirectories,
  );

  assert.match(violations[0], /components must own/);
});

test('accepts a component with its colocated test', () => {
  const file = `${leadsPage}/components/LeadModal/LeadModal.tsx`;
  assert.deepEqual(
    violationsFor(
      checkTestOwnership,
      file,
      [file, `${leadsPage}/components/LeadModal/LeadModal.test.tsx`],
      routePageDirectories,
    ),
    [],
  );
});

test('requires hooks and API adapters to own tests', () => {
  const hook = `${leadsPage}/components/LeadModal/useLeadForm.ts`;
  const api = `${leadsPage}/leads.api.ts`;

  assert.match(
    violationsFor(checkTestOwnership, hook, [hook], routePageDirectories)[0],
    /hooks must own/,
  );
  assert.match(
    violationsFor(checkTestOwnership, api, [api], routePageDirectories)[0],
    /API adapters must own/,
  );
});

test('checks an owner when its test is deleted', () => {
  const owner = `${leadsPage}/hooks/useLeads.ts`;
  const deletedTest = `${leadsPage}/hooks/useLeads.test.ts`;

  assert.deepEqual(
    collectStructureCheckFiles(
      [deletedTest],
      [...completeLeadPage, owner],
      routePageDirectories,
    ),
    [`${leadsPage}/Leads.tsx`, owner],
  );
});

test('accepts shared preference fields with owning table rules', () => {
  const source = `
    const { preferences, updatePreferences } = usePreferences({
      key: 'lead-filters',
      fields: {
        columnWidths: preferenceColumnWidths(tableKeys),
        hiddenColumns: preferenceHiddenColumns(tableKeys),
      },
    });
    updatePreferences({ hiddenColumns });
  `;

  assert.deepEqual(
    violationsFor(checkPreferenceControlOwnership, `${leadsPage}/hooks/useLeadPreferences.ts`, source),
    [],
  );
});

test('accepts a route-selected key and formatted field rules', () => {
  const source = `
    usePreferences({
      key: preferenceKey,
      fields: {
        columnWidths: preferenceColumnWidths(
          tableKeys,
        ),
        hiddenColumns: preferenceHiddenColumns(tableKeys),
      },
    });
  `;

  assert.deepEqual(
    violationsFor(checkPreferenceControlOwnership, `${leadsPage}/hooks/useLeadPreferences.ts`, source),
    [],
  );
});

test('allows filter-only preferences without table column keys', () => {
  const source = `
    const { preferences, updatePreferences } = usePreferences({
      key: 'lead-filters',
      fields: { search: preferenceText() },
    });
    updatePreferences({ search });
  `;

  assert.deepEqual(
    violationsFor(checkPreferenceControlOwnership, `${leadsPage}/hooks/useLeadPreferences.ts`, source),
    [],
  );
});

test('requires field rules on shared preference calls', () => {
  const violations = violationsFor(
    checkPreferenceControlOwnership,
    `${leadsPage}/hooks/useLeadPreferences.ts`,
    "usePreferences({ key: 'lead-filters' });",
  );

  assert.match(violations.join('\n'), /field normalization rules in fields/);
});

test('requires both table preferences to use owning table keys', () => {
  const source = `
    usePreferences({
      key: 'lead-filters',
      fields: {
        columnWidths: preferenceColumnWidths(otherKeys),
        hiddenColumns: preferenceIds(tableKeys),
      },
    });
  `;
  const violations = violationsFor(
    checkPreferenceControlOwnership,
    `${leadsPage}/hooks/useLeadPreferences.ts`,
    source,
  );

  assert.equal(violations.length, 2);
  assert.match(violations[0], /preferenceColumnWidths\(tableKeys\)/);
  assert.match(violations[1], /preferenceHiddenColumns\(tableKeys\)/);
});

test('rejects page-owned preference restoration and option recovery hooks', () => {
  for (const hook of ['useUserPreference', 'usePreferenceOptionRecovery']) {
    const violations = violationsFor(
      checkPreferenceControlOwnership,
      `${leadsPage}/hooks/useLeadPreferences.ts`,
      `${hook}({});`,
    );

    assert.match(violations.join('\n'), /must use usePreferences/);
  }
});

test('leaves preference test fixtures outside page ownership enforcement', () => {
  assert.deepEqual(
    violationsFor(
      checkPreferenceControlOwnership,
      `${leadsPage}/hooks/useLeadPreferences.test.ts`,
      "useUserPreference('lead-filters');",
    ),
    [],
  );
});

const groupedPreferenceSource = `
  function useLeadPreferences() {
    const { preferences, updatePreferences, ready, error } = usePreferences({
      key: 'lead-filters',
      fields: {
        search: preferenceText(),
        statuses: preferenceOptions(['active']),
        columnWidths: preferenceColumnWidths(tableKeys),
        hiddenColumns: preferenceHiddenColumns(tableKeys),
      },
    });
    return {
      ready,
      error,
      view,
      setView,
      search: { value, setValue, appliedValue, apply, clear },
      filters: { statuses, definitions, apply, clear },
      table: { sorting, setSorting, columnWidths, setColumnWidths, hiddenColumns, setHiddenColumns },
      schedulableCohorts,
    };
  }
`;

function preferenceViolations(source: string): string[] {
  return violationsFor(checkPreferenceControlOwnership, `${leadsPage}/hooks/useLeadPreferences.ts`, source);
}

test('accepts grouped preference controls with optional view controls and domain extras', () => {
  assert.deepEqual(preferenceViolations(groupedPreferenceSource), []);
  assert.deepEqual(preferenceViolations(groupedPreferenceSource.replace('      view,\n      setView,\n', '')), []);
});

test('requires ready and error on the returned contract, not merely the shared hook result', () => {
  const source = groupedPreferenceSource.replace('      ready,\n      error,\n', '');
  const violations = preferenceViolations(source);

  assert.match(violations.join('\n'), /return ready at the top level/);
  assert.match(violations.join('\n'), /return error at the top level/);
});

test('does not mistake field definitions or nested callback returns for the grouped contract', () => {
  const source = `
    function useLeadPreferences() {
      usePreferences({
        key: 'lead-filters',
        fields: { search: {}, filters: {}, table: {} },
      });
      const unrelated = () => {
        return { ready, error, search: {}, filters: {}, table: {} };
      };
      return { ready, error, searchValue, appliedSearch, filterDefinitions };
    }
  `;
  const violations = preferenceViolations(source);

  for (const group of ['search', 'filters', 'table']) {
    assert.match(violations.join('\n'), new RegExp(`explicit ${group} control group`));
  }
  assert.match(violations.join('\n'), /searchValue must be exposed inside/);
});

test('requires complete grouped controls and domain filter values', () => {
  const source = groupedPreferenceSource
    .replace('value, setValue, appliedValue, apply, clear', 'value, setValue')
    .replace('statuses, definitions, apply, clear', 'definitions, apply, clear')
    .replace('sorting, setSorting, columnWidths, setColumnWidths, hiddenColumns, setHiddenColumns', 'sorting');
  const violations = preferenceViolations(source);

  assert.match(violations.join('\n'), /search preference group must include appliedValue, apply, clear/);
  assert.match(violations.join('\n'), /filters preference group must expose its domain filter values/);
  assert.match(violations.join('\n'), /table preference group must include setSorting/);
});

test('rejects flat controls even alongside otherwise complete groups', () => {
  const source = groupedPreferenceSource.replace('      schedulableCohorts,', '      sorting,\n      applySearch,');
  const violations = preferenceViolations(source);

  assert.match(violations.join('\n'), /sorting must be exposed inside/);
  assert.match(violations.join('\n'), /applySearch must be exposed inside/);
});

test('rejects historical aliases and domain fields duplicated outside filters', () => {
  const aliases = ['filterCategories', 'setSearch', 'statusFilters', 'roleFilters', 'programFilters', 'statuses'];
  const source = groupedPreferenceSource.replace('      schedulableCohorts,', aliases.join(',') + ',');
  const violations = preferenceViolations(source);

  for (const alias of aliases) {
    assert.match(violations.join('\n'), new RegExp(`${alias} must be exposed inside`));
  }
});

test('requires explicit group literals and paired view controls', () => {
  const source = groupedPreferenceSource
    .replace('search: { value, setValue, appliedValue, apply, clear }', 'search')
    .replace('      setView,\n', '');
  const violations = preferenceViolations(source);

  assert.match(violations.join('\n'), /explicit search control group/);
  assert.match(violations.join('\n'), /view and setView must be exposed together/);
});

test('rejects a historical list-view owner', () => {
  const violations = violationsFor(
    checkPaginatedTables,
    'frontend/src/pages/Staff/Tasks/components/TaskListView/hooks/useTasks.ts',
    "import { TABLE_PAGE_SIZE } from '../../../../../../../query/types'; useInfiniteListQuery({ limit: TABLE_PAGE_SIZE, ordering: { getValue: row => row.name, direction: 'asc' } });",
  );

  assert.match(violations.join('\n'), /\*ListView and \*TableView owners are not supported/);
});

test('rejects a historical table-view owner', () => {
  const violations = violationsFor(
    checkPaginatedTables,
    'frontend/src/pages/Staff/Tasks/components/TaskTableView/hooks/useTasks.ts',
    "import { TABLE_PAGE_SIZE } from '../../../../../../../query/types'; useInfiniteListQuery({ limit: TABLE_PAGE_SIZE, ordering: { getValue: row => row.name, direction: 'asc' } });",
  );

  assert.match(violations.join('\n'), /\*ListView and \*TableView owners are not supported/);
});

test('requires infinite-list queries in a canonical table to use its hooks directory', () => {
  const violations = violationsFor(
    checkPaginatedTables,
    'frontend/src/pages/Staff/Tasks/components/TaskTable/useTasks.ts',
    "import { TABLE_PAGE_SIZE } from '../../../../../../../query/types'; useInfiniteListQuery({ limit: TABLE_PAGE_SIZE, ordering: { getValue: row => row.name, direction: 'asc' } });",
  );

  assert.match(violations.join('\n'), /remote-table hook/);
});

test('accepts an infinite-list hook colocated under a canonical table', () => {
  assert.deepEqual(violationsFor(
    checkPaginatedTables,
    'frontend/src/pages/Staff/Tasks/components/TaskTable/hooks/useTasks.ts',
    "import { TABLE_PAGE_SIZE } from '../../../../../../../query/types'; useInfiniteListQuery({ limit: TABLE_PAGE_SIZE, ordering: { getValue: row => row.name, direction: 'asc' } });",
  ), []);
});

test('rejects deferred search inside a remote table-data hook', () => {
  const violations = violationsFor(
    checkPaginatedTables,
    'frontend/src/pages/Staff/Tasks/components/TaskTable/hooks/useTaskTableData.ts',
    "import { TABLE_PAGE_SIZE } from '../../../../../../../query/types'; useDeferredValue(search); useInfiniteListQuery({ limit: TABLE_PAGE_SIZE, ordering: { getValue: row => row.name, direction: 'asc' } });",
  );

  assert.match(violations.join('\n'), /receive page-applied search/);
});

test('rejects debounced page search', () => {
  const violations = violationsFor(
    checkPaginatedTables,
    'frontend/src/pages/Youth/hooks/useYouthControls.ts',
    'const debouncedSearch = useDebounce(search);',
  );

  assert.match(violations.join('\n'), /explicit Apply\/Clear flow/);
});

test('rejects a route page importing its table owner private data hook', () => {
  const violations = violationsFor(
    checkPaginatedTables,
    'frontend/src/pages/Youth/Youth.tsx',
    "import useYouthTableData from './components/YouthTable/hooks/useYouthTableData';",
  );

  assert.match(violations.join('\n'), /must not import a table owner's private data hook/);
});

test('accepts a route page importing its table presentation hook', () => {
  assert.deepEqual(violationsFor(
    checkPaginatedTables,
    'frontend/src/pages/Staff/Hours/Hours.tsx',
    "import useHoursTable from './components/HoursTable/hooks/useHoursTable';",
  ), []);
});

test('requires a canonical table renderer filename to match its owner', () => {
  const violations = violationsFor(
    checkPaginatedTables,
    'frontend/src/pages/Staff/Tasks/components/TaskTable/Rows.tsx',
    'export function Rows() { return <Table />; }',
  );

  assert.match(violations.join('\n'), /matching owner and file names/);
});

test('rejects a route page that renders the shared table directly', () => {
  const violations = violationsFor(
    checkPaginatedTables,
    'frontend/src/pages/Staff/Tasks/Tasks.tsx',
    'export function Tasks() { return <Table />; }',
  );

  assert.match(violations.join('\n'), /components\/\*Table\/\*Table\.tsx/);
});

test('accepts a canonical table renderer', () => {
  assert.deepEqual(violationsFor(
    checkPaginatedTables,
    'frontend/src/pages/Staff/Tasks/components/TaskTable/TaskTable.tsx',
    'export function TaskTable() { tableRefreshMessage(notice); return <Table hasNextPage={false} loadingNextPage={false} onLoadNextPage={load} nextPageUnavailable={failure} />; }',
  ), []);
});

test('does not confuse the shared table column type with a Table renderer', () => {
  assert.deepEqual(violationsFor(
    checkPaginatedTables,
    'frontend/src/pages/Staff/Tasks/Tasks.tsx',
    'const columns = useMemo<TableColumnDef<Task>[]>(() => []);',
  ), []);
});

test('does not confuse generic infinite-list infrastructure with a page table owner', () => {
  assert.deepEqual(violationsFor(
    checkPaginatedTables,
    'frontend/src/query/useInfiniteListQuery.ts',
    'export function useInfiniteListQuery() {}',
  ), []);
});

test('requires the complete paginated-table contract', () => {
  const violations = violationsFor(
    checkPaginatedTables,
    'frontend/src/pages/Staff/Tasks/components/TaskTable/TaskTable.tsx',
    '<Table hasNextPage={hasNextPage} />',
  );

  assert.match(violations.join("\n"), /loadingNextPage, onLoadNextPage/);
});

test('rejects page tables that bypass pagination or next-page recovery entirely', () => {
  const violations = violationsFor(
    checkPaginatedTables,
    'frontend/src/pages/Programming/Programs/components/CycleTable/CycleTable.tsx',
    '<Table data={cycles} />',
  );

  assert.match(violations.join('\n'), /hasNextPage, loadingNextPage, onLoadNextPage/);
  assert.match(violations.join('\n'), /nextPageUnavailable/);
});

test('requires out-of-order warning configuration and page-message wiring', () => {
  const hookViolations = violationsFor(checkPaginatedTables,
    'frontend/src/pages/Youth/components/YouthTable/hooks/useYouthTableData.ts',
    "import { TABLE_PAGE_SIZE } from '../../query/types'; useInfiniteListQuery({ limit: TABLE_PAGE_SIZE });",
  );
  assert.match(hookViolations.join('\n'), /sort value and direction/);

  const tableViolations = violationsFor(checkPaginatedTables,
    'frontend/src/pages/Youth/components/YouthTable/YouthTable.tsx',
    '<Table hasNextPage={false} loadingNextPage={false} onLoadNextPage={load} nextPageUnavailable={undefined} />',
  );
  assert.match(tableViolations.join('\n'), /page message owner/);
});

test('reports missing TimelineCalendar ownership, buffering, and lifecycle wiring', () => {
  const violations = violationsFor(
    checkTimelineCalendars,
    'frontend/src/pages/Staff/Tasks/Tasks.tsx',
    '<TimelineCalendar />',
  );

  assert.match(violations.join('\n'), /useDataBuffer/);
  assert.match(violations.join('\n'), /\*Calendar component/);
  assert.match(violations.join('\n'), /complete period lifecycle/);
});

test('accepts a fully wired page-owned TimelineCalendar view', () => {
  const source = `
    useDataBuffer();
    <TimelineCalendar
      onInitialPeriods={onInitialPeriods}
      onPeriodsBuilt={onPeriodsBuilt}
      onPeriodsReset={onPeriodsReset}
      positionStorageKey="tasks"
    />;
  `;

  assert.deepEqual(violationsFor(
    checkTimelineCalendars,
    'frontend/src/pages/Staff/Tasks/components/TaskCalendar/TaskCalendar.tsx',
    source,
  ), []);
});

test('requires calendar-data hooks to live under their Calendar owner', () => {
  const violations = violationsFor(
    checkCalendarDataHooks,
    'frontend/src/pages/Staff/Tasks/hooks/useTaskCalendarData.ts',
  );

  assert.match(violations[0], /Calendar hooks directory/);
});

test('requires frontend architecture and integration documentation to remain centralized', () => {
  const violations = violationsFor(
    checkCentralizedFrontendDocumentation,
    'frontend/src/common/components/Example/README.md',
  );

  assert.match(violations[0], /belongs under docs/);
  assert.deepEqual(
    violationsFor(checkCentralizedFrontendDocumentation, 'docs/frontend/example.md'),
    [],
  );
});


test('requires the canonical table page-size constant instead of a literal or local value', () => {
  for (const source of [
    'useInfiniteListQuery({ limit: 25 });',
    'useInfiniteListQuery({ limit: 50 });',
    "const TABLE_PAGE_SIZE = 50; useInfiniteListQuery({ limit: TABLE_PAGE_SIZE, ordering: { getValue: row => row.name, direction: 'asc' } });",
  ]) {
    const violations = violationsFor(
      checkPaginatedTables,
      'frontend/src/pages/Staff/Tasks/components/TaskTable/hooks/useTaskTableData.ts',
      source,
    );

    assert.match(violations.join('\n'), /TABLE_PAGE_SIZE from query\/types/);
  }
});
