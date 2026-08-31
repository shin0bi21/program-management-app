import { join } from 'node:path';

import type { ScaffoldContext, ScaffoldPlan } from '../../index.ts';

export function dashboardPlan(context: ScaffoldContext, ownerPath: string, name: string): ScaffoldPlan {
  const owner = context.pageComponentsOwner(ownerPath, 'Dashboard');
  const directory = context.componentOwner(owner, name, 'Dashboard', 'Dashboard');
  const title = name.replace(/Dashboard$/, '');
  const component = context.sourceFile(join(directory, `${name}.tsx`), `
export default function ${name}() {
  return (
    <section aria-label="${title} dashboard">
      TODO: Compose the ${title} dashboard cards.
    </section>
  );
}
`);
  const test = context.sourceFile(join(directory, `${name}.test.tsx`), `
// Card owners retain card rendering and focused action tests; the route retains selected-context wiring.
import { describe, it } from 'vitest';

describe('${name}', () => {
  it.todo('composes selection-driven loading, unavailable, empty, and ready states');
  it.todo('wires dashboard-owned queries, cards, and cross-owner callbacks once');
});
`);

  return {
    files: new Map([
      [join(directory, `${name}.tsx`), component],
      [join(directory, `${name}.test.tsx`), test],
    ]),
  };
}
