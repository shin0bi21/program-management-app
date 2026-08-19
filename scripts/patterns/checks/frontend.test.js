import assert from 'node:assert/strict';
import test from 'node:test';

import {
  checkApiStructure,
  checkFrontendOwnership,
  checkPreferenceControlOwnership,
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
