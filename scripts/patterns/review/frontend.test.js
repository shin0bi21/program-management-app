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

test('advises review when a route page delegates all styling', () => {
  const file = 'frontend/src/pages/Login/Login.tsx';
  const findings = findingsFor(file, 'export default function Login() { return <AuthLayout />; }', {
    repositoryFiles: [file],
    routePageDirectories: ['frontend/src/pages/Login'],
  });

  assert.match(findings.join('\n'), /\[review-page-styles\].*no page-owned CSS/);
});

test('does not advise style review when the route owns CSS', () => {
  const file = 'frontend/src/pages/Login/Login.tsx';
  const findings = findingsFor(file, 'export default function Login() { return <AuthLayout />; }', {
    repositoryFiles: [file, 'frontend/src/pages/Login/Login.css'],
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
      return <ThingTableView filters={filters} preferences={preferences} things={things} />;
    }
  `;

  assert.deepEqual(findingsFor(file, source, {
    repositoryFiles: [
      file,
      'frontend/src/pages/Things/Things.css',
      'frontend/src/pages/Things/components/ThingTableView/ThingTableView.tsx',
      'frontend/src/pages/Things/hooks/useThingFilters.ts',
      'frontend/src/pages/Things/hooks/useThingPreferences.ts',
      'frontend/src/pages/Things/hooks/useThings.ts',
    ],
    routePageDirectories: ['frontend/src/pages/Things'],
  }), []);
});
