import assert from 'node:assert/strict';
import test from 'node:test';

import { checkCentralizedFrontendDocumentation, checkFrontendOwnership } from './ownership.ts';
import { collectRoutePageDirectories } from './shared.ts';

const repoRoot = '/repo';
const leadsPage = 'frontend/src/pages/Leads';
const homepagePage = 'frontend/src/pages/Homepage';
const manageHomepagePage = 'frontend/src/pages/Homepage/ManageHomepage';
const routePageDirectories = [manageHomepagePage, homepagePage, leadsPage];

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

test('rejects imports against each shared dependency boundary', () => {
  const cases = [
    ['frontend/src/common/components/Example.tsx', '../features/leads/leads.api', /common components cannot import/],
    ['frontend/src/common/features/leads/leads.api.ts', '../../../pages/Leads/leads.api', /common features cannot import pages/],
    ['frontend/src/pages/Homepage/common/example.ts', '../ManageHomepage/private', /page-family common code cannot import/],
  ] as const;

  for (const [file, target, message] of cases) {
    const violations = violationsFor(
      checkFrontendOwnership,
      file,
      `import { example } from '${target}';`,
      routePageDirectories,
      repoRoot,
    );

    assert.equal(violations.length, 1);
    assert.match(violations[0], message);
  }
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

