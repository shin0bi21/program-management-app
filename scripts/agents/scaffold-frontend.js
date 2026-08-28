#!/usr/bin/env node

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Project, QuoteKind } from 'ts-morph';

const REPO_ROOT = resolve(process.env.SCAFFOLD_REPO_ROOT ?? resolve(import.meta.dirname, '../..'));
const FRONTEND_ROOT = join(REPO_ROOT, 'frontend/src');
const PASCAL_CASE = /^[A-Z][A-Za-z0-9]*$/;
const FORMAT_SETTINGS = {
  convertTabsToSpaces: true,
  ensureNewLineAtEndOfFile: true,
  indentSize: 2,
};

function usage() {
  return `Usage:
  npm run scaffold:frontend -- page <RouteFamily/PageName> [--dry-run]
  npm run scaffold:frontend -- modal <owner-path> <NameModal> [--dry-run]
  npm run scaffold:frontend -- table <owner-path> <NameTable> [--dry-run]
  npm run scaffold:frontend -- calendar <owner-path> <NameCalendar> [--dry-run]
  npm run scaffold:frontend -- dashboard <owner-path> <NameDashboard> [--dry-run]

Examples:
  npm run scaffold:frontend -- page Staff/Schedules
  npm run scaffold:frontend -- modal frontend/src/pages/Staff/Schedules/components ScheduleModal
  npm run scaffold:frontend -- table frontend/src/pages/Staff/Schedules/components ScheduleTable
  npm run scaffold:frontend -- calendar frontend/src/pages/Staff/Schedules/components ScheduleCalendar
  npm run scaffold:frontend -- dashboard frontend/src/pages/Staff/Schedules/components ScheduleDashboard --dry-run`;
}

function toPosix(path) {
  return path.split(sep).join('/');
}

function relativeImport(fromDirectory, target) {
  const path = toPosix(relative(fromDirectory, target));
  return path.startsWith('.') ? path : `./${path}`;
}

function assertInside(path, boundary, label) {
  const pathFromBoundary = relative(boundary, path);
  if (pathFromBoundary.startsWith('..') || isAbsolute(pathFromBoundary)) {
    throw new Error(`${label} must stay inside ${toPosix(relative(REPO_ROOT, boundary))}.`);
  }
}

function assertPascalCase(name, label) {
  if (!PASCAL_CASE.test(name)) throw new Error(`${label} must use PascalCase.`);
}

function sourceFile(path, text) {
  const project = new Project({
    manipulationSettings: { quoteKind: QuoteKind.Single },
    skipAddingFilesFromTsConfig: true,
    useInMemoryFileSystem: true,
  });
  const file = project.createSourceFile(toPosix(path), text);
  file.formatText(FORMAT_SETTINGS);
  return file.getFullText();
}

