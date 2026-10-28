import assert from 'node:assert/strict';
import test from 'node:test';

import { planCommands, selectTests, type TestPlan } from './select-tests.ts';

type PlanExpectation = Partial<TestPlan> & { commands?: ReturnType<typeof planCommands> };

function assertPlan(
  files: string[],
  expected: PlanExpectation,
  options?: Parameters<typeof selectTests>[1],
): void {
  const plan = selectTests(files, options);
  const { commands, ...fields } = expected;
  const context = files.join(', ');

  if (commands !== undefined) assert.deepEqual(planCommands(plan), commands, `${context}: commands`);
  for (const [key, value] of Object.entries(fields)) {
    assert.deepEqual(plan[key as keyof TestPlan], value, `${context}: ${key}`);
  }
}

test('documentation-only changes do not select paid application jobs', () => {
  assertPlan(['docs/workflows/testing.md'], { commands: [] });
});

test('Task backend changes select Task and Hours integration suites', () => {
  assertPlan(['backend/src/services/staff/tasks/taskService.ts'], {
    backendMode: 'focused',
    backendTestPaths: ['tests/tasks', 'tests/hours', 'tests/referenceData'],
    frontend: false,
    static: true,
  });
});

test('domain backend changes select only their authoritative suite', () => {
  const cases = [
    ['backend/src/services/accounts/accountService.ts', ['tests/accounts']],
    ['backend/src/services/auth/authService.ts', ['tests/auth']],
    ['backend/src/services/programming/cohorts/cohortService.ts', ['tests/cohorts', 'tests/referenceData']],
    ['backend/src/services/outreach/leads/leadService.ts', ['tests/public', 'tests/expressionOfInterest', 'tests/leads']],
    ['backend/src/services/preferenceService.ts', ['tests/preferences']],
    ['backend/src/services/programService.ts', ['tests/programs', 'tests/referenceData']],
    ['backend/src/routes/schoolRoutes.ts', ['tests/schools', 'tests/referenceData']],
    ['backend/src/services/youth/youthService.ts', ['tests/youth']],
  ] as const;

  for (const [file, testPaths] of cases) {
    assertPlan([file], { backendMode: 'focused', backendTestPaths: [...testPaths] });
  }
});

test('shared backend files select every domain that consumes them', () => {
  assertPlan(['backend/src/policies/staffResourcePolicy.ts'], {
    backendMode: 'focused',
    backendTestPaths: ['tests/tasks', 'tests/hours', 'tests/referenceData'],
  });

  for (const file of [
    'backend/src/controllers/homepageController.ts',
    'backend/src/routes/homepageRoutes.ts',
    'backend/src/services/homepageService.ts',
  ]) {
    assertPlan([file], {
      backendMode: 'focused',
      backendTestPaths: ['tests/homepage', 'tests/public', 'tests/expressionOfInterest', 'tests/leads'],
    });
  }
});

test('domain-like source filenames do not receive focused coverage', () => {
  for (const file of [
    'backend/src/controllers/authorizationPolicy.ts',
    'backend/src/services/accountingService.ts',
  ]) {
    assertPlan([file], { backendMode: 'full' });
  }
});

test('shared backend and migration changes escalate to the full backend suite', () => {
  for (const file of ['backend/src/middleware/routeMiddleware.ts', 'backend/db/migrations/2026-08-18_example.sql']) {
    assertPlan([file], { backendMode: 'full' });
  }
});

test('frontend source changes use the Vitest dependency graph and require a build', () => {
  assertPlan(['frontend/src/pages/Staff/Tasks/components/TaskListView/TaskListView.tsx'], {
    frontendMode: 'related',
    frontend: true,
    backend: false,
    static: true,
  });
});

test('frontend dependency changes conservatively run all frontend tests', () => {
  assertPlan(['frontend/package-lock.json'], { frontendMode: 'full' });
});

test('CI planner changes select only static verification', () => {
  assertPlan([
    'scripts/ci/select-tests.ts',
    'scripts/patterns/check-patterns.ts',
    '.github/workflows/ci.yml',
    'scripts/tests/check-doc-links.ts',
    'tsconfig.json',
  ], { commands: [['static', '']] });
});

test('shared TypeScript policy validates both applications without deployment', () => {
  assertPlan(['tsconfig.base.json'], {
    commands: [['static', ''], ['backend-full', ''], ['frontend-full', '']],
    deploy: false,
    backendImage: true,
    frontendImage: true,
  });
});

test('deployment inputs preserve production validation and image routing', () => {
  for (const file of ['scripts/deploy/main.sh', 'scripts/deploy/05-classify-changes.sh', 'nginx.conf']) {
    assertPlan([file], { deploy: true, backendImage: true, frontendImage: true, compose: true });
  }
});

test('root Docker ignore changes validate both production images', () => {
  assertPlan(['.dockerignore'], { static: true, backendImage: true, frontendImage: true });
});

test('unrecognized repository files fail closed with the complete application plan', () => {
  assertPlan(['unexpected.config'], {
    commands: [['deploy', ''], ['static', ''], ['backend-full', ''], ['frontend-full', '']],
  });
});

test('main pull requests always validate production packaging', () => {
  assertPlan(
    ['docs/README.md'],
    { backendImage: true, frontendImage: true, compose: true },
    { baseRef: 'main' },
  );
});

test('reference lookups select their HTTP matrix and Hours dashboard integration', () => {
  for (const path of [
    'backend/src/services/referenceData/staffReferenceData.ts',
    'backend/src/routes/referenceDataRoutes.ts',
    'backend/tests/referenceData/referenceData.test.ts',
  ]) {
    assertPlan([path], {
      backendMode: 'focused',
      backendTestPaths: ['tests/referenceData', 'tests/hours'],
    });
  }
});
