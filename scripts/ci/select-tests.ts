#!/usr/bin/env node

import { appendFileSync } from 'node:fs';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

type BackendMode = 'none' | 'focused' | 'full';
type FrontendMode = 'none' | 'related' | 'full';

export interface TestPlan {
  static: boolean;
  deploy: boolean;
  backend: boolean;
  backendMode: BackendMode;
  backendTestPaths: string[];
  frontend: boolean;
  frontendMode: FrontendMode;
  backendImage: boolean;
  frontendImage: boolean;
  compose: boolean;
}

type PlanCommand = [command: string, value: string];

type SourceDirectory = `${string}/`;
type BackendDomain = {
  testPaths: readonly string[];
  sourceDirectories?: readonly SourceDirectory[];
  sourceFiles: readonly string[];
};

// Each domain declares its authoritative tests and the source files they own.
// Directories end in a slash; conventional files match exactly.
const BACKEND_DOMAINS = {
  accounts: {
    testPaths: ['tests/accounts'],
    sourceDirectories: ['services/accounts/'],
    sourceFiles: [
      'controllers/accountController.ts',
      'policies/accountPolicy.ts',
      'routes/accountRoutes.ts',
      'validation/accountSchemas.ts',
    ],
  },
  auth: {
    testPaths: ['tests/auth'],
    sourceDirectories: ['services/auth/'],
    sourceFiles: ['controllers/authController.ts', 'routes/authRoutes.ts', 'validation/authSchemas.ts'],
  },
  cohorts: {
    testPaths: ['tests/cohorts'],
    sourceDirectories: ['services/programming/cohorts/', 'services/programming/sessions/'],
    sourceFiles: ['controllers/cohortController.ts', 'routes/cohortRoutes.ts', 'validation/cohortSchemas.ts'],
  },
  homepage: {
    testPaths: ['tests/homepage'],
    sourceFiles: [
      'validation/homepageSchemas.ts',
    ],
  },
  outreach: {
    testPaths: ['tests/public', 'tests/expressionOfInterest', 'tests/leads'],
    sourceDirectories: ['services/outreach/'],
    sourceFiles: [
      'controllers/leadController.ts',
      'routes/leadRoutes.ts',
      'validation/leadNoteSchemas.ts',
      'validation/leadSchemas.ts',
      'validation/publicSchemas.ts',
    ],
  },
  preferences: {
    testPaths: ['tests/preferences'],
    sourceFiles: [
      'controllers/preferenceController.ts',
      'routes/preferenceRoutes.ts',
      'services/preferenceService.ts',
      'validation/preferenceSchemas.ts',
    ],
  },
  programs: {
    testPaths: ['tests/programs'],
    sourceFiles: [
      'controllers/programController.ts',
      'routes/programRoutes.ts',
      'services/programService.ts',
      'validation/programSchemas.ts',
    ],
  },
  schools: {
    testPaths: ['tests/schools'],
    sourceFiles: ['controllers/schoolController.ts', 'routes/schoolRoutes.ts', 'validation/schoolSchemas.ts'],
  },
  tasks: {
    testPaths: ['tests/tasks'],
    sourceDirectories: ['services/staff/tasks/'],
    sourceFiles: [
      'controllers/taskController.ts',
      'policies/taskPolicy.ts',
      'routes/taskRoutes.ts',
      'validation/taskSchemas.ts',
    ],
  },
  hours: {
    testPaths: ['tests/hours'],
    sourceDirectories: ['services/staff/hours/'],
    sourceFiles: [
      'controllers/hoursController.ts',
      'policies/hoursPolicy.ts',
      'routes/hoursRoutes.ts',
      'validation/hoursSchemas.ts',
    ],
  },
  youth: {
    testPaths: ['tests/youth'],
    sourceDirectories: ['services/youth/'],
    sourceFiles: [
      'controllers/youthController.ts',
      'routes/youthRoutes.ts',
      'validation/youthProfileNoteSchemas.ts',
      'validation/youthSchemas.ts',
    ],
  },
} as const satisfies Record<string, BackendDomain>;

type BackendSuite = keyof typeof BACKEND_DOMAINS;

const RELATED_BACKEND_SUITES: Partial<Record<BackendSuite, readonly BackendSuite[]>> = {
  tasks: ['hours'],
  hours: ['tasks'],
};

const SHARED_BACKEND_FILES: Readonly<Record<string, readonly BackendSuite[]>> = {
  'backend/src/policies/staffResourcePolicy.ts': ['tasks', 'hours'],
  'backend/src/controllers/homepageController.ts': ['homepage', 'outreach'],
  'backend/src/routes/homepageRoutes.ts': ['homepage', 'outreach'],
  'backend/src/services/homepageService.ts': ['homepage', 'outreach'],
};

