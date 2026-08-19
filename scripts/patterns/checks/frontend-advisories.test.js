import assert from 'node:assert/strict';
import test from 'node:test';
import { checkFrontendAdvisories } from './frontend-advisories.js';

function advisoriesFor(file, source, options = {}) {
  const advisories = [];
  checkFrontendAdvisories(advisories, file, source, options);
  return advisories;
}

test('flags a route entry that renders a table instead of delegating to a view', () => {
  const file = 'frontend/src/pages/Leads/Leads.tsx';
  const advisories = advisoriesFor(file, 'export default function Leads() { return <Table />; }', {
    repositoryFiles: [file],
    routePageDirectories: ['frontend/src/pages/Leads'],
  });

  assert.match(advisories.join('\n'), /\[review-owner-boundary\].*renders Table directly/);
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
    advisoriesFor('frontend/src/common/features/things/ThingModal.tsx', source).join('\n'),
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
  const result = advisoriesFor('frontend/src/pages/Things/hooks/useThings.ts', source).join('\n');

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
    advisoriesFor('frontend/src/common/features/things/things.api.ts', source),
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
    advisoriesFor('frontend/src/common/components/SmallModal/SmallModal.tsx', source),
    [],
  );
});

test('allows a reviewed advisory to be suppressed only with a documented reason', () => {
  const source = `
    // pattern-advisory-ignore review-owner-boundary: this route is the intentionally focused list owner
    export default function Things() { return <Table />; }
  `;

  assert.deepEqual(advisoriesFor('frontend/src/pages/Things/Things.tsx', source, {
    routePageDirectories: ['frontend/src/pages/Things'],
  }), []);
});

test('does not honor a suppression without a reason', () => {
  const source = `
    // pattern-advisory-ignore review-owner-boundary:
    export default function Things() { return <Table />; }
  `;

  assert.match(advisoriesFor('frontend/src/pages/Things/Things.tsx', source, {
    routePageDirectories: ['frontend/src/pages/Things'],
  }).join('\n'), /\[review-owner-boundary\]/);
});

test('does not warn for a lean page orchestrator composed from owned hooks and views', () => {
  const file = 'frontend/src/pages/Things/Things.tsx';
  const source = `
    export default function Things() {
      const controls = useThingControls();
      const things = useThings(controls.filters);
      return <ThingListView controls={controls} things={things} />;
    }
  `;

  assert.deepEqual(advisoriesFor(file, source, {
    repositoryFiles: [
      file,
      'frontend/src/pages/Things/components/ThingListView/ThingListView.tsx',
      'frontend/src/pages/Things/hooks/useThings.ts',
    ],
    routePageDirectories: ['frontend/src/pages/Things'],
  }), []);
});
