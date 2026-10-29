import assert from 'node:assert/strict';
import test from 'node:test';
import { runEnforcementChecks } from './index.ts';
import { filterDeletedFiles } from './utils.ts';

const repoRoot = '/repo';

function violationsFor(file: string, source: string): string[] {
  const violations: string[] = [];
  runEnforcementChecks(violations, file, source, repoRoot);
  return violations;
}

test('keeps dashboard naming checks on common components', () => {
  const violations = violationsFor(
    'frontend/src/common/components/ExampleOverview.tsx',
    'export function ExampleOverview() { return <ExampleDashboardCard />; }',
  );
  assert.match(violations.join('\n'), /structural dashboard owners/);
});

test('distinguishes a dashboard card from its data loading indicator', () => {
  const file = 'frontend/src/pages/Example/components/ExampleSetting.tsx';
  assert.match(violationsFor(file, '<DashboardCard title="Example" />').join('\n'), /DashboardCard naming/);
  assert.deepEqual(violationsFor(file, '<DashboardCardLoading label="Loading setting…" />'), []);
});

test('routes page preferences to their ownership check', () => {
  const violations = violationsFor(
    'frontend/src/pages/Example/hooks/useExamplePreferences.ts',
    "usePreferences({ key: 'example-filters', fields: { hiddenColumns: preferenceIds([]) } });",
  );
  assert.match(violations.join('\n'), /owning tableKeys/);
});

test('routes backend route files to async-handler enforcement', () => {
  const violations = violationsFor(
    'backend/src/routes/example.ts',
    "router.get('/example', handler);",
  );
  assert.match(violations.join('\n'), /asyncHandler/);
});

test('requires the final route handler itself to use asyncHandler', () => {
  const violations = violationsFor(
    'backend/src/routes/example.ts',
    "router.get('/example', handler /* asyncHandler(fakeHandler) */);",
  );

  assert.match(violations.join('\n'), /asyncHandler/);
});

test('ignores route-like source text outside the syntax tree', () => {
  const violations = violationsFor(
    'backend/src/routes/example.ts',
    `
      // router.get('/comment', handler);
      const example = "router.post('/string', handler);";
      router.get(
        '/example',
        middleware,
        asyncHandler(handler),
      );
    `,
  );

  assert.deepEqual(violations, []);
});

test('does not run application-specific rules for documentation files', () => {
  assert.deepEqual(violationsFor('docs/example.md', 'A documentation change.'), []);
});

test('removes unstaged deletions from the current repository inventory', () => {
  assert.deepEqual(
    filterDeletedFiles(
      ['frontend/src/pages/Leads/Leads.tsx', 'frontend/src/pages/Leads/api/leads.api.ts'],
      ['frontend/src/pages/Leads/api/leads.api.ts'],
    ),
    ['frontend/src/pages/Leads/Leads.tsx'],
  );
});