// Match a backend source or test file to the smallest safe domain suite. Files
// without a known owner return null so the caller can fail closed to all tests.
function backendSuitesFor(file: string): BackendSuite[] | null {
  const sharedSuites = SHARED_BACKEND_FILES[file];
  if (sharedSuites) return [...sharedSuites];

  const sourcePath = file.startsWith('backend/src/') ? file.slice('backend/src/'.length) : null;

  for (const suite of Object.keys(BACKEND_DOMAINS) as BackendSuite[]) {
    const domain: BackendDomain = BACKEND_DOMAINS[suite];
    const ownsTest = domain.testPaths.some(testPath => file.startsWith(`backend/${testPath}/`));
    const ownsSource = sourcePath !== null && (
      domain.sourceFiles.includes(sourcePath)
      || domain.sourceDirectories?.some(directory => sourcePath.startsWith(directory))
    );

    if (ownsTest || ownsSource) return [suite, ...(RELATED_BACKEND_SUITES[suite] ?? [])];
  }

  return null;
}

// Start with no work selected. Each changed path only enables the checks it
// owns, keeping documentation-only and unrelated jobs off paid runners.
function emptyPlan(): TestPlan {
  return {
    static: false,
    deploy: false,
    backend: false,
    backendMode: 'none',
    backendTestPaths: [],
    frontend: false,
    frontendMode: 'none',
    backendImage: false,
    frontendImage: false,
    compose: false,
  };
}

// Unknown repository paths can affect either application, so their safe
// fallback is every local application check rather than an incomplete subset.
function enableFullApplication(plan: TestPlan): void {
  plan.static = true;
  plan.deploy = true;
  plan.backend = true;
  plan.backendMode = 'full';
  plan.frontend = true;
  plan.frontendMode = 'full';
}

// Classify repository-relative changed paths into static, application, and
// production checks. This function is the shared policy for local and CI runs.
export function selectTests(files: string[], { baseRef = 'develop' }: { baseRef?: string } = {}): TestPlan {
  const plan = emptyPlan();
  const backendSuites = new Set<BackendSuite>();

  for (const file of files.filter(Boolean)) {
    // Documentation changes do not need application runners.
    if (file.startsWith('docs/') || file.endsWith('.md')) continue;

    // Deployment inputs require both image builds and Compose validation.
    if (file.startsWith('scripts/deploy/') || file === 'scripts/tests/test-deploy.sh'
      || file === 'docker-compose.prod.yml' || file === 'nginx.conf') {
      plan.deploy = true;
      plan.static = true;
      plan.backendImage = true;
      plan.frontendImage = true;
      plan.compose = true;
      continue;
    }

    // Shared compiler policy can affect both applications; the root config
    // owns repository scripts only.
    if (file === 'tsconfig.base.json') {
      plan.static = true;
      plan.backend = true;
      plan.backendMode = 'full';
      plan.frontend = true;
      plan.frontendMode = 'full';
      plan.backendImage = true;
      plan.frontendImage = true;
      continue;
    }

    if (file === 'docker-compose.yml') {
      plan.static = true;
      plan.backend = true;
      plan.backendMode = 'full';
      plan.frontend = true;
      plan.frontendMode = 'full';
      continue;
    }

    // Automation and repository-policy changes validate their own static layer.
    if (file.startsWith('.github/workflows/') || file.startsWith('scripts/ci/')
      || file === 'scripts/tests/test-app.sh' || file === 'scripts/tests/test-static.sh'
      || /^scripts\/tests\/check-doc-links\.(?:js|ts)$/.test(file)
      || file.startsWith('.agents/skills/') || file === 'AGENTS.md'
      || file === 'eslint.config.js' || file === 'tsconfig.json'
      || file === 'package.json' || file === 'package-lock.json') {
      plan.static = true;
      continue;
    }

    // Runner changes can alter suite execution, so validate their whole layer.
    if (file.startsWith('scripts/tests/backend/')) {
      plan.static = true;
      plan.backend = true;
      plan.backendMode = 'full';
      continue;
    }

    if (file.startsWith('scripts/tests/frontend/')) {
      plan.static = true;
      plan.frontend = true;
      plan.frontendMode = 'full';
      continue;
    }

    if (file.startsWith('scripts/agents/') || file.startsWith('scripts/patterns/')
      || file.startsWith('scripts/reports/')) {
      plan.static = true;
      continue;
    }

    // Known backend owners use focused Jest paths. Shared infrastructure,
    // migrations, dependencies, and unknown backend paths run the full suite.
    if (file.startsWith('backend/')) {
      plan.static = true;
      plan.backend = true;
      if (/^backend\/(?:Dockerfile|\.dockerignore|package(?:-lock)?\.json)$/.test(file)) plan.backendImage = true;
      if (file.startsWith('backend/db/migrations/') || file.startsWith('backend/db/scripts/')
        || /^backend\/(?:package(?:-lock)?\.json|tsconfig.*\.json|jest.*)/.test(file)) {
        plan.backendMode = 'full';
        continue;
      }
      const suites = backendSuitesFor(file);
      if (!suites) {
        plan.backendMode = 'full';
      } else if (plan.backendMode !== 'full') {
        plan.backendMode = 'focused';
        suites.forEach(suite => backendSuites.add(suite));
      }
      continue;
    }

    // Source changes use Vitest's dependency graph, which includes the changed
    // unit's tests and tests for importing components and route pages. Tooling
    // or dependency changes run the complete frontend suite.
    if (file.startsWith('frontend/')) {
      if (file.startsWith('frontend/playwright/') || file === 'frontend/playwright.config.ts') continue;
      plan.static = true;
      plan.frontend = true;
      if (/^frontend\/(?:Dockerfile|\.dockerignore|package(?:-lock)?\.json)$/.test(file)) plan.frontendImage = true;
      if (file.startsWith('frontend/src/') && plan.frontendMode !== 'full') {
        plan.frontendMode = 'related';
      } else {
        plan.frontendMode = 'full';
      }
      continue;
    }

    // Both production Dockerfiles use the repository root as their context.
    if (file === '.dockerignore') {
      plan.static = true;
      plan.backendImage = true;
      plan.frontendImage = true;
      continue;
    }

    // New top-level paths are deliberately expensive until explicitly mapped.
    enableFullApplication(plan);
  }

  // Resolve selected backend domains into one deduplicated Jest invocation.
  if (plan.backendMode === 'focused') {
    plan.backendTestPaths = [...backendSuites]
      .flatMap(suite => BACKEND_DOMAINS[suite].testPaths)
      .filter((path, index, paths) => paths.indexOf(path) === index);
  }

  // Release pull requests always validate production packaging, even when the
  // individual changed paths would not select it for a feature pull request.
  if (baseRef === 'main') {
    plan.backendImage = true;
    plan.frontendImage = true;
    plan.compose = true;
  }
  return plan;
}

