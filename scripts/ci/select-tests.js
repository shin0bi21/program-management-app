#!/usr/bin/env node

import { appendFileSync } from 'node:fs';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

// Backend domains map to their authoritative Jest directories. A domain can
// intentionally include consumer coverage, as Tasks and Hours do below.
const BACKEND_TEST_PATHS = {
  accounts: ['tests/accounts'],
  auth: ['tests/auth'],
  cohorts: ['tests/cohorts'],
  homepage: ['tests/homepage'],
  outreach: ['tests/public', 'tests/expressionOfInterest', 'tests/leads'],
  preferences: ['tests/preferences'],
  programs: ['tests/programs'],
  schools: ['tests/schools'],
  tasks: ['tests/tasks'],
  hours: ['tests/hours'],
  youth: ['tests/youth'],
};

// Match a backend source or test file to the smallest safe domain suite. Files
// without a known owner return null so the caller can fail closed to all tests.
function backendSuitesFor(file) {
  if (/backend\/(?:tests\/tasks\/|src\/(?:controllers\/taskController|policies\/taskPolicy|routes\/taskRoutes|services\/staff\/tasks\/|validation\/taskSchemas))/.test(file)) {
    return ['tasks', 'hours'];
  }
  if (/backend\/(?:tests\/hours\/|src\/(?:controllers\/hoursController|policies\/hoursPolicy|routes\/hoursRoutes|services\/staff\/hours\/|validation\/hoursSchemas))/.test(file)) {
    return ['hours', 'tasks'];
  }
  if (file === 'backend/src/policies/staffResourcePolicy.ts') return ['tasks', 'hours'];
  if (/backend\/(?:tests\/auth\/|src\/(?:controllers\/auth|routes\/auth|services\/auth|validation\/auth))/.test(file)) return ['auth'];
  if (/backend\/(?:tests\/accounts\/|src\/(?:controllers\/account|policies\/account|routes\/account|services\/account|validation\/account))/.test(file)) return ['accounts'];
  if (/backend\/(?:tests\/youth\/|src\/(?:controllers\/youth|routes\/youth|services\/youth|validation\/youth))/.test(file)) return ['youth'];
  if (/backend\/(?:tests\/schools\/|src\/(?:controllers\/school|routes\/school|services\/school|validation\/school))/.test(file)) return ['schools'];
  if (/backend\/(?:tests\/programs\/|src\/(?:controllers\/program|routes\/program|services\/programService|validation\/program))/.test(file)) return ['programs'];
  if (/backend\/(?:tests\/cohorts\/|src\/(?:controllers\/(?:cohort|session)|routes\/(?:cohort|session)|services\/(?:cohort|session|programming\/cohorts\/|programming\/sessions\/)|validation\/(?:cohort|session)))/.test(file)) return ['cohorts'];
  if (/backend\/(?:tests\/homepage\/|src\/(?:controllers\/homepage|routes\/homepage|services\/homepage|validation\/homepage))/.test(file)) return ['homepage'];
  if (/backend\/(?:tests\/preferences\/|src\/(?:controllers\/preference|routes\/preference|services\/preference|validation\/preference))/.test(file)) return ['preferences'];
  if (/backend\/(?:tests\/(?:leads|expressionOfInterest|public)\/|src\/(?:controllers\/(?:lead|expressionOfInterest|public)|routes\/(?:lead|expressionOfInterest|public)|services\/(?:lead|outreach\/)|validation\/(?:lead|expressionOfInterest|public)))/.test(file)) return ['outreach'];
  return null;
}

// Start with no work selected. Each changed path only enables the checks it
// owns, keeping documentation-only and unrelated jobs off paid runners.
function emptyPlan() {
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
function enableFullApplication(plan) {
  plan.static = true;
  plan.deploy = true;
  plan.backend = true;
  plan.backendMode = 'full';
  plan.frontend = true;
  plan.frontendMode = 'full';
}

// Classify repository-relative changed paths into static, application, and
// production checks. This function is the shared policy for local and CI runs.
export function selectTests(files, { baseRef = 'develop' } = {}) {
  const plan = emptyPlan();
  const backendSuites = new Set();

  for (const file of files.filter(Boolean)) {
    // Documentation changes do not need application runners.
    if (file.startsWith('docs/') || file.endsWith('.md')) continue;

    // Deployment inputs require both image builds and Compose validation.
    if (file === 'scripts/deploy.sh' || file === 'scripts/tests/test-deploy.sh'
      || file === 'docker-compose.prod.yml' || file === 'nginx.conf') {
      plan.deploy = true;
      plan.static = true;
      plan.backendImage = true;
      plan.frontendImage = true;
      plan.compose = true;
      continue;
    }

    // Automation and repository-policy changes validate their own static layer.
    if (file.startsWith('.github/workflows/') || file.startsWith('scripts/ci/')
      || file === 'scripts/tests/test-app.sh' || file === 'scripts/tests/test-static.sh'
      || file.startsWith('.agents/skills/') || file === 'AGENTS.md'
      || file === 'eslint.config.js' || file === 'package.json' || file === 'package-lock.json') {
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

    // New top-level paths are deliberately expensive until explicitly mapped.
    enableFullApplication(plan);
  }

  // Resolve selected backend domains into one deduplicated Jest invocation.
  if (plan.backendMode === 'focused') {
    plan.backendTestPaths = [...backendSuites]
      .flatMap(suite => BACKEND_TEST_PATHS[suite])
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
export function planCommands(plan) {
  const commands = [];
  if (plan.deploy) commands.push(['deploy', '']);
  if (plan.static) commands.push(['static', '']);
  if (plan.backendMode === 'full') commands.push(['backend-full', '']);
  if (plan.backendMode === 'focused') commands.push(['backend-focused', plan.backendTestPaths.join(' ')]);
  if (plan.frontendMode === 'full') commands.push(['frontend-full', '']);
  if (plan.frontendMode === 'related') commands.push(['frontend-related', '']);
  return commands;
}

// Convert the same plan to names suitable for GitHub job outputs.
function githubOutputs(plan) {
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
async function readFiles() {
  let input = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) input += chunk;
  return input.split(/\r?\n/).filter(Boolean);
}

// Support human-readable JSON, local command planning, and GitHub outputs from
// one entry point so CI cannot drift from the local --changed behavior.
async function main() {
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