function pagePlan(pagePath) {
  const normalizedPath = toPosix(pagePath).replace(/^\/+|\/+$/g, '');
  const parts = normalizedPath.split('/').filter(Boolean);
  if (parts.length < 2) throw new Error('Page path must include a route family and page name.');
  parts.forEach(part => assertPascalCase(part, 'Each page path segment'));

  const name = parts.at(-1);
  const directory = join(FRONTEND_ROOT, 'pages', ...parts);
  assertInside(directory, join(FRONTEND_ROOT, 'pages'), 'Page destination');

  const pageHeaderImport = relativeImport(directory, join(FRONTEND_ROOT, 'common/components/PageHeader/PageHeader'));
  const pageBodyImport = relativeImport(directory, join(FRONTEND_ROOT, 'common/components/PageBody/PageBody'));
  const implementation = `# ${name} implementation checklist

Use this checklist to replace the scaffold placeholders without changing the ownership order.

## Page implementation

- [ ] Define permissions and protected-route visibility.
- [ ] Add page-owned data and preference hooks only when the page needs them.
- [ ] Add selection and page-spanning action owners.
- [ ] Define modal and confirmation entry states beside their workflows.
- [ ] Replace the dashboard and primary-view placeholders with owned components.
- [ ] Wire loading, empty, error, and permission states.
- [ ] Register the route and navigation entry.

## Test ownership

Follow \`docs/workflows/testing.md#page-test-scaffold-sections\`. Keep each behavior at one owner and delete sections the page does not need.

### API adapter

- [ ] Cover domain transport and boundary behavior without repeating query or UI mechanics.

### Page-wide data hook

- [ ] Cover domain query composition, derived data, and only loading/error decisions owned here.

### Preferences, selection, and actions

- [ ] Cover restoration and saves, selection reconciliation, commands, locks, and mutation reconciliation at their respective owners.

### Table data hook and component

- [ ] Cover domain query/cursor inputs in the data hook and representative state, pagination, empty-copy, selection, and action wiring in the table component.
- [ ] Leave generic infinite-query and shared-table behavior to their shared suites.

### Calendar component and data adaptation

- [ ] Cover domain range loading, unavailable/retry wiring, item shaping, capabilities, selection, and supported callbacks.
- [ ] Do not add table refresh or pagination cases to a calendar without an explicit domain contract.

### Dashboard, modal, and focused components

- [ ] Cover domain composition, workflows, public rendering, accessibility, and emitted values at their narrowest owners.

### Route page

- [ ] Cover permissions, restored control wiring, view switching, selected context, entry paths, and cross-owner callbacks.

### Browser scenarios

- [ ] Add Playwright only when real layout, focus, scrolling, portals, pointers, or responsive behavior matters.

## Verification

- [ ] Run focused tests, builds, pattern checks, and \`git diff --check\`.
`;
  const component = sourceFile(join(directory, `${name}.tsx`), `
import PageBody from '${pageBodyImport}';
import PageHeader from '${pageHeaderImport}';

export default function ${name}() {
  // TODO: Page-local error state.

  // TODO: Permissions and application services.

  // TODO: Page data and preferences.

  // TODO: Selection and page-spanning actions.

  // TODO: Modal and confirmation workflows.

  // TODO: Table, calendar, dashboard, and body initialization.
  const dashboard = <p>${name} dashboard</p>;
  const primaryView = <p>${name} content</p>;

  // TODO: Derived errors and presentation state.

  // Render.
  return (
    <main className="page-container page-container--data">
      <PageHeader title="${name}" />
      <PageBody
        ariaLabel="${name} overview"
        dashboard={dashboard}
        table={primaryView}
      />
    </main>
  );
}
`);
  const test = sourceFile(join(directory, `${name}.test.tsx`), `
// Owns ${name} route composition and cross-owner wiring.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import ${name} from './${name}';

describe('${name}', () => {
  it('renders the page shell', () => {
    render(<${name} />);

    expect(screen.getByRole('heading', { name: '${name}' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '${name} overview' })).toBeInTheDocument();
  });
});
`);

  return {
    directories: [
      directory,
      join(directory, 'components'),
      join(directory, 'hooks/actions'),
      join(directory, 'hooks/data'),
      join(directory, 'hooks/preferences'),
      join(directory, 'hooks/selection'),
      join(directory, 'utils'),
    ],
    files: new Map([
      [join(directory, `${name}.tsx`), component],
      [join(directory, `${name}.test.tsx`), test],
      [join(directory, 'IMPLEMENTATION.md'), implementation],
    ]),
  };
}

function modalPlan(ownerPath, name) {
  assertPascalCase(name, 'Modal name');
  if (!name.endsWith('Modal')) throw new Error('Modal name must end with Modal.');
  const owner = resolve(REPO_ROOT, ownerPath);
  assertInside(owner, FRONTEND_ROOT, 'Modal owner');
  const directory = join(owner, name);
  const modalImport = relativeImport(directory, join(FRONTEND_ROOT, 'common/components/Modal/Modal'));
  const hookName = `use${name}`;
  const implementation = `# ${name} implementation checklist

- [ ] Define the page-owned target and every entry path.
- [ ] Define add/edit initialization and contextual field locks.
- [ ] Add draft transitions, validation, and dependent-field resets to \`hooks/${hookName}.ts\`.
- [ ] Query only data the caller does not already own and forward cancellation.
- [ ] Add exact mutation payloads, same-tick submit locking, retry, and failure recovery.
- [ ] Return the authoritative saved record before closing.
- [ ] Replace placeholder fields with shared form controls.
- [ ] Cover workflow transitions in the hook test and field wiring in the component test.
`;
  const component = sourceFile(join(directory, `${name}.tsx`), `
import Modal from '${modalImport}';

import ${hookName} from './hooks/${hookName}';

interface ${name}Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function ${name}({ isOpen, onClose }: ${name}Props) {
  const workflow = ${hookName}();

  return (
    <Modal
      isOpen={isOpen}
      title="${name.replace(/Modal$/, '')}"
      status={workflow.submitStatus}
      statusMessage={workflow.statusMessage}
      onClose={onClose}
    >
      <p>TODO: Add the ${name} form or focused workflow.</p>
    </Modal>
  );
}
`);
  const hook = sourceFile(join(directory, `hooks/${hookName}.ts`), `
export default function ${hookName}() {
  // TODO: Own initialization, draft state, validation, submission, and recovery here.
  return {
    submitStatus: 'idle' as const,
    statusMessage: undefined,
  };
}
`);
  const componentTest = sourceFile(join(directory, `${name}.test.tsx`), `
// Owns ${name} field wiring and emitted values.
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import ${name} from './${name}';

describe('${name}', () => {
  it('renders its dialog when open', () => {
    render(<${name} isOpen onClose={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: '${name.replace(/Modal$/, '')}' })).toBeInTheDocument();
  });
});
`);
  const hookTest = sourceFile(join(directory, `hooks/${hookName}.test.ts`), `
// Owns ${hookName} state transitions and observable effects.
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import ${hookName} from './${hookName}';

describe('${hookName}', () => {
  it('starts idle', () => {
    const { result } = renderHook(() => ${hookName}());

    expect(result.current.submitStatus).toBe('idle');
  });
});
`);

  return {
    directories: [directory, join(directory, 'hooks')],
    files: new Map([
      [join(directory, `${name}.tsx`), component],
      [join(directory, `${name}.test.tsx`), componentTest],
      [join(directory, `hooks/${hookName}.ts`), hook],
      [join(directory, `hooks/${hookName}.test.ts`), hookTest],
      [join(directory, 'IMPLEMENTATION.md'), implementation],
    ]),
  };
}

