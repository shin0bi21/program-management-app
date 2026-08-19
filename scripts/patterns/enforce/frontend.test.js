import assert from 'node:assert/strict';
import test from 'node:test';

import {
  checkApiStructure,
  checkCalendarDataHooks,
  checkCentralizedFrontendDocumentation,
  checkFrontendOwnership,
  checkPaginatedTables,
  checkPreferenceControlOwnership,
  checkResourceCalendars,
  checkRoutePageStructure,
  checkTestOwnership,
  collectRoutePageDirectories,
  collectStructureCheckFiles,
} from './frontend.js';

const repoRoot = '/repo';
const leadsPage = 'frontend/src/pages/Outreach/Leads';
const homepagePage = 'frontend/src/pages/Homepage';
const manageHomepagePage = 'frontend/src/pages/Homepage/ManageHomepage';
const routePageDirectories = [manageHomepagePage, homepagePage, leadsPage];
const completeLeadPage = [
  `${leadsPage}/Leads.tsx`,
  `${leadsPage}/Leads.css`,
  `${leadsPage}/Leads.test.tsx`,
  `${leadsPage}/types.ts`,
];

function violationsFor(check, ...args) {
  const violations = [];
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

test('rejects imports from a sibling route page', () => {
  const violations = violationsFor(
    checkFrontendOwnership,
    `${manageHomepagePage}/ManageHomepage.tsx`,
    "import HomepageContent from '../PublicHomepage/PublicHomepage';",
    routePageDirectories,
    repoRoot,
  );

  assert.match(violations[0], /another route page's private code/);
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

test('requires the standard route-page files', () => {
  const violations = violationsFor(
    checkRoutePageStructure,
    `${leadsPage}/Leads.tsx`,
    routePageDirectories,
    [`${leadsPage}/Leads.tsx`],
  );

  assert.match(violations[0], /Leads\.css, Leads\.test\.tsx, types\.ts/);
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

test('accepts the normalized functional preference lifecycle', () => {
  const source = `
    const { setBaseline, save } = useUserPreference('lead-filters', columnKeys);
    setBaseline(restored);
    save(current => ({ ...current, hiddenColumns }));
  `;

  assert.deepEqual(
    violationsFor(
      checkPreferenceControlOwnership,
      `${leadsPage}/hooks/useLeadControls.ts`,
      source,
    ),
    [],
  );
});

test('allows filter-only preferences without table column keys', () => {
  const source = `
    const { setBaseline, save } = useUserPreference('lead-filters');
    setBaseline(restored);
    save(current => ({ ...current, statuses }));
  `;

  assert.deepEqual(
    violationsFor(
      checkPreferenceControlOwnership,
      `${leadsPage}/hooks/useLeadControls.ts`,
      source,
    ),
    [],
  );
});

test('requires page-owned column keys and functional preference saves', () => {
  const source = `
    const { save } = useUserPreference('lead-filters');
    save({ hiddenColumns });
  `;
  const violations = violationsFor(
    checkPreferenceControlOwnership,
    `${leadsPage}/hooks/useLeadControls.ts`,
    source,
  );

  assert.match(violations.join('\n'), /page-owned columnKeys/);
  assert.match(violations.join('\n'), /normalized restored state/);
  assert.match(violations.join('\n'), /functional saves/);
});

test('requires infinite-list queries to use the owning ListView hook and page size', () => {
  const violations = violationsFor(
    checkPaginatedTables,
    'frontend/src/pages/Staff/Tasks/components/TaskListView/useTasks.ts',
    'useInfiniteListQuery({ limit: 50 });',
  );

  assert.match(violations.join('\n'), /ListView remote-list hook/);
  assert.match(violations.join('\n'), /25-row cursor page size/);
});

test('accepts a standard infinite-list hook', () => {
  assert.deepEqual(violationsFor(
    checkPaginatedTables,
    'frontend/src/pages/Staff/Tasks/components/TaskListView/hooks/useTasks.ts',
    'useInfiniteListQuery({ limit: 25 });',
  ), []);
});

test('requires the complete paginated-table contract', () => {
  const violations = violationsFor(
    checkPaginatedTables,
    'frontend/src/pages/Staff/Tasks/components/TaskListView/TaskListView.tsx',
    '<Table hasNextPage={hasNextPage} />',
  );

  assert.match(violations[0], /loadingNextPage, onLoadNextPage/);
});

test('reports missing ResourceCalendar ownership, buffering, and lifecycle wiring', () => {
  const violations = violationsFor(
    checkResourceCalendars,
    'frontend/src/pages/Staff/Tasks/Tasks.tsx',
    '<ResourceCalendar />',
  );

  assert.match(violations.join('\n'), /usePeriodDataBuffer/);
  assert.match(violations.join('\n'), /\*CalendarView component/);
  assert.match(violations.join('\n'), /complete period lifecycle/);
});

test('accepts a fully wired page-owned ResourceCalendar view', () => {
  const source = `
    usePeriodDataBuffer();
    <ResourceCalendar
      onInitialPeriods={onInitialPeriods}
      onPeriodsBuilt={onPeriodsBuilt}
      onPeriodsReset={onPeriodsReset}
      positionStorageKey="tasks"
    />;
  `;

  assert.deepEqual(violationsFor(
    checkResourceCalendars,
    'frontend/src/pages/Staff/Tasks/components/TaskCalendarView/TaskCalendarView.tsx',
    source,
  ), []);
});

test('requires calendar-data hooks to live under their CalendarView', () => {
  const violations = violationsFor(
    checkCalendarDataHooks,
    'frontend/src/pages/Staff/Tasks/hooks/useTaskCalendarData.ts',
  );

  assert.match(violations[0], /CalendarView hooks directory/);
});

test('requires frontend architecture and integration documentation to remain centralized', () => {
  const violations = violationsFor(
    checkCentralizedFrontendDocumentation,
    'frontend/src/common/components/Example/README.md',
  );

  assert.match(violations[0], /belongs under docs/);
  assert.deepEqual(
    violationsFor(checkCentralizedFrontendDocumentation, 'docs/development/frontend/example.md'),
    [],
  );
});
