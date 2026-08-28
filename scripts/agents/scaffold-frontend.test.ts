import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { Project } from 'ts-morph';

const repoRoot = mkdtempSync(join(tmpdir(), 'frontend-scaffold-repo-'));
mkdirSync(join(repoRoot, 'frontend/src'), { recursive: true });
process.env.SCAFFOLD_REPO_ROOT = repoRoot;
const { scaffoldFrontend } = await import('./scaffold-frontend.ts');

function assertParses(path: string): void {
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  const source = project.addSourceFileAtPath(path);
  assert.equal(source.getPreEmitDiagnostics().filter(diagnostic => (
    diagnostic.getCode() === 1005
  )).length, 0);
}

test('previews a canonical page without writing files', () => {
  const files = scaffoldFrontend(['page', 'Staff/ExampleSchedule', '--dry-run']);

  assert.deepEqual(files, [
    'frontend/src/pages/Staff/ExampleSchedule/ExampleSchedule.tsx',
    'frontend/src/pages/Staff/ExampleSchedule/ExampleSchedule.test.tsx',
    'frontend/src/pages/Staff/ExampleSchedule/IMPLEMENTATION.md',
  ]);
  assert.equal(existsSync(join(repoRoot, files[0])), false);
});

test('creates a page with ordered orchestration sections and implementation checklist', () => {
  const name = `ScaffoldPage${Date.now()}`;
  const pagePath = `Temporary/${name}`;
  const files = scaffoldFrontend(['page', pagePath]);
  const componentPath = join(repoRoot, files[0]);
  const component = readFileSync(componentPath, 'utf8');
  const checklist = readFileSync(join(repoRoot, files[2]), 'utf8');

  assert.match(component, /Permissions and application services/);
  assert.ok(component.indexOf('Page data and preferences') < component.indexOf('Selection and page-spanning actions'));
  assert.ok(component.indexOf('Modal and confirmation workflows') < component.indexOf('body initialization'));
  assert.match(checklist, /Register the route and navigation entry/);
  assert.match(checklist, /## Test ownership/);
  assert.match(checklist, /### Table data hook and component/);
  assert.match(checklist, /Leave generic infinite-query and shared-table behavior to their shared suites/);
  assert.match(checklist, /Do not add table refresh or pagination cases to a calendar/);
  assert.match(checklist, /### Route page/);
  assertParses(componentPath);
});

test('creates a modal owner under a temporary frontend owner', () => {
  const relativeOwner = 'frontend/src/pages/Temporary/Example';
  const modalFiles = scaffoldFrontend(['modal', relativeOwner, 'ExampleModal']);

  assert.equal(modalFiles.length, 5);
  assert.match(readFileSync(join(repoRoot, modalFiles[0]), 'utf8'), /useExampleModal/);
  assertParses(join(repoRoot, modalFiles[0]));
});

test('creates table, calendar, and dashboard contract presets', () => {
  const relativeOwner = 'frontend/src/pages/Temporary/Presets/components';
  const tableFiles = scaffoldFrontend(['table', relativeOwner, 'ExampleTable']);
  const calendarFiles = scaffoldFrontend(['calendar', relativeOwner, 'ExampleCalendar']);
  const dashboardFiles = scaffoldFrontend(['dashboard', relativeOwner, 'ExampleDashboard']);

  assert.equal(tableFiles.length, 5);
  assert.equal(calendarFiles.length, 3);
  assert.equal(dashboardFiles.length, 3);
  assert.match(readFileSync(join(repoRoot, tableFiles[2]), 'utf8'), /domain query key/);
  assert.match(readFileSync(join(repoRoot, tableFiles[4]), 'utf8'), /generic pagination and rendering mechanics/);
  assert.match(readFileSync(join(repoRoot, calendarFiles[2]), 'utf8'), /only when records need page-owned adaptation/);
  assert.match(readFileSync(join(repoRoot, dashboardFiles[2]), 'utf8'), /only for dashboard-owned remote data/);
  assertParses(join(repoRoot, tableFiles[0]));
  assertParses(join(repoRoot, calendarFiles[0]));
  assertParses(join(repoRoot, dashboardFiles[0]));
});

test('rejects unsafe names, destinations, and overwrites', () => {
  assert.throws(() => scaffoldFrontend(['page', '../Outside']), /PascalCase|route family/);
  assert.throws(() => scaffoldFrontend(['modal', '../outside', 'ExampleModal']), /inside frontend\/src/);
  assert.throws(() => scaffoldFrontend(['table', 'frontend/src/pages', 'ExampleList']), /must end with Table/);
  assert.throws(() => scaffoldFrontend(['calendar', 'frontend/src/pages', 'bad-name']), /PascalCase/);
  assert.throws(() => scaffoldFrontend(['dashboard', 'frontend/src/pages', 'ExampleOverview']), /must end with Dashboard/);
  assert.throws(() => scaffoldFrontend(['overlay', 'frontend/src/pages', 'ExampleOverlay']), /Usage/);
  scaffoldFrontend(['page', 'Temporary/OverwriteExample']);
  assert.throws(() => scaffoldFrontend(['page', 'Temporary/OverwriteExample']), /Refusing to overwrite/);
});