// Convert the plan into stable commands consumed by the local test-app runner.
export function planCommands(plan: TestPlan): PlanCommand[] {
  const commands: PlanCommand[] = [];
  if (plan.deploy) commands.push(['deploy', '']);
  if (plan.static) commands.push(['static', '']);
  if (plan.backendMode === 'full') commands.push(['backend-full', '']);
  if (plan.backendMode === 'focused') commands.push(['backend-focused', plan.backendTestPaths.join(' ')]);
  if (plan.frontendMode === 'full') commands.push(['frontend-full', '']);
  if (plan.frontendMode === 'related') commands.push(['frontend-related', '']);
  return commands;
}

// Convert the same plan to names suitable for GitHub job outputs.
function githubOutputs(plan: TestPlan): Record<string, string | boolean> {
  return {
    static: plan.static,
    deploy: plan.deploy,
    backend: plan.backend,
    backend_mode: plan.backendMode,
    backend_test_paths: plan.backendTestPaths.join(' '),
    frontend: plan.frontend,
    frontend_mode: plan.frontendMode,
    backend_image: plan.backendImage,
    frontend_image: plan.frontendImage,
    compose: plan.compose,
  };
}

// Changed paths are streamed over stdin by Git locally and in GitHub Actions.
async function readFiles(): Promise<string[]> {
  let input = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) input += chunk;
  return input.split(/\r?\n/).filter(Boolean);
}

// Support human-readable JSON, local command planning, and GitHub outputs from
// one entry point so CI cannot drift from the local --changed behavior.
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const outputIndex = args.indexOf('--github-output');
  const baseIndex = args.indexOf('--base-ref');
  const baseRef = baseIndex >= 0 ? args[baseIndex + 1] : 'develop';
  const plan = selectTests(await readFiles(), { baseRef });

  if (outputIndex >= 0) {
    const outputFile = args[outputIndex + 1];
    if (!outputFile) throw new Error('--github-output requires a file path');
    const lines = Object.entries(githubOutputs(plan)).map(([key, value]) => `${key}=${value}`);
    appendFileSync(outputFile, `${lines.join('\n')}\n`);
    return;
  }
  if (args.includes('--commands')) {
    for (const [command, value] of planCommands(plan)) console.log(`${command}\t${value}`);
    return;
  }
  console.log(JSON.stringify(plan, null, 2));
}

// Keep the exported planner testable without executing the command-line path.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
