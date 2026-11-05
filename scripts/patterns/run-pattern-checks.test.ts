import assert from 'node:assert/strict';
import test from 'node:test';
import { runEnforcementChecks } from './run-pattern-checks.ts';
import { filterDeletedFiles } from './utils.ts';

const repoRoot = '/repo';

function violationsFor(file: string, source: string): string[] {
  const violations: string[] = [];
  runEnforcementChecks(violations, file, source, repoRoot);
  return violations;
}

test('enforces centralized HTTP while allowing the transport owner', () => {
  const source = "fetch('/api/example');";

  assert.match(violationsFor('frontend/src/pages/Example/example.api.ts', source).join('\n'), /centralized API client/);
  assert.deepEqual(violationsFor('frontend/src/http/transport.ts', source), []);
});

test('retains focused endpoint methods and route-validated controller queries', () => {
  const adapter = 'frontend/src/pages/Example/example.api.ts';
  assert.match(violationsFor(adapter, "apiClient.put('/example/status', data);").join('\n'), /PATCH, not PUT/);
  assert.deepEqual(violationsFor(adapter, "apiClient.patch('/example/status', data);"), []);

  const controller = 'backend/src/controllers/example.ts';
  assert.match(violationsFor(controller, 'schema.parse(req.query);').join('\n'), /route-validated query/);
  assert.deepEqual(violationsFor(controller, 'const query = res.locals.validatedQuery;'), []);
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
