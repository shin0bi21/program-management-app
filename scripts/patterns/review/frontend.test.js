import assert from 'node:assert/strict';
import test from 'node:test';
import { reviewFrontendPatterns } from './frontend.js';

function findingsFor(file, source, options = {}) {
  const findings = [];
  reviewFrontendPatterns(findings, file, source, options);
  return findings;
}

test('flags a route entry that renders a table instead of delegating to a view', () => {
  const file = 'frontend/src/pages/Leads/Leads.tsx';
  const findings = findingsFor(file, 'export default function Leads() { return <Table />; }', {
    repositoryFiles: [file],
    routePageDirectories: ['frontend/src/pages/Leads'],
  });

  assert.match(findings.join('\n'), /\[review-owner-boundary\].*renders Table directly/);
});

test('flags a data route that renders an owned view without PageBody', () => {
  const file = 'frontend/src/pages/Users/Users.tsx';
  const source = `
    export default function Users() {
      return <main><PageHeader title="Users" /><UserTable /></main>;
    }
  `;
  const findings = findingsFor(file, source, {
    repositoryFiles: [file, 'frontend/src/pages/Users/Users.css'],
    routePageDirectories: ['frontend/src/pages/Users'],
  });

  assert.match(findings.join('\n'), /\[review-page-shell\].*UserTable.*without the shared PageBody/);
});

test('accepts a data route that delegates its owned view through PageBody', () => {
  const file = 'frontend/src/pages/Users/Users.tsx';
  const source = `
    export default function Users() {
      return <main><PageHeader title="Users" /><PageBody table={<UserTable />} /></main>;
    }
  `;

  assert.deepEqual(findingsFor(file, source, {
    repositoryFiles: [file, 'frontend/src/pages/Users/Users.css'],
    routePageDirectories: ['frontend/src/pages/Users'],
  }), []);
});

test('allows a route page to delegate all styling', () => {
  const file = 'frontend/src/pages/Login/Login.tsx';
  const findings = findingsFor(file, 'export default function Login() { return <AuthLayout />; }', {
    repositoryFiles: [file],
    routePageDirectories: ['frontend/src/pages/Login'],
  });

  assert.deepEqual(findings, []);
});

test('reports inline workflow behavior without scoring its complexity', () => {
  const source = `
    import { useEffect, useState } from 'react';
    import { saveThing } from './api/things.api';
    export default function ThingModal() {
      const [one] = useState(''); const [two] = useState('');
      const [three] = useState(''); const [four] = useState('');
      const [five] = useState(''); const [six] = useState('');
      const [seven] = useState(''); const [eight] = useState('');
      useEffect(() => {}, []); useEffect(() => {}, []);
      const handleSave = async () => saveThing();
      return <button onClick={handleSave}>Save</button>;
    }
  `;

  assert.match(
    findingsFor('frontend/src/common/features/things/ThingModal.tsx', source).join('\n'),
    /\[review-inline-workflow\]/,
  );
});

test('allows cohesive page-owned modal entry state', () => {
  const file = 'frontend/src/pages/Tasks/Tasks.tsx';
  const source = `
    import { useState } from 'react';
    export default function Tasks() {
      const [taskModalState] = useState(null);
      const [hoursModalState] = useState(null);
      return <TaskTable taskModalState={taskModalState} hoursModalState={hoursModalState} />;
    }
  `;

  assert.deepEqual(findingsFor(file, source, {
    repositoryFiles: [file, 'frontend/src/pages/Tasks/Tasks.css'],
    routePageDirectories: ['frontend/src/pages/Tasks'],
  }), []);
});

test('allows several route-owned selection and overlay targets without remote workflow signals', () => {
  const file = 'frontend/src/pages/Tasks/Tasks.tsx';
  const source = `
    import { useState } from 'react';
    export default function Tasks() {
      const [selection] = useState(null);
      const [taskModalState] = useState(null);
      const [hoursModalState] = useState(null);
      const [confirmationState] = useState(null);
      return <TaskPage selection={selection} taskModalState={taskModalState}
        hoursModalState={hoursModalState} confirmationState={confirmationState} />;
    }
  `;

  assert.deepEqual(findingsFor(file, source, {
    repositoryFiles: [file, 'frontend/src/pages/Tasks/Tasks.css'],
    routePageDirectories: ['frontend/src/pages/Tasks'],
  }), []);
});

test('reports a route page that owns cache or remote lifecycles', () => {
  const file = 'frontend/src/pages/Tasks/Tasks.tsx';
  const source = `
    import { useQueryClient } from '@tanstack/react-query';
    export default function Tasks() {
      const queryClient = useQueryClient();
      const refresh = () => queryClient.invalidateQueries({ queryKey: ['tasks'] });
      return <TaskPage onRefresh={refresh} />;
    }
  `;

  assert.match(findingsFor(file, source, {
    repositoryFiles: [file, 'frontend/src/pages/Tasks/Tasks.css'],
    routePageDirectories: ['frontend/src/pages/Tasks'],
  }).join('\n'), /\[review-inline-workflow\]/);
});

test('allows a Calendar owner to own one range loader and buffer-adapter effect', () => {
  const file = 'frontend/src/pages/Tasks/components/TaskCalendar/TaskCalendar.tsx';
  const source = `
    import { useEffect } from 'react';
    import { getTasks } from '../../../../common/features/tasks/tasks.api';
    export default function TaskCalendar({ calendarCacheRef, calendar }) {
      const loadRange = async () => getTasks();
      useEffect(() => {
        calendarCacheRef.current = { upsert: calendar.upsertItem };
      }, [calendar.upsertItem, calendarCacheRef]);
      return <TimelineCalendar load={loadRange} />;
    }
  `;

  assert.deepEqual(findingsFor(file, source, {
    repositoryFiles: [
      file,
      'frontend/src/pages/Tasks/components/TaskCalendar/TaskItem/TaskItem.tsx',
      'frontend/src/pages/Tasks/components/TaskCalendar/hooks/useTaskCalendarData.ts',
    ],
  }), []);
});

