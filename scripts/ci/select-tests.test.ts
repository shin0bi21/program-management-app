import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { planCommands, selectTests, type TestPlan } from './select-tests.ts';

type PlanExpectation = Partial<TestPlan> & { commands?: ReturnType<typeof planCommands> };

/**
 * Checks selected plan fields and optional commands for a changed-path scenario.
 * @param files - Repository-relative changed paths supplied to the shared selector.
 * @param expected - Plan fields and runner commands owned by the scenario.
 * @param options - Optional pull-request target controlling release packaging checks.
 * @example assertPlan(['README.md'], { commands: [] })
 */
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

test('scaffolding and repository reports select static verification', () => {
  for (const file of ['scripts/scaffold/frontend/index.ts', 'scripts/reports/file-changes-report.ts', 'data/reports/ci-history.json']) {
    assertPlan([file], { commands: [['static', '']] });
  }
});

test('backend changes are passed to Jest without a domain map', () => {
  assertPlan(['backend/src/services/staff/tasks/taskService.ts'], {
    backendMode: 'related',
    backendChangedPaths: ['src/services/staff/tasks/taskService.ts'],
    frontend: false,
    static: true,
  });
});

test('deduplicates changed inputs and preserves full coverage regardless of input order', () => {
  const paths = [
    'backend/src/routes/taskRoutes.ts',
    'backend/src/routes/hoursRoutes.ts',
  ];
  assertPlan([...paths, paths[0]], {
    backendMode: 'related',
    backendChangedPaths: ['src/routes/taskRoutes.ts', 'src/routes/hoursRoutes.ts'],
  });

  const sharedInput = 'backend/tests/shared/app.ts';
  for (const files of [[...paths, sharedInput], [sharedInput, ...paths]]) {
    assertPlan(files, { backendMode: 'full', backendChangedPaths: [] });
  }
});

test('CLI emits matching JSON, local commands, and GitHub output from stdin', (context) => {
  const script = fileURLToPath(new URL('./select-tests.ts', import.meta.url));
  const input = 'docs/guide.md\r\nbackend/src/routes/taskRoutes.ts\r\n';
  const plan = selectTests(['docs/guide.md', 'backend/src/routes/taskRoutes.ts']);
  const json = spawnSync(process.execPath, [script], { input, encoding: 'utf8' });
  assert.equal(json.status, 0, json.stderr);
  assert.deepEqual(JSON.parse(json.stdout), plan);

  const commands = spawnSync(process.execPath, [script, '--commands'], { input, encoding: 'utf8' });
  assert.equal(commands.status, 0, commands.stderr);
  assert.equal(commands.stdout, planCommands(plan).map(([name, value]) => `${name}\t${value}\n`).join(''));

  const directory = mkdtempSync(join(tmpdir(), 'test-selector-'));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const outputFile = join(directory, 'github-output');
  const github = spawnSync(process.execPath, [script, '--github-output', outputFile, '--base-ref', 'main'], {
    input,
    encoding: 'utf8',
  });
  assert.equal(github.status, 0, github.stderr);
  assert.equal(github.stdout, '');
  const outputs = readFileSync(outputFile, 'utf8');
  assert.match(outputs, /^backend_mode=related$/m);
  assert.match(outputs, /^backend_changed_paths=src\/routes\/taskRoutes\.ts$/m);
  assert.match(outputs, /^backend_image=true$/m);
  assert.match(outputs, /^frontend_image=true$/m);
  assert.match(outputs, /^compose=true$/m);
});

test('CLI validates arguments before reading input', () => {
  const script = fileURLToPath(new URL('./select-tests.ts', import.meta.url));
  for (const args of [['--base-ref'], ['--github-output'], ['--base-ref', '--commands'], ['--unknown']]) {
    const result = spawnSync(process.execPath, [script, ...args], { input: '', encoding: 'utf8' });
    assert.equal(result.status, 1, args.join(' '));
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /requires|Unknown argument/);
  }

  const help = spawnSync(process.execPath, [script, '--help'], { input: '', encoding: 'utf8' });
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /Usage:/);
});

test('backend configuration and migrations select the full backend suite', () => {
  for (const file of ['backend/jest.config.js', 'backend/tests/setup.ts', 'backend/db/migrations/2026-08-18_example.sql',
    'backend/db/schema/init.sql', 'backend/db/data/migrations/2026-11-04_1_seed.sql', 'backend/db/baseline.json']) {
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
    'scripts/patterns/run-pattern-checks.ts',
    '.github/workflows/ci.yml',
    'tsconfig.json',
  ], { commands: [['static', '']] });
});

test('application build inputs validate their owning suite and production image', () => {
  for (const file of ['backend/tsconfig.json', 'backend/tsconfig.build.json', 'backend/Dockerfile', 'backend/.dockerignore']) {
    assertPlan([file], {
      static: true, backendMode: 'full', frontend: false,
      backendImage: true, frontendImage: false,
    });
  }
  for (const file of ['frontend/tsconfig.json', 'frontend/tsconfig.node.json', 'frontend/Dockerfile', 'frontend/.dockerignore']) {
    assertPlan([file], {
      static: true, frontendMode: 'full', backend: false,
      frontendImage: true, backendImage: false,
    });
  }
});

test('deployment inputs preserve production validation and image routing', () => {
  for (const file of ['scripts/deploy/main.sh', 'scripts/deploy/05-classify-changes.sh', 'nginx.conf']) {
    assertPlan([file], { deploy: true, backendImage: true, frontendImage: true, compose: true });
  }
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

test('new domains and shared source files use dependency discovery without registration', () => {
  for (const file of [
    'backend/src/services/newDomain/newService.ts',
    'backend/src/controllers/newDomainController.ts',
    'backend/src/middleware/routeMiddleware.ts',
    'backend/tests/newDomain/newDomain.test.ts',
  ]) {
    assertPlan([file], {
      backendMode: 'related',
      backendChangedPaths: [file.slice('backend/'.length)],
      commands: [['static', ''], ['backend-related', file.slice('backend/'.length)]],
    });
  }
});
