#!/usr/bin/env node

/**
 * SELECT TESTS — shared check planning for local runners and GitHub Actions.
 *
 * Flow: validate options → read changed paths → classify checks → emit a plan.
 * Reads newline-delimited paths from stdin. Prints JSON or local commands, or
 * appends outputs to --github-output FILE. Does not run the selected checks.
 *
 * Usage:
 *   git diff --name-only HEAD | node scripts/ci/select-tests.ts --commands
 *   node scripts/ci/select-tests.ts --help
 */

// ============================================================================
// 1. Imports
// ============================================================================

import { appendFileSync } from 'node:fs';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

// ============================================================================
// 2. Plan contracts
// ============================================================================

type BackendMode = 'none' | 'related' | 'full';
type FrontendMode = 'none' | 'related' | 'full';

export interface TestPlan {
  static: boolean;
  deploy: boolean;
  backend: boolean;
  backendMode: BackendMode;
  backendChangedPaths: string[];
  frontend: boolean;
  frontendMode: FrontendMode;
  backendImage: boolean;
  frontendImage: boolean;
  compose: boolean;
}

type PlanCommand = [command: string, value: string];

// ============================================================================
// 3. CLI arguments
// ============================================================================

interface CliOptions {
  baseRef: string;
  commands: boolean;
  githubOutput?: string;
  help: boolean;
}

function usage(): string {
  return `Usage: node scripts/ci/select-tests.ts [--base-ref REF] [--commands | --github-output FILE]

Read newline-delimited changed paths from stdin and plan checks without running them.

  --base-ref REF       Target branch; main also selects production packaging checks.
  --commands           Print tab-delimited commands for the local test runner.
  --github-output FILE Append job outputs to this GitHub Actions output file.
  -h, --help           Show this help.

Without an output option, print JSON. GitHub output takes precedence over commands.`;
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = { baseRef: 'develop', commands: false, help: false };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    switch (argument) {
      case '--base-ref':
      case '--github-output': {
        const value = args[index + 1];
        const valueName = argument === '--base-ref' ? 'a revision' : 'a file path';
        if (!value || value.startsWith('--')) {
          throw new Error(`${argument} requires ${valueName}`);
        }

        if (argument === '--base-ref') {
          options.baseRef = value;
        } else {
          options.githubOutput = value;
        }

        // Consume the value so it is not interpreted as the next option.
        index += 1;
        break;
      }

      case '--commands':
        options.commands = true;
        break;

      case '-h':
      case '--help':
        options.help = true;
        break;

      default:
        throw new Error(`Unknown argument: ${argument}`);
    }
  }

  return options;
}

// ============================================================================
// 4. Input collection
// ============================================================================

// Changed paths are streamed over stdin by Git locally and in GitHub Actions.
async function readFiles(): Promise<string[]> {
  process.stdin.setEncoding('utf8');

  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk;
  }

  return input.split(/\r?\n/).filter(Boolean);
}

// ============================================================================
// 5. Changed-path routing policy
// ============================================================================

// Start with no work selected. Each changed path only enables the checks it
// owns, keeping documentation-only and unrelated jobs off paid runners.
function emptyPlan(): TestPlan {
  return {
    static: false,
    deploy: false,
    backend: false,
    backendMode: 'none',
    backendChangedPaths: [],
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
  // Step 1. Start with no checks; paths can only add coverage.
  const plan = emptyPlan();
  const backendChangedPaths = new Set<string>();

  // Step 2. Classify each path, escalating unknown owners to full coverage.
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

    if (file.startsWith('scripts/scaffold/') || file.startsWith('scripts/patterns/')
      || file.startsWith('scripts/reports/')) {
      plan.static = true;
      continue;
    }

    // Application sources and test files go directly to Jest's dependency graph.
    // Database, configuration, and shared test setup changes require every suite.
    if (file.startsWith('backend/')) {
      plan.static = true;
      plan.backend = true;
      const affectsBackendImage = /^backend\/(?:Dockerfile|\.dockerignore|package(?:-lock)?\.json)$/.test(file);
      if (affectsBackendImage) {
        plan.backendImage = true;
      }

      const isSource = file.startsWith('backend/src/');
      const isTest = file.startsWith('backend/tests/');
      const isSharedTestSetup = file.startsWith('backend/tests/shared/') || file === 'backend/tests/setup.ts';
      if ((!isSource && !isTest) || isSharedTestSetup) {
        plan.backendMode = 'full';
        continue;
      }

      if (plan.backendMode !== 'full') {
        plan.backendMode = 'related';
        backendChangedPaths.add(file.slice('backend/'.length));
      }
      continue;
    }

    // Source changes use Vitest's dependency graph, which includes the changed
    // unit's tests and tests for importing components and route pages. Tooling
    // or dependency changes run the complete frontend suite.
    if (file.startsWith('frontend/')) {
      const belongsToBrowserSuite = file.startsWith('frontend/playwright/') || file === 'frontend/playwright.config.ts';
      if (belongsToBrowserSuite) {
        continue;
      }

      plan.static = true;
      plan.frontend = true;
      const affectsFrontendImage = /^frontend\/(?:Dockerfile|\.dockerignore|package(?:-lock)?\.json)$/.test(file);
      if (affectsFrontendImage) {
        plan.frontendImage = true;
      }

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

  // Step 3. Deduplicate changed inputs for Jest; it discovers the affected tests.
  if (plan.backendMode === 'related') {
    plan.backendChangedPaths = [...backendChangedPaths];
  }

  // Step 4. Release pull requests always validate production packaging, even when the
  // individual changed paths would not select it for a feature pull request.
  if (baseRef === 'main') {
    plan.backendImage = true;
    plan.frontendImage = true;
    plan.compose = true;
  }

  return plan;
}

// ============================================================================
// 6. Output representations
// ============================================================================

// Convert the plan into stable commands consumed by the local test-app runner.
export function planCommands(plan: TestPlan): PlanCommand[] {
  const commands: PlanCommand[] = [];
  if (plan.deploy) commands.push(['deploy', '']);
  if (plan.static) commands.push(['static', '']);
  if (plan.backendMode === 'full') commands.push(['backend-full', '']);
  if (plan.backendMode === 'related') commands.push(['backend-related', plan.backendChangedPaths.join(' ')]);
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
    backend_changed_paths: plan.backendChangedPaths.join(' '),
    frontend: plan.frontend,
    frontend_mode: plan.frontendMode,
    backend_image: plan.backendImage,
    frontend_image: plan.frontendImage,
    compose: plan.compose,
  };
}

// ============================================================================
// 7. Main workflow
// ============================================================================

async function main(): Promise<void> {
  // Step 1. Validate options before reading stdin or appending GitHub outputs.
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }

  // Step 2. Read changed paths and derive the shared local/CI test plan.
  const files = await readFiles();
  const plan = selectTests(files, { baseRef: options.baseRef });

  // Step 3. Emit the requested representation; selected checks are not executed.
  if (options.githubOutput) {
    const lines = Object.entries(githubOutputs(plan)).map(([key, value]) => `${key}=${value}`);
    appendFileSync(options.githubOutput, `${lines.join('\n')}\n`);
    return;
  }

  if (options.commands) {
    for (const [command, value] of planCommands(plan)) {
      console.log(`${command}\t${value}`);
    }
    return;
  }

  console.log(JSON.stringify(plan, null, 2));
}

// ============================================================================
// 8. Entrypoint
// ============================================================================

// Keep the exported planner testable without executing the command-line path.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