function componentOwner(ownerPath, name, suffix, label) {
  assertPascalCase(name, `${label} name`);
  if (!name.endsWith(suffix)) throw new Error(`${label} name must end with ${suffix}.`);
  const owner = resolve(REPO_ROOT, ownerPath);
  assertInside(owner, FRONTEND_ROOT, `${label} owner`);
  return join(owner, name);
}

function tablePlan(ownerPath, name) {
  const directory = componentOwner(ownerPath, name, 'Table', 'Table');
  const hookName = `use${name}Data`;
  const title = name.replace(/Table$/, '');
  const implementation = `# ${name} implementation checklist

- [ ] Define the row, filter, sorting, and query-key contracts.
- [ ] Implement cursor pagination through \`useInfiniteListQuery\` in \`hooks/${hookName}.ts\`.
- [ ] Forward loading, refreshing, unavailable/retry, and pagination state to the shared Table.
- [ ] Define domain empty and filtered-empty copy, columns, selection, permissions, and actions.
- [ ] Test domain query inputs in the hook and representative Table wiring in the component.
- [ ] Leave generic pagination and rendering mechanics to shared query and Table suites.
`;
  const component = sourceFile(join(directory, `${name}.tsx`), `
import ${hookName} from './hooks/${hookName}';

export default function ${name}() {
  const table = ${hookName}();

  return (
    <section aria-label="${title} table" data-loading={table.loading || undefined}>
      TODO: Connect the ${title} collection to the shared Table.
    </section>
  );
}
`);
  const hook = sourceFile(join(directory, `hooks/${hookName}.ts`), `
export default function ${hookName}() {
  // TODO: Own the domain query key, inputs, row shaping, and cursor adapter here.
  return {
    rows: [],
    loading: false,
  };
}
`);
  const test = sourceFile(join(directory, `${name}.test.tsx`), `
// Owns ${name} domain state, pagination, selection, and action wiring.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import ${name} from './${name}';

describe('${name}', () => {
  it('renders the table owner', () => {
    render(<${name} />);

    expect(screen.getByRole('region', { name: '${title} table' })).toBeInTheDocument();
  });
});
`);
  const hookTest = sourceFile(join(directory, `hooks/${hookName}.test.ts`), `
// Owns ${hookName} domain query inputs and row shaping.
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import ${hookName} from './${hookName}';

describe('${hookName}', () => {
  it('starts with no rows', () => {
    const { result } = renderHook(() => ${hookName}());

    expect(result.current.rows).toEqual([]);
  });
});
`);

  return {
    directories: [directory, join(directory, 'hooks')],
    files: new Map([
      [join(directory, `${name}.tsx`), component],
      [join(directory, `${name}.test.tsx`), test],
      [join(directory, `hooks/${hookName}.ts`), hook],
      [join(directory, `hooks/${hookName}.test.ts`), hookTest],
      [join(directory, 'IMPLEMENTATION.md'), implementation],
    ]),
  };
}

