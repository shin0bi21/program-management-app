import assert from 'node:assert/strict';
import test from 'node:test';
import { runEnforcementChecks } from './run.js';

const repoRoot = '/repo';

function violationsFor(file, source) {
  const violations = [];
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

test('routes page preference controls to their ownership check', () => {
  const violations = violationsFor(
    'frontend/src/pages/Example/hooks/useExampleControls.ts',
    "const { save } = useUserPreference('example-filters');\nsave({ hiddenColumns });",
  );
  assert.match(violations.join('\n'), /page-owned columnKeys/);
});

test('routes backend route files to async-handler enforcement', () => {
  const violations = violationsFor(
    'backend/src/routes/example.ts',
    "router.get('/example', handler);",
  );
  assert.match(violations.join('\n'), /asyncHandler/);
});

test('does not run application-specific rules for documentation files', () => {
  assert.deepEqual(violationsFor('docs/example.md', 'A documentation change.'), []);
});
