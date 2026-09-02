import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import ts from 'typescript';

const repoRoot = mkdtempSync(join(tmpdir(), 'frontend-scaffold-repo-'));
mkdirSync(join(repoRoot, 'frontend/src'), { recursive: true });
process.env.SCAFFOLD_REPO_ROOT = repoRoot;
const { scaffoldFrontend } = await import('./index.ts');

function read(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

function assertParses(relativePath: string): void {
  const result = ts.transpileModule(read(relativePath), {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: relativePath,
    reportDiagnostics: true,
  });
  const errors = result.diagnostics?.filter(diagnostic => diagnostic.category === ts.DiagnosticCategory.Error) ?? [];
  assert.deepEqual(errors.map(diagnostic => ({ code: diagnostic.code, message: diagnostic.messageText })), []);
}

test('previews root and route-family pages without writing files', () => {
  assert.deepEqual(scaffoldFrontend(['page', 'Leads', '--dry-run']), [
    'frontend/src/pages/Leads/Leads.tsx',
    'frontend/src/pages/Leads/Leads.test.tsx',
  ]);
  assert.deepEqual(scaffoldFrontend(['page', 'Staff/ExampleSchedule', '--dry-run']), [
    'frontend/src/pages/Staff/ExampleSchedule/ExampleSchedule.tsx',
    'frontend/src/pages/Staff/ExampleSchedule/ExampleSchedule.test.tsx',
  ]);
  assert.equal(existsSync(join(repoRoot, 'frontend/src/pages/Leads')), false);
});

test('creates only the required page files with honest orchestration placeholders', () => {
  const files = scaffoldFrontend(['page', 'Temporary/ScaffoldPage']);

  assert.equal(files.length, 2);
  assert.equal(existsSync(join(repoRoot, 'frontend/src/pages/Temporary/ScaffoldPage/components')), false);
  assert.equal(existsSync(join(repoRoot, 'frontend/src/pages/Temporary/ScaffoldPage/hooks')), false);
  assert.match(read(files[0]), /Permissions and application services/);
  assert.match(read(files[0]), /Saved preferences, when this page has durable controls/);
  assert.match(read(files[0]), /Filter configuration passed to every page data view/);
  assert.match(read(files[1]), /it\.todo\('wires permissions, restored controls/);
  assert.match(read(files[1]), /cross-owner callbacks without repeating child behavior/);
  assertParses(files[0]);
  assertParses(files[1]);
});

test('creates a non-trivial modal workflow in page, nested, family-common, and feature owners', () => {
  const owners = [
    'frontend/src/pages/Leads/components',
    'frontend/src/pages/Staff/ExampleSchedule/components/ExamplePanel',
    'frontend/src/pages/Programming/common/components',
    'frontend/src/common/features/notes/components',
  ];

  owners.forEach((owner, index) => {
    const name = `Example${index}Modal`;
    const files = scaffoldFrontend(['modal', owner, name]);

    assert.equal(files.length, 4);
    assert.match(read(files[1]), /Shared Modal tests retain generic dialog/);
    assert.match(read(files[3]), /it\.todo\('validates and submits the exact command/);
    files.forEach(assertParses);
  });
});

test('creates focused table, calendar, and dashboard owners under page components', () => {
  const familyOwner = 'frontend/src/pages/Temporary/Presets/components';
  const rootOwner = 'frontend/src/pages/Leads/components';
  const tableFiles = scaffoldFrontend(['table', familyOwner, 'ExampleTable']);
  const calendarFiles = scaffoldFrontend(['calendar', familyOwner, 'ExampleCalendar']);
  const dashboardFiles = scaffoldFrontend(['dashboard', rootOwner, 'ExampleDashboard']);

  assert.equal(tableFiles.length, 4);
  assert.equal(calendarFiles.length, 2);
  assert.equal(dashboardFiles.length, 2);
  assert.match(read(tableFiles[1]), /controlled selection.*without owning selection state/);
  assert.match(read(tableFiles[3]), /filters, sorting, page size, cursor, and AbortSignal/);
  assert.match(read(calendarFiles[1]), /TimelineCalendar tests retain generic/);
  assert.match(read(dashboardFiles[1]), /Card owners retain card rendering/);
  [...tableFiles, ...calendarFiles, ...dashboardFiles].forEach(assertParses);
});

test('rejects unsupported page depths, invalid owners, names, and overwrites', () => {
  assert.throws(() => scaffoldFrontend(['page', 'Family/Area/Page']), /at most one route family/);
  assert.throws(() => scaffoldFrontend(['page', '../Outside']), /PascalCase|at most one route family/);
  assert.throws(() => scaffoldFrontend(['page', '/Outside']), /PascalCase/);
  assert.throws(() => scaffoldFrontend(['page', 'Family\\Outside']), /PascalCase/);
  assert.throws(
    () => scaffoldFrontend(['table', 'frontend/src/pages/Leads', 'LeadTable']),
    /page components directory/,
  );
  assert.throws(
    () => scaffoldFrontend(['calendar', 'frontend/src/pages/Programming/common/components', 'SharedCalendar']),
    /page components directory/,
  );
  assert.throws(
    () => scaffoldFrontend(['dashboard', 'frontend/src/common/components', 'ExampleDashboard']),
    /inside frontend\/src|page components directory/,
  );
  assert.throws(
    () => scaffoldFrontend(['modal', 'frontend/src/common/components', 'ExampleModal']),
    /page, page-family common, or common-feature/,
  );
  assert.throws(
    () => scaffoldFrontend(['modal', 'frontend/src/pages/Leads/components/hooks', 'ExampleModal']),
    /page, page-family common, or common-feature/,
  );
  assert.throws(
    () => scaffoldFrontend(['modal', 'frontend/src/pages/Leads/components', 'ExampleDialog']),
    /must end with Modal/,
  );
  assert.throws(
    () => scaffoldFrontend(['table', 'frontend/src/pages/Leads/components', 'ExampleList']),
    /must end with Table/,
  );
  for (const [kind, name] of [
    ['modal', 'Modal'],
    ['table', 'Table'],
    ['calendar', 'Calendar'],
    ['dashboard', 'Dashboard'],
  ]) {
    assert.throws(
      () => scaffoldFrontend([kind, 'frontend/src/pages/Leads/components', name]),
      /must include a domain name/,
    );
  }
  assert.throws(() => scaffoldFrontend(['overlay', 'frontend/src/pages', 'ExampleOverlay']), /Usage/);

  scaffoldFrontend(['page', 'Temporary/OverwriteExample']);
  assert.throws(() => scaffoldFrontend(['page', 'Temporary/OverwriteExample']), /Refusing to overwrite/);
});
