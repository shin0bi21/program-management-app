import assert from 'node:assert/strict';
import test from 'node:test';

import {
  checkCalendarDataHooks,
  checkPaginatedTables,
  checkResourceCalendars,
} from './frontend-views.js';

function violationsFor(check, ...args) {
  const violations = [];
  check(violations, ...args);
  return violations;
}

test('requires infinite-list queries to use the owning ListView hook and page size', () => {
  const violations = violationsFor(
    checkPaginatedTables,
    'frontend/src/pages/Staff/Tasks/components/TaskListView/useTasks.ts',
    'useInfiniteListQuery({ limit: 50 });',
  );

  assert.match(violations.join('\n'), /ListView remote-list hook/);
  assert.match(violations.join('\n'), /25-row cursor page size/);
});

test('accepts a standard infinite-list hook', () => {
  const violations = violationsFor(
    checkPaginatedTables,
    'frontend/src/pages/Staff/Tasks/components/TaskListView/hooks/useTasks.ts',
    'useInfiniteListQuery({ limit: 25 });',
  );

  assert.deepEqual(violations, []);
});

test('requires the complete paginated-table contract', () => {
  const violations = violationsFor(
    checkPaginatedTables,
    'frontend/src/pages/Staff/Tasks/components/TaskListView/TaskListView.tsx',
    '<Table hasNextPage={hasNextPage} />',
  );

  assert.match(violations[0], /loadingNextPage, onLoadNextPage/);
});

test('reports missing ResourceCalendar ownership, buffering, and lifecycle wiring', () => {
  const violations = violationsFor(
    checkResourceCalendars,
    'frontend/src/pages/Staff/Tasks/Tasks.tsx',
    '<ResourceCalendar />',
  );

  assert.match(violations.join('\n'), /usePeriodDataBuffer/);
  assert.match(violations.join('\n'), /\*CalendarView component/);
  assert.match(violations.join('\n'), /complete period lifecycle/);
});

test('accepts a fully wired page-owned ResourceCalendar view', () => {
  const source = `
    usePeriodDataBuffer();
    <ResourceCalendar
      onInitialPeriods={onInitialPeriods}
      onPeriodsBuilt={onPeriodsBuilt}
      onPeriodsReset={onPeriodsReset}
      positionStorageKey="tasks"
    />;
  `;
  const violations = violationsFor(
    checkResourceCalendars,
    'frontend/src/pages/Staff/Tasks/components/TaskCalendarView/TaskCalendarView.tsx',
    source,
  );

  assert.deepEqual(violations, []);
});

test('requires calendar-data hooks to live under their CalendarView', () => {
  const violations = violationsFor(
    checkCalendarDataHooks,
    'frontend/src/pages/Staff/Tasks/hooks/useTaskCalendarData.ts',
  );

  assert.match(violations[0], /CalendarView hooks directory/);
});