test('still reports mixed workflow state inside a Calendar owner', () => {
  const file = 'frontend/src/pages/Tasks/components/TaskCalendar/TaskCalendar.tsx';
  const source = `
    import { useEffect, useState } from 'react';
    import { getTasks } from '../../../../common/features/tasks/tasks.api';
    export default function TaskCalendar() {
      const [editorState] = useState(null);
      useEffect(() => {}, []);
      const loadRange = async () => getTasks();
      return <TimelineCalendar load={loadRange} editorState={editorState} />;
    }
  `;

  assert.match(findingsFor(file, source).join('\n'), /\[review-inline-workflow\]/);
});

test('flags response compatibility and empty-filter fallbacks outside API adapters', () => {
  const source = `
    export function useThings(filters) {
      const params = filters ?? {};
      return Array.isArray(response) ? response : response.data;
    }
  `;
  const result = findingsFor('frontend/src/pages/Things/hooks/useThings.ts', source).join('\n');

  assert.match(result, /not-ready query input/);
  assert.match(result, /response-shape compatibility/);
});

test('allows boundary normalization inside API adapters', () => {
  const source = `
    export function normalize(filters) {
      const params = filters ?? {};
      return Array.isArray(response) ? response : response.data;
    }
  `;

  assert.deepEqual(
    findingsFor('frontend/src/common/features/things/things.api.ts', source),
    [],
  );
});

test('flags an API-only contract exported from a page types file', () => {
  const file = 'frontend/src/pages/Things/types.ts';
  const findings = findingsFor(file, 'export interface SetThingInput { name: string }', {
    repositorySources: new Map([
      [file, 'export interface SetThingInput { name: string }'],
      ['frontend/src/pages/Things/things.api.ts', 'function save(input: SetThingInput) {}'],
    ]),
    routePageDirectories: ['frontend/src/pages/Things'],
  });

  assert.match(
    findings.join('\n'),
    /\[review-type-ownership\].*SetThingInput.*keep endpoint-only contracts in the API adapter/,
  );
});

test('flags a page-local contract exported from a page types file', () => {
  const file = 'frontend/src/pages/Things/types.ts';
  const findings = findingsFor(file, 'export type ThingModalState = null | { mode: \'add\' };', {
    repositorySources: new Map([
      [file, 'export type ThingModalState = null | { mode: \'add\' };'],
      ['frontend/src/pages/Things/Things.tsx', 'const state: ThingModalState = null;'],
    ]),
    routePageDirectories: ['frontend/src/pages/Things'],
  });

  assert.match(
    findings.join('\n'),
    /\[review-type-ownership\].*ThingModalState.*keep owner-local contracts beside that component, hook, or page/,
  );
});

test('allows a page type consumed by multiple sibling units', () => {
  const file = 'frontend/src/pages/Things/types.ts';
  const source = 'export interface Thing { id: string }';

  assert.deepEqual(findingsFor(file, source, {
    repositorySources: new Map([
      [file, source],
      ['frontend/src/pages/Things/hooks/useThings.ts', 'const thing: Thing = value;'],
      ['frontend/src/pages/Things/components/ThingTable/ThingTable.tsx', 'function Row({ thing }: { thing: Thing }) {}'],
    ]),
    routePageDirectories: ['frontend/src/pages/Things'],
  }), []);
});

test('does not warn only because a focused leaf has no components or hooks directory', () => {
  const source = `
    export default function SmallModal() {
      return <p>Focused content</p>;
    }
  `;

  assert.deepEqual(
    findingsFor('frontend/src/common/components/SmallModal/SmallModal.tsx', source),
    [],
  );
});

test('allows a reviewed finding to be suppressed only with a documented reason', () => {
  const source = `
    // pattern-review-ignore review-owner-boundary: this route is the intentionally focused list owner
    export default function Things() { return <Table />; }
  `;

  assert.deepEqual(findingsFor('frontend/src/pages/Things/Things.tsx', source, {
    repositoryFiles: ['frontend/src/pages/Things/Things.css'],
    routePageDirectories: ['frontend/src/pages/Things'],
  }), []);
});

test('does not honor a suppression without a reason', () => {
  const source = `
    // pattern-review-ignore review-owner-boundary:
    export default function Things() { return <Table />; }
  `;

  assert.match(findingsFor('frontend/src/pages/Things/Things.tsx', source, {
    routePageDirectories: ['frontend/src/pages/Things'],
  }).join('\n'), /\[review-owner-boundary\]/);
});

test('does not warn for a lean page orchestrator composed from owned hooks and views', () => {
  const file = 'frontend/src/pages/Things/Things.tsx';
  const source = `
    export default function Things() {
      const preferences = useThingPreferences();
      const filters = useThingFilters(preferences);
      const things = useThings(filters.applied);
      return <ThingTable filters={filters} preferences={preferences} things={things} />;
    }
  `;

  assert.deepEqual(findingsFor(file, source, {
    repositoryFiles: [
      file,
      'frontend/src/pages/Things/Things.css',
      'frontend/src/pages/Things/components/ThingTable/ThingTable.tsx',
      'frontend/src/pages/Things/hooks/useThingFilters.ts',
      'frontend/src/pages/Things/hooks/useThingPreferences.ts',
      'frontend/src/pages/Things/hooks/useThings.ts',
    ],
    routePageDirectories: ['frontend/src/pages/Things'],
  }), []);
});
