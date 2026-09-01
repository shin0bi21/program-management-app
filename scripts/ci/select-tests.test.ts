import assert from 'node:assert/strict';
import test from 'node:test';

import { planCommands, selectTests } from './select-tests.ts';

test('documentation-only changes do not select paid application jobs', () => {
  assert.deepEqual(planCommands(selectTests(['docs/workflows/testing.md'])), []);
});

test('Task backend changes select Task and Hours integration suites', () => {
  const plan = selectTests(['backend/src/services/staff/tasks/taskService.ts']);

  assert.equal(plan.backendMode, 'focused');
  assert.deepEqual(plan.backendTestPaths, ['tests/tasks', 'tests/hours']);
  assert.equal(plan.frontend, false);
  assert.equal(plan.static, true);
});

test('domain backend changes select only their authoritative suite', () => {
  const cases = [
    ['backend/src/services/accounts/accountService.ts', ['tests/accounts']],
    ['backend/src/services/auth/authService.ts', ['tests/auth']],
    ['backend/src/services/programming/cohorts/cohortService.ts', ['tests/cohorts']],
    ['backend/src/services/homepageService.ts', ['tests/homepage']],
    ['backend/src/services/outreach/leads/leadService.ts', ['tests/public', 'tests/expressionOfInterest', 'tests/leads']],
    ['backend/src/services/preferenceService.ts', ['tests/preferences']],
    ['backend/src/services/programService.ts', ['tests/programs']],
    ['backend/src/routes/schoolRoutes.ts', ['tests/schools']],
    ['backend/src/services/youth/youthService.ts', ['tests/youth']],
  ] as const;

  for (const [file, testPaths] of cases) {
    const plan = selectTests([file]);

    assert.equal(plan.backendMode, 'focused', file);
    assert.deepEqual(plan.backendTestPaths, testPaths, file);
  }
});

test('shared backend files select every domain that consumes them', () => {
  const plan = selectTests(['backend/src/policies/staffResourcePolicy.ts']);

  assert.equal(plan.backendMode, 'focused');
  assert.deepEqual(plan.backendTestPaths, ['tests/tasks', 'tests/hours']);
});

test('domain-like source filenames do not receive focused coverage', () => {
  for (const file of [
    'backend/src/controllers/authorizationPolicy.ts',
    'backend/src/services/accountingService.ts',
  ]) {
    assert.equal(selectTests([file]).backendMode, 'full', file);
  }
});

test('shared backend and migration changes escalate to the full backend suite', () => {
  for (const file of ['backend/src/middleware/routeMiddleware.ts', 'backend/db/migrations/2026-08-18_example.sql']) {
    assert.equal(selectTests([file]).backendMode, 'full');
  }
});

test('frontend source changes use the Vitest dependency graph and require a build', () => {
  const plan = selectTests([
    'frontend/src/pages/Staff/Tasks/components/TaskListView/TaskListView.tsx',
  ]);

  assert.equal(plan.frontendMode, 'related');
  assert.equal(plan.frontend, true);
  assert.equal(plan.backend, false);
  assert.equal(plan.static, true);
});

test('frontend dependency changes conservatively run all frontend tests', () => {
  assert.equal(selectTests(['frontend/package-lock.json']).frontendMode, 'full');
});

test('CI planner changes select only static verification', () => {
  const plan = selectTests([
    'scripts/ci/select-tests.ts',
    'scripts/patterns/check-patterns.ts',
    '.github/workflows/ci.yml',
    'scripts/tests/check-doc-links.ts',
    'tsconfig.json',
  ]);

  assert.deepEqual(planCommands(plan), [['static', '']]);
});

test('shared TypeScript policy validates both applications without deployment', () => {
  const plan = selectTests(['tsconfig.base.json']);

  assert.deepEqual(planCommands(plan), [
    ['static', ''],
    ['backend-full', ''],
    ['frontend-full', ''],
  ]);
  assert.equal(plan.deploy, false);
  assert.equal(plan.backendImage, true);
  assert.equal(plan.frontendImage, true);
});

test('deployment inputs preserve production validation and image routing', () => {
  for (const file of ['scripts/deploy/main.sh', 'scripts/deploy/05-classify-changes.sh', 'nginx.conf']) {
    const plan = selectTests([file]);
    assert.equal(plan.deploy, true);
    assert.equal(plan.backendImage, true);
    assert.equal(plan.frontendImage, true);
    assert.equal(plan.compose, true);
  }
});

test('root Docker ignore changes validate both production images', () => {
  const plan = selectTests(['.dockerignore']);

  assert.equal(plan.static, true);
  assert.equal(plan.backendImage, true);
  assert.equal(plan.frontendImage, true);
});

test('unrecognized repository files fail closed with the complete application plan', () => {
  const plan = selectTests(['unexpected.config']);

  assert.deepEqual(planCommands(plan), [
    ['deploy', ''],
    ['static', ''],
    ['backend-full', ''],
    ['frontend-full', ''],
  ]);
});

test('main pull requests always validate production packaging', () => {
  const plan = selectTests(['docs/README.md'], { baseRef: 'main' });

  assert.equal(plan.backendImage, true);
  assert.equal(plan.frontendImage, true);
  assert.equal(plan.compose, true);
});
