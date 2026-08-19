import assert from 'node:assert/strict';
import test from 'node:test';

import { planCommands, selectTests } from './select-tests.js';

test('documentation-only changes do not select paid application jobs', () => {
  assert.deepEqual(planCommands(selectTests(['docs/operations/testing.md'])), []);
});

test('Task backend changes select Task and Timesheet integration suites', () => {
  const plan = selectTests(['backend/src/services/staff/tasks/taskService.ts']);

  assert.equal(plan.backendMode, 'focused');
  assert.deepEqual(plan.backendTestPaths, ['tests/tasks', 'tests/timesheets']);
  assert.equal(plan.frontend, false);
  assert.equal(plan.static, true);
});

test('domain backend changes select only their authoritative suite', () => {
  const plan = selectTests(['backend/src/services/preferenceService.ts']);

  assert.equal(plan.backendMode, 'focused');
  assert.deepEqual(plan.backendTestPaths, ['tests/preferences']);
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
  const plan = selectTests(['scripts/ci/select-tests.js', '.github/workflows/ci.yml']);

  assert.deepEqual(planCommands(plan), [['static', '']]);
});

test('deployment inputs preserve production validation and image routing', () => {
  for (const file of ['scripts/deploy.sh', 'nginx.conf']) {
    const plan = selectTests([file]);
    assert.equal(plan.deploy, true);
    assert.equal(plan.backendImage, true);
    assert.equal(plan.frontendImage, true);
    assert.equal(plan.compose, true);
  }
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