function calendarPlan(ownerPath, name) {
  const directory = componentOwner(ownerPath, name, 'Calendar', 'Calendar');
  const title = name.replace(/Calendar$/, '');
  const implementation = `# ${name} implementation checklist

- [ ] Define rows, filters, range API inputs, item ranges, and selection contracts.
- [ ] Connect range loading and unavailable/retry reporting through \`useDataBuffer\`.
- [ ] Map item capabilities and exact cell, selection, move, and resize callbacks supported by the domain.
- [ ] Add \`hooks/use${name}Data.ts\` with a colocated test only when records need page-owned adaptation.
- [ ] Add a domain \`${title}Item/\` owner with a colocated test only when item presentation is meaningful.
- [ ] Add a browser story and Playwright coverage only for real geometry, focus, pointer, or scrolling behavior.
- [ ] Leave generic buffering and TimelineCalendar mechanics to their shared suites.
`;
  const component = sourceFile(join(directory, `${name}.tsx`), `
export default function ${name}() {
  return (
    <section aria-label="${title} calendar">
      TODO: Connect ${title} range data to TimelineCalendar.
    </section>
  );
}
`);
  const test = sourceFile(join(directory, `${name}.test.tsx`), `
// Owns ${name} range, item, capability, selection, and action wiring.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import ${name} from './${name}';

describe('${name}', () => {
  it('renders the calendar owner', () => {
    render(<${name} />);

    expect(screen.getByRole('region', { name: '${title} calendar' })).toBeInTheDocument();
  });
});
`);

  return {
    directories: [directory],
    files: new Map([
      [join(directory, `${name}.tsx`), component],
      [join(directory, `${name}.test.tsx`), test],
      [join(directory, 'IMPLEMENTATION.md'), implementation],
    ]),
  };
}

function dashboardPlan(ownerPath, name) {
  const directory = componentOwner(ownerPath, name, 'Dashboard', 'Dashboard');
  const title = name.replace(/Dashboard$/, '');
  const implementation = `# ${name} implementation checklist

- [ ] Define the page-owned selection context passed into the dashboard.
- [ ] Compose dashboard-specific loading, unavailable, empty, and ready states.
- [ ] Add \`hooks/use${title}OverviewData.ts\` with a colocated test only for dashboard-owned remote data.
- [ ] Add domain-named \`*DashboardCard/\` owners with colocated tests only for meaningful card contracts.
- [ ] Keep page-wide actions in the page header and record-specific actions with their card owner.
- [ ] Test selection-driven composition, query enablement, card wiring, and cross-owner callbacks once.
`;
  const component = sourceFile(join(directory, `${name}.tsx`), `
export default function ${name}() {
  return (
    <section aria-label="${title} dashboard">
      TODO: Compose the ${title} dashboard cards.
    </section>
  );
}
`);
  const test = sourceFile(join(directory, `${name}.test.tsx`), `
// Owns ${name} selection-driven composition and card wiring.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import ${name} from './${name}';

describe('${name}', () => {
  it('renders the dashboard owner', () => {
    render(<${name} />);

    expect(screen.getByRole('region', { name: '${title} dashboard' })).toBeInTheDocument();
  });
});
`);

  return {
    directories: [directory],
    files: new Map([
      [join(directory, `${name}.tsx`), component],
      [join(directory, `${name}.test.tsx`), test],
      [join(directory, 'IMPLEMENTATION.md'), implementation],
    ]),
  };
}

function parseRequest(argv) {
  const dryRun = argv.includes('--dry-run');
  const positional = argv.filter(argument => argument !== '--dry-run');
  const [kind, ...args] = positional;
  if (kind === 'page' && args.length === 1) return { dryRun, plan: pagePlan(args[0]) };
  if (kind === 'modal' && args.length === 2) return { dryRun, plan: modalPlan(args[0], args[1]) };
  if (kind === 'table' && args.length === 2) return { dryRun, plan: tablePlan(args[0], args[1]) };
  if (kind === 'calendar' && args.length === 2) return { dryRun, plan: calendarPlan(args[0], args[1]) };
  if (kind === 'dashboard' && args.length === 2) return { dryRun, plan: dashboardPlan(args[0], args[1]) };
  throw new Error(usage());
}

function assertAvailable(plan) {
  const conflicts = [...plan.files.keys()].filter(existsSync);
  if (conflicts.length) {
    throw new Error(`Refusing to overwrite existing files:\n${conflicts.map(toPosix).join('\n')}`);
  }
}

export function scaffoldFrontend(argv) {
  const { dryRun, plan } = parseRequest(argv);
  assertAvailable(plan);
  const plannedFiles = [...plan.files.keys()].map(path => toPosix(relative(REPO_ROOT, path)));
  if (dryRun) return plannedFiles;

  plan.directories.forEach(directory => mkdirSync(directory, { recursive: true }));
  plan.files.forEach((contents, path) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, contents);
  });
  return plannedFiles;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const files = scaffoldFrontend(process.argv.slice(2));
    console.log(files.join('\n'));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
